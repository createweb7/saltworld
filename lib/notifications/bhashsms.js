// Salt World — BhashSMS adapter.
//
// Endpoint: http://bhashsms.com/api/sendmsg.php
// Params (GET): user, pass, sender, phone, text, priority, stype
//
// Credentials priority: process.env → integrations collection.

import { getDb } from '@/lib/mongo';

let _cache = { at: 0, cfg: null };
const CACHE_MS = 30_000;

export async function readBhashSmsConfig() {
  const now = Date.now();
  if (now - _cache.at < CACHE_MS && _cache.cfg) return _cache.cfg;
  const db = await getDb();
  const doc = await db.collection('integrations').findOne({ key: 'bhashsms' });
  const cfg = doc?.config || {};
  const merged = {
    user:     process.env.BHASHSMS_USER     || cfg.user     || '',
    password: process.env.BHASHSMS_PASSWORD || cfg.password || '',
    sender:   process.env.BHASHSMS_SENDER   || cfg.sender   || 'SLTWRD',
    baseUrl:  process.env.BHASHSMS_BASE_URL || cfg.baseUrl  || 'http://bhashsms.com/api/sendmsg.php',
    priority: cfg.priority || 'ndnd',
    stype:    cfg.stype    || 'normal',
    dltEntityId: process.env.BHASHSMS_DLT_ENTITY_ID || cfg.dltEntityId || '',
    dltTemplateId: process.env.BHASHSMS_DLT_TEMPLATE_ID || cfg.dltTemplateId || '',
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
  };
  _cache = { at: now, cfg: merged };
  return merged;
}

export function _resetBhashSmsCache() { _cache = { at: 0, cfg: null }; }

export async function bhashSmsIsConfigured() {
  const cfg = await readBhashSmsConfig();
  return Boolean(cfg.user && cfg.password && cfg.sender);
}

function normalizeIndianPhone(input, cc = '91') {
  const raw = String(input || '').trim().replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (!raw) return null;
  // BhashSMS domestic delivery: strip country code so number is 10 digits.
  if (raw.length === 10 && /^[6-9]/.test(raw)) return raw;
  if (raw.startsWith(cc) && raw.length === (cc.length + 10)) return raw.slice(cc.length);
  if (raw.length === 12 && raw.startsWith(cc)) return raw.slice(cc.length);
  if (/^[1-9][0-9]{9,14}$/.test(raw)) return raw; // international fallback
  return null;
}

async function loadTemplate(templateKey) {
  const db = await getDb();
  return db.collection('templates').findOne({ key: templateKey, channel: 'sms' });
}

/**
 * Interpolate a template body — {var} placeholders replaced by variable values.
 */
function renderTemplate(body, vars = {}) {
  return String(body || '').replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/**
 * Send a plain SMS via BhashSMS. If templateKey is provided, load its body from
 * the templates collection and interpolate. Otherwise send `text` verbatim.
 */
export async function sendBhashSms(args) {
  const cfg = await readBhashSmsConfig();
  if (!cfg.user || !cfg.password || !cfg.sender) {
    return { queued: false, error: 'bhashsms_not_configured' };
  }
  const phone = normalizeIndianPhone(args.to, cfg.defaultCountryCode);
  if (!phone) return { queued: false, error: 'invalid_phone' };

  let body = args.text;
  if (args.templateKey && !body) {
    const tpl = await loadTemplate(args.templateKey);
    if (!tpl) return { queued: false, error: 'template_not_found', details: args.templateKey };
    body = renderTemplate(tpl.body || '', args.variables || {});
  }
  if (!body) return { queued: false, error: 'text_required' };

  const params = new URLSearchParams({
    user:     cfg.user,
    pass:     cfg.password,
    sender:   cfg.sender,
    phone,
    text:     body,
    priority: cfg.priority,
    stype:    cfg.stype,
  });
  if (cfg.dltEntityId)   params.set('peid', cfg.dltEntityId);
  if (cfg.dltTemplateId) params.set('tempid', cfg.dltTemplateId);

  const url = `${cfg.baseUrl}?${params.toString()}`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { queued: false, error: 'bhashsms_api_error', status: res.status, details: text };
    // BhashSMS returns a plaintext body like 'MessageID:1234567' on success,
    // or an error string. We treat non-2xx or bodies containing 'invalid'/'fail'
    // as failures.
    const lower = text.toLowerCase();
    if (lower.includes('invalid') || lower.includes('fail') || lower.includes('error')) {
      return { queued: false, error: 'bhashsms_rejected', details: text.trim().slice(0, 300) };
    }
    const idMatch = text.match(/[0-9]{5,}/);
    return { queued: true, messageId: idMatch ? idMatch[0] : null, apiResponse: text.trim().slice(0, 300) };
  } catch (err) {
    return { queued: false, error: 'network_error', details: String(err?.message || err) };
  }
}
