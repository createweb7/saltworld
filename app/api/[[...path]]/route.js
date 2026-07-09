import { NextResponse } from 'next/server';
import { getDb, clean } from '@/lib/mongo';
import { TEMPLATES, getTemplate, emptyPage } from '@/lib/templates';
import { randomUUID } from 'crypto';

const slugify = (s) => (s || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';

async function uniqueSlug(db, base) {
  let slug = base, i = 1;
  while (await db.collection('pages').findOne({ slug })) slug = `${base}-${++i}`;
  return slug;
}

async function handle(req, method, segs) {
  const db = await getDb();
  const col = db.collection('pages');
  const bookings = db.collection('bookings');

  // ------- Bookings -------
  if (segs[0] === 'bookings') {
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json();
      const now = new Date();
      const yy = String(now.getFullYear()).slice(2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const ref = `SW-${yy}${mm}-${rand}`;
      const doc = {
        id: randomUUID(),
        ref,
        outcome:   body.outcome   || null,
        therapy:   body.therapy   || null,
        slotDate:  body.slotDate  || null,
        slotTime:  body.slotTime  || null,
        guests:    body.guests    || 1,
        contact:   body.contact   || {},
        payment:   body.payment   || 'at-visit',
        priceLine: body.priceLine || null,
        total:     body.total     || 0,
        status:    'confirmed',
        createdAt: now.toISOString(),
      };
      await bookings.insertOne(doc);
      const { _id, ...clean } = doc;
      return NextResponse.json(clean);
    }
    if (segs[1] && method === 'GET') {
      const doc = await bookings.findOne({ id: segs[1] });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const { _id, ...cleanDoc } = doc;
      return NextResponse.json(cleanDoc);
    }
  }

  // /api/templates
  if (segs[0] === 'templates') {
    return NextResponse.json(TEMPLATES.map(({ id, name, description, accent }) => ({ id, name, description, accent })));
  }

  // /api/pages
  if (segs[0] === 'pages') {
    // list
    if (segs.length === 1 && method === 'GET') {
      const docs = await col.find({}).sort({ updatedAt: -1 }).limit(200).toArray();
      return NextResponse.json(docs.map(clean));
    }
    // create
    if (segs.length === 1 && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const tmpl = body.templateId ? getTemplate(body.templateId) : null;
      const base = tmpl
        ? { title: body.title || tmpl.name, description: tmpl.description, template: tmpl.id, sections: tmpl.build(), seo: { metaTitle: tmpl.seo.metaTitle, metaDescription: tmpl.seo.metaDescription, ogImage: '', canonical: '' } }
        : emptyPage(body.title || 'Untitled');
      base.sections = (base.sections || []).map(s => ({ id: randomUUID(), ...s }));
      const now = new Date().toISOString();
      const doc = {
        id: randomUUID(),
        slug: await uniqueSlug(db, slugify(base.title)),
        status: 'draft',
        ...base,
        createdAt: now, updatedAt: now, publishedAt: null,
      };
      await col.insertOne(doc);
      return NextResponse.json(clean(doc));
    }

    // /api/pages/by-slug/:slug  (public)
    if (segs[1] === 'by-slug' && segs[2] && method === 'GET') {
      const doc = await col.findOne({ slug: segs[2], status: 'published' });
      if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json(clean(doc));
    }

    const id = segs[1];
    if (id) {
      if (segs[2] === 'duplicate' && method === 'POST') {
        const src = await col.findOne({ id });
        if (!src) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        const now = new Date().toISOString();
        const newTitle = `${src.title} (copy)`;
        const copy = {
          ...src, _id: undefined, id: randomUUID(),
          slug: await uniqueSlug(db, slugify(newTitle)),
          title: newTitle, status: 'draft', createdAt: now, updatedAt: now, publishedAt: null,
        };
        delete copy._id;
        await col.insertOne(copy);
        return NextResponse.json(clean(copy));
      }
      if (segs[2] === 'publish' && method === 'POST') {
        const now = new Date().toISOString();
        await col.updateOne({ id }, { $set: { status: 'published', publishedAt: now, updatedAt: now } });
        const doc = await col.findOne({ id });
        return NextResponse.json(clean(doc));
      }
      if (segs[2] === 'unpublish' && method === 'POST') {
        const now = new Date().toISOString();
        await col.updateOne({ id }, { $set: { status: 'draft', updatedAt: now } });
        const doc = await col.findOne({ id });
        return NextResponse.json(clean(doc));
      }
      if (method === 'GET') {
        const doc = await col.findOne({ id });
        if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
        return NextResponse.json(clean(doc));
      }
      if (method === 'PATCH') {
        const body = await req.json();
        const now = new Date().toISOString();
        const $set = { updatedAt: now };
        for (const k of ['title', 'description', 'sections', 'seo']) if (k in body) $set[k] = body[k];
        if (body.title) {
          const cur = await col.findOne({ id });
          if (cur && slugify(cur.title) === cur.slug) $set.slug = await uniqueSlug(db, slugify(body.title));
        }
        if (body.slug) $set.slug = await uniqueSlug(db, slugify(body.slug));
        await col.updateOne({ id }, { $set });
        const doc = await col.findOne({ id });
        return NextResponse.json(clean(doc));
      }
      if (method === 'DELETE') {
        await col.deleteOne({ id });
        return NextResponse.json({ ok: true });
      }
    }
  }

  if (segs[0] === 'health' || segs.length === 0) {
    return NextResponse.json({ ok: true, service: 'salt-world-builder' });
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

const route = (m) => async (req, ctx) => {
  try {
    const { path = [] } = await ctx.params;
    return await handle(req, m, path);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
};

export const GET = route('GET');
export const POST = route('POST');
export const PATCH = route('PATCH');
export const DELETE = route('DELETE');
