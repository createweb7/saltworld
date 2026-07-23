// Salt World — Gallabox WhatsApp adapter.
//
// Docs: https://developers.gallabox.com/gallabox-api/whatsapp-templates
// Endpoint: POST https://server.gallabox.com/devapi/messages/whatsapp
//   headers: { apiKey, apiSecret, Content-Type: application/json }
//   body: { channelId, channelType:'whatsapp',
//           recipient:{name, phone}, type:'template',
//           templateName, bodyValues:{'1':'x','2':'y',...} }
//
// Credentials priority: process.env → integrations collection (admin-configured).

import { getDb } from '@/lib/mongo';

let _cache = { at: 0, cfg: null };
const CACHE_MS = 30_000;

export async function readGallaboxConfig() {
  const now = Date.now();
  if (now - _cache.at < CACHE_MS && _cache.cfg) return _cache.cfg;
  const db = await getDb();
  const doc = await db.collection('integrations').findOne({ key: 'gallabox' });
  const cfg = doc?.config || {};
  const merged = {
    apiKey:    process.env.GALLABOX_API_KEY    || cfg.apiKey    || '',
    apiSecret: process.env.GALLABOX_API_SECRET || cfg.apiSecret || '',
    channelId: process.env.GALLABOX_CHANNEL_ID || cfg.channelId || '',
    baseUrl:   process.env.GALLABOX_BASE_URL   || cfg.baseUrl   || 'https://server.gallabox.com/devapi',
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
  };
  _cache = { at: now, cfg: merged };
  return merged;
}

export function _resetGallaboxCache() { _cache = { at: 0, cfg: null }; }

export async function gallaboxIsConfigured() {
  const cfg = await readGallaboxConfig();
  return Boolean(cfg.apiKey && cfg.apiSecret && cfg.channelId);
}

function normalizePhone(input, cc = '91') {
  const raw = String(input || '').trim().replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (!raw) return null;
  if (raw.startsWith(cc) && raw.length >= 11 && raw.length <= 15) return raw;
  if (/^[0-9]{10}$/.test(raw)) return `${cc}${raw}`;
  if (/^[1-9][0-9]{9,14}$/.test(raw)) return raw;
  return null;
}

async function loadTemplate(templateKey) {
  const db = await getDb();
  return db.collection('templates').findOne({ key: templateKey, channel: 'whatsapp' });
}

/**
 * Send a Gallabox WhatsApp template message.
 *
 * @param {{to:string, name?:string, templateKey?:string, templateName?:string,
 *          variables?:object, orderedVariables?:string[]}} args
 * @returns {{queued:boolean, messageId?:string, error?:string, details?:any, status?:number}}
 */
export async function sendGallaboxTemplate(args) {
  const cfg = await readGallaboxConfig();
  if (!cfg.apiKey || !cfg.apiSecret || !cfg.channelId) {
    return { queued: false, error: 'gallabox_not_configured' };
  }
  const phone = normalizePhone(args.to, cfg.defaultCountryCode);
  if (!phone) return { queued: false, error: 'invalid_phone' };

  let templateName = args.templateName;
  let orderedVars = args.orderedVariables || null;
  if (args.templateKey) {
    const tpl = await loadTemplate(args.templateKey);
    if (!tpl) return { queued: false, error: 'template_not_found', details: args.templateKey };
    templateName = tpl.gallaboxTemplateName || tpl.name || args.templateKey;
    orderedVars = orderedVars || tpl.variables || [];
  }
  if (!templateName) return { queued: false, error: 'template_name_required' };

  // Gallabox expects bodyValues as an object keyed by '1','2',... in order.
  const vars = args.variables || {};
  const bodyValues = {};
  (orderedVars || []).forEach((k, i) => { bodyValues[String(i + 1)] = String(vars[k] ?? ''); });

  const payload = {
    channelId: cfg.channelId,
    channelType: 'whatsapp',
    recipient: { name: args.name || 'Customer', phone },
    type: 'template',
    templateName,
    bodyValues,
  };

  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/messages/whatsapp`, {
      method: 'POST',
      headers: {
        apiKey: cfg.apiKey,
        apiSecret: cfg.apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
    if (!res.ok) {
      return { queued: false, error: 'gallabox_api_error', status: res.status, details: data || text };
    }
    const messageId = data?.messageId || data?.messages?.[0]?.id || data?.id || null;
    return { queued: true, messageId, apiResponse: data };
  } catch (err) {
    return { queued: false, error: 'network_error', details: String(err?.message || err) };
  }
}
