import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase';

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'sw-bos-dev-fallback-secret'
);
const COOKIE_NAME = 'sw_admin';
const SESSION_TTL_SEC = 60 * 60 * 12; // 12h

export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(SECRET);
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

export async function getSessionFromCookies() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session?.userId) return null;
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('users')
    .select('id, email, name, role, permissions, status, branch_id, last_login_at, created_at, updated_at, data')
    .eq('id', session.userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!row) return null;
  // Flatten the `data` catch-all (extra fields not modeled as real columns)
  // back onto the top level, then map snake_case columns to the camelCase
  // shape the rest of the app (and every API response) already expects.
  return {
    ...row.data,
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: row.permissions,
    status: row.status,
    branchId: row.branch_id,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export { COOKIE_NAME, SESSION_TTL_SEC };
