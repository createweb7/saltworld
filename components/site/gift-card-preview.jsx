'use client';

import { getDesign, formatINR } from '@/lib/gift-designs';
import { Logomark } from '@/components/site/shell';
import { cn } from '@/components/ss/utils';

/**
 * The single visual for a Salt World gift card. Used everywhere:
 * - Designer live preview
 * - Confirmation page
 * - Recipient redemption page
 * - Emails (once wired)
 *
 * Props: designId, amount, from, to, message, code, occasion, size ('sm' | 'md' | 'lg')
 */
export default function GiftCardPreview({
  designId = 'halite',
  amount = 5000,
  from = '',
  to = '',
  message = '',
  code = '',
  occasion = '',
  size = 'md',
  className,
}) {
  const d = getDesign(designId);
  const inverted = d.palette.ink === '#F5F1EA' || d.palette.ink === '#FFFFFF';

  const dims = {
    sm: { w: 'w-full max-w-[300px]', p: 'p-5',  headline: 'text-lg',  amt: 'text-2xl' },
    md: { w: 'w-full max-w-[440px]', p: 'p-7',  headline: 'text-xl',  amt: 'text-4xl' },
    lg: { w: 'w-full max-w-[560px]', p: 'p-9',  headline: 'text-2xl', amt: 'text-5xl' },
  }[size];

  return (
    <div
      className={cn(
        'relative aspect-[1.586/1] rounded-[22px] overflow-hidden shadow-2xl',
        'transition-shadow ring-1 ring-black/5',
        dims.w,
        className
      )}
      style={{ background: d.palette.bg, color: d.palette.ink }}
    >
      {/* subtle overlay glow */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
           style={{ background: d.palette.accent }} />

      <div className={cn('relative h-full w-full flex flex-col justify-between', dims.p)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Logomark size={size === 'lg' ? 34 : size === 'md' ? 28 : 24} inverted={inverted} />
            <div className="text-[10px] uppercase tracking-[0.22em] font-semibold">
              Salt World<span className="align-super text-[0.55em] ml-0.5">®</span>
            </div>
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.22em] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: d.palette.ink }}
          >
            {occasion || 'Gift Card'}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: d.palette.subInk }}>
            Value
          </div>
          <div className={cn('font-serif tracking-tight', dims.amt)}>
            {formatINR(Number(amount) || 0)}
          </div>
          {(to || from) && (
            <div className="mt-3 text-[12px] leading-5" style={{ color: d.palette.subInk }}>
              {to && <div>To — <span className="font-medium" style={{ color: d.palette.ink }}>{to}</span></div>}
              {from && <div>From — <span className="font-medium" style={{ color: d.palette.ink }}>{from}</span></div>}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            {message ? (
              <p className="text-[12.5px] leading-5 line-clamp-2 italic" style={{ color: d.palette.subInk }}>
                &ldquo;{message}&rdquo;
              </p>
            ) : (
              <div className={cn('font-serif italic', dims.headline)}>
                {d.subtitle}
              </div>
            )}
          </div>
          {code && (
            <div className="text-right shrink-0">
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: d.palette.subInk }}>Code</div>
              <div className="text-[13px] font-mono tracking-tight font-semibold">{code}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
