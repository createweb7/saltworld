'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, Upload, Image as ImageIcon, FileText, ExternalLink, Copy } from 'lucide-react';
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

export default function CmsClient({ user }) {
  const [tab, setTab] = useState('pages');
  const pages = useQuery({ queryKey: ['cms-pages'], queryFn: fetchPages, enabled: tab === 'pages' });
  const media = useQuery({ queryKey: ['cms-media'], queryFn: fetchMedia, enabled: tab === 'media' });
  const blog  = useQuery({ queryKey: ['cms-blog'],  queryFn: fetchBlog,  enabled: tab === 'blog' });

  return (
    <AdminShell user={user} title="CMS" actions={<CmsActions tab={tab} />}>
      <PageHeader eyebrow="Content" title="CMS" subtitle="Landing pages built visually, media library, and journal posts." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={[
            { key: 'pages', label: 'Pages', count: pages.data?.length },
            { key: 'blog',  label: 'Journal', count: blog.data?.length },
            { key: 'media', label: 'Media library', count: media.data?.length },
          ]} active={tab} onChange={setTab} />
        </div>
        {tab === 'pages' && <PagesTab data={pages.data || []} loading={pages.isLoading} />}
        {tab === 'blog'  && <BlogTab  data={blog.data  || []} loading={blog.isLoading} qc={pages.queryClient} />}
        {tab === 'media' && <MediaTab data={media.data || []} loading={media.isLoading} />}
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
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean) };
      const url = isEdit ? `/api/admin/cms/blog/${initial.id}` : '/api/admin/cms/blog';
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Journal" title={isEdit ? `Edit “${initial.title}”` : 'New journal post'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Title" required><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Slug" hint="Auto-generated if blank"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Field label="Cover image URL"><Input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="https://…" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></Select></Field>
        </div>
        <Field label="Tags (comma separated)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
        <Field label="Excerpt"><Textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></Field>
        <Field label="Body (markdown)"><Textarea rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="font-mono text-[12.5px]" /></Field>
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
