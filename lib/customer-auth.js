// Customer auth — phone + OTP (WhatsApp/SMS) and Google (Emergent) support.
// Uses a distinct `sw_customer` cookie so it never collides with the admin JWT.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomUUID, randomInt } from 'crypto';
import { getDb } from '@/lib/mongo';

const COOKIE_NAME = 'sw_customer';
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const SECRET = process.env.CUSTOMER_JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'sw-customer-dev-secret';

function secret() { return new TextEncoder().encode(SECRET); }

export async function signCustomerToken(payload) {
  return await new SignJWT({ ...payload, kind: 'customer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret());
}

export async function verifyCustomerToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload?.kind === 'customer' ? payload : null;
  } catch { return null; }
}

export async function setCustomerCookie(token) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
}

export async function clearCustomerCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getCurrentCustomer() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyCustomerToken(token);
  if (!payload) return null;
  const db = await getDb();
  const doc = await db.collection('customers').findOne({ id: payload.sub });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

/**
 * Normalise a phone number for lookup. Accepts:
 *   +91 76878 78793 / 917687878793 / 07687878793 / 7687878793
 * Returns 12-digit E.164-without-plus (e.g. "917687878793") or null.
 */
export function normalizePhone(raw, cc = '91') {
  if (!raw) return null;
  let s = String(raw).replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (s.startsWith('0')) s = s.slice(1);
  if (s.length === 10) s = cc + s;
  if (!/^[1-9][0-9]{9,14}$/.test(s)) return null;
  return s;
}

function hashOtp(otp) {
  return require('crypto').createHash('sha256').update(String(otp)).digest('hex');
}

/**
 * Create + store a fresh OTP for a phone. Returns { otp, expiresAt }.
 * Enforces max 3 attempts per 10 minutes.
 */
export async function issueOtp(phone) {
  const db = await getDb();
  const p = normalizePhone(phone);
  if (!p) throw new Error('invalid_phone');

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await db.collection('otp').countDocuments({ phone: p, createdAt: { $gte: tenMinAgo } });
  if (recent >= 3) throw new Error('otp_throttled');

  const otp = String(randomInt(100000, 1000000)); // always 6 digits
  const doc = {
    id: randomUUID(),
    phone: p,
    otpHash: hashOtp(otp),
    attempts: 0,
    used: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  await db.collection('otp').insertOne(doc);
  await db.collection('otp').createIndex({ phone: 1, createdAt: -1 }).catch(() => {});
  return { phone: p, otp, expiresAt: doc.expiresAt };
}

export async function verifyOtp(phone, otp) {
  const db = await getDb();
  const p = normalizePhone(phone);
  if (!p) return { ok: false, error: 'invalid_phone' };

  const doc = await db.collection('otp').findOne(
    { phone: p, used: false, expiresAt: { $gte: new Date().toISOString() } },
    { sort: { createdAt: -1 } },
  );
  if (!doc) return { ok: false, error: 'otp_expired' };
  if ((doc.attempts || 0) >= 5) return { ok: false, error: 'too_many_attempts' };
  if (doc.otpHash !== hashOtp(otp)) {
    await db.collection('otp').updateOne({ id: doc.id }, { $inc: { attempts: 1 } });
    return { ok: false, error: 'wrong_otp' };
  }
  await db.collection('otp').updateOne({ id: doc.id }, { $set: { used: true, usedAt: new Date().toISOString() } });
  return { ok: true, phone: p };
}

/**
 * Find or create a customer by phone (called after successful OTP verify).
 */
export async function upsertCustomerByPhone(phone, extra = {}) {
  const db = await getDb();
  const p = normalizePhone(phone);
  if (!p) throw new Error('invalid_phone');

  // Legacy customer records may exist under un-normalized phones (raw 10-digit,
  // or with a leading '+'). Widen the lookup so we never create a duplicate
  // that ends up owning memberships / bookings under a different id.
  const digits = p.replace(/\D/g, '');
  const variants = new Set([p, `+${p}`]);
  if (digits.length > 10) variants.add(digits.slice(-10));
  variants.add(digits);
  const variantList = [...variants];

  let doc = await db.collection('customers').findOne({ phone: { $in: variantList } });
  if (doc) {
    // Normalise the stored phone forward so future lookups stay clean.
    await db.collection('customers').updateOne(
      { id: doc.id },
      { $set: { phone: p, lastLoginAt: new Date().toISOString(), ...extra } },
    );
    doc = await db.collection('customers').findOne({ id: doc.id });
  } else {
    const now = new Date().toISOString();
    doc = {
      id: randomUUID(),
      phone: p,
      name:   extra.name  || '',
      email:  extra.email || '',
      tags: [],
      status: 'active',
      source: extra.source || 'customer_portal',
      walletBalance: 0,
      lifetimeValue: 0,
      lastLoginAt: now,
      createdAt: now,
    };
    await db.collection('customers').insertOne(doc);
  }
  const { _id, ...rest } = doc;
  return rest;
}

/**
 * Find or create a customer by verified email (called after Emergent Google auth).
 * Auto-links to an existing phone-OTP customer if their email matches.
 */
export async function upsertCustomerByEmail(email, extra = {}) {
  const db = await getDb();
  const { isValidEmail } = await import('@/lib/email-validation');
  const e = String(email || '').trim().toLowerCase();
  if (!isValidEmail(e)) throw new Error('invalid_email');

  let doc = await db.collection('customers').findOne({ email: e });
  if (doc) {
    await db.collection('customers').updateOne(
      { id: doc.id },
      { $set: {
          lastLoginAt: new Date().toISOString(),
          emailVerified: true,
          ...(extra.name && !doc.name ? { name: extra.name } : {}),
          ...(extra.picture && !doc.picture ? { picture: extra.picture } : {}),
        },
        $addToSet: { authMethods: 'google' },
      },
    );
    doc = await db.collection('customers').findOne({ id: doc.id });
  } else {
    const now = new Date().toISOString();
    doc = {
      id: randomUUID(),
      phone: '',
      name:   extra.name    || '',
      email:  e,
      picture: extra.picture || '',
      emailVerified: true,
      authMethods: ['google'],
      tags: [],
      status: 'active',
      source: extra.source || 'google_signin',
      walletBalance: 0,
      lifetimeValue: 0,
      lastLoginAt: now,
      createdAt: now,
    };
    await db.collection('customers').insertOne(doc);
  }
  const { _id, ...rest } = doc;
  return rest;
}


export const CUSTOMER_COOKIE_NAME = COOKIE_NAME;
