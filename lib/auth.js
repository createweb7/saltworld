import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongo';

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
  const db = await getDb();
  const doc = await db.collection('users').findOne({ id: session.userId, status: 'active' });
  if (!doc) return null;
  const { _id, passwordHash, ...safe } = doc;
  return safe;
}

export { COOKIE_NAME, SESSION_TTL_SEC };
