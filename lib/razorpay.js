// Razorpay integration helper — test-mode oriented.
// Reads keys from process.env first, falls back to the integrations collection
// (populated via Admin → Settings → Integrations) so the marketing team can plug
// keys in without a deploy. Never expose key_secret to the client.

import crypto from 'crypto';
import { getDb } from '@/lib/mongo';

let _cachedSecret = null;
let _cachedId = null;
let _cachedWebhook = null;
let _cachedAt = 0;
const CACHE_MS = 30_000;

async function readIntegrationConfig() {
  const now = Date.now();
  if (now - _cachedAt < CACHE_MS && (_cachedSecret || _cachedId)) {
    return { keyId: _cachedId, keySecret: _cachedSecret, webhookSecret: _cachedWebhook };
  }
  const db = await getDb();
  const doc = await db.collection('integrations').findOne({ key: 'razorpay' });
  const cfg = doc?.config || {};
  _cachedId      = process.env.RAZORPAY_KEY_ID       || cfg.keyId       || null;
  _cachedSecret  = process.env.RAZORPAY_KEY_SECRET   || cfg.keySecret   || null;
  _cachedWebhook = process.env.RAZORPAY_WEBHOOK_SECRET || cfg.webhookSecret || null;
  _cachedAt = now;
  return { keyId: _cachedId, keySecret: _cachedSecret, webhookSecret: _cachedWebhook };
}

function isPlaceholder(v) {
  return !v || /placeholder|xxx|your_/i.test(String(v));
}

export async function razorpayIsConfigured() {
  const { keyId, keySecret } = await readIntegrationConfig();
  return Boolean(keyId && keySecret && !isPlaceholder(keyId) && !isPlaceholder(keySecret));
}

export async function getPublicKeyId() {
  const { keyId } = await readIntegrationConfig();
  return keyId;
}

async function razorpayClient() {
  const { keyId, keySecret } = await readIntegrationConfig();
  if (!keyId || !keySecret) throw new Error('razorpay_not_configured');
  const mod = await import('razorpay');
  const Razorpay = mod.default || mod;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Create a Razorpay Order (amount MUST be in paise).
 * @param {{amountPaise:number, currency?:string, receipt?:string, notes?:object}} p
 * @returns Razorpay order object.
 */
export async function createOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('invalid_amount_paise');
  }
  const rp = await razorpayClient();
  return rp.orders.create({
    amount: amountPaise,
    currency,
    receipt: receipt || undefined,
    notes,
    payment_capture: 1,
  });
}

/**
 * Verify Razorpay Checkout signature.
 * signature = HMAC_SHA256(order_id + '|' + payment_id, key_secret)
 */
export async function verifySignature({ orderId, paymentId, signature }) {
  const { keySecret } = await readIntegrationConfig();
  if (!keySecret) return false;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // constant-time compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || '')));
  } catch {
    return false;
  }
}

/**
 * Verify a webhook payload against the configured webhook secret.
 * @param {string} rawBody raw request body (must not be re-serialised)
 * @param {string} signature value of X-Razorpay-Signature header
 */
export async function verifyWebhookSignature(rawBody, signature) {
  const { webhookSecret } = await readIntegrationConfig();
  if (!webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || '')));
  } catch {
    return false;
  }
}

// Reset the module-level cache (used by admin endpoint after integration is updated)
export function _resetRazorpayCache() {
  _cachedId = _cachedSecret = _cachedWebhook = null;
  _cachedAt = 0;
}
