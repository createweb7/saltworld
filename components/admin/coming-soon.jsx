'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from './shell';

export default function ComingSoon({ user, title, eyebrow, description, when = 'Phase 3.2' }) {
  return (
    <AdminShell user={user} title={title}>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={description} />
      <AdminSection>
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto h-10 w-10 rounded-full bg-brand/10 text-brand flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="mt-4 text-[15px] font-semibold">Arriving in {when}</div>
          <p className="mt-2 text-[13px] text-muted-foreground max-w-md mx-auto">
            The Foundation cut ships first — Auth, Dashboard, Customers, Bookings, Calendar and Reception.
            This module is next up.
          </p>
          <Link href="/admin/dashboard" className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-foreground text-background text-[12.5px] font-semibold">
            Back to dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </AdminSection>
    </AdminShell>
  );
}
