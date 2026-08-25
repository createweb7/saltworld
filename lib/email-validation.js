// Salt World — email validation (single source of truth).
//
// Enforces the strict format `username@domain.tld` where TLD is ≥ 2 characters.
// Rejects: spaces, double dots (`..`), missing `@`, missing TLD, trailing/leading
// dot, IPs, unicode oddities.
//
// Used by:
//   • /lib/customer-auth.js  (customer signup/OTP)
//   • POST /api/bookings     (contact.email validation)
//   • /app/book              (frontend form validation)

const EMAIL_RE =
  /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function isValidEmail(input) {
  const email = String(input || '').trim();
  if (!email || email.length > 254) return false;
  if (/\.\./.test(email))            return false; // no double dots
  if (/\s/.test(email))              return false; // no whitespace
  return EMAIL_RE.test(email);
}

export const EMAIL_INVALID_MESSAGE =
  'Please enter a valid email address with a domain extension (e.g., name@example.com).';
