// Salt World Design System — canonical token map.
// Consumed by the docs page; components themselves reference the same
// Tailwind/CSS variables defined in globals.css so this stays in sync.

export const COLORS = [
  { name: 'background', css: 'bg-background', desc: 'Page background' },
  { name: 'foreground', css: 'bg-foreground', desc: 'Primary text' },
  { name: 'card', css: 'bg-card border border-border', desc: 'Surface / card' },
  { name: 'muted', css: 'bg-muted', desc: 'Subtle surfaces, chips' },
  { name: 'muted-foreground', css: 'bg-muted-foreground', desc: 'Secondary text' },
  { name: 'border', css: 'bg-border', desc: 'Hairlines, dividers' },
  { name: 'ring', css: 'bg-ring', desc: 'Focus rings' },
  { name: 'brand', css: 'bg-brand', desc: 'Salt World accent' },
  { name: 'destructive', css: 'bg-destructive', desc: 'Errors, destructive actions' },
];

export const TYPE_SCALE = [
  { name: 'Display',  cls: 'text-5xl md:text-6xl font-semibold tracking-tight leading-[1.02]', px: '48 / 60', usage: 'Hero titles' },
  { name: 'Title 1',  cls: 'text-4xl font-semibold tracking-tight leading-tight',              px: '36',      usage: 'Page titles' },
  { name: 'Title 2',  cls: 'text-2xl font-semibold tracking-tight',                            px: '24',      usage: 'Section titles' },
  { name: 'Title 3',  cls: 'text-xl font-semibold',                                            px: '20',      usage: 'Sub-sections' },
  { name: 'Body L',   cls: 'text-[17px] leading-7 text-foreground',                            px: '17',      usage: 'Lead paragraphs' },
  { name: 'Body',     cls: 'text-[15px] leading-7 text-foreground',                            px: '15',      usage: 'Default body' },
  { name: 'Body S',   cls: 'text-[13px] leading-6 text-muted-foreground',                      px: '13',      usage: 'Meta, captions' },
  { name: 'Micro',    cls: 'text-[11px] uppercase tracking-wider font-medium text-muted-foreground', px: '11', usage: 'Labels, eyebrows' },
  { name: 'Mono',     cls: 'font-mono text-[13px]',                                            px: '13',      usage: 'Code, IDs' },
];

export const SPACING = [
  { name: '0', px: 0 }, { name: '1', px: 4 }, { name: '2', px: 8 },
  { name: '3', px: 12 }, { name: '4', px: 16 }, { name: '6', px: 24 },
  { name: '8', px: 32 }, { name: '12', px: 48 }, { name: '16', px: 64 }, { name: '24', px: 96 },
];

export const RADIUS = [
  { name: 'xs', cls: 'rounded-[4px]',  px: 4 },
  { name: 'sm', cls: 'rounded-md',     px: 6 },
  { name: 'md', cls: 'rounded-lg',     px: 10 },
  { name: 'lg', cls: 'rounded-xl',     px: 14 },
  { name: 'xl', cls: 'rounded-2xl',    px: 20 },
  { name: 'full', cls: 'rounded-full', px: 999 },
];

export const ELEVATION = [
  { name: 'flat',   cls: 'border border-border',                     desc: 'Default — hairline over fill' },
  { name: 'raised', cls: 'border border-border shadow-sm',           desc: 'Subtle lift for cards on hover' },
  { name: 'popover',cls: 'border border-border shadow-lg',           desc: 'Menus, popovers' },
  { name: 'modal',  cls: 'border border-border shadow-2xl',          desc: 'Dialogs, sheets' },
];

export const MOTION = [
  { name: 'instant',  ms: 100, ease: 'linear',                                     usage: 'Hover color' },
  { name: 'fast',     ms: 150, ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',          usage: 'Buttons, chips' },
  { name: 'standard', ms: 220, ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',          usage: 'Cards, popovers' },
  { name: 'slow',     ms: 320, ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',          usage: 'Sheets, dialogs' },
];
