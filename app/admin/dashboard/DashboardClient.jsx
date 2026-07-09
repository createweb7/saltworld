'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee, Calendar as CalIcon, Users, Gift, Sparkles, TrendingUp,
  ArrowUpRight, Clock, MessageCircle, ArrowRight, Activity, Wallet, Building2,
} from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { cn } from '@/components/ss/utils';

const inr = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');

async function fetchDashboard() {
  const res = await fetch('/api/admin/dashboard');
  if (!res.ok) throw new Error('dashboard_failed');
  return res.json();
}

export default function DashboardClient({ user }) {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard, refetchInterval: 60_000 });

  // SSE realtime (optional, silent) — refresh on tick
  const [liveBookings, setLiveBookings] = useState(null);
  useEffect(() => {
    const src = new EventSource('/api/admin/stream');
    src.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'tick') setLiveBookings(msg.bookingsToday);
      } catch { /* noop */ }
    };
    return () => src.close();
  }, []);

  const kpis = data?.kpis || {};
  const trend = data?.trend7d || [];
  const upcoming = data?.upcoming || [];

  return (
    <AdminShell
      user={user}
      title="Dashboard"
      actions={
        <Link href="/admin/reception" className="h-8 px-3 rounded-md bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 inline-flex items-center gap-1.5">
          Reception <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      <PageHeader
        eyebrow={`Signed in as ${user.name}`}
        title={greet(user.name)}
        subtitle="An at-a-glance view of today. Numbers refresh live."
      />

      <AdminSection>
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={IndianRupee} label={"Today\u2019s revenue"}  value={inr(kpis.todayRevenue)} sub={<Delta pct={12} />} loading={isLoading} />
          <Kpi icon={CalIcon}     label={"Today\u2019s bookings"} value={liveBookings ?? kpis.bookingsToday ?? 0} sub={`${kpis.walkIns || 0} walk-ins`} loading={isLoading} />
          <Kpi icon={Wallet}      label="Pending payments"      value={kpis.pendingPayments ?? 0} sub={<span className="text-amber-600">Needs attention</span>} loading={isLoading} />
          <Kpi icon={Users}       label="Active members"        value={kpis.membersActive ?? 0} sub={`${kpis.customersTotal || 0} customers total`} loading={isLoading} />
        </div>

        {/* Row: Revenue + Occupancy */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2 p-5">
            <CardHeader label="Revenue · last 7 days" hint={inr(trend.reduce((s, d) => s + d.revenue, 0)) + ' total'} />
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v) => v?.slice(5)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v) => inr(v)} labelFormatter={(v) => new Date(v).toDateString()} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--brand))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--brand))' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader label="Occupancy today" hint={<span className="text-emerald-600">62%</span>} />
            <div className="mt-4 space-y-2.5">
              {[
                { name: 'Float Tank 1', pct: 66, cap: '4/6' },
                { name: 'Float Tank 2', pct: 33, cap: '2/6' },
                { name: 'Salt Cave',    pct: 100, cap: '5/5' },
                { name: 'Infrared Sauna', pct: 0, cap: '0/2' },
                { name: 'Cold Plunge',  pct: 50, cap: '1/2' },
                { name: 'Red-light',    pct: 25, cap: '1/4' },
              ].map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <div className="text-[12px] w-28 text-muted-foreground truncate">{r.name}</div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', r.pct >= 100 ? 'bg-amber-500' : 'bg-brand')} style={{ width: `${r.pct}%` }} />
                  </div>
                  <div className="text-[11.5px] font-mono text-muted-foreground w-9 text-right">{r.cap}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Row: Upcoming + Bookings by day */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2 p-0">
            <div className="p-5 pb-3 flex items-center justify-between">
              <CardHeader label="Upcoming sessions" hint={`${upcoming.length} scheduled`} />
              <Link href="/admin/bookings" className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">All bookings <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="divide-y divide-border border-t border-border">
              {upcoming.length === 0 && (
                <div className="px-5 py-10 text-center text-[12.5px] text-muted-foreground">No upcoming sessions.</div>
              )}
              {upcoming.slice(0, 6).map((b) => (
                <Link key={b.id || b.ref} href={`/admin/bookings/${b.id || b.ref}`}
                  className="flex items-center gap-4 px-5 h-12 hover:bg-muted/50 transition-colors">
                  <div className="text-[12.5px] font-mono text-muted-foreground w-16">{b.slotTime || '—'}</div>
                  <div className="text-[13px] flex-1 truncate">{b.contact?.name || b.contact?.email || 'Guest'}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate hidden md:block">{b.therapy || b.outcome || 'Session'}</div>
                  <StatusPill status={b.status} />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader label="Bookings · last 7 days" hint={`${trend.reduce((s, d) => s + d.bookings, 0)} total`} />
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v) => v?.slice(5)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="bookings" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Row: Sales & Leads */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-5">
            <CardHeader label="Gift cards sold today" hint={<TrendingUp className="h-3.5 w-3.5 text-brand" />} />
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-serif text-[36px] tracking-tight">{kpis.giftcardsToday ?? 0}</div>
              <div className="text-[12px] text-muted-foreground">issued</div>
            </div>
            <Link href="/admin/giftcards" className="mt-3 text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View gift cards <ArrowRight className="h-3 w-3" /></Link>
          </Card>
          <Card className="p-5">
            <CardHeader label="Membership sales" hint={<Sparkles className="h-3.5 w-3.5 text-brand" />} />
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-serif text-[36px] tracking-tight">{kpis.membersActive ?? 0}</div>
              <div className="text-[12px] text-muted-foreground">active plans</div>
            </div>
            <Link href="/admin/memberships" className="mt-3 text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Manage memberships <ArrowRight className="h-3 w-3" /></Link>
          </Card>
          <Card className="p-5">
            <CardHeader label="Leads today" hint={<Building2 className="h-3.5 w-3.5 text-brand" />} />
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-serif text-[36px] tracking-tight">{kpis.leadsToday ?? 0}</div>
              <div className="text-[12px] text-muted-foreground">website + corporate</div>
            </div>
            <Link href="/admin/marketing" className="mt-3 text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Follow up <ArrowRight className="h-3 w-3" /></Link>
          </Card>
        </div>
      </AdminSection>
    </AdminShell>
  );
}

/* Little primitives */

function greet(name = '') {
  const h = new Date().getHours();
  const first = (name || '').split(' ')[0];
  const salut = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${salut}${first ? `, ${first}` : ''}`;
}

function Kpi({ icon: Icon, label, value, sub, loading }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-serif text-[30px] leading-none tracking-tight">{loading ? <span className="opacity-40">—</span> : value}</div>
      <div className="mt-2 text-[11.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Card({ children, className }) {
  return <div className={cn('rounded-lg border border-border bg-card', className)}>{children}</div>;
}

function CardHeader({ label, hint }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{label}</div>
      <div className="text-[11.5px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Delta({ pct }) {
  const positive = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', positive ? 'text-emerald-600' : 'text-red-500')}>
      <ArrowUpRight className={cn('h-3 w-3', !positive && 'rotate-180')} /> {Math.abs(pct)}% wow
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    confirmed:   ['Confirmed', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
    booked:      ['Booked',    'bg-blue-500/10 text-blue-700 dark:text-blue-400'],
    checked_in:  ['Checked in','bg-amber-500/10 text-amber-700 dark:text-amber-400'],
    in_session:  ['In session','bg-purple-500/10 text-purple-700 dark:text-purple-400'],
    completed:   ['Done',      'bg-muted text-muted-foreground'],
    no_show:     ['No-show',   'bg-red-500/10 text-red-600 dark:text-red-400'],
    cancelled:   ['Cancelled', 'bg-muted text-muted-foreground'],
  };
  const [label, cls] = map[status] || ['—', 'bg-muted text-muted-foreground'];
  return <span className={cn('inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10.5px] font-semibold', cls)}>{label}</span>;
}
