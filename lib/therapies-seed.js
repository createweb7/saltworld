// Salt World — System therapies seed.
// These 5 therapies are the master services offered by Salt World and must
// mirror the public landing pages at /therapies/[slug]. Marketing content
// (whoFor / benefits / science / FAQs / gallery) lives in lib/therapies.js
// as dev-controlled copy. Operational configuration (duration, buffers,
// price, resources, branch availability, SEO overrides, hero images) lives
// in MongoDB and is edited via the Admin CMS.

import { randomUUID } from 'crypto';
import { getDb } from '@/lib/mongo';
import { getDefaultBranch } from '@/lib/branches';

// System therapy seeds — slugs MUST match the landing-page routes.
const SYSTEM_THERAPIES = [
  {
    slug: 'float-therapy',
    name: 'Float Therapy',
    durationMin: 60,
    preBufferMin: 5,
    postBufferMin: 5,
    cleaningBufferMin: 15,
    defaultPrice: 2499,
    description: 'Ten inches of body-temperature water. Zero gravity. Sixty minutes of nothing.',
    heroImage: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1600&q=80',
    defaultResources: [
      { name: 'Float Tank 1', type: 'float_tank', supportedModes: ['single', 'couple'] },
      { name: 'Float Tank 2', type: 'float_tank', supportedModes: ['single', 'couple'] },
    ],
    seo: { title: 'Float Therapy in Bengaluru — Salt World', description: 'Sixty minutes in half a tonne of magnesium. Zero gravity, deep recovery, restored calm.' },
  },
  {
    slug: 'salt-therapy',
    name: 'Halotherapy',
    durationMin: 45,
    preBufferMin: 5,
    postBufferMin: 5,
    cleaningBufferMin: 10,
    defaultPrice: 1499,
    description: 'Forty-five minutes in a heated salt-lined sanctuary. Deeper sleep, clearer breathing.',
    heroImage: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=1600&q=80',
    defaultResources: [{ name: 'Salt Cave', type: 'salt_cave', capacity: 4 }],
    seo: { title: 'Halotherapy — Dry salt therapy in Bengaluru', description: 'Forty-five minutes in a salt-lined sanctuary. Deeper sleep, clearer breathing, calmer nervous system.' },
  },
  {
    slug: 'infrared-sauna',
    name: 'Infrared Sauna',
    durationMin: 35,
    preBufferMin: 5,
    postBufferMin: 5,
    cleaningBufferMin: 10,
    defaultPrice: 1299,
    description: 'Thirty-five minutes of deep-heat cellular therapy. Recovery, longevity, calm.',
    heroImage: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1600&q=80',
    defaultResources: [{ name: 'Infrared Sauna Room', type: 'sauna_room', capacity: 2 }],
    seo: { title: 'Infrared Sauna in Bengaluru — Salt World', description: 'Thirty-five minutes of deep-heat cellular therapy. Recovery, longevity, calm.' },
  },
  {
    slug: 'cold-plunge',
    name: 'Cold Plunge',
    durationMin: 5, // includes 2-4 minute plunge + entry/exit ritual
    preBufferMin: 3,
    postBufferMin: 5,
    cleaningBufferMin: 5,
    defaultPrice: 999,
    description: 'Two minutes at 10°C. A week of resilience.',
    heroImage: 'https://images.unsplash.com/photo-1522547902298-51566e4fb383?w=1600&q=80',
    defaultResources: [{ name: 'Cold Plunge Pool', type: 'plunge_pool' }],
    seo: { title: 'Cold Plunge in Bengaluru — Salt World', description: 'Two minutes at 10°C, a week of resilience. Dopamine, recovery, calm.' },
  },
  {
    slug: 'red-light-therapy',
    name: 'Red-light Therapy',
    durationMin: 20,
    preBufferMin: 3,
    postBufferMin: 3,
    cleaningBufferMin: 5,
    defaultPrice: 1199,
    description: 'Photobiomodulation for skin and mitochondria. Twenty minutes, no downtime.',
    heroImage: 'https://images.unsplash.com/photo-1611443094820-3fdd4d7a4d18?w=1600&q=80',
    defaultResources: [{ name: 'Red Light Studio', type: 'red_light_studio' }],
    seo: { title: 'Red-Light Therapy in Bengaluru — Salt World', description: 'Photobiomodulation for skin, recovery, and mitochondrial health. Twenty minutes, no downtime.' },
  },
];

// Idempotent — upserts by slug, marks isSystem, adds default per-branch
// resources for the default branch on first run. Does not overwrite admin
// edits on subsequent runs.
export async function seedSystemTherapies() {
  const db = await getDb();
  const now = new Date().toISOString();
  const defaultBranch = await getDefaultBranch();
  const defaultBranchId = defaultBranch?.id || null;

  await db.collection('therapies').createIndex({ slug: 1 }, { unique: true });
  await db.collection('resources').createIndex({ id: 1 }, { unique: true });

  for (const seed of SYSTEM_THERAPIES) {
    const existing = await db.collection('therapies').findOne({ slug: seed.slug });
    if (existing) {
      // Idempotent: ensure isSystem flag is set (in case of legacy row).
      if (!existing.isSystem) {
        await db.collection('therapies').updateOne(
          { slug: seed.slug },
          { $set: { isSystem: true, updatedAt: now } },
        );
      }
      continue;
    }

    // Seed default resources for the default branch and link them to the therapy.
    const resourceIds = [];
    if (defaultBranchId) {
      for (const r of seed.defaultResources) {
        const rid = randomUUID();
        await db.collection('resources').insertOne({
          id: rid,
          name: r.name,
          type: r.type,
          capacity: r.capacity || 1,
          supportedModes: Array.isArray(r.supportedModes) && r.supportedModes.length > 0
            ? r.supportedModes
            : ['single', 'couple'],
          branchId: defaultBranchId,
          therapySlug: seed.slug,
          active: true,
          createdAt: now,
        });
        resourceIds.push(rid);
      }
    }

    const doc = {
      id: randomUUID(),
      slug: seed.slug,
      name: seed.name,
      isSystem: true,
      active: true,
      onlineBookingEnabled: true,
      durationMin: seed.durationMin,
      preBufferMin: seed.preBufferMin,
      postBufferMin: seed.postBufferMin,
      cleaningBufferMin: seed.cleaningBufferMin,
      maxCapacity: 1,
      defaultPrice: seed.defaultPrice,
      taxHsn: '999722',
      description: seed.description,
      heroImage: seed.heroImage,
      images: [],
      resourceIds,
      branchIds: [], // empty = all branches; per-branch scoping via resources[].branchId
      seo: seed.seo,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('therapies').insertOne(doc);
  }
}

export const SYSTEM_THERAPY_SLUGS = SYSTEM_THERAPIES.map((t) => t.slug);
