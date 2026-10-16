'use client';
import React from 'react';
import { cn } from './utils';
import { Loader2 } from 'lucide-react';

/* ------------------------------- Button ------------------------------- */
const BTN_VARIANTS = {
  primary:     'bg-foreground text-background hover:bg-foreground/90 border border-transparent',
  secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
  outline:     'bg-transparent text-foreground hover:bg-muted border border-border',
  ghost:       'bg-transparent text-foreground hover:bg-muted border border-transparent',
  brand:       'bg-brand text-brand-foreground hover:brightness-110 border border-transparent',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent',
  link:        'bg-transparent text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground border-transparent px-0',
};
const BTN_SIZES = {
  sm: 'h-8 px-3 text-[12.5px] rounded-md gap-1.5',
  md: 'h-9 px-3.5 text-[13.5px] rounded-md gap-2',
  lg: 'h-11 px-5 text-[14.5px] rounded-lg gap-2',
};
export const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, iconLeft, iconRight, className, children, disabled, href, ...rest }, ref
) {
  const cls = cn(
    'inline-flex items-center justify-center font-medium tracking-tight transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
    className
  );
  const content = (
    <>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </>
  );
  // Builder-authored CTA blocks can supply a real destination; plain
  // decorative buttons (no href) keep rendering as <button> exactly as
  // before, so existing pages are unaffected.
  if (href && !disabled && !loading) {
    return <a ref={ref} href={href} className={cls} {...rest}>{content}</a>;
  }
  return (
    <button ref={ref} disabled={disabled || loading} className={cls} {...rest}>
      {content}
    </button>
  );
});

/* ------------------------------- IconButton ------------------------------- */
export const IconButton = React.forwardRef(function IconButton(
  { variant = 'ghost', size = 'md', className, children, ...rest }, ref
) {
  const sizes = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        BTN_VARIANTS[variant], sizes[size], 'px-0', className
      )}
      {...rest}
    >{children}</button>
  );
});

/* ------------------------------- Badge ------------------------------- */
const BADGE_TONES = {
  default:  'bg-muted text-foreground border-border',
  brand:    'bg-brand/10 text-brand border-brand/30',
  success:  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  warn:     'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  danger:   'bg-destructive/10 text-destructive border-destructive/30',
  neutral:  'bg-foreground/5 text-foreground border-border',
};
export const Badge = ({ tone = 'default', children, className, ...rest }) => (
  <span className={cn(
    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11.5px] font-medium leading-none',
    BADGE_TONES[tone], className
  )} {...rest}>{children}</span>
);

/* ------------------------------- Pill (rounded-full) ------------------------------- */
export const Pill = ({ tone = 'default', children, className, ...rest }) => (
  <span className={cn(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium',
    BADGE_TONES[tone], className
  )} {...rest}>{children}</span>
);

/* ------------------------------- Card ------------------------------- */
export const Card = ({ className, children, elevation = 'flat', interactive, ...rest }) => {
  const el = {
    flat: 'border border-border',
    raised: 'border border-border shadow-sm',
    popover: 'border border-border shadow-lg',
    modal: 'border border-border shadow-2xl',
  }[elevation];
  return (
    <div className={cn(
      'bg-card text-card-foreground rounded-xl',
      el,
      interactive && 'transition-all hover:shadow-md hover:-translate-y-0.5',
      className
    )} {...rest}>{children}</div>
  );
};
export const CardHeader = ({ className, children }) => (
  <div className={cn('p-5 pb-3', className)}>{children}</div>
);
export const CardTitle = ({ className, children }) => (
  <h3 className={cn('text-[15px] font-semibold tracking-tight', className)}>{children}</h3>
);
export const CardDescription = ({ className, children }) => (
  <p className={cn('text-[13px] text-muted-foreground mt-0.5', className)}>{children}</p>
);
export const CardBody = ({ className, children }) => (
  <div className={cn('px-5 pb-5 pt-1 text-[14px] leading-6 text-foreground', className)}>{children}</div>
);
export const CardFooter = ({ className, children }) => (
  <div className={cn('px-5 py-3 border-t border-border flex items-center justify-between gap-3', className)}>{children}</div>
);

/* ------------------------------- StatCard ------------------------------- */
export const StatCard = ({ label, value, delta, deltaTone = 'success', icon: Icon, footer, className }) => (
  <Card className={cn('p-5', className)} elevation="flat">
    <div className="flex items-start justify-between">
      <div className="text-[11.5px] uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
    </div>
    <div className="mt-2 flex items-baseline gap-2">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {delta && <Badge tone={deltaTone} className="text-[11px]">{delta}</Badge>}
    </div>
    {footer && <div className="mt-3 text-[12.5px] text-muted-foreground">{footer}</div>}
  </Card>
);

/* ------------------------------- Divider ------------------------------- */
export const Divider = ({ className }) => <div className={cn('h-px w-full bg-border', className)} />;

/* ------------------------------- Kbd ------------------------------- */
export const Kbd = ({ children, className }) => (
  <kbd className={cn('font-mono text-[10.5px] px-1.5 py-0.5 rounded border border-border bg-muted text-foreground', className)}>{children}</kbd>
);
