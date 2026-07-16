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
import { getDb } from '@/lib/mongo';
import { sendWhatsappTemplate, whatsappIsConfigured } from '@/lib/whatsapp';

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

// Per-channel dispatcher. Each returns { sent:boolean, providerRef?:string, error?:string }.
// New channels (SMS, email, push) plug in here without touching call-sites.
async function dispatch(channel, event, payload) {
  if (channel === 'whatsapp') {
    if (!(await whatsappIsConfigured())) {
      return { sent: false, error: 'whatsapp_not_configured' };
    }
    const r = await sendWhatsappTemplate({
      to: payload.to?.phone || payload.to?.whatsapp,
      templateKey: event,
      variables: payload.context || {},
      orderedVariables: Object.keys(payload.context || {}),
    });
    return { sent: !!r.queued, providerRef: r.messageId, error: r.error };
  }
  if (channel === 'email') {
    // TODO: wire SendGrid / SES / Postmark when keys are provided.
    return { sent: false, error: 'email_not_configured' };
  }
  if (channel === 'sms') {
    // TODO: wire MSG91 / Twilio when keys are provided.
    return { sent: false, error: 'sms_not_configured' };
  }
  return { sent: false, error: 'unknown_channel' };
}

// Persist a communications row for audit.
async function record(db, { event, channel, payload, result, retries = 0 }) {
  await db.collection('communications').insertOne({
    id: randomUUID(),
    event,
    channel,
    to:          payload.to || null,
    customerId:  payload.customerId || null,
    bookingId:   payload.bookingId  || null,
    branchId:    payload.branchId   || null,
    payload:     payload.context || {},
    status:      result.sent ? 'sent' : 'failed',
    providerRef: result.providerRef || null,
    retries,
    error:       result.error || null,
    sentAt:      new Date().toISOString(),
  });
}

// Load channel overrides from the notification-events settings singleton.
// Absent → fall back to DEFAULT_CHANNELS_BY_EVENT.
async function channelsForEvent(db, event) {
  const doc = await db.collection('settings').findOne({ key: 'notification_events' });
  const cfg = doc?.value?.[event];
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
  const db = await getDb();
  const channels = await channelsForEvent(db, event);
  const results = [];
  for (const channel of channels) {
    try {
      const result = await dispatch(channel, event, payload);
      await record(db, { event, channel, payload, result });
      results.push({ channel, ...result });
    } catch (e) {
      const errResult = { sent: false, error: String(e?.message || e) };
      await record(db, { event, channel, payload, result: errResult });
      results.push({ channel, ...errResult });
    }
  }
  return results;
}

// Retry entrypoint — called by /api/admin/notifications/retry/:id.
export async function retry(communicationId) {
  const db = await getDb();
  const doc = await db.collection('communications').findOne({ id: communicationId });
  if (!doc) return { ok: false, error: 'not_found' };
  if (doc.status === 'sent') return { ok: true, alreadySent: true };
  const result = await dispatch(doc.channel, doc.event || doc.templateId, {
    to: doc.to || {},
    context: doc.payload || {},
    customerId: doc.customerId,
    bookingId: doc.bookingId,
  });
  await db.collection('communications').updateOne(
    { id: communicationId },
    { $set: { status: result.sent ? 'sent' : 'failed', providerRef: result.providerRef || null, error: result.error || null, retries: (doc.retries || 0) + 1, retriedAt: new Date().toISOString() } },
  );
  return { ok: result.sent, error: result.error };
}
