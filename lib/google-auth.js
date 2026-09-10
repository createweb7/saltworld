// Customer "Sign in with Google" — standard server-side OAuth 2.0
// authorization-code flow against Google's own endpoints. No third-party
// auth proxy involved: the token exchange happens directly between this
// server and accounts.google.com over HTTPS, using GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export function googleIsConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function callbackUrl(origin) {
  return `${origin}/api/customer/auth/google-callback`;
}

export function buildGoogleAuthUrl({ origin, state }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for the signed-in user's verified profile.
 * Throws on any failure — callers should catch and map to a user-facing error.
 */
export async function exchangeGoogleCode({ code, origin }) {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(origin),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw new Error('google_token_exchange_failed');
  const tokens = await tokenRes.json();

  const profileRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error('google_userinfo_failed');
  const profile = await profileRes.json();

  const verified = profile.email_verified === true || profile.email_verified === 'true';
  if (!profile.email || !verified) {
    throw new Error('google_email_unverified');
  }
  return { email: profile.email, name: profile.name, picture: profile.picture };
}
