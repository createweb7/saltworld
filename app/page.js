'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Plus, Search, MoreHorizontal, ExternalLink, Copy, Trash2, Pencil,
  Globe, FileEdit, Sun, Moon, ArrowRight, LayoutTemplate, Heart, Gift, Waves,
  Moon as MoonIcon, Dumbbell, Wind, X,
} from 'lucide-react';
import { Button, IconButton, Badge, Pill, Card } from '@/components/ss/primitives';
import { Field, Input } from '@/components/ss/forms';
import { cn } from '@/components/ss/utils';

const TEMPLATE_ICONS = {
  'couple-activities': Heart,
  'experience-gifts': Gift,
  'stress-relief': Wind,
  'better-sleep': MoonIcon,
  'athlete-recovery': Dumbbell,
  'float-therapy': Waves,
};

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const initial = typeof window !== 'undefined' && (
      localStorage.getItem('sw-theme') === 'dark' ||
      (!localStorage.getItem('sw-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
    setDark(!!initial);
    document.documentElement.classList.toggle('dark', !!initial);
  }, []);
  const toggle = useCallback(() => {
    setDark(d => {
      const nd = !d;
      document.documentElement.classList.toggle('dark', nd);
      localStorage.setItem('sw-theme', nd ? 'dark' : 'light');
      return nd;
    });
  }, []);
  return { dark, toggle };
}

const timeAgo = (iso) => {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ------------------------------- Template picker modal ------------------------------- */
const TemplateModal = ({ open, onClose, templates, onCreate, creating }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-12 border-b border-border">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            <div className="text-[13.5px] font-semibold">Start from a template</div>
          </div>
          <IconButton onClick={onClose}><X className="h-3.5 w-3.5" /></IconButton>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          <button disabled={creating}
            onClick={() => onCreate(null)}
            className="text-left rounded-xl border border-dashed border-border p-4 hover:border-foreground hover:bg-muted/40 transition-colors disabled:opacity-50">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center mb-3">
              <Plus className="h-4 w-4" />
            </div>
            <div className="text-[13.5px] font-semibold">Blank page</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Start from a hero + CTA. Add sections as you go.</div>
          </button>
          {templates.map(t => {
            const Icon = TEMPLATE_ICONS[t.id] || LayoutTemplate;
            return (
              <button key={t.id} disabled={creating}
                onClick={() => onCreate(t.id)}
                className="text-left rounded-xl border border-border p-4 hover:border-foreground hover:bg-muted/40 transition-colors disabled:opacity-50">
                <div className="h-9 w-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[13.5px] font-semibold">{t.name}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{t.description}</div>
                <div className="mt-3"><Pill tone="brand">{t.accent}</Pill></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Row actions menu ------------------------------- */
const RowMenu = ({ page, onDuplicate, onDelete, onTogglePublish }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [open]);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <IconButton onClick={() => setOpen(v => !v)}><MoreHorizontal className="h-3.5 w-3.5" /></IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover shadow-lg z-30 py-1">
          <button onClick={() => { setOpen(false); onDuplicate(page); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted text-left">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button onClick={() => { setOpen(false); onTogglePublish(page); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted text-left">
            {page.status === 'published' ? <><FileEdit className="h-3.5 w-3.5" /> Unpublish</> : <><Globe className="h-3.5 w-3.5" /> Publish</>}
          </button>
          <div className="my-1 h-px bg-border" />
          <button onClick={() => { setOpen(false); onDelete(page); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-destructive/10 text-destructive text-left">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

/* ------------------------------- Page ------------------------------- */
const App = () => {
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const [pages, setPages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | published | draft
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, tRes] = await Promise.all([fetch('/api/pages'), fetch('/api/templates')]);
    setPages(await pRes.json());
    setTemplates(await tRes.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (templateId) => {
    setCreating(true);
    const r = await fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId }) });
    const doc = await r.json();
    setCreating(false);
    setModal(false);
    router.push(`/builder/${doc.id}`);
  };
  const duplicate = async (p) => {
    const r = await fetch(`/api/pages/${p.id}/duplicate`, { method: 'POST' });
    const doc = await r.json();
    setPages(cur => [doc, ...cur]);
  };
  const del = async (p) => {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    await fetch(`/api/pages/${p.id}`, { method: 'DELETE' });
    setPages(cur => cur.filter(x => x.id !== p.id));
  };
  const togglePub = async (p) => {
    const url = p.status === 'published' ? `/api/pages/${p.id}/unpublish` : `/api/pages/${p.id}/publish`;
    const r = await fetch(url, { method: 'POST' });
    const doc = await r.json();
    setPages(cur => cur.map(x => x.id === doc.id ? doc : x));
  };

  const filtered = pages.filter(p =>
    (filter === 'all' || p.status === filter) &&
    (q === '' || p.title?.toLowerCase().includes(q.toLowerCase()) || p.slug?.includes(q.toLowerCase()))
  );
  const counts = { all: pages.length, published: pages.filter(p => p.status === 'published').length, draft: pages.filter(p => p.status === 'draft').length };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-foreground text-background grid place-items-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight">Salt World · Marketing</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">Landing Page Builder</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors">
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Button variant="primary" size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setModal(true)}>New page</Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 pt-10 pb-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Marketing Platform</div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Landing pages</h1>
            <p className="mt-2 text-[14.5px] text-muted-foreground max-w-xl">Compose, preview, and publish landing pages from reusable design-system blocks. Zero code.</p>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{counts.all} pages</Pill>
            <Pill tone="success">{counts.published} live</Pill>
            <Pill tone="warn">{counts.draft} drafts</Pill>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px] max-w-md">
            <Field><Input placeholder="Search pages…" value={q} onChange={(e) => setQ(e.target.value)} iconLeft={<Search className="h-3.5 w-3.5" />} /></Field>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-card">
            {['all', 'published', 'draft'].map(k => (
              <button key={k} onClick={() => setFilter(k)}
                className={cn(
                  'px-2.5 h-7 rounded text-[12.5px] font-medium capitalize transition-colors',
                  filter === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                )}>{k}</button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
                  <div className="h-4 w-2/3 bg-muted rounded" />
                  <div className="mt-3 h-3 w-1/2 bg-muted rounded" />
                  <div className="mt-6 h-8 w-24 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-14 text-center">
              <div className="h-10 w-10 mx-auto rounded-full bg-muted grid place-items-center"><LayoutTemplate className="h-4 w-4" /></div>
              <div className="mt-4 text-[15px] font-semibold">No pages yet</div>
              <div className="mt-1 text-[13px] text-muted-foreground max-w-sm mx-auto">Start from a Salt World template — Couple Activities, Better Sleep, Float Therapy — or build from a blank canvas.</div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <Button variant="primary" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setModal(true)}>Create your first page</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p => (
                <Card key={p.id} className="p-0 overflow-hidden hover:border-foreground/30 transition-colors group" interactive>
                  <Link href={`/builder/${p.id}`} className="block">
                    <div className="relative h-32 bg-gradient-to-br from-brand/15 via-muted to-background border-b border-border overflow-hidden">
                      <div className="absolute inset-0 grid-bg opacity-60" />
                      <div className="absolute inset-0 flex flex-col justify-end p-4">
                        <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">/{p.slug}</div>
                      </div>
                      <div className="absolute top-3 right-3">
                        {p.status === 'published'
                          ? <Badge tone="success"><Globe className="h-2.5 w-2.5" /> Live</Badge>
                          : <Badge tone="warn"><FileEdit className="h-2.5 w-2.5" /> Draft</Badge>}
                      </div>
                    </div>
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/builder/${p.id}`} className="flex-1 min-w-0">
                        <div className="text-[14.5px] font-semibold truncate">{p.title}</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">
                          {(p.sections || []).length} sections · updated {timeAgo(p.updatedAt)}
                        </div>
                      </Link>
                      <RowMenu page={p} onDuplicate={duplicate} onDelete={del} onTogglePublish={togglePub} />
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <Link href={`/builder/${p.id}`}>
                        <Button variant="outline" size="sm" iconLeft={<Pencil className="h-3 w-3" />}>Edit</Button>
                      </Link>
                      {p.status === 'published' && (
                        <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm" iconRight={<ExternalLink className="h-3 w-3" />}>View live</Button>
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <TemplateModal open={modal} onClose={() => setModal(false)} templates={templates} onCreate={create} creating={creating} />
    </div>
  );
};

export default App;
