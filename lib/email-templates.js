// Branded HTML email templates — plain table-based markup (no web fonts,
// no external CSS) so it renders consistently across Gmail/Outlook/Apple
// Mail. One shared layout, per-event content builders for the customer-
// facing confirmation and the shorter internal admin alert.

const BRAND_TEAL = '#0a3838';
const BRAND_TEAL_LIGHT = '#0f4f4a';
const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#e5e0d5';
const BG = '#f7f4ee';

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ preheader = '', heading, intro = '', bodyHtml, ctaLabel, ctaHref, footerNote = '' }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
        <tr>
          <td style="background:${BRAND_TEAL};padding:24px 32px;text-align:center;">
            <img src="${ASSET_URL}/email/logo-white.png" width="160" height="35" alt="Salt World" style="display:block;margin:0 auto;width:160px;height:auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px 32px;">
            <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${INK};font-weight:400;">${heading}</h1>
            ${intro ? `<p style="margin:0 0 20px 0;font-size:14.5px;line-height:1.6;color:${MUTED};">${intro}</p>` : ''}
          </td>
        </tr>
        <tr><td style="padding:0 32px;">${bodyHtml}</td></tr>
        ${ctaLabel && ctaHref ? `
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <a href="${esc(ctaHref)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:600;padding:13px 26px;border-radius:999px;">${esc(ctaLabel)}</a>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:32px;">
            ${footerNote ? `<p style="margin:0 0 16px 0;font-size:12px;line-height:1.6;color:${MUTED};">${footerNote}</p>` : ''}
            <div style="border-top:1px solid ${BORDER};padding-top:16px;font-size:11.5px;line-height:1.7;color:${MUTED};">
              Salt World · 3rd Floor, 6th Cross, Sector 7, HSR Layout, Bengaluru 560102<br />
              <a href="tel:+917687878793" style="color:${MUTED};text-decoration:none;">+91 76878 78793</a> ·
              <a href="mailto:info@saltworld.in" style="color:${MUTED};text-decoration:none;">info@saltworld.in</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};width:40%;">${esc(label)}</td>
    <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:13.5px;color:${INK};font-weight:500;text-align:right;">${value}</td>
  </tr>`;
}

function detailTable(rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">${rowsHtml}</table>`;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://saltworld.in';
// Images in an email are fetched by the recipient's mail client, so they must
// be publicly reachable — never a localhost URL (local dev sends real emails).
const ASSET_URL = /localhost|127\.0\.0\.1/.test(BASE_URL)
  ? (process.env.EMAIL_ASSET_BASE_URL || 'https://saltworld.vercel.app')
  : BASE_URL;

/* ---------------- Customer-facing templates ---------------- */

export function bookingConfirmationEmail(ctx = {}) {
  const body = detailTable([
    row('Reference', ctx.ref),
    row('Session', ctx.outcome || ctx.therapy),
    row('Date', ctx.date),
    row('Time', ctx.time),
  ].join(''));
  return {
    subject: `Booking confirmed — ${ctx.ref || 'Salt World'}`,
    html: layout({
      preheader: `Your Salt World session is confirmed for ${ctx.date || 'your visit'}.`,
      heading: `See you soon, ${esc(ctx.name || 'there')}.`,
      intro: `Your session is confirmed. Here are the details for your records.`,
      bodyHtml: body,
      ctaLabel: 'View booking',
      ctaHref: `${BASE_URL}/account`,
    }),
  };
}

// Email-safe rendition of the on-site GiftCardPreview — a gradient "card"
// block built from nested tables so it survives Outlook's Word rendering
// engine (bgcolor fallback alongside the CSS gradient, no flexbox/grid).
function giftCardVisual({ giftTitle, amount, code, toName, fromName }) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a3838"
    style="background:linear-gradient(135deg,#003D3A 0%,#005E58 55%,#00A79A 100%);border-radius:14px;overflow:hidden;">
    <tr>
      <td style="padding:24px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#F5F1EA;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;opacity:0.85;">Salt World Gift</td>
          </tr>
          <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="color:#F5F1EA;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;">${esc(giftTitle)}</td>
          </tr>
          <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="color:#F5F1EA;font-size:12px;opacity:0.85;">
              ${toName ? `To — <strong style="color:#ffffff;">${esc(toName)}</strong><br/>` : ''}
              ${fromName ? `From — <strong style="color:#ffffff;">${esc(fromName)}</strong>` : ''}
            </td>
          </tr>
          <tr><td style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="border-top:1px solid rgba(245,241,234,0.25);padding-top:14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="color:#F5F1EA;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Code</td>
                <td align="right" style="color:#ffffff;font-family:monospace;font-size:13px;font-weight:600;letter-spacing:0.5px;">${esc(code)}</td>
              </tr></table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function giftCardPurchasedEmail(ctx = {}) {
  const visual = giftCardVisual({ giftTitle: ctx.giftTitle, amount: ctx.amount, code: ctx.code, toName: ctx.toName, fromName: ctx.name });
  const body = detailTable([
    row('Value', fmtINR(ctx.amount)),
    row('PIN', ctx.pin ? `<span style="font-family:monospace;">${esc(ctx.pin)}</span>` : null),
    row('Valid until', ctx.expiresAt),
  ].join(''));
  return {
    subject: `Your Salt World gift is ready — ${ctx.code || ''}`,
    html: layout({
      preheader: `Your gift is ready to view, download or send.`,
      heading: `Your gift is ready, ${esc(ctx.name || 'there')}.`,
      intro: ctx.toName
        ? `Your gift for ${esc(ctx.toName)} has been created. View it below, or open your account to download a printable certificate or share the code directly.`
        : `Your gift has been created. Add a recipient any time from your account — or view it below and download a printable certificate now.`,
      bodyHtml: visual + `<div style="height:20px;"></div>` + body,
      ctaLabel: 'View & download gift card',
      ctaHref: `${BASE_URL}/account/gifts/${ctx.giftId || ''}`,
      footerNote: 'Valid for 12 months from purchase, redeemable toward any Salt World booking. Use the code and PIN above to redeem at checkout, or look it up in your account.',
    }),
  };
}

export function orderConfirmationEmail(ctx = {}) {
  const itemRows = (ctx.items || []).map((it) =>
    row(`${it.name} × ${it.qty}`, fmtINR(it.price * it.qty))
  ).join('');
  const body = detailTable(itemRows + row('Total', `<strong>${fmtINR(ctx.total)}</strong>`));
  return {
    subject: `Order confirmed — ${ctx.ref || 'Salt World'}`,
    html: layout({
      preheader: `Your Salt World order is confirmed.`,
      heading: `Thanks for your order, ${esc(ctx.name || 'there')}.`,
      intro: `We're preparing your order for dispatch. Here's what you ordered.`,
      bodyHtml: body,
      ctaLabel: 'Track your order',
      ctaHref: `${BASE_URL}/account/orders/${ctx.orderId || ''}`,
    }),
  };
}

/* ---------------- Internal admin alert templates ---------------- */

function adminLayout({ heading, bodyHtml, ctaLabel, ctaHref }) {
  return layout({
    preheader: heading,
    heading,
    bodyHtml,
    ctaLabel,
    ctaHref,
    footerNote: 'Internal notification — sent to the ops inbox only.',
  });
}

export function adminBookingAlertEmail(ctx = {}) {
  const body = detailTable([
    row('Reference', ctx.ref),
    row('Customer', ctx.name),
    row('Session', ctx.outcome || ctx.therapy),
    row('Date', ctx.date),
    row('Time', ctx.time),
  ].join(''));
  return {
    subject: `New booking — ${ctx.ref || ''}`,
    html: adminLayout({
      heading: 'New booking received',
      bodyHtml: body,
      ctaLabel: 'Open in admin',
      ctaHref: `${BASE_URL}/admin/bookings`,
    }),
  };
}

export function adminGiftAlertEmail(ctx = {}) {
  const body = detailTable([
    row('Gift of', ctx.giftTitle),
    row('Value', fmtINR(ctx.amount)),
    row('Code', ctx.code),
    row('From', ctx.name),
    row('To', ctx.toName || '— not set yet'),
  ].join(''));
  return {
    subject: `New gift purchased — ${fmtINR(ctx.amount)}`,
    html: adminLayout({
      heading: 'New gift purchased',
      bodyHtml: body,
      ctaLabel: 'Open in admin',
      ctaHref: `${BASE_URL}/admin/giftcards`,
    }),
  };
}

export function adminOrderAlertEmail(ctx = {}) {
  const itemRows = (ctx.items || []).map((it) => row(`${it.name} × ${it.qty}`, fmtINR(it.price * it.qty))).join('');
  const body = detailTable([row('Reference', ctx.ref), row('Customer', ctx.name)].join('') + itemRows + row('Total', `<strong>${fmtINR(ctx.total)}</strong>`));
  return {
    subject: `New order — ${ctx.ref || ''}`,
    html: adminLayout({
      heading: 'New order received',
      bodyHtml: body,
      ctaLabel: 'Open in admin',
      ctaHref: `${BASE_URL}/admin/orders`,
    }),
  };
}

export const EMAIL_TEMPLATES = {
  booking_confirmation: { customer: bookingConfirmationEmail, admin: adminBookingAlertEmail },
  gift_card_purchased:  { customer: giftCardPurchasedEmail,   admin: adminGiftAlertEmail },
  order_confirmation:   { customer: orderConfirmationEmail,   admin: adminOrderAlertEmail },
};
