'use client';

import { Cake, HeartHandshake, HandHeart, PartyPopper, Sparkles, Briefcase, Gift } from 'lucide-react';
import { OCCASIONS } from '@/lib/gift-designs';
import { cn } from '@/components/ss/utils';

const OCCASION_ICONS = { Cake, HeartHandshake, HandHeart, PartyPopper, Sparkles, Briefcase };

/** Icon-grid occasion picker — used anywhere a gift's occasion is chosen, so
 * the same cake/couple/party imagery shows up while picking as ends up on
 * the card itself (see gift-card-preview.jsx). */
export default function OccasionPicker({ value, onChange, allowNone = true }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {allowNone && (
        <button type="button" onClick={() => onChange('')}
          className={cn('flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 py-3 px-2 text-center transition-colors',
            !value ? 'border-brand bg-brand-soft' : 'border-border hover:border-foreground/30')}>
          <Gift className="h-4.5 w-4.5" />
          <span className="text-[11px] font-medium leading-tight">No occasion</span>
        </button>
      )}
      {OCCASIONS.map((o) => {
        const Icon = OCCASION_ICONS[o.icon] || Gift;
        const isSel = value === o.label;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.label)}
            className={cn('flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 py-3 px-2 text-center transition-colors',
              isSel ? 'border-brand bg-brand-soft' : 'border-border hover:border-foreground/30')}>
            <Icon className="h-4.5 w-4.5" />
            <span className="text-[11px] font-medium leading-tight">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
