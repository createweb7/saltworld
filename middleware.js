import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'sw-bos-dev-fallback-secret'
);
const COOKIE = 'sw_admin';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/forgot'];
const isPublicAdmin = (path) =>
  PUBLIC_ADMIN_PATHS.includes(path) || path.startsWith('/admin/reset/');

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // Always allow public admin auth pages
  if (isPublicAdmin(pathname)) return NextResponse.next();

  // Always allow the auth sub-API endpoints
  if (
    pathname === '/api/admin/auth/login' ||
    pathname === '/api/admin/auth/forgot' ||
    pathname === '/api/admin/auth/reset' ||
    pathname === '/api/admin/auth/logout'
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return redirectToLogin(req);

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
