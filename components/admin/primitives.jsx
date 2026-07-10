'use client';

import { cn } from '@/components/ss/utils';
import { Loader2 } from 'lucide-react';

/**
 * Uniform data table used across BOS admin modules.
 * columns: [{ key, label, className?, render? }]
 * empty: string | node
 */
export function SimpleTable({ columns, rows, isLoading, empty = 'No records yet.', onRowClick, className }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      <table className="w-full text-left">
        <thead className="bg-muted/40">
          <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-2.5 font-semibold', c.className)}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center"><Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" /></td></tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-[12.5px] text-muted-foreground">{empty}</td></tr>
          )}
          {!isLoading && rows.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-t border-border transition-colors', onRowClick && 'cursor-pointer hover:bg-muted/40')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 text-[13px]', c.className)}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tabs({ items, active, onChange }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-border">
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'h-9 px-3.5 text-[12.5px] font-medium border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label} {typeof t.count === 'number' && (
            <span className="ml-1.5 text-[10.5px] text-muted-foreground">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, title, eyebrow, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-background border-l border-border flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            {eyebrow && <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{eyebrow}</div>}
            <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-3 border-t border-border">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
        {label}{required && <span className="text-brand ml-1">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Input(props) {
  return <input {...props} className={cn('w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring', props.className)} />;
}

export function Textarea(props) {
  return <textarea {...props} className={cn('w-full px-3 py-2 rounded-md border border-input bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring resize-y', props.className)} />;
}

export function Select(props) {
  return <select {...props} className={cn('w-full h-10 px-3 rounded-md border border-input bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring', props.className)}>{props.children}</select>;
}

export function PrimaryBtn({ children, ...rest }) {
  return <button {...rest} className={cn('h-10 px-4 rounded-md bg-foreground text-background text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 hover:bg-foreground/90 transition-colors', rest.className)}>{children}</button>;
}

export function GhostBtn({ children, ...rest }) {
  return <button {...rest} className={cn('h-9 px-3 rounded-md border border-border text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors', rest.className)}>{children}</button>;
}

export const inr = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
