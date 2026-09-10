// WhatsApp Cloud API helper — outbound template messages only (v1, no webhook).
// Reads config from process.env first, falls back to the integrations collection
// so the admin can configure keys via Admin → Settings → Integrations.

import { getSupabase } from '@/lib/supabase';

let _cache = { at: 0, cfg: null };
const CACHE_MS = 30_000;

async function readConfig() {
  const now = Date.now();
  if (now - _cache.at < CACHE_MS && _cache.cfg) return _cache.cfg;
  const supabase = getSupabase();
  const { data: row } = await supabase.from('integrations').select('value').eq('key', 'whatsapp').maybeSingle();
  const cfg = row?.value?.config || {};
  const merged = {
    token: process.env.WHATSAPP_CLOUD_API_TOKEN || cfg.accessToken || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || cfg.phoneNumberId || '',
    apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || cfg.apiVersion || 'v21.0',
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
  };
  _cache = { at: now, cfg: merged };
  return merged;
}

export async function whatsappIsConfigured() {
  const cfg = await readConfig();
  return Boolean(cfg.token && cfg.phoneNumberId);
}

/**
 * Normalise a phone number to E.164 digits-only form (no leading `+`).
 * Meta accepts either +91… or 91… — we return 91… to match the docs example.
 */
export function normalizeE164(phoneInput, countryCode = '91') {
  const raw = String(phoneInput || '').trim();
  const cleaned = raw.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (!cleaned) return null;
  if (cleaned.startsWith(countryCode) && cleaned.length >= 11 && cleaned.length <= 15) {
    return cleaned;
  }
  if (/^[0-9]{10}$/.test(cleaned)) return `${countryCode}${cleaned}`;
  if (/^[1-9][0-9]{9,14}$/.test(cleaned)) return cleaned;
  return null;
}

async function loadTemplate(templateKey) {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('templates').select('data').eq('key', templateKey).eq('channel', 'whatsapp').maybeSingle();
  return row?.data || null;
}

/**
 * Send a template WhatsApp message. Falls back to a queued record if not configured.
 *
 * @param {{to:string, templateKey?:string, templateName?:string, languageCode?:string,
 *          variables?:object, orderedVariables?:string[]}} args
 * @returns {{queued:boolean, messageId?:string, error?:string, details?:any}}
 */
export async function sendWhatsappTemplate(args) {
  const cfg = await readConfig();
  const to = normalizeE164(args.to, cfg.defaultCountryCode);
  if (!to) return { queued: false, error: 'invalid_phone' };

  if (!cfg.token || !cfg.phoneNumberId) {
    return { queued: false, error: 'whatsapp_not_configured' };
  }

  let templateName = args.templateName;
  let languageCode = args.languageCode || 'en';
  let orderedVars = args.orderedVariables || null;
  if (args.templateKey) {
    const tpl = await loadTemplate(args.templateKey);
    if (!tpl) return { queued: false, error: 'template_not_found', details: args.templateKey };
    templateName = tpl.name || args.templateKey;
    languageCode = tpl.language || languageCode;
    orderedVars = orderedVars || tpl.variables || [];
  }
  if (!templateName) return { queued: false, error: 'template_name_required' };

  const bodyParams = (orderedVars || []).map((k) => ({
    type: 'text',
    text: String((args.variables || {})[k] ?? ''),
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(bodyParams.length ? { components: [{ type: 'body', parameters: bodyParams }] } : {}),
    },
  };

  const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { queued: false, error: 'whatsapp_api_error', status: res.status, details: errText };
    }
    const data = await res.json();
    const messageId = data?.messages?.[0]?.id || null;
    return { queued: true, messageId, apiResponse: data };
  } catch (err) {
    return { queued: false, error: 'network_error', details: String(err?.message || err) };
  }
}

export function _resetWhatsappCache() {
  _cache = { at: 0, cfg: null };
}
