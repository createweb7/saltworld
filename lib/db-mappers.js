// Shared row <-> app-shape mappers for entities touched by many modules
// (customers, bookings, therapies, resources). Every table keeps a `data`
// jsonb catch-all for fields not promoted to real columns (see
// supabase/schema.sql) — these mappers flatten `data` back onto the top
// level, then overlay the explicitly-modeled columns mapped to the
// camelCase field names the rest of the app (and every API response
// shape) already expects from the Mongo era.

export function toCustomer(row) {
  if (!row) return null;
  const { data, ...c } = row;
  return {
    ...data,
    id: c.id, branchId: c.branch_id, name: c.name, email: c.email, phone: c.phone, dob: c.dob,
    tags: c.tags || [], walletBalance: Number(c.wallet_balance) || 0, lifetimeValue: Number(c.lifetime_value) || 0,
    emergencyContact: c.emergency_contact, medicalNotes: c.medical_notes, preferredTherapistId: c.preferred_therapist_id,
    picture: c.picture, emailVerified: c.email_verified, authMethods: c.auth_methods || [],
    source: c.source, status: c.status, lastVisitAt: c.last_visit_at, lastLoginAt: c.last_login_at,
    createdAt: c.created_at, updatedAt: c.updated_at,
  };
}

export function fromCustomerPatch(patch) {
  const map = {
    branchId: 'branch_id', name: 'name', email: 'email', phone: 'phone', dob: 'dob', tags: 'tags',
    walletBalance: 'wallet_balance', lifetimeValue: 'lifetime_value', emergencyContact: 'emergency_contact',
    medicalNotes: 'medical_notes', preferredTherapistId: 'preferred_therapist_id', picture: 'picture',
    emailVerified: 'email_verified', authMethods: 'auth_methods', source: 'source', status: 'status',
    lastVisitAt: 'last_visit_at', lastLoginAt: 'last_login_at', updatedAt: 'updated_at',
  };
  const row = {};
  const extra = {};
  for (const [k, v] of Object.entries(patch)) {
    if (map[k]) row[map[k]] = v;
    else if (k !== 'id' && k !== 'createdAt') extra[k] = v;
  }
  return { row, extra };
}

export function toTherapy(row) {
  if (!row) return null;
  const { data, ...t } = row;
  return {
    ...data,
    id: t.id, slug: t.slug, name: t.name, isSystem: t.is_system, active: t.active,
    onlineBookingEnabled: t.online_booking_enabled, durationMin: t.duration_min, preBufferMin: t.pre_buffer_min,
    postBufferMin: t.post_buffer_min, cleaningBufferMin: t.cleaning_buffer_min, maxCapacity: t.max_capacity,
    concurrentResources: t.concurrent_resources, defaultPrice: Number(t.default_price) || 0,
    durationOptions: t.duration_options, taxHsn: t.tax_hsn, description: t.description, heroImage: t.hero_image,
    images: t.images || [], branchIds: t.branch_ids || [], seo: t.seo,
    createdAt: t.created_at, updatedAt: t.updated_at,
  };
}

export function toResource(row) {
  if (!row) return null;
  const { data, ...r } = row;
  return {
    ...data,
    id: r.id, name: r.name, type: r.type, capacity: r.capacity, supportedModes: r.supported_modes || [],
    branchId: r.branch_id, active: r.active, createdAt: r.created_at,
  };
}

export function toSubscription(row) {
  if (!row) return null;
  const { data, ...s } = row;
  return {
    ...data,
    id: s.id, customerId: s.customer_id, membershipId: s.membership_id, planName: s.plan_name,
    planSnapshot: s.plan_snapshot || {}, status: s.status, sessionsRemaining: s.sessions_remaining,
    walletBalance: s.wallet_balance, freezeHistory: s.freeze_history || [],
    startAt: s.starts_at, endAt: s.expires_at, createdAt: s.created_at, updatedAt: s.updated_at,
  };
}

export function toGiftcard(row) {
  if (!row) return null;
  const { data, ...g } = row;
  return {
    ...data,
    id: g.id, code: g.code, pin: g.pin, balance: Number(g.balance) || 0, status: g.status,
    claimedByCustomerId: g.claimed_by_customer_id, claimedAt: g.claimed_at, expiresAt: g.expires_at,
    createdAt: g.created_at, updatedAt: g.updated_at,
  };
}

// Full booking representation matching the old Mongo document shape exactly
// — `therapies` and `schedule` as embedded arrays — by joining the child
// tables. Used anywhere a booking is returned to a client (both route.js and
// admin.js), since consumers (frontend, reports) still expect those fields
// embedded rather than needing a second fetch.
export async function toBookingFull(supabase, row) {
  if (!row) return null;
  const booking = toBooking(row);
  const [{ data: therapyRows }, { data: scheduleRows }] = await Promise.all([
    supabase.from('booking_therapies').select('*').eq('booking_id', row.id).order('position', { ascending: true }),
    supabase.from('booking_schedule_items').select('*').eq('booking_id', row.id).order('position', { ascending: true }),
  ]);
  booking.therapies = (therapyRows || []).map((t) => ({
    slug: t.therapy_slug, label: t.label, role: t.role,
    ...(t.duration_min ? { durationMin: t.duration_min } : {}),
    ...(t.data || {}),
  }));
  booking.schedule = (scheduleRows || []).map((s) => ({
    therapySlug: s.therapy_slug, resourceId: s.resource_id, from: s.starts_at, to: s.ends_at,
  }));
  // Legacy single-therapy convenience fields, derived from the first line.
  if (!booking.therapy && booking.therapies[0]) booking.therapy = booking.therapies[0].slug;
  if (!booking.therapyLabel && booking.therapies[0]) booking.therapyLabel = booking.therapies[0].label;
  return booking;
}

export function toPage(row) {
  if (!row) return null;
  const { data, ...p } = row;
  return { ...data, id: p.id, slug: p.slug, status: p.status, createdAt: p.created_at, updatedAt: p.updated_at };
}

export function toBooking(row) {
  if (!row) return null;
  const { data, ...b } = row;
  return {
    ...data,
    id: b.id, ref: b.ref, branchId: b.branch_id, customerId: b.customer_id, bookedForOther: b.booked_for_other,
    outcome: b.outcome, outcomeLabel: b.outcome_label, sessionMode: b.session_mode,
    contact: { name: b.contact_name, phone: b.contact_phone, email: b.contact_email },
    startAt: b.start_at, blockedFrom: b.blocked_from, blockedTo: b.blocked_to, guests: b.guests,
    status: b.status, payment: b.payment, total: Number(b.total) || 0, pricingBreakdown: b.pricing_breakdown,
    couponId: b.coupon_id, couponCode: b.coupon_code, couponDiscount: Number(b.coupon_discount) || 0,
    resourceId: b.primary_resource_id, resourceName: b.primary_resource_name,
    createdAt: b.created_at, updatedAt: b.updated_at,
  };
}
