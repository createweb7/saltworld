'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  LayoutDashboard, Users, Calendar, CalendarOff, MessageSquareText, ClipboardList,
  Waves, Sparkles, Gift, Package, IndianRupee, BarChart3, Megaphone, Ticket,
  FileText, BellDot, Bot, Settings, Search, Sun, Moon, LogOut,
  ChevronsLeft, ChevronsRight, Command, ChevronDown, User as UserIcon,
  CircleUser, Building2, MapPin, Check,
} from 'lucide-react';
import { cn } from '@/components/ss/utils';
import CommandPalette from './command-palette';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'g d' },
      { href: '/admin/reception', label: 'Reception',  icon: ClipboardList,  shortcut: 'g r', badge: 'live' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { href: '/admin/bookings',        label: 'Bookings',        icon: Calendar,        shortcut: 'g b' },
      { href: '/admin/calendar-blocks', label: 'Calendar Blocks', icon: CalendarOff },
      { href: '/admin/customers',       label: 'Customers',       icon: Users,           shortcut: 'g c' },
      { href: '/admin/services',        label: 'Services',        icon: Waves },
    ],
  },
  {
    label: 'Sell',
    items: [
      { href: '/admin/memberships', label: 'Memberships', icon: Sparkles },
      { href: '/admin/giftcards',   label: 'Gift cards',  icon: Gift },
      { href: '/admin/products',    label: 'Products',    icon: Package },
      { href: '/admin/payments',    label: 'Payments',    icon: IndianRupee },
    ],
  },
  {
    label: 'Grow',
    items: [
      { href: '/admin/reports',       label: 'Reports',       icon: BarChart3 },
      { href: '/admin/marketing',     label: 'Marketing',     icon: Megaphone },
      { href: '/admin/coupons',       label: 'Coupons',       icon: Ticket },
      { href: '/admin/referrals',     label: 'Referrals',     icon: Sparkles },
      { href: '/admin/cms',           label: 'CMS',           icon: FileText },
      { href: '/admin/notifications', label: 'Notifications', icon: BellDot },
      { href: '/admin/ai',            label: 'AI Assistant',  icon: Bot },
    ],
  },
  {
    label: 'Company',
    items: [
      { href: '/admin/branches',      label: 'Branches',      icon: Building2 },
    ],
  },
];

export default function AdminShell({ user, children, title, actions, tabs, right }) {
  const router = useRouter();
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Load collapse pref
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(window.localStorage.getItem('sw-sidebar-collapsed') === '1');
  }, []);
  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem('sw-sidebar-collapsed', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  // Keyboard: ⌘K palette, ⌘B collapse
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      toast.success('Signed out');
      router.push('/admin/login');
    } catch {
      toast.error('Sign-out failed');
    }
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* ============ Sidebar ============ */}
      <aside
        className={cn(
          'no-print sticky top-0 h-screen shrink-0 border-r border-border bg-card/40',
          'flex flex-col transition-[width] duration-200 ease-out',
          collapsed ? 'w-[64px]' : 'w-[240px]'
        )}
      >
        {/* Brand */}
        <div className={cn('h-14 flex items-center gap-2 px-3 border-b border-border', collapsed ? 'justify-center px-0' : 'px-4')}>
          <div className="h-7 w-7 shrink-0 rounded-md bg-foreground text-background flex items-center justify-center text-[11px] font-bold tracking-tight">SW</div>
          {!collapsed && <div className="text-[13px] font-semibold tracking-tight">Salt World<span className="align-super text-[0.55em] ml-0.5 opacity-70">BOS</span></div>}
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className={cn(
            'mx-3 mt-3 h-9 rounded-md border border-border bg-background flex items-center gap-2 text-[12.5px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors',
            collapsed ? 'w-9 justify-center px-0' : 'px-2.5'
          )}
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-muted border border-border">⌘K</kbd>
            </>
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((g, gi) => (
            <div key={gi}>
              {!collapsed && g.label && (
                <div className="px-2.5 pt-2 pb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">{g.label}</div>
              )}
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = path === it.href || path.startsWith(it.href + '/');
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        title={collapsed ? it.label : undefined}
                        className={cn(
                          'group flex items-center gap-2.5 h-8 rounded-md text-[13px] transition-colors',
                          collapsed ? 'justify-center px-0' : 'px-2.5',
                          active
                            ? 'bg-muted text-foreground font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        )}
                      >
                        <it.icon className={cn('h-[15px] w-[15px] shrink-0', active && 'text-foreground')} />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{it.label}</span>
                            {it.badge === 'live' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-border p-2 flex flex-col gap-1">
          <Link
            href="/admin/settings"
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-2.5 h-8 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
              collapsed ? 'justify-center px-0' : 'px-2.5'
            )}
          >
            <Settings className="h-[15px] w-[15px]" />
            {!collapsed && <span>Settings</span>}
          </Link>

          {/* User row */}
          <UserMenu user={user} collapsed={collapsed} onLogout={onLogout} />
        </div>
      </aside>

      {/* ============ Main ============ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
          <div className="h-14 flex items-center gap-4 px-5">
            <button
              onClick={toggleCollapse}
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={`${collapsed ? 'Expand' : 'Collapse'} · ⌘B`}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="text-[13px] font-semibold tracking-tight truncate">{title}</div>
              {tabs && <div className="hidden md:flex items-center gap-1">{tabs}</div>}
            </div>

            <div className="flex items-center gap-1">
              <BranchSwitcher />
              {actions}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Body + optional right rail */}
        <div className="flex-1 min-w-0 flex">
          <main className="flex-1 min-w-0">{children}</main>
          {right && (
            <aside className="hidden xl:block w-[320px] shrink-0 border-l border-border bg-card/30">{right}</aside>
          )}
        </div>
      </div>
    </div>
  );
}

function UserMenu({ user, collapsed, onLogout }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = (e) => { if (!e.target.closest?.('[data-user-menu]')) setOpen(false); };
    document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, []);
  const initials = (user?.name || user?.email || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="relative" data-user-menu>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2.5 h-9 rounded-md hover:bg-muted transition-colors',
          collapsed ? 'justify-center px-0' : 'px-2'
        )}
      >
        <div className="h-6 w-6 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12.5px] font-medium leading-none truncate">{user?.name || 'You'}</div>
              <div className="text-[10.5px] text-muted-foreground mt-1 truncate capitalize">{(user?.role || '').replace('_', ' ')}</div>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </>
        )}
      </button>
      {open && (
        <div className={cn(
          'absolute z-40 rounded-lg border border-border bg-popover shadow-xl p-1 min-w-[200px]',
          collapsed ? 'left-full bottom-0 ml-2' : 'left-0 bottom-full mb-2'
        )}>
          <div className="px-2.5 py-2 border-b border-border">
            <div className="text-[12.5px] font-medium truncate">{user?.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-1">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="px-5 md:px-8 pt-6 pb-4 border-b border-border">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{eyebrow}</div>
          )}
          <h1 className="mt-1 text-[22px] md:text-[26px] font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[13.5px] text-muted-foreground max-w-[640px]">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function AdminSection({ children, className }) {
  return <div className={cn('px-5 md:px-8 py-6', className)}>{children}</div>;
}

function BranchSwitcher() {
  const [branches, setBranches] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/branches')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        setBranches(Array.isArray(data) ? data : []);
        // Cookie value comes as document.cookie 'sw_branch=…'
        const match = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )sw_branch=([^;]+)/) : null;
        if (match) setCurrentId(decodeURIComponent(match[1]));
        else if (data?.[0]?.id) setCurrentId(data[0].id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (!e.target.closest?.('[data-branch-switcher]')) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = branches.find((b) => b.id === currentId) || branches[0] || null;

  const switchTo = async (id) => {
    if (id === currentId) { setOpen(false); return; }
    setSwitching(true);
    try {
      // 12-hour cookie so it survives a working shift.
      document.cookie = `sw_branch=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 12}; samesite=lax`;
      setCurrentId(id);
      toast.success('Branch switched');
      // Force a full re-render so branch-scoped fetches refresh
      if (typeof window !== 'undefined') window.location.reload();
    } finally { setSwitching(false); setOpen(false); }
  };

  if (branches.length <= 1) return null;

  return (
    <div className="relative" data-branch-switcher>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-2.5 rounded-md border border-border text-[12.5px] hover:bg-muted flex items-center gap-1.5 max-w-[220px]"
        title="Switch branch"
        disabled={switching}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{current?.name || 'Branches'}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[240px] rounded-lg border border-border bg-card shadow-lg z-40 p-1">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => switchTo(b.id)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-muted transition-colors',
                b.id === currentId && 'bg-muted'
              )}
            >
              <div className="h-6 w-6 rounded bg-brand/10 text-brand inline-flex items-center justify-center shrink-0"><MapPin className="h-3 w-3" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{b.name}</div>
                <div className="text-[10.5px] text-muted-foreground font-mono">{b.code}</div>
              </div>
              {b.id === currentId && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
