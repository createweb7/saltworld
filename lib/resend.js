// Resend transactional email — plain fetch against their REST API (no SDK
// dependency, same approach as lib/whatsapp.js against Meta's Graph API).
// Stays gracefully "not configured" until RESEND_API_KEY is set and the
// sending domain is verified — sends will 4xx from Resend until DNS
// propagates, which we surface as a normal failed-send result, not a crash.

const API_KEY   = process.env.RESEND_API_KEY || '';
const FROM      = process.env.RESEND_FROM_EMAIL || 'Salt World <noreply@saltworld.in>';
const ADMIN_TO  = process.env.ADMIN_NOTIFICATION_EMAIL || '';

export function resendIsConfigured() {
  return Boolean(API_KEY);
}

export function adminNotificationEmail() {
  return ADMIN_TO || null;
}

/**
 * @param {{to:string|string[], subject:string, html:string, replyTo?:string}} args
 * @returns {{ok:boolean, id?:string, error?:string}}
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!API_KEY) return { ok: false, error: 'resend_not_configured' };
  if (!to) return { ok: false, error: 'no_recipient' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || `resend_error_${res.status}`, details: data };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: 'network_error', details: String(err?.message || err) };
  }
}
