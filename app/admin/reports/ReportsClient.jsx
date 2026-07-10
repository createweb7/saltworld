'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import { Tabs, GhostBtn, inr } from '@/components/admin/primitives';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

const PALETTE = ['hsl(var(--brand))', 'hsl(var(--driftwood))', 'hsl(var(--aurora))', '#6366f1', '#f472b6', '#22d3ee'];

async function fetchReport(kind, days) {
  const res = await fetch(`/api/admin/reports/${kind}?days=${days}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function ReportsClient({ user }) {
  const [kind, setKind] = useState('revenue');
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({ queryKey: ['report', kind, days], queryFn: () => fetchReport(kind, days) });

  const downloadCsv = () => {
    if (!data?.daily) return;
    const rows = [['date', 'value'], ...data.daily.map((d) => [d.date, d.value])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `salt-world-${kind}-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell user={user} title="Reports" actions={
      <GhostBtn onClick={downloadCsv} className="h-8 px-3"><Download className="h-3.5 w-3.5" /> CSV</GhostBtn>
    }>
      <PageHeader eyebrow="Analytics" title="Reports" subtitle="Live business metrics. Export any view as CSV." />
      <AdminSection>
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <Tabs items={[
            { key: 'revenue',   label: 'Revenue'   },
            { key: 'bookings',  label: 'Bookings'  },
            { key: 'occupancy', label: 'Occupancy' },
          ]} active={kind} onChange={setKind} />
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`h-7 px-3 rounded-[5px] text-[11.5px] font-medium transition-colors ${days === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                {d} d
              </button>
            ))}
          </div>
        </div>

        {kind === 'revenue'   && <RevenueReport data={data} loading={isLoading} />}
        {kind === 'bookings'  && <BookingsReport data={data} loading={isLoading} />}
        {kind === 'occupancy' && <OccupancyReport data={data} loading={isLoading} />}
      </AdminSection>
    </AdminShell>
  );
}

function RevenueReport({ data, loading }) {
  const daily = data?.daily || [];
  const byMethod = data?.byMethod || {};
  const pieData = Object.entries(byMethod).map(([name, value]) => ({ name, value }));
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total revenue" value={inr(data?.total || 0)} loading={loading} />
        <Kpi label="Transactions"  value={data?.count || 0}       loading={loading} />
        <Kpi label="Avg. order"    value={data?.count ? inr(Math.round((data.total || 0) / data.count)) : inr(0)} loading={loading} />
        <Kpi label="Peak day"      value={peak(daily)}            loading={loading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 20, right: 20, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => v?.slice(5)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v) => inr(v)} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--brand))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="h-[320px]">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">By method</div>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}

function BookingsReport({ data, loading }) {
  const daily = data?.daily || [];
  const byStatus = data?.byStatus || {};
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total bookings" value={data?.total || 0} loading={loading} />
        <Kpi label="Completed"      value={byStatus.completed || 0} loading={loading} />
        <Kpi label="No-shows"       value={byStatus.no_show || 0}   loading={loading} />
        <Kpi label="Cancelled"      value={byStatus.cancelled || 0} loading={loading} />
      </div>
      <Card className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daily} margin={{ top: 20, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(v) => v?.slice(5)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

function OccupancyReport({ data, loading }) {
  const rows = Object.entries(data?.byResource || {}).map(([k, v]) => ({ resource: k, sessions: v }));
  const max = Math.max(1, ...rows.map((r) => r.sessions));
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-4">Sessions per resource</div>
      {loading && <div className="text-[12.5px] text-muted-foreground">Loading…</div>}
      {!loading && rows.length === 0 && <div className="text-[12.5px] text-muted-foreground">No bookings in this window.</div>}
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.resource} className="flex items-center gap-3">
            <div className="w-32 text-[12.5px] font-medium capitalize">{r.resource.replace('_', ' ')}</div>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(r.sessions / max) * 100}%` }} />
            </div>
            <div className="w-16 text-right font-mono text-[12.5px]">{r.sessions}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Kpi({ label, value, loading }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">{label}</div>
      <div className="mt-2 font-serif text-[26px] leading-none tracking-tight">{loading ? <span className="opacity-40">—</span> : value}</div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>{children}</div>;
}

function peak(daily = []) {
  if (!daily.length) return '—';
  let best = daily[0];
  for (const d of daily) if ((d.value || 0) > (best.value || 0)) best = d;
  return best.date?.slice(5) || '—';
}
