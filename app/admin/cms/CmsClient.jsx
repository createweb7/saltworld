'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Upload, Image as ImageIcon, FileText, ExternalLink, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn,
} from '@/components/admin/primitives';

async function fetchPages() {
  const res = await fetch('/api/pages?status=all');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchMedia() {
  const res = await fetch('/api/admin/cms/media');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchBlog() {
  const res = await fetch('/api/admin/cms/blog');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchMiniBlog() {
  const res = await fetch('/api/admin/cms/mini-blog');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function CmsClient({ user }) {
  const [tab, setTab] = useState('pages');
  const pages     = useQuery({ queryKey: ['cms-pages'],     queryFn: fetchPages,     enabled: tab === 'pages' });
  const media     = useQuery({ queryKey: ['cms-media'],     queryFn: fetchMedia,     enabled: tab === 'media' });
  const blog      = useQuery({ queryKey: ['cms-blog'],      queryFn: fetchBlog,      enabled: tab === 'blog' });
  const miniBlog  = useQuery({ queryKey: ['cms-mini-blog'], queryFn: fetchMiniBlog,  enabled: tab === 'mini-blog' });

  return (
    <AdminShell user={user} title="CMS" actions={<CmsActions tab={tab} />}>
      <PageHeader eyebrow="Content" title="CMS" subtitle="Landing pages built visually, media library, long-form journal, and short-form mini-blogs." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={[
            { key: 'pages',      label: 'Pages',      count: pages.data?.length },
            { key: 'blog',       label: 'Journal',    count: blog.data?.length },
            { key: 'mini-blog',  label: 'Mini-blogs', count: miniBlog.data?.length },
            { key: 'media',      label: 'Media library', count: media.data?.length },
          ]} active={tab} onChange={setTab} />
        </div>
        {tab === 'pages'      && <PagesTab     data={pages.data     || []} loading={pages.isLoading} />}
        {tab === 'blog'       && <BlogTab      data={blog.data      || []} loading={blog.isLoading} />}
        {tab === 'mini-blog'  && <MiniBlogTab  data={miniBlog.data  || []} loading={miniBlog.isLoading} />}
        {tab === 'media'      && <MediaTab     data={media.data     || []} loading={media.isLoading} />}
      </AdminSection>
    </AdminShell>
  );
}

function CmsActions({ tab }) {
  if (tab === 'pages') return <Link href="/admin" className="h-8 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Open page builder</Link>;
  return null;
}

function PagesTab({ data, loading }) {
  const columns = [
    { key: 'title',  label: 'Page',  render: (r) => <div><div className="font-medium text-[13px]">{r.title}</div><div className="text-[11px] text-muted-foreground font-mono">/{r.slug}</div></div> },
    { key: 'status', label: 'Status', render: (r) => <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${r.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{r.status}</span> },
    { key: 'updatedAt', label: 'Updated', render: (r) => new Date(r.updatedAt || r.createdAt).toLocaleDateString() },
    { key: 'actions',   label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <Link href={`/builder/${r.id}`} className="h-7 px-3 rounded-md border border-border text-[11.5px] font-medium hover:bg-muted inline-flex items-center gap-1"><Edit3 className="h-3 w-3" /> Edit</Link>
        {r.status === 'published' && <Link href={`/p/${r.slug}`} target="_blank" className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><ExternalLink className="h-3.5 w-3.5" /></Link>}
      </div>
    )},
  ];
  return <SimpleTable columns={columns} rows={data} isLoading={loading} empty={<>No pages yet. <Link href="/admin" className="underline underline-offset-4">Open the builder</Link> to create your first page.</>} />;
}

function BlogTab({ data, loading }) {
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const remove = async (id) => {
    if (!confirm('Delete this post?')) return;
    const res = await fetch(`/api/admin/cms/blog/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['cms-blog'] }); }
  };
  const columns = [
    { key: 'title',    label: 'Title', render: (r) => <div><div className="font-medium text-[13px]">{r.title}</div><div className="text-[11px] text-muted-foreground font-mono">/journal/{r.slug}</div></div> },
    { key: 'category', label: 'Category' },
    { key: 'status',   label: 'Status', render: (r) => <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${r.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{r.status}</span> },
    { key: 'updatedAt',label: 'Updated', render: (r) => new Date(r.updatedAt || r.createdAt).toLocaleDateString() },
    { key: 'actions',  label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); remove(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];
  return (
    <>
      <div className="mb-3 flex justify-end">
        <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New journal post</PrimaryBtn>
      </div>
      <SimpleTable columns={columns} rows={data} isLoading={loading} empty="No posts yet." />
      {(newOpen || editing) && <BlogEditor initial={editing} onClose={() => { setEditing(null); setNewOpen(false); }} onSaved={() => { qc.invalidateQueries({ queryKey: ['cms-blog'] }); setEditing(null); setNewOpen(false); }} />}
    </>
  );
}

import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(() => import('@/components/admin/rich-text-editor'), { ssr: false });

function BlogEditor({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    title: initial?.title || '',
    slug: initial?.slug || '',
    excerpt: initial?.excerpt || '',
    body: initial?.body || '',
    coverUrl: initial?.coverUrl || '',
    category: initial?.category || 'Wellness',
    tags: (initial?.tags || []).join(', '),
    status: initial?.status || 'draft',
    // SEO metadata
    seoTitle:       initial?.seo?.title       || '',
    seoDescription: initial?.seo?.description || '',
    ogImage:        initial?.seo?.ogImage     || '',
    canonicalUrl:   initial?.seo?.canonicalUrl|| '',
  });
  const [showSeo, setShowSeo] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        seo: { title: form.seoTitle, description: form.seoDescription, ogImage: form.ogImage, canonicalUrl: form.canonicalUrl },
      };
      // Trim redundant top-level fields
      delete body.seoTitle; delete body.seoDescription; delete body.ogImage; delete body.canonicalUrl;
      const url = isEdit ? `/api/admin/cms/blog/${initial.id}` : '/api/admin/cms/blog';
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Journal" title={isEdit ? `Edit “${initial.title}”` : 'New journal post'} wide
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug" hint="Auto-generated if blank"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Tags (comma separated)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
        </div>
        <Field label="Cover image URL"><Input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Excerpt"><Textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="One or two sentences shown in listing cards + search snippets." /></Field>
        <Field label="Body" hint="Notion-style editor — internal links (/journal/…), external links, images, videos, tables, quotes, headings, lists.">
          <RichTextEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} minHeight={360} placeholder="Start writing your essay…" />
        </Field>

        <button type="button" onClick={() => setShowSeo(!showSeo)} className="w-full text-left text-[11.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground py-2 hover:text-foreground">
          {showSeo ? '−' : '+'} SEO &amp; social preview
        </button>
        {showSeo && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <Field label="SEO title" hint="Overrides the page <title>. Leave blank to use Title."><Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></Field>
            <Field label="SEO description" hint="Search-result snippet, 150–160 chars."><Textarea rows={2} value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></Field>
            <Field label="Open Graph image URL" hint="Shown when the article is shared on WhatsApp/social."><Input value={form.ogImage} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} /></Field>
            <Field label="Canonical URL" hint="Set only if this content lives on another URL."><Input value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} /></Field>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function MiniBlogTab({ data, loading }) {
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const qc = useQueryClient();
  const remove = async (id) => {
    if (!confirm('Delete this mini-blog?')) return;
    const res = await fetch(`/api/admin/cms/mini-blog/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['cms-mini-blog'] }); }
  };
  const reorder = async (row, delta) => {
    const res = await fetch(`/api/admin/cms/mini-blog/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: (row.order || 0) + delta }),
    });
    if (res.ok) { qc.invalidateQueries({ queryKey: ['cms-mini-blog'] }); }
  };
  const columns = [
    { key: 'title', label: 'Mini-blog', render: (r) => (
      <div className="flex items-center gap-3">
        {r.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
        ) : (
          <div className="h-9 w-9 rounded-md bg-muted border border-border" />
        )}
        <div>
          <div className="font-medium text-[13px]">{r.title}</div>
          <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[380px]">{r.body}</div>
        </div>
      </div>
    ) },
    { key: 'tag',   label: 'Tag', render: (r) => r.tag || <span className="text-muted-foreground">—</span> },
    { key: 'order', label: 'Order', render: (r) => (
      <div className="inline-flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); reorder(r, -1); }} className="h-6 w-6 rounded hover:bg-muted text-muted-foreground inline-flex items-center justify-center" aria-label="Move up"><ArrowUp className="h-3 w-3" /></button>
        <span className="text-[12px] font-mono w-4 text-center">{r.order ?? 0}</span>
        <button onClick={(e) => { e.stopPropagation(); reorder(r, 1); }} className="h-6 w-6 rounded hover:bg-muted text-muted-foreground inline-flex items-center justify-center" aria-label="Move down"><ArrowDown className="h-3 w-3" /></button>
      </div>
    ) },
    { key: 'status',label: 'Status', render: (r) => <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-semibold ${r.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{r.status}</span> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); remove(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11.5px] text-muted-foreground">Bite-sized posts (≤200 words) that appear as a “Salt Notes” strip on the homepage.</div>
        <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New mini-blog</PrimaryBtn>
      </div>
      <SimpleTable columns={columns} rows={data} isLoading={loading} empty="No mini-blogs yet. Publish 3–6 to feed the homepage strip." />
      {(newOpen || editing) && <MiniBlogEditor initial={editing} onClose={() => { setEditing(null); setNewOpen(false); }} onSaved={() => { qc.invalidateQueries({ queryKey: ['cms-mini-blog'] }); setEditing(null); setNewOpen(false); }} />}
    </>
  );
}

function MiniBlogEditor({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    title: initial?.title || '',
    body: initial?.body || '',
    imageUrl: initial?.imageUrl || '',
    linkHref: initial?.linkHref || '',
    linkLabel: initial?.linkLabel || '',
    tag: initial?.tag || '',
    order: initial?.order ?? 0,
    status: initial?.status || 'draft',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/cms/mini-blog/${initial.id}` : '/api/admin/cms/mini-blog';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, order: Number(form.order) || 0 }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Mini-blog" title={isEdit ? `Edit “${initial.title}”` : 'New mini-blog'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="One sharp headline" /></Field>
        <Field label="Body (≤200 words)" hint="Short-form insight, quote, or tip."><RichTextEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} minHeight={160} placeholder="A quick insight, tip or quote…" /></Field>
        <Field label="Image URL" hint="Displayed as the mini-blog card cover"><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CTA label" hint="Optional"><Input value={form.linkLabel} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} placeholder="Read the guide" /></Field>
          <Field label="CTA link" hint="Optional"><Input value={form.linkHref} onChange={(e) => setForm({ ...form, linkHref: e.target.value })} placeholder="/journal/… or https://…" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tag"><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Sleep, Stress…" /></Field>
          <Field label="Order" hint="Lower = earlier"><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></Select></Field>
        </div>
      </div>
    </Drawer>
  );
}

function MediaTab({ data, loading }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('alt', file.name);
        const res = await fetch('/api/admin/cms/media', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('failed');
      }
      toast.success(`Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['cms-media'] });
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };
  const remove = async (id) => {
    if (!confirm('Delete this asset?')) return;
    const res = await fetch(`/api/admin/cms/media/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['cms-media'] }); }
  };
  const copyUrl = (url) => { navigator.clipboard.writeText(url); toast.success('Copied URL'); };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <input ref={fileRef} type="file" multiple accept="image/*" hidden onChange={(e) => upload(e.target.files)} />
        <PrimaryBtn onClick={() => fileRef.current?.click()} disabled={uploading} className="h-9 px-3"><Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload image'}</PrimaryBtn>
        <div className="text-[11.5px] text-muted-foreground">{data.length} asset{data.length === 1 ? '' : 's'} · S3 = configure keys in Settings → Integrations</div>
      </div>
      {loading && <div className="py-10 text-center text-[12.5px] text-muted-foreground">Loading…</div>}
      {!loading && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <div className="text-[13px]">No media yet</div>
          <div className="text-[12px] text-muted-foreground mt-1">Uploads fall back to local disk when S3 keys aren&rsquo;t configured.</div>
        </div>
      )}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {data.map((a) => (
            <div key={a.id} className="group relative rounded-lg overflow-hidden border border-border bg-card aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.alt || ''} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/60 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                <div className="flex gap-1">
                  <button onClick={() => copyUrl(a.url)} className="h-7 w-7 rounded-md bg-background/90 text-foreground inline-flex items-center justify-center"><Copy className="h-3 w-3" /></button>
                  <button onClick={() => remove(a.id)} className="h-7 w-7 rounded-md bg-red-500 text-white inline-flex items-center justify-center"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
              <div className="absolute top-2 left-2 text-[9px] uppercase tracking-[0.14em] font-semibold px-1.5 py-0.5 rounded bg-background/85 text-foreground">{a.storage || 'local'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
