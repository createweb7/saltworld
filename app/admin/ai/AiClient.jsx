'use client';

import Link from 'next/link';
import { Bot, Sparkles, TrendingUp, Users, Package, Key, ArrowRight } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';

export default function AiClient({ user }) {
  return (
    <AdminShell user={user} title="AI Assistant">
      <PageHeader eyebrow="Intelligence" title="AI Assistant" subtitle="Customer insights, inactive-customer alerts, cross-sell suggestions and a dashboard assistant." />
      <AdminSection>
        <div className="rounded-lg border border-dashed border-border bg-card p-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-[15px]">Connect an LLM provider to activate</div>
              <p className="mt-1.5 text-[13px] text-muted-foreground max-w-[560px]">
                The AI Assistant is wired end-to-end but disabled until you connect an LLM.
                Add an OpenAI, Anthropic (Claude), or Gemini key in Settings → Integrations. Once
                connected, you’ll get dashboard briefings, cross-sell suggestions, inactive-customer
                alerts, and a natural-language search across the whole business.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link href="/admin/settings" className="h-9 px-4 rounded-md bg-foreground text-background text-[13px] font-semibold inline-flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Add API key
                </Link>
                <span className="text-[11.5px] text-muted-foreground">Requires Super Admin</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">Once connected</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { Icon: TrendingUp, title: 'Dashboard briefings', body: 'A daily paragraph summarising what changed and what to focus on.' },
              { Icon: Users,      title: 'Inactive customers',   body: 'Automatically flags members who haven\u2019t booked in 4+ weeks with suggested outreach.' },
              { Icon: Package,    title: 'Cross-sell picks',      body: 'Per-customer next-best-offer based on outcome affinity and journey stage.' },
              { Icon: Sparkles,   title: 'AI copywriter',         body: 'Generate landing-page copy, journal drafts, and WhatsApp campaigns in the brand voice.' },
              { Icon: Bot,        title: 'Ask anything',           body: 'Natural-language search across bookings, customers, revenue and marketing.' },
              { Icon: ArrowRight, title: 'Recommended actions',    body: 'Suggested resource re-allocations, restock alerts, and staffing tweaks.' },
            ].map((c) => (
              <div key={c.title} className="rounded-lg border border-border bg-card p-4">
                <c.Icon className="h-4 w-4 text-brand" />
                <div className="mt-2 font-medium text-[13.5px]">{c.title}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
