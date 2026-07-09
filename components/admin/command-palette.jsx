'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search, User, Calendar, FileText, LayoutDashboard, ClipboardList,
  Waves, Sparkles, Gift, Package, IndianRupee, BarChart3, Megaphone,
  BellDot, Bot, Settings, ArrowRight,
} from 'lucide-react';

const QUICK_LINKS = [
  { href: '/admin/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/reception',      label: 'Reception desk', icon: ClipboardList  },
  { href: '/admin/bookings',       label: 'Bookings',       icon: Calendar        },
  { href: '/admin/bookings/calendar', label: 'Calendar',    icon: Calendar        },
  { href: '/admin/customers',      label: 'Customers',      icon: User            },
  { href: '/admin/services',       label: 'Services',       icon: Waves           },
  { href: '/admin/memberships',    label: 'Memberships',    icon: Sparkles        },
  { href: '/admin/giftcards',      label: 'Gift cards',     icon: Gift            },
  { href: '/admin/products',       label: 'Products',       icon: Package         },
  { href: '/admin/payments',       label: 'Payments',       icon: IndianRupee     },
  { href: '/admin/reports',        label: 'Reports',        icon: BarChart3       },
  { href: '/admin/marketing',      label: 'Marketing',      icon: Megaphone       },
  { href: '/admin/cms',            label: 'CMS',            icon: FileText        },
  { href: '/admin/notifications',  label: 'Notifications',  icon: BellDot         },
  { href: '/admin/ai',             label: 'AI Assistant',   icon: Bot             },
  { href: '/admin/settings',       label: 'Settings',       icon: Settings        },
];

export default function CommandPalette({ open, onOpenChange }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ customers: [], bookings: [], pages: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setQ(''); setResults({ customers: [], bookings: [], pages: [] }); }
  }, [open]);

  useEffect(() => {
    if (!q || q.length < 2) { setResults({ customers: [], bookings: [], pages: [] }); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) setResults(data || { customers: [], bookings: [], pages: [] });
      } catch { /* noop */ }
      finally { if (!cancelled) setLoading(false); }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const go = (href) => { onOpenChange(false); router.push(href); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-[640px] rounded-xl overflow-hidden bg-popover text-popover-foreground shadow-2xl border border-border">
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <div className="flex items-center gap-2 px-4 h-12" cmdk-input-wrapper="">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Search customers, bookings, pages, or jump to a page…"
              className="flex-1 h-full bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">ESC</kbd>
          </div>
          <Command.List className="max-h-[420px] overflow-y-auto py-2">
            {loading && <div className="px-4 py-2 text-[12px] text-muted-foreground">Searching…</div>}
            <Command.Empty className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              {q.length < 2 ? 'Type to search customers, bookings, and pages.' : 'No matches. Try a different query.'}
            </Command.Empty>

            {results.customers?.length > 0 && (
              <Command.Group heading="Customers" className="px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-semibold">
                {results.customers.map((c) => (
                  <Command.Item key={c.id} value={`c-${c.id}-${c.name}`} onSelect={() => go(`/admin/customers/${c.id}`)}
                    className="px-3 h-10 flex items-center gap-3 rounded-md cursor-pointer aria-selected:bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate">{c.name || '(no name)'}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{c.email || c.phone || 'no contact'}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.bookings?.length > 0 && (
              <Command.Group heading="Bookings" className="px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-semibold">
                {results.bookings.map((b) => (
                  <Command.Item key={b.id} value={`b-${b.id}-${b.ref}`} onSelect={() => go(`/admin/bookings/${b.id}`)}
                    className="px-3 h-10 flex items-center gap-3 rounded-md cursor-pointer aria-selected:bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate font-mono">{b.ref}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{b.contact?.name || 'guest'} · {b.slotDate} {b.slotTime}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.pages?.length > 0 && (
              <Command.Group heading="CMS Pages" className="px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-semibold">
                {results.pages.map((p) => (
                  <Command.Item key={p.id} value={`p-${p.id}-${p.title}`} onSelect={() => go(`/builder/${p.id}`)}
                    className="px-3 h-10 flex items-center gap-3 rounded-md cursor-pointer aria-selected:bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">/{p.slug} · {p.status}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Jump to" className="px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-semibold">
              {QUICK_LINKS.map((l) => (
                <Command.Item key={l.href} value={`j-${l.href}-${l.label}`} onSelect={() => go(l.href)}
                  className="px-3 h-9 flex items-center gap-3 rounded-md cursor-pointer aria-selected:bg-muted">
                  <l.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] flex-1">{l.label}</span>
                  <span className="text-[10.5px] text-muted-foreground">{l.href}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
