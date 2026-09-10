// Centralised notification engine.
// Every user-visible event in the system should flow through here so
// (a) admins can enable/disable channels per event, and
// (b) providers can be swapped without touching business logic.
//
// Usage:
//   import { NOTIFY_EVENTS, emit } from '@/lib/notifications';
//   await emit(NOTIFY_EVENTS.BOOKING_CONFIRMATION, {
//     to: { phone, email }, customerId, context: {name, ref, ...},
//   });

import { randomUUID } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { sendWhatsappTemplate, whatsappIsConfigured } from '@/lib/whatsapp';
import { sendGallaboxTemplate, gallaboxIsConfigured } from '@/lib/notifications/gallabox';
import { sendBhashSms, bhashSmsIsConfigured } from '@/lib/notifications/bhashsms';

export const NOTIFY_EVENTS = {
  BOOKING_CONFIRMATION:       'booking_confirmation',
  BOOKING_REMINDER_24H:       'booking_reminder_24h',
  BOOKING_REMINDER_2H:        'booking_reminder_2h',
  BOOKING_CANCELLED:          'booking_cancelled',
  BOOKING_RESCHEDULED:        'booking_rescheduled',
  PAYMENT_CONFIRMATION:       'payment_confirmation',
  MEMBERSHIP_PURCHASED:       'membership_purchased',
  MEMBERSHIP_EXPIRY_REMINDER: 'membership_expiry_reminder',
  GIFT_CARD_PURCHASED:        'gift_card_purchased',
  GIFT_CARD_DELIVERED:        'gift_card_delivered',
  GIFT_CARD_REDEEMED:         'gift_card_redeemed',
  BIRTHDAY_WISHES:            'birthday_wishes',
  ANNIVERSARY_WISHES:         'anniversary_wishes',
  REFERRAL_REWARD_EARNED:     'referral_reward_earned',
  OTP_LOGIN:                  'otp_login',
};

const DEFAULT_CHANNELS_BY_EVENT = {
  [NOTIFY_EVENTS.BOOKING_CONFIRMATION]:       ['whatsapp', 'email'],
  [NOTIFY_EVENTS.BOOKING_REMINDER_24H]:       ['whatsapp'],
  [NOTIFY_EVENTS.BOOKING_REMINDER_2H]:        ['whatsapp', 'sms'],
  [NOTIFY_EVENTS.BOOKING_CANCELLED]:          ['whatsapp', 'email'],
  [NOTIFY_EVENTS.BOOKING_RESCHEDULED]:        ['whatsapp', 'email'],
  [NOTIFY_EVENTS.PAYMENT_CONFIRMATION]:       ['email'],
  [NOTIFY_EVENTS.MEMBERSHIP_PURCHASED]:       ['whatsapp', 'email'],
  [NOTIFY_EVENTS.MEMBERSHIP_EXPIRY_REMINDER]: ['whatsapp', 'email'],
  [NOTIFY_EVENTS.GIFT_CARD_PURCHASED]:        ['email'],
  [NOTIFY_EVENTS.GIFT_CARD_DELIVERED]:        ['whatsapp', 'email'],
  [NOTIFY_EVENTS.GIFT_CARD_REDEEMED]:         ['whatsapp'],
  [NOTIFY_EVENTS.BIRTHDAY_WISHES]:            ['whatsapp'],
  [NOTIFY_EVENTS.ANNIVERSARY_WISHES]:         ['whatsapp'],
  [NOTIFY_EVENTS.REFERRAL_REWARD_EARNED]:     ['whatsapp'],
  [NOTIFY_EVENTS.OTP_LOGIN]:                  ['whatsapp', 'sms'],
};

// Read the notifications provider selection singleton.
//   whatsapp: 'meta_cloud' | 'gallabox'   (default 'gallabox' since it's what user configured)
//   sms:      'bhashsms'                 (default 'bhashsms')
async function readProviderConfig(supabase) {
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'notification_providers').maybeSingle();
  const v = row?.value || {};
  return {
    whatsapp: v.whatsapp || 'gallabox',
    sms:      v.sms      || 'bhashsms',
  };
}

// Per-channel dispatcher. Each returns { sent:boolean, providerRef?:string, error?:string }.
// New channels (email, push) plug in here without touching call-sites.
async function dispatch(channel, event, payload) {
  const supabase = getSupabase();
  const providers = await readProviderConfig(supabase);

  if (channel === 'whatsapp') {
    // Route to the active WhatsApp provider (Gallabox or Meta Cloud).
    if (providers.whatsapp === 'gallabox') {
      if (!(await gallaboxIsConfigured())) {
        return { sent: false, error: 'gallabox_not_configured', provider: 'gallabox' };
      }
      const r = await sendGallaboxTemplate({
        to: payload.to?.phone || payload.to?.whatsapp,
        name: payload.to?.name || payload.context?.name,
        templateKey: event,
        variables: payload.context || {},
        orderedVariables: Object.keys(payload.context || {}),
      });
      return { sent: !!r.queued, providerRef: r.messageId, error: r.error, provider: 'gallabox' };
    }
    // Fallback: Meta Cloud
    if (!(await whatsappIsConfigured())) {
      return { sent: false, error: 'whatsapp_not_configured', provider: 'meta_cloud' };
    }
    const r = await sendWhatsappTemplate({
      to: payload.to?.phone || payload.to?.whatsapp,
      templateKey: event,
      variables: payload.context || {},
      orderedVariables: Object.keys(payload.context || {}),
    });
    return { sent: !!r.queued, providerRef: r.messageId, error: r.error, provider: 'meta_cloud' };
  }

  if (channel === 'sms') {
    if (providers.sms === 'bhashsms') {
      if (!(await bhashSmsIsConfigured())) {
        return { sent: false, error: 'bhashsms_not_configured', provider: 'bhashsms' };
      }
      const r = await sendBhashSms({
        to: payload.to?.phone,
        templateKey: event,
        variables: payload.context || {},
      });
      return { sent: !!r.queued, providerRef: r.messageId, error: r.error, provider: 'bhashsms' };
    }
    return { sent: false, error: 'sms_provider_not_selected' };
  }

  if (channel === 'email') {
    // TODO: wire SendGrid / SES / Postmark when keys are provided.
    return { sent: false, error: 'email_not_configured' };
  }
  return { sent: false, error: 'unknown_channel' };
}

// Persist a communications row for audit.
async function record(supabase, { event, channel, payload, result, retries = 0 }) {
  await supabase.from('communications').insert({
    id: randomUUID(),
    customer_id: payload.customerId || null,
    channel,
    status: result.sent ? 'sent' : 'failed',
    created_at: new Date().toISOString(),
    data: {
      event, to: payload.to || null, bookingId: payload.bookingId || null, branchId: payload.branchId || null,
      payload: payload.context || {}, providerRef: result.providerRef || null, retries, error: result.error || null,
      sentAt: new Date().toISOString(),
    },
  });
}

// Load channel overrides from the notification-events settings singleton.
// Absent → fall back to DEFAULT_CHANNELS_BY_EVENT.
async function channelsForEvent(supabase, event) {
  const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'notification_events').maybeSingle();
  const cfg = row?.value?.[event];
  if (Array.isArray(cfg?.channels)) return cfg.channels;
  return DEFAULT_CHANNELS_BY_EVENT[event] || [];
}

/**
 * Fire a notification event across every enabled channel. Non-blocking by
 * default — the caller can `await emit(...)` if they want a summary.
 *
 * @returns Array of { channel, sent, providerRef?, error? }
 */
export async function emit(event, payload = {}) {
  const supabase = getSupabase();
  const channels = await channelsForEvent(supabase, event);
  const results = [];
  for (const channel of channels) {
    try {
      const result = await dispatch(channel, event, payload);
      await record(supabase, { event, channel, payload, result });
      results.push({ channel, ...result });
    } catch (e) {
      const errResult = { sent: false, error: String(e?.message || e) };
      await record(supabase, { event, channel, payload, result: errResult });
      results.push({ channel, ...errResult });
    }
  }
  return results;
}

// Retry entrypoint — called by /api/admin/notifications/retry/:id.
export async function retry(communicationId) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('communications').select('*').eq('id', communicationId).maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };
  if (row.status === 'sent') return { ok: true, alreadySent: true };
  const d = row.data || {};
  const result = await dispatch(row.channel, d.event, {
    to: d.to || {}, context: d.payload || {}, customerId: row.customer_id, bookingId: d.bookingId,
  });
  await supabase.from('communications').update({
    status: result.sent ? 'sent' : 'failed',
    data: { ...d, providerRef: result.providerRef || null, error: result.error || null, retries: (d.retries || 0) + 1, retriedAt: new Date().toISOString() },
  }).eq('id', communicationId);
  return { ok: result.sent, error: result.error };
}
