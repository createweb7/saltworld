// One-time data migration: local MongoDB (saltworld) -> Supabase Postgres.
// Idempotent (safe to re-run): every insert is an upsert keyed by `id`
// (bookings' child tables are deleted-then-reinserted per parent instead,
// since they have no natural unique key of their own).
//
// Run: MONGO_URL=... DB_NAME=... SUPABASE_DB_URL=... node scripts/supabase/migrate-data.mjs
import { MongoClient } from 'mongodb';
import pg from 'pg';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'saltworld';
const pgUrl = process.env.SUPABASE_DB_URL;
if (!pgUrl) throw new Error('SUPABASE_DB_URL missing');

const mongoClient = new MongoClient(mongoUrl);
await mongoClient.connect();
const mdb = mongoClient.db(dbName);

const pool = new pg.Pool({ connectionString: pgUrl });

const stats = {};
const errors = [];
function bump(name) { stats[name] = (stats[name] || 0) + 1; }
function fail(name, id, e) { errors.push(`${name} ${id}: ${e.message}`); }

function omit(obj, keys) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (k === '_id' || keys.includes(k)) continue;
    out[k] = obj[k];
  }
  return out;
}
const d = (v) => (v ? new Date(v) : null);
const j = (v) => JSON.stringify(v ?? {});

async function upsert(table, obj) {
  const cols = Object.keys(obj).filter((k) => obj[k] !== undefined);
  const values = cols.map((c) => obj[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const updateCols = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ') || 'id = excluded.id';
  await pool.query(
    `insert into ${table} (${cols.join(', ')}) values (${placeholders})
     on conflict (id) do update set ${updateCols}`,
    values,
  );
}

// ---------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------
async function migrateBranches() {
  const docs = await mdb.collection('branches').find().toArray();
  const used = ['id', 'name', 'code', 'isDefault', 'hours', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('branches', {
        id: doc.id, name: doc.name, code: doc.code || null,
        is_default: !!doc.isDefault, hours: j(doc.hours),
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('branches');
    } catch (e) { fail('branches', doc.id, e); }
  }
}

async function migrateUsers() {
  const docs = await mdb.collection('users').find().toArray();
  const used = ['id', 'email', 'passwordHash', 'name', 'role', 'permissions', 'status', 'branchId', 'lastLoginAt', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('users', {
        id: doc.id, email: doc.email, password_hash: doc.passwordHash,
        name: doc.name || null, role: doc.role || 'reception',
        permissions: doc.permissions || [], status: doc.status || 'active',
        branch_id: doc.branchId || null, last_login_at: d(doc.lastLoginAt),
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('users');
    } catch (e) { fail('users', doc.id, e); }
  }
}

async function migrateCustomers() {
  const docs = await mdb.collection('customers').find().toArray();
  const used = ['id', 'branchId', 'name', 'email', 'phone', 'dob', 'tags', 'walletBalance', 'lifetimeValue',
    'emergencyContact', 'medicalNotes', 'preferredTherapistId', 'picture', 'emailVerified', 'authMethods',
    'source', 'status', 'lastVisitAt', 'lastLoginAt', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('customers', {
        id: doc.id, branch_id: doc.branchId || null, name: doc.name || '', email: doc.email || '', phone: doc.phone || '',
        dob: doc.dob ? new Date(doc.dob) : null, tags: doc.tags || [],
        wallet_balance: doc.walletBalance || 0, lifetime_value: doc.lifetimeValue || 0,
        emergency_contact: doc.emergencyContact ? j(doc.emergencyContact) : null,
        medical_notes: doc.medicalNotes || '', preferred_therapist_id: doc.preferredTherapistId || null,
        picture: doc.picture || null, email_verified: !!doc.emailVerified, auth_methods: doc.authMethods || [],
        source: doc.source || 'customer_portal', status: doc.status || 'active',
        last_visit_at: d(doc.lastVisitAt), last_login_at: d(doc.lastLoginAt),
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('customers');
    } catch (e) { fail('customers', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------
async function migrateTherapies() {
  const docs = await mdb.collection('therapies').find().toArray();
  const used = ['id', 'slug', 'name', 'isSystem', 'active', 'onlineBookingEnabled', 'durationMin', 'preBufferMin',
    'postBufferMin', 'cleaningBufferMin', 'maxCapacity', 'concurrentResources', 'defaultPrice', 'durationOptions',
    'taxHsn', 'description', 'heroImage', 'images', 'resourceIds', 'branchIds', 'seo', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('therapies', {
        id: doc.id, slug: doc.slug, name: doc.name, is_system: !!doc.isSystem, active: doc.active !== false,
        online_booking_enabled: doc.onlineBookingEnabled !== false,
        duration_min: doc.durationMin || 60, pre_buffer_min: doc.preBufferMin || 0,
        post_buffer_min: doc.postBufferMin || 0, cleaning_buffer_min: doc.cleaningBufferMin || 0,
        max_capacity: doc.maxCapacity || 1, concurrent_resources: !!doc.concurrentResources,
        default_price: doc.defaultPrice || 0, duration_options: doc.durationOptions ? j(doc.durationOptions) : null,
        tax_hsn: doc.taxHsn || null, description: doc.description || null, hero_image: doc.heroImage || null,
        images: doc.images || [], branch_ids: doc.branchIds || [], seo: doc.seo ? j(doc.seo) : null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('therapies');
    } catch (e) { fail('therapies', doc.id, e); continue; }

    await pool.query('delete from therapy_resources where therapy_id = $1', [doc.id]);
    for (const rid of doc.resourceIds || []) {
      try {
        await pool.query('insert into therapy_resources (therapy_id, resource_id) values ($1,$2) on conflict do nothing', [doc.id, rid]);
      } catch (e) { fail('therapy_resources', `${doc.id}/${rid}`, e); }
    }
  }
}

async function migrateResources() {
  const docs = await mdb.collection('resources').find().toArray();
  const used = ['id', 'name', 'type', 'capacity', 'supportedModes', 'branchId', 'therapySlug', 'active', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('resources', {
        id: doc.id, name: doc.name, type: doc.type || null, capacity: doc.capacity || 1,
        supported_modes: doc.supportedModes || [], branch_id: doc.branchId || null, active: doc.active !== false,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('resources');
    } catch (e) { fail('resources', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------
async function migrateMemberships() {
  const docs = await mdb.collection('memberships').find().toArray();
  const used = ['id', 'slug', 'name', 'active', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('memberships', {
        id: doc.id, slug: doc.slug || null, name: doc.name, active: doc.active !== false,
        plan: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('memberships');
    } catch (e) { fail('memberships', doc.id, e); }
  }
}

async function migrateMemberSubscriptions() {
  const docs = await mdb.collection('memberSubscriptions').find().toArray();
  const used = ['id', 'customerId', 'membershipId', 'planName', 'planSnapshot', 'status', 'sessionsRemaining',
    'walletBalance', 'freezeHistory', 'startAt', 'endAt', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('member_subscriptions', {
        id: doc.id, customer_id: doc.customerId || null, membership_id: doc.membershipId || null,
        plan_name: doc.planName || null, plan_snapshot: j(doc.planSnapshot || {}),
        status: doc.status || 'active', sessions_remaining: doc.sessionsRemaining ?? null,
        wallet_balance: doc.walletBalance ?? null, freeze_history: j(doc.freezeHistory || []),
        starts_at: d(doc.startAt), expires_at: d(doc.endAt),
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || d(doc.createdAt) || new Date(),
      });
      bump('member_subscriptions');
    } catch (e) { fail('member_subscriptions', doc.id, e); }
  }
}

async function migrateMembershipUsage() {
  const docs = await mdb.collection('membership_usage').find().toArray();
  const used = ['id', 'subscriptionId', 'bookingId', 'therapySlug', 'consumedAt'];
  for (const doc of docs) {
    try {
      await upsert('membership_usage', {
        id: doc.id, subscription_id: doc.subscriptionId, booking_id: doc.bookingId || null,
        therapy_slug: doc.therapySlug || null, consumed_at: d(doc.consumedAt) || new Date(),
        data: j(omit(doc, used)),
      });
      bump('membership_usage');
    } catch (e) { fail('membership_usage', doc.id, e); }
  }
}

async function migrateMembershipTransactions() {
  const docs = await mdb.collection('membership_transactions').find().toArray();
  const used = ['id', 'subscriptionId', 'type', 'amount', 'note', 'actorId', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('membership_transactions', {
        id: doc.id, subscription_id: doc.subscriptionId, type: doc.type || null,
        amount: doc.amount ?? null, note: doc.note || null, actor_id: doc.actorId || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('membership_transactions');
    } catch (e) { fail('membership_transactions', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Commerce
// ---------------------------------------------------------------------
async function migrateCoupons() {
  const docs = await mdb.collection('coupons').find().toArray();
  const used = ['id', 'code', 'discountType', 'discountValue', 'applicableTherapies', 'applicableBranches',
    'firstTimeOnly', 'active', 'startsAt', 'endsAt', 'usageLimit', 'usageCount', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('coupons', {
        id: doc.id, code: doc.code, discount_type: doc.discountType || 'flat', discount_value: doc.discountValue || 0,
        applicable_therapies: doc.applicableTherapies || [], applicable_branches: doc.applicableBranches || [],
        first_time_only: !!doc.firstTimeOnly, active: doc.active !== false,
        starts_at: d(doc.startsAt), expires_at: d(doc.endsAt),
        usage_limit: doc.usageLimit ?? null, usage_count: doc.usageCount || 0,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('coupons');
    } catch (e) { fail('coupons', doc.id, e); }
  }
}

async function migrateCouponRedemptions() {
  const docs = await mdb.collection('coupon_redemptions').find().toArray();
  const used = ['id', 'couponId', 'bookingId', 'customerId', 'subtotalInr', 'discountInr', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('coupon_redemptions', {
        id: doc.id, coupon_id: doc.couponId, booking_id: doc.bookingId || null, customer_id: doc.customerId || null,
        subtotal_inr: doc.subtotalInr ?? null, discount_inr: doc.discountInr ?? null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('coupon_redemptions');
    } catch (e) { fail('coupon_redemptions', doc.id, e); }
  }
}

async function migrateGiftcards() {
  const docs = await mdb.collection('giftcards').find().toArray();
  const used = ['id', 'code', 'balance', 'status', 'claimedByCustomerId', 'claimedAt', 'expiresAt', 'createdAt',
    'updatedAt', 'redemptions'];
  for (const doc of docs) {
    try {
      await upsert('giftcards', {
        id: doc.id, code: doc.code, pin: doc.pin || null, balance: doc.balance ?? 0, status: doc.status || 'active',
        claimed_by_customer_id: doc.claimedByCustomerId || null, claimed_at: d(doc.claimedAt),
        expires_at: d(doc.expiresAt), data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || d(doc.createdAt) || new Date(),
      });
      bump('giftcards');
    } catch (e) { fail('giftcards', doc.id, e); continue; }

    await pool.query('delete from giftcard_redemptions where giftcard_id = $1', [doc.id]);
    for (const r of doc.redemptions || []) {
      try {
        await pool.query(
          `insert into giftcard_redemptions (giftcard_id, booking_id, booking_ref, amount, created_at) values ($1,$2,$3,$4,$5)`,
          [doc.id, r.bookingId || null, r.bookingRef || null, r.amount || 0, d(r.at) || new Date()],
        );
      } catch (e) { fail('giftcard_redemptions', doc.id, e); }
    }
  }
}

// ---------------------------------------------------------------------
// Bookings — handles both the legacy single-therapy shape and the newer
// multi-therapy/schedule shape (the collection has a mix of both).
// ---------------------------------------------------------------------
async function migrateBookings() {
  const docs = await mdb.collection('bookings').find().toArray();
  const used = ['id', 'ref', 'branchId', 'customerId', 'bookedForOther', 'outcome', 'outcomeLabel', 'sessionMode',
    'contact', 'startAt', 'slotDate', 'slotTime', 'blockedFrom', 'blockedTo', 'guests', 'status', 'payment',
    'priceLine', 'total', 'pricingBreakdown', 'couponId', 'couponCode', 'couponDiscount', 'resourceId',
    'resourceName', 'createdAt', 'updatedAt', 'therapy', 'therapyLabel', 'therapies', 'schedule'];
  for (const doc of docs) {
    const startAt = doc.startAt || (doc.slotDate && doc.slotTime ? `${doc.slotDate}T${doc.slotTime}:00+05:30` : null);
    try {
      await upsert('bookings', {
        id: doc.id, ref: doc.ref, branch_id: doc.branchId || null, customer_id: doc.customerId || null,
        booked_for_other: !!doc.bookedForOther, outcome: doc.outcome || null, outcome_label: doc.outcomeLabel || null,
        session_mode: doc.sessionMode || null,
        contact_name: doc.contact?.name || '', contact_phone: doc.contact?.phone || '', contact_email: doc.contact?.email || '',
        start_at: d(startAt), blocked_from: d(doc.blockedFrom), blocked_to: d(doc.blockedTo),
        guests: doc.guests || 1, status: doc.status || 'confirmed', payment: doc.payment || 'at-visit',
        total: doc.total || 0, pricing_breakdown: doc.pricingBreakdown ? j(doc.pricingBreakdown) : null,
        coupon_id: doc.couponId || null, coupon_code: doc.couponCode || null, coupon_discount: doc.couponDiscount || 0,
        primary_resource_id: doc.resourceId || null, primary_resource_name: doc.resourceName || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || d(doc.createdAt) || new Date(),
      });
      bump('bookings');
    } catch (e) { fail('bookings', doc.id, e); continue; }

    const therapyLines = Array.isArray(doc.therapies) && doc.therapies.length > 0
      ? doc.therapies
      : (doc.therapy ? [{ slug: doc.therapy, label: doc.therapyLabel, role: 'Primary' }] : []);
    await pool.query('delete from booking_therapies where booking_id = $1', [doc.id]);
    let pos = 0;
    for (const t of therapyLines) {
      if (!t?.slug) continue;
      try {
        await pool.query(
          `insert into booking_therapies (booking_id, therapy_slug, label, role, duration_min, position, data) values ($1,$2,$3,$4,$5,$6,$7)`,
          [doc.id, t.slug, t.label || null, t.role || null, t.durationMin || null, pos++, j(omit(t, ['slug', 'label', 'role', 'durationMin']))],
        );
      } catch (e) { fail('booking_therapies', doc.id, e); }
    }

    const scheduleSteps = Array.isArray(doc.schedule) && doc.schedule.length > 0
      ? doc.schedule
      : (doc.resourceId && doc.blockedFrom && doc.blockedTo
          ? [{ therapySlug: therapyLines[0]?.slug || doc.therapy, resourceId: doc.resourceId, from: doc.blockedFrom, to: doc.blockedTo }]
          : []);
    await pool.query('delete from booking_schedule_items where booking_id = $1', [doc.id]);
    let spos = 0;
    for (const s of scheduleSteps) {
      if (!s?.resourceId || !s?.from || !s?.to) continue;
      try {
        await pool.query(
          `insert into booking_schedule_items (booking_id, therapy_slug, resource_id, starts_at, ends_at, position) values ($1,$2,$3,$4,$5,$6)`,
          [doc.id, s.therapySlug || null, s.resourceId, d(s.from), d(s.to), spos++],
        );
      } catch (e) { fail('booking_schedule_items', doc.id, e); }
    }
  }
}

async function migrateCalendarBlocks() {
  const docs = await mdb.collection('calendar_blocks').find().toArray();
  const used = ['id', 'scope', 'branchId', 'therapySlug', 'resourceId', 'startAt', 'endAt', 'reason', 'createdBy', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('calendar_blocks', {
        id: doc.id, branch_id: doc.branchId || null, resource_id: doc.resourceId || null,
        therapy_slug: doc.therapySlug || null, scope: doc.scope || 'branch', reason: doc.reason || null,
        starts_at: d(doc.startAt), ends_at: d(doc.endAt), created_by: doc.createdBy || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('calendar_blocks');
    } catch (e) { fail('calendar_blocks', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Loyalty
// ---------------------------------------------------------------------
async function migrateWalletTransactions() {
  const docs = await mdb.collection('wallet_transactions').find().toArray();
  const used = ['id', 'customerId', 'type', 'points', 'amountInr', 'note', 'ref', 'actorId', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('wallet_transactions', {
        id: doc.id, customer_id: doc.customerId, type: doc.type || null, points: doc.points || 0,
        amount_inr: doc.amountInr ?? null, note: doc.note || null, ref: doc.ref || null, actor_id: doc.actorId || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('wallet_transactions');
    } catch (e) { fail('wallet_transactions', doc.id, e); }
  }
}

async function migrateReferralCodes() {
  const docs = await mdb.collection('referral_codes').find().toArray();
  const used = ['id', 'code', 'customerId', 'usageCount', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('referral_codes', {
        id: doc.id, code: doc.code, customer_id: doc.customerId || null, usage_count: doc.usageCount || 0,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('referral_codes');
    } catch (e) { fail('referral_codes', doc.id, e); }
  }
}

async function migrateReferrals() {
  const docs = await mdb.collection('referrals').find().toArray();
  const used = ['id', 'referrerCustomerId', 'referredCustomerId', 'referralCodeId', 'totalInr', 'referrerReward', 'status', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('referrals', {
        id: doc.id, referrer_customer_id: doc.referrerCustomerId || null, referred_customer_id: doc.referredCustomerId || null,
        referral_code_id: doc.referralCodeId || null, total_inr: doc.totalInr || 0, referrer_reward: doc.referrerReward || 0,
        status: doc.status || 'pending', data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('referrals');
    } catch (e) { fail('referrals', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
async function migrateOtp() {
  const docs = await mdb.collection('otp').find().toArray();
  const used = ['id', 'phone', 'otpHash', 'attempts', 'used', 'usedAt', 'expiresAt', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('otp_codes', {
        id: doc.id, phone: doc.phone, otp_hash: doc.otpHash, attempts: doc.attempts || 0,
        used: !!doc.used, used_at: d(doc.usedAt), expires_at: d(doc.expiresAt),
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('otp_codes');
    } catch (e) { fail('otp_codes', doc.id, e); }
  }
}

async function migratePasswordResets() {
  const docs = await mdb.collection('passwordResets').find().toArray();
  const used = ['id', 'token', 'userId', 'expiresAt', 'used', 'usedAt', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('password_resets', {
        id: doc.id, user_id: doc.userId, token: doc.token, expires_at: d(doc.expiresAt),
        used: !!doc.used, used_at: d(doc.usedAt), data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('password_resets');
    } catch (e) { fail('password_resets', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Misc / CRM / CMS
// ---------------------------------------------------------------------
async function migrateActivityLog() {
  const docs = await mdb.collection('activityLog').find().toArray();
  const used = ['id', 'actorId', 'action', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('activity_log', {
        id: doc.id, actor_id: doc.actorId || null, action: doc.action || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('activity_log');
    } catch (e) { fail('activity_log', doc.id, e); }
  }
}

async function migrateCommunications() {
  const docs = await mdb.collection('communications').find().toArray();
  const used = ['id', 'customerId', 'channel', 'status', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('communications', {
        id: doc.id, customer_id: doc.customerId || null, channel: doc.channel || null, status: doc.status || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('communications');
    } catch (e) { fail('communications', doc.id, e); }
  }
}

async function migrateLeads() {
  const docs = await mdb.collection('leads').find().toArray();
  const used = ['id', 'name', 'email', 'company', 'teamSize', 'notes', 'source', 'status', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('leads', {
        id: doc.id, name: doc.name, email: doc.email, company: doc.company || null,
        team_size: doc.teamSize || null, notes: doc.notes || null, source: doc.source || 'unknown',
        status: doc.status || 'new', data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('leads');
    } catch (e) { fail('leads', doc.id, e); }
  }
}

async function migrateNotes() {
  const docs = await mdb.collection('notes').find().toArray();
  const used = ['id', 'parentType', 'parentId', 'body', 'authorId', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('notes', {
        id: doc.id, parent_type: doc.parentType, parent_id: doc.parentId, body: doc.body || '',
        author_id: doc.authorId || null, data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('notes');
    } catch (e) { fail('notes', doc.id, e); }
  }
}

async function migratePages() {
  const docs = await mdb.collection('pages').find().toArray();
  const used = ['id', 'slug', 'status', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('pages', {
        id: doc.id, slug: doc.slug, status: doc.status || 'draft', data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('pages');
    } catch (e) { fail('pages', doc.id, e); }
  }
}

async function migrateBlog() {
  const docs = await mdb.collection('blog').find().toArray();
  const used = ['id', 'slug', 'status', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('blog_posts', {
        id: doc.id, slug: doc.slug || null, status: doc.status || 'draft', data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('blog_posts');
    } catch (e) { fail('blog_posts', doc.id, e); }
  }
}

async function migrateMiniBlog() {
  const docs = await mdb.collection('mini_blog').find().toArray();
  const used = ['id', 'status', 'order', 'createdAt', 'updatedAt'];
  for (const doc of docs) {
    try {
      await upsert('mini_blog_posts', {
        id: doc.id, status: doc.status || 'draft', '"order"': doc.order || 0, data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(), updated_at: d(doc.updatedAt) || new Date(),
      });
      bump('mini_blog_posts');
    } catch (e) { fail('mini_blog_posts', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Commerce — invoices, payments, refunds
// ---------------------------------------------------------------------
async function migrateInvoices() {
  const docs = await mdb.collection('invoices').find().toArray();
  const used = ['id', 'number', 'customerId', 'customerName', 'bookingId', 'total', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('invoices', {
        id: doc.id, number: doc.number || null, booking_id: doc.bookingId || null, customer_id: doc.customerId || null,
        customer_name: doc.customerName || null, amount: doc.total || 0, status: 'issued',
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('invoices');
    } catch (e) { fail('invoices', doc.id, e); }
  }
}

async function migratePayments() {
  const docs = await mdb.collection('payments').find().toArray();
  const used = ['id', 'bookingId', 'customerId', 'amount', 'method', 'status', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('payments', {
        id: doc.id, booking_id: doc.bookingId || null, customer_id: doc.customerId || null,
        amount: doc.amount || 0, method: doc.method || null, status: doc.status || 'captured',
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('payments');
    } catch (e) { fail('payments', doc.id, e); }
  }
}

async function migrateRefunds() {
  const docs = await mdb.collection('refunds').find().toArray();
  const used = ['id', 'paymentId', 'bookingId', 'amount', 'status', 'reason', 'createdAt'];
  for (const doc of docs) {
    try {
      await upsert('refunds', {
        id: doc.id, payment_id: doc.paymentId || null, booking_id: doc.bookingId || null,
        amount: doc.amount || 0, status: doc.status || 'pending', reason: doc.reason || null,
        data: j(omit(doc, used)),
        created_at: d(doc.createdAt) || new Date(),
      });
      bump('refunds');
    } catch (e) { fail('refunds', doc.id, e); }
  }
}

// ---------------------------------------------------------------------
// Settings / integrations (polymorphic Mongo collections -> key/value tables)
// ---------------------------------------------------------------------
async function migrateSettings() {
  const docs = await mdb.collection('settings').find().toArray();
  for (const doc of docs) {
    try {
      await pool.query(
        `insert into app_settings (key, value, updated_by, updated_at) values ($1,$2,$3,$4)
         on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [doc.key, j(doc.value || {}), doc.updatedBy || null, d(doc.updatedAt) || new Date()],
      );
      bump('app_settings');
    } catch (e) { fail('app_settings', doc.key, e); }
  }
}

async function migrateIntegrations() {
  const docs = await mdb.collection('integrations').find().toArray();
  const used = ['key', 'createdAt', 'updatedAt', 'updatedBy'];
  for (const doc of docs) {
    try {
      await pool.query(
        `insert into integrations (key, value, updated_at) values ($1,$2,$3)
         on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
        [doc.key, j(omit(doc, used)), d(doc.updatedAt) || new Date()],
      );
      bump('integrations');
    } catch (e) { fail('integrations', doc.key, e); }
  }
}

// ---------------------------------------------------------------------
// Run — dependency order matters (FKs).
// ---------------------------------------------------------------------
console.log('Migrating branches, users, customers...');
await migrateBranches();
await migrateUsers();
await migrateCustomers();

console.log('Migrating catalog (therapies, resources)...');
await migrateTherapies();
await migrateResources();
// therapy_resources FKs need resources present — re-run therapy link pass
// now that resources definitely exist.
await migrateTherapies();

console.log('Migrating memberships...');
await migrateMemberships();
await migrateMemberSubscriptions();
await migrateMembershipUsage();
await migrateMembershipTransactions();

console.log('Migrating commerce (coupons, giftcards)...');
await migrateCoupons();
await migrateCouponRedemptions();
await migrateGiftcards();

console.log('Migrating bookings...');
await migrateBookings();
await migrateCalendarBlocks();

console.log('Migrating loyalty...');
await migrateWalletTransactions();
await migrateReferralCodes();
await migrateReferrals();

console.log('Migrating auth (otp, password resets)...');
await migrateOtp();
await migratePasswordResets();

console.log('Migrating CRM/CMS...');
await migrateActivityLog();
await migrateCommunications();
await migrateLeads();
await migrateNotes();
await migratePages();
await migrateBlog();
await migrateMiniBlog();

console.log('Migrating invoices/payments/refunds...');
await migrateInvoices();
await migratePayments();
await migrateRefunds();

console.log('Migrating settings/integrations...');
await migrateSettings();
await migrateIntegrations();

// Keep the invoice sequence ahead of any migrated numeric invoice numbers.
await pool.query(`select setval('invoice_number_seq', 1, false)`);

console.log('\n=== Summary ===');
for (const [k, v] of Object.entries(stats)) console.log(`${k}: ${v}`);
if (errors.length) {
  console.log(`\n=== ${errors.length} errors ===`);
  errors.forEach((e) => console.log(e));
} else {
  console.log('\nNo errors.');
}

await pool.end();
await mongoClient.close();
