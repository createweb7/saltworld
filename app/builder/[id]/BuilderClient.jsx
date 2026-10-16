'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, Monitor, Smartphone, Globe, FileEdit, Plus, Trash2, Copy,
  GripVertical, ChevronDown, ChevronRight, Layers, Search as SearchIcon,
  Sparkles, MessageSquareQuote, IndianRupee, ArrowRight as ArrowRightIcon,
  Save, Loader2, ExternalLink, X, LayoutList, Wrench, MessageSquare, Star,
} from 'lucide-react';
import { Button, IconButton, Badge, Pill, Card } from '@/components/ss/primitives';
import { Field, Input, Textarea, Select, Switch, Label } from '@/components/ss/forms';
import { renderBlock, BLOCK_META } from '@/components/ss/renderer';
import { cn } from '@/components/ss/utils';
import RichTextEditor from '@/components/admin/rich-text-editor';

const BLOCK_TYPES = [
  { type: 'hero',         label: 'Hero',         icon: Sparkles,           desc: 'Big title, subtitle, two CTAs.' },
  { type: 'content',      label: 'Content',      icon: LayoutList,         desc: 'Rich text — paragraphs, headings, links.' },
  { type: 'cta',          label: 'CTA',          icon: ArrowRightIcon,     desc: 'Conversion block. Light or dark.' },
  { type: 'pricing',      label: 'Pricing',      icon: IndianRupee,        desc: 'Three-tier pricing grid.' },
  { type: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote, desc: 'Quote cards with author + rating.' },
];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

const DEFAULT_PROPS = {
  hero: {
    eyebrow: 'Salt World',
    title: 'A brand-new headline',
    subtitle: 'Write a short, benefit-led subtitle to invite bookings.',
    primaryCtaLabel: 'Book a session',
    secondaryCtaLabel: 'Learn more',
  },
  content: {
    title: '',
    html: '<p>Start writing…</p>',
  },
  cta: {
    title: 'Ready to start?',
    subtitle: 'Your first session is on us.',
    primaryCtaLabel: 'Book now',
    secondaryCtaLabel: 'Talk to us',
    variant: 'default',
  },
  pricing: {
    title: 'Choose your rhythm',
    subtitle: 'Simple, transparent pricing.',
    tiles: [
      { name: 'Starter', price: '₹1,499', period: '/ session', description: 'Try it once.', features: ['1 session', 'Room access'], cta: 'Book once', featured: false },
      { name: 'Wellness', price: '₹3,499', period: '/ month', description: 'Monthly rhythm.', features: ['8 sessions', 'Priority booking'], cta: 'Choose plan', featured: true },
      { name: 'Family', price: '₹6,999', period: '/ month', description: 'Up to 4 members.', features: ['16 sessions', 'Free consult'], cta: 'Choose plan', featured: false },
    ],
  },
  testimonials: {
    title: 'What members say',
    items: [
      { quote: 'My weekly reset. Non-negotiable.', author: 'Rohan Menon', role: 'Member · Koramangala', rating: 5 },
      { quote: 'I sleep the same night as my session.', author: 'Sneha Kulkarni', role: 'Member · HSR', rating: 5 },
      { quote: 'The team knows me by name.', author: 'Divya Iyer', role: 'Member · Indiranagar', rating: 5 },
    ],
  },
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
};

/* ------------------------------- Sortable section item ------------------------------- */
function SortableSection({ id, section, selected, onSelect, onDelete, onDuplicate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const meta = BLOCK_META[section.type];
  const title = section.props?.title || section.props?.eyebrow || meta?.label || section.type;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded-md border pr-1 pl-1 py-1 text-[13px] transition-colors',
        selected ? 'bg-foreground text-background border-foreground' : 'border-border bg-card hover:border-foreground/30',
        isDragging && 'opacity-60'
      )}>
      <button {...attributes} {...listeners}
        className={cn('h-6 w-4 shrink-0 cursor-grab active:cursor-grabbing flex items-center justify-center rounded',
          selected ? 'text-background/60 hover:text-background' : 'text-muted-foreground hover:text-foreground')}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button onClick={onSelect} className="flex-1 min-w-0 text-left px-1 py-0.5">
        <div className={cn('text-[11px] uppercase tracking-wider font-semibold',
          selected ? 'text-background/60' : 'text-muted-foreground')}>{meta?.label || section.type}</div>
        <div className="text-[13px] truncate">{title}</div>
      </button>
      <button onClick={onDuplicate} className={cn('h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity',
        selected ? 'text-background/60 hover:text-background hover:bg-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
        <Copy className="h-3 w-3" />
      </button>
      <button onClick={onDelete} className={cn('h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity',
        selected ? 'text-background/60 hover:text-background hover:bg-white/10' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10')}>
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ------------------------------- Inspector: array editors ------------------------------- */
function TilesEditor({ tiles = [], onChange }) {
  const upd = (i, patch) => onChange(tiles.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= tiles.length) return;
    const c = [...tiles]; [c[i], c[j]] = [c[j], c[i]]; onChange(c);
  };
  const add = () => onChange([...tiles, { name: 'New tier', price: '₹0', period: '/ month', features: ['Feature 1'], cta: 'Choose plan' }]);
  const rem = (i) => onChange(tiles.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {tiles.map((t, i) => (
        <details key={i} className="rounded-md border border-border bg-background overflow-hidden">
          <summary className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-muted">
            <ChevronRight className="h-3 w-3 transition-transform [details[open]_&]:rotate-90" />
            <span className="flex-1 truncate">{t.name || `Tier ${i+1}`} · {t.price}</span>
            {t.featured && <Pill tone="brand">Featured</Pill>}
          </summary>
          <div className="p-3 space-y-2.5 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name"><Input value={t.name || ''} onChange={(e) => upd(i, { name: e.target.value })} /></Field>
              <Field label="Price"><Input value={t.price || ''} onChange={(e) => upd(i, { price: e.target.value })} /></Field>
              <Field label="Period"><Input value={t.period || ''} onChange={(e) => upd(i, { period: e.target.value })} /></Field>
              <Field label="CTA"><Input value={t.cta || ''} onChange={(e) => upd(i, { cta: e.target.value })} /></Field>
            </div>
            <Field label="Description"><Textarea rows={2} value={t.description || ''} onChange={(e) => upd(i, { description: e.target.value })} /></Field>
            <Field label="Features (one per line)">
              <Textarea rows={3} value={(t.features || []).join('\n')} onChange={(e) => upd(i, { features: e.target.value.split('\n').filter(Boolean) })} />
            </Field>
            <div className="flex items-center justify-between pt-1">
              <Switch label="Featured" checked={!!t.featured} onChange={(e) => upd(i, { featured: e.target.checked })} />
              <div className="flex items-center gap-1">
                <IconButton size="sm" variant="outline" onClick={() => move(i, -1)}><ChevronDown className="h-3 w-3 rotate-180" /></IconButton>
                <IconButton size="sm" variant="outline" onClick={() => move(i, 1)}><ChevronDown className="h-3 w-3" /></IconButton>
                <IconButton size="sm" variant="outline" onClick={() => rem(i)}><Trash2 className="h-3 w-3" /></IconButton>
              </div>
            </div>
          </div>
        </details>
      ))}
      <Button variant="outline" size="sm" iconLeft={<Plus className="h-3 w-3" />} onClick={add} className="w-full">Add tier</Button>
    </div>
  );
}

function ItemsEditor({ items = [], onChange }) {
  const upd = (i, patch) => onChange(items.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const add = () => onChange([...items, { quote: 'Great experience.', author: 'Name', role: 'Member', rating: 5 }]);
  const rem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const c = [...items]; [c[i], c[j]] = [c[j], c[i]]; onChange(c);
  };
  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <details key={i} className="rounded-md border border-border bg-background overflow-hidden">
          <summary className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-muted">
            <ChevronRight className="h-3 w-3" />
            <span className="flex-1 truncate">{t.author || `Testimonial ${i+1}`}</span>
            <span className="flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: t.rating || 5 }).map((_, k) => <Star key={k} className="h-2.5 w-2.5 fill-current" />)}
            </span>
          </summary>
          <div className="p-3 space-y-2.5 border-t border-border">
            <Field label="Quote"><Textarea rows={3} value={t.quote || ''} onChange={(e) => upd(i, { quote: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Author"><Input value={t.author || ''} onChange={(e) => upd(i, { author: e.target.value })} /></Field>
              <Field label="Role"><Input value={t.role || ''} onChange={(e) => upd(i, { role: e.target.value })} /></Field>
            </div>
            <Field label="Rating">
              <Select value={String(t.rating || 5)} onChange={(e) => upd(i, { rating: Number(e.target.value) })}>
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} stars</option>)}
              </Select>
            </Field>
            <div className="flex items-center justify-end gap-1 pt-1">
              <IconButton size="sm" variant="outline" onClick={() => move(i, -1)}><ChevronDown className="h-3 w-3 rotate-180" /></IconButton>
              <IconButton size="sm" variant="outline" onClick={() => move(i, 1)}><ChevronDown className="h-3 w-3" /></IconButton>
              <IconButton size="sm" variant="outline" onClick={() => rem(i)}><Trash2 className="h-3 w-3" /></IconButton>
            </div>
          </div>
        </details>
      ))}
      <Button variant="outline" size="sm" iconLeft={<Plus className="h-3 w-3" />} onClick={add} className="w-full">Add testimonial</Button>
    </div>
  );
}

/* ------------------------------- Inspector for a section ------------------------------- */
function Inspector({ section, onChange }) {
  if (!section) return (
    <div className="p-6 text-center">
      <div className="h-10 w-10 mx-auto rounded-full bg-muted grid place-items-center"><Wrench className="h-4 w-4" /></div>
      <div className="mt-3 text-[13.5px] font-semibold">Nothing selected</div>
      <div className="mt-1 text-[12px] text-muted-foreground">Click any section in the canvas or the section list to edit its content.</div>
    </div>
  );
  const p = section.props || {};
  const set = (patch) => onChange({ ...section, props: { ...p, ...patch } });

  const meta = BLOCK_META[section.type];
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 px-1 pb-2 border-b border-border">
        <Badge tone="brand">{meta?.label || section.type}</Badge>
        <div className="text-[11px] text-muted-foreground font-mono truncate">{section.id.slice(0, 8)}</div>
      </div>
      {section.type === 'hero' && (
        <>
          <Field label="Eyebrow"><Input value={p.eyebrow || ''} onChange={(e) => set({ eyebrow: e.target.value })} /></Field>
          <Field label="Title"><Textarea rows={2} value={p.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Subtitle"><Textarea rows={3} value={p.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Primary CTA"><Input value={p.primaryCtaLabel || ''} onChange={(e) => set({ primaryCtaLabel: e.target.value })} /></Field>
            <Field label="Secondary CTA"><Input value={p.secondaryCtaLabel || ''} onChange={(e) => set({ secondaryCtaLabel: e.target.value })} /></Field>
            <Field label="Primary CTA link" hint="e.g. /gifts — leave blank for a non-clickable button"><Input value={p.primaryCtaHref || ''} onChange={(e) => set({ primaryCtaHref: e.target.value })} /></Field>
            <Field label="Secondary CTA link"><Input value={p.secondaryCtaHref || ''} onChange={(e) => set({ secondaryCtaHref: e.target.value })} /></Field>
          </div>
          <Field label="Hero image URL" hint="Leave blank for the default placeholder"><Input value={p.heroImage || ''} onChange={(e) => set({ heroImage: e.target.value })} placeholder="https://…" /></Field>
        </>
      )}
      {section.type === 'content' && (
        <>
          <Field label="Heading (optional)"><Input value={p.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Body">
            <RichTextEditor value={p.html || ''} onChange={(html) => set({ html })} placeholder="Write the page copy…" minHeight={360} />
          </Field>
        </>
      )}
      {section.type === 'cta' && (
        <>
          <Field label="Title"><Textarea rows={2} value={p.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Subtitle"><Textarea rows={2} value={p.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Primary CTA"><Input value={p.primaryCtaLabel || ''} onChange={(e) => set({ primaryCtaLabel: e.target.value })} /></Field>
            <Field label="Secondary CTA"><Input value={p.secondaryCtaLabel || ''} onChange={(e) => set({ secondaryCtaLabel: e.target.value })} /></Field>
            <Field label="Primary CTA link" hint="e.g. /gifts — leave blank for a non-clickable button"><Input value={p.primaryCtaHref || ''} onChange={(e) => set({ primaryCtaHref: e.target.value })} /></Field>
            <Field label="Secondary CTA link"><Input value={p.secondaryCtaHref || ''} onChange={(e) => set({ secondaryCtaHref: e.target.value })} /></Field>
          </div>
          <Field label="Style">
            <Select value={p.variant || 'default'} onChange={(e) => set({ variant: e.target.value })}>
              <option value="default">Light</option>
              <option value="inverted">Dark (inverted)</option>
            </Select>
          </Field>
        </>
      )}
      {section.type === 'pricing' && (
        <>
          <Field label="Title"><Input value={p.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Subtitle"><Input value={p.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
          <div className="pt-1"><Label>Tiles</Label></div>
          <TilesEditor tiles={p.tiles || []} onChange={(tiles) => set({ tiles })} />
        </>
      )}
      {section.type === 'testimonials' && (
        <>
          <Field label="Title"><Input value={p.title || ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <div className="pt-1"><Label>Testimonials</Label></div>
          <ItemsEditor items={p.items || []} onChange={(items) => set({ items })} />
        </>
      )}
    </div>
  );
}

/* ------------------------------- SEO panel ------------------------------- */
function SeoPanel({ page, setPage }) {
  const seo = page.seo || {};
  const set = (patch) => setPage({ ...page, seo: { ...seo, ...patch } });
  return (
    <div className="p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">SEO</div>
      <Field label="Page title" hint="Shown in Google tab & search results"><Input value={page.title || ''} onChange={(e) => setPage({ ...page, title: e.target.value })} /></Field>
      <Field label="URL slug" hint={`/p/${page.slug}`}><Input value={page.slug || ''} onChange={(e) => setPage({ ...page, slug: e.target.value })} /></Field>
      <Field label="Meta title" hint={`${(seo.metaTitle || '').length}/60`}>
        <Input value={seo.metaTitle || ''} onChange={(e) => set({ metaTitle: e.target.value })} />
      </Field>
      <Field label="Meta description" hint={`${(seo.metaDescription || '').length}/160`}>
        <Textarea rows={3} value={seo.metaDescription || ''} onChange={(e) => set({ metaDescription: e.target.value })} />
      </Field>
      <Field label="OG image URL"><Input value={seo.ogImage || ''} onChange={(e) => set({ ogImage: e.target.value })} placeholder="https://…" /></Field>
      <Field label="Canonical URL"><Input value={seo.canonical || ''} onChange={(e) => set({ canonical: e.target.value })} placeholder="https://saltworld.in/p/…" /></Field>
    </div>
  );
}

/* ------------------------------- Canvas section wrapper ------------------------------- */
function CanvasSection({ section, selected, onSelect }) {
  return (
    <div onClick={onSelect}
      className={cn('relative cursor-pointer transition-all',
        selected ? 'outline outline-2 outline-brand outline-offset-[-2px]' : 'hover:outline hover:outline-1 hover:outline-brand/50 hover:outline-offset-[-1px]'
      )}>
      {selected && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <Badge tone="brand">{BLOCK_META[section.type]?.label || section.type}</Badge>
        </div>
      )}
      {renderBlock(section)}
    </div>
  );
}

/* ------------------------------- Left panel tabs ------------------------------- */
function LeftPanel({ page, setPage, selectedId, setSelectedId }) {
  const [tab, setTab] = useState('sections');
  const [q, setQ] = useState('');
  const addSection = (type) => {
    const s = { id: uid(), type, props: JSON.parse(JSON.stringify(DEFAULT_PROPS[type])) };
    setPage({ ...page, sections: [...(page.sections || []), s] });
    setSelectedId(s.id);
    setTab('sections');
  };
  const filteredBlocks = BLOCK_TYPES.filter(b => b.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="flex items-center gap-1 p-1.5 border-b border-border">
        {[
          { k: 'sections', label: 'Sections', icon: LayoutList },
          { k: 'blocks',   label: 'Add',      icon: Plus },
          { k: 'seo',      label: 'SEO',      icon: Globe },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[12px] font-medium transition-colors',
              tab === t.k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'sections' && (
          <div className="p-2 space-y-1">
            {(page.sections || []).length === 0 ? (
              <div className="p-6 text-center text-[12px] text-muted-foreground">No sections yet. Click <b>Add</b> to insert your first block.</div>
            ) : (
              <SortableContext items={(page.sections || []).map(s => s.id)} strategy={verticalListSortingStrategy}>
                {(page.sections || []).map((s) => (
                  <SortableSection key={s.id} id={s.id} section={s}
                    selected={selectedId === s.id}
                    onSelect={() => setSelectedId(s.id)}
                    onDelete={() => setPage({ ...page, sections: page.sections.filter(x => x.id !== s.id) })}
                    onDuplicate={() => {
                      const copy = { ...s, id: uid(), props: JSON.parse(JSON.stringify(s.props || {})) };
                      const i = page.sections.findIndex(x => x.id === s.id);
                      const next = [...page.sections]; next.splice(i + 1, 0, copy);
                      setPage({ ...page, sections: next });
                      setSelectedId(copy.id);
                    }}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        )}

        {tab === 'blocks' && (
          <div className="p-3 space-y-3">
            <Field><Input placeholder="Search blocks…" iconLeft={<SearchIcon className="h-3 w-3" />} value={q} onChange={(e) => setQ(e.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-2">
              {filteredBlocks.map(b => (
                <button key={b.type} onClick={() => addSection(b.type)}
                  className="text-left rounded-lg border border-border p-3 hover:border-foreground/40 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-brand/10 text-brand flex items-center justify-center"><b.icon className="h-3.5 w-3.5" /></div>
                    <div className="text-[13px] font-semibold">{b.label}</div>
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-muted-foreground">{b.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'seo' && <SeoPanel page={page} setPage={setPage} />}
      </div>
    </aside>
  );
}

/* ------------------------------- Top bar ------------------------------- */
function TopBar({ page, setPage, saving, savedAt, onPublish, publishing, viewport, setViewport }) {
  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-3 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Link href="/"><IconButton variant="ghost"><ArrowLeft className="h-3.5 w-3.5" /></IconButton></Link>
        <div className="min-w-0 max-w-xs">
          <input value={page.title || ''} onChange={(e) => setPage({ ...page, title: e.target.value })}
            className="w-full bg-transparent text-[13.5px] font-semibold outline-none border-b border-transparent hover:border-border focus:border-foreground/40 px-0.5" />
          <div className="text-[10.5px] text-muted-foreground font-mono truncate">/p/{page.slug}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background">
        {[
          { k: 'desktop', icon: Monitor, label: 'Desktop' },
          { k: 'mobile',  icon: Smartphone, label: 'Mobile' },
        ].map(v => (
          <button key={v.k} onClick={() => setViewport(v.k)} title={v.label}
            className={cn('h-7 w-8 flex items-center justify-center rounded transition-colors',
              viewport === v.k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
            <v.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="text-[11.5px] text-muted-foreground min-w-[80px] text-right">
          {saving ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
            : savedAt ? <span>Saved {timeAgo(savedAt)}</span> : ''}
        </div>
        {page.status === 'published' ? (
          <>
            <Badge tone="success"><Globe className="h-2.5 w-2.5" /> Live</Badge>
            <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" iconRight={<ExternalLink className="h-3 w-3" />}>View</Button>
            </a>
            <Button variant="outline" size="sm" loading={publishing} onClick={() => onPublish(false)}>Unpublish</Button>
          </>
        ) : (
          <>
            <Badge tone="warn"><FileEdit className="h-2.5 w-2.5" /> Draft</Badge>
            <Button variant="primary" size="sm" loading={publishing} iconLeft={<Globe className="h-3 w-3" />} onClick={() => onPublish(true)}>Publish</Button>
          </>
        )}
      </div>
    </header>
  );
}

/* ------------------------------- Main ------------------------------- */
export default function BuilderClient({ pageId }) {
  const router = useRouter();
  const [page, setPage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [viewport, setViewport] = useState('desktop');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const firstLoad = useRef(true);
  const saveTimer = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // load
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/pages/${pageId}`);
      if (!r.ok) { router.push('/'); return; }
      const doc = await r.json();
      setPage(doc);
      if (doc.sections?.[0]) setSelectedId(doc.sections[0].id);
      setLoading(false);
    })();
  }, [pageId, router]);

  // debounced save
  useEffect(() => {
    if (!page) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const r = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: page.title, sections: page.sections, seo: page.seo, slug: page.slug }),
      });
      if (r.ok) {
        const doc = await r.json();
        // preserve local title/slug already updated; adopt server slug only
        setSavedAt(doc.updatedAt);
        setPage(prev => prev ? { ...prev, slug: doc.slug, updatedAt: doc.updatedAt } : prev);
      }
      setSaving(false);
    }, 700);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.title, page?.sections, page?.seo, page?.slug]);

  const publish = async (yes) => {
    setPublishing(true);
    const r = await fetch(`/api/pages/${pageId}/${yes ? 'publish' : 'unpublish'}`, { method: 'POST' });
    const doc = await r.json();
    setPage(prev => ({ ...prev, status: doc.status, publishedAt: doc.publishedAt }));
    setPublishing(false);
  };

  const onDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = page.sections;
    const oldIdx = list.findIndex(s => s.id === active.id);
    const newIdx = list.findIndex(s => s.id === over.id);
    setPage({ ...page, sections: arrayMove(list, oldIdx, newIdx) });
  };

  const selected = useMemo(
    () => page?.sections?.find(s => s.id === selectedId) || null,
    [page, selectedId]
  );

  if (loading || !page) {
    return (
      <div className="h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading builder…
        </div>
      </div>
    );
  }

  const setBlock = (updated) => {
    setPage({ ...page, sections: page.sections.map(s => s.id === updated.id ? updated : s) });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar page={page} setPage={setPage} saving={saving} savedAt={savedAt}
        onPublish={publish} publishing={publishing} viewport={viewport} setViewport={setViewport} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex-1 flex overflow-hidden">
          <LeftPanel page={page} setPage={setPage} selectedId={selectedId} setSelectedId={setSelectedId} />
          <main className="flex-1 overflow-auto bg-muted/40">
            <div className="min-h-full flex justify-center p-6">
              <div
                className={cn('bg-background border border-border rounded-2xl overflow-hidden shadow-sm transition-all',
                  viewport === 'mobile' ? 'w-[390px]' : 'w-full max-w-[1200px]')}
                onClick={(e) => {
                  // click empty area deselects
                  if (e.target === e.currentTarget) setSelectedId(null);
                }}
              >
                {(page.sections || []).length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="h-10 w-10 mx-auto rounded-full bg-muted grid place-items-center"><Layers className="h-4 w-4" /></div>
                    <div className="mt-3 text-[14px] font-semibold">Empty canvas</div>
                    <div className="mt-1 text-[12.5px] text-muted-foreground">Open the <b>Add</b> tab and drop in your first section.</div>
                  </div>
                ) : (
                  (page.sections || []).map((s) => (
                    <CanvasSection key={s.id} section={s}
                      selected={selectedId === s.id}
                      onSelect={(e) => { e?.stopPropagation?.(); setSelectedId(s.id); }} />
                  ))
                )}
              </div>
            </div>
          </main>
          <aside className="w-[340px] shrink-0 border-l border-border bg-card overflow-y-auto">
            <Inspector section={selected} onChange={setBlock} />
          </aside>
        </div>
      </DndContext>
    </div>
  );
}
