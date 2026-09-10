// Customer auth — phone + OTP (WhatsApp/SMS) and Google support.
// Uses a distinct `sw_customer` cookie so it never collides with the admin JWT.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomUUID, randomInt } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { toCustomer } from '@/lib/db-mappers';

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
  const supabase = getSupabase();
  const { data: row } = await supabase.from('customers').select('*').eq('id', payload.sub).maybeSingle();
  return toCustomer(row);
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
  const supabase = getSupabase();
  const p = normalizePhone(phone);
  if (!p) throw new Error('invalid_phone');

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase.from('otp_codes').select('id', { count: 'exact', head: true })
    .eq('phone', p).gte('created_at', tenMinAgo);
  if ((count || 0) >= 3) throw new Error('otp_throttled');

  const otp = String(randomInt(100000, 1000000)); // always 6 digits
  const doc = {
    id: randomUUID(), phone: p, otpHash: hashOtp(otp), attempts: 0, used: false,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  const { error } = await supabase.from('otp_codes').insert({
    id: doc.id, phone: doc.phone, otp_hash: doc.otpHash, attempts: 0, used: false,
    created_at: doc.createdAt, expires_at: doc.expiresAt,
  });
  if (error) throw error;
  return { phone: p, otp, expiresAt: doc.expiresAt };
}

export async function verifyOtp(phone, otp) {
  const supabase = getSupabase();
  const p = normalizePhone(phone);
  if (!p) return { ok: false, error: 'invalid_phone' };

  const { data: rows } = await supabase.from('otp_codes').select('*')
    .eq('phone', p).eq('used', false).gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1);
  const doc = rows?.[0];
  if (!doc) return { ok: false, error: 'otp_expired' };
  if ((doc.attempts || 0) >= 5) return { ok: false, error: 'too_many_attempts' };
  if (doc.otp_hash !== hashOtp(otp)) {
    await supabase.from('otp_codes').update({ attempts: (doc.attempts || 0) + 1 }).eq('id', doc.id);
    return { ok: false, error: 'wrong_otp' };
  }
  await supabase.from('otp_codes').update({ used: true, used_at: new Date().toISOString() }).eq('id', doc.id);
  return { ok: true, phone: p };
}

/**
 * Find or create a customer by phone (called after successful OTP verify).
 */
export async function upsertCustomerByPhone(phone, extra = {}) {
  const supabase = getSupabase();
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

  const { data: existingRow } = await supabase.from('customers').select('*').in('phone', variantList).limit(1).maybeSingle();
  let row;
  if (existingRow) {
    const { error } = await supabase.from('customers').update({
      phone: p, last_login_at: new Date().toISOString(), ...extra,
    }).eq('id', existingRow.id);
    if (error) throw error;
    ({ data: row } = await supabase.from('customers').select('*').eq('id', existingRow.id).single());
  } else {
    const now = new Date().toISOString();
    const id = randomUUID();
    const { error } = await supabase.from('customers').insert({
      id, phone: p, name: extra.name || '', email: extra.email || '', tags: [], status: 'active',
      source: extra.source || 'customer_portal', wallet_balance: 0, lifetime_value: 0,
      last_login_at: now, created_at: now, updated_at: now,
    });
    if (error) throw error;
    ({ data: row } = await supabase.from('customers').select('*').eq('id', id).single());
  }
  return toCustomer(row);
}

/**
 * Find or create a customer by verified email (called after Google auth).
 * Auto-links to an existing phone-OTP customer if their email matches.
 */
export async function upsertCustomerByEmail(email, extra = {}) {
  const supabase = getSupabase();
  const { isValidEmail } = await import('@/lib/email-validation');
  const e = String(email || '').trim().toLowerCase();
  if (!isValidEmail(e)) throw new Error('invalid_email');

  const { data: existingRow } = await supabase.from('customers').select('*').eq('email', e).maybeSingle();
  let row;
  if (existingRow) {
    const patch = {
      last_login_at: new Date().toISOString(), email_verified: true,
      auth_methods: Array.from(new Set([...(existingRow.auth_methods || []), 'google'])),
    };
    if (extra.name && !existingRow.name) patch.name = extra.name;
    if (extra.picture && !existingRow.picture) patch.picture = extra.picture;
    const { error } = await supabase.from('customers').update(patch).eq('id', existingRow.id);
    if (error) throw error;
    ({ data: row } = await supabase.from('customers').select('*').eq('id', existingRow.id).single());
  } else {
    const now = new Date().toISOString();
    const id = randomUUID();
    const { error } = await supabase.from('customers').insert({
      id, phone: '', name: extra.name || '', email: e, picture: extra.picture || '',
      email_verified: true, auth_methods: ['google'], tags: [], status: 'active',
      source: extra.source || 'google_signin', wallet_balance: 0, lifetime_value: 0,
      last_login_at: now, created_at: now, updated_at: now,
    });
    if (error) throw error;
    ({ data: row } = await supabase.from('customers').select('*').eq('id', id).single());
  }
  return toCustomer(row);
}


export const CUSTOMER_COOKIE_NAME = COOKIE_NAME;
