// Group and Kids bookings — shared by the booking page, the price
// calculator and the booking API so all three apply the same limits.
//
// Group: one therapy booked on its own for 3+ people.
//   Salt Cave   — shared room, up to its capacity (7), additionalGuestPriceInr each (₹1,200).
//   Cold Plunge — whole room held for the group (one booking at a time), up to 5, ₹720 each.
// Kids: Salt Cave only. ₹1,600 per child, one accompanying adult free; a slot
// with kids in it holds at most 3 people in total (rules doc, Salt Cave).
//
// Values can be overridden per therapy (groupMaxGuests / groupPerPersonInr on
// the therapy record); these are the agreed defaults (Nov 2026).

export const GROUP_MIN_GUESTS = 3;
export const KIDS_SLOT_MAX_PEOPLE = 3;

const EXCLUSIVE_GROUP_DEFAULTS = {
  'cold-plunge': { maxGuests: 5, perPersonInr: 720 },
};

/** { maxGuests, perPersonInr } if this therapy can be booked as a group, else null. */
export function groupConfig(t) {
  if (!t?.slug) return null;
  const cap = Number(t.maxCapacity) || 1;
  if (cap > 1) {
    const per = t.groupPerPersonInr ?? t.additionalGuestPriceInr ?? t.defaultPrice;
    return cap >= GROUP_MIN_GUESTS ? { maxGuests: cap, perPersonInr: Number(per) || 0, shared: true } : null;
  }
  const d = EXCLUSIVE_GROUP_DEFAULTS[t.slug];
  if (!d && t.groupMaxGuests == null) return null;
  const maxGuests = Number(t.groupMaxGuests ?? d?.maxGuests) || 0;
  const perPersonInr = Number(t.groupPerPersonInr ?? d?.perPersonInr) || 0;
  return maxGuests >= GROUP_MIN_GUESTS && perPersonInr > 0 ? { maxGuests, perPersonInr, shared: false } : null;
}

/** Kids booking is offered on shared rooms that have a child price (Salt Cave). */
export function kidsAllowed(t) {
  return !!t?.slug && (Number(t.maxCapacity) || 1) > 1 && t.childPriceInr != null;
}

/**
 * Check a booking's headcount. `therapies` are therapy records for every
 * therapy on the booking. Returns null when fine, else { error, message, meta }.
 */
export function checkPartySize(therapies, guests, children) {
  const adults = Math.max(1, Number(guests) || 1);
  const kids = Math.max(0, Number(children) || 0);
  const only = therapies.length === 1 ? therapies[0] : null;

  if (kids > 0) {
    if (!only || !kidsAllowed(only)) {
      return { error: 'kids_not_offered', message: 'Kids sessions are for the Salt Cave booked on its own.' };
    }
    if (adults + kids > KIDS_SLOT_MAX_PEOPLE) {
      return {
        error: 'kids_cap_exceeded',
        message: `A kids Salt Cave session holds up to ${KIDS_SLOT_MAX_PEOPLE} people (children + adults).`,
        meta: { maxPeople: KIDS_SLOT_MAX_PEOPLE },
      };
    }
    return null;
  }
  if (adults >= GROUP_MIN_GUESTS) {
    const g = only ? groupConfig(only) : null;
    if (!g) {
      return { error: 'group_not_offered', message: 'Group bookings are for the Salt Cave or Cold Plunge booked on their own.' };
    }
    if (adults > g.maxGuests) {
      return {
        error: 'guest_cap_exceeded',
        message: `${only.name || 'This therapy'} takes up to ${g.maxGuests} people per booking.`,
        meta: { maxGuests: g.maxGuests },
      };
    }
  }
  return null;
}
