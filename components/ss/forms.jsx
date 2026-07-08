'use client';
import React from 'react';
import { cn } from './utils';
import { Check, ChevronDown } from 'lucide-react';

/* ------------------------------- Field wrapper ------------------------------- */
export const Field = ({ label, hint, error, required, id, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    {label && (
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12.5px] font-medium text-foreground">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {hint && !error && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}
      </div>
    )}
    {children}
    {error && <div className="text-[11.5px] text-destructive">{error}</div>}
  </div>
);

const BASE_INPUT = cn(
  'w-full bg-background text-foreground placeholder:text-muted-foreground',
  'border border-border rounded-md px-3 h-9 text-[13.5px]',
  'transition-shadow focus:outline-none focus:ring-2 focus:ring-ring focus:border-foreground/30',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

/* ------------------------------- Input ------------------------------- */
export const Input = React.forwardRef(function Input({ className, invalid, iconLeft, ...rest }, ref) {
  if (iconLeft) {
    return (
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{iconLeft}</span>
        <input ref={ref} className={cn(BASE_INPUT, 'pl-8', invalid && 'border-destructive focus:ring-destructive/40', className)} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={cn(BASE_INPUT, invalid && 'border-destructive focus:ring-destructive/40', className)} {...rest} />;
});

/* ------------------------------- Textarea ------------------------------- */
export const Textarea = React.forwardRef(function Textarea({ className, rows = 4, invalid, ...rest }, ref) {
  return (
    <textarea ref={ref} rows={rows}
      className={cn(BASE_INPUT, 'h-auto py-2 leading-6 resize-y', invalid && 'border-destructive focus:ring-destructive/40', className)}
      {...rest} />
  );
});

/* ------------------------------- Select (native, styled) ------------------------------- */
export const Select = React.forwardRef(function Select({ className, children, invalid, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref}
        className={cn(BASE_INPUT, 'appearance-none pr-9 cursor-pointer', invalid && 'border-destructive focus:ring-destructive/40', className)}
        {...rest}
      >{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
});

/* ------------------------------- Checkbox ------------------------------- */
export const Checkbox = React.forwardRef(function Checkbox({ className, label, description, id, ...rest }, ref) {
  const inputId = id || React.useId();
  return (
    <label htmlFor={inputId} className={cn('flex items-start gap-2.5 cursor-pointer group', className)}>
      <span className="relative inline-flex mt-0.5 h-4 w-4">
        <input ref={ref} id={inputId} type="checkbox" className="peer sr-only" {...rest} />
        <span className={cn(
          'absolute inset-0 rounded border border-border bg-background',
          'transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
          'peer-checked:bg-foreground peer-checked:border-foreground'
        )} />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-background opacity-0 peer-checked:opacity-100 transition-opacity" />
      </span>
      {(label || description) && (
        <span className="flex-1">
          {label && <span className="block text-[13.5px] text-foreground leading-5">{label}</span>}
          {description && <span className="block text-[12px] text-muted-foreground leading-5 mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
});

/* ------------------------------- Radio ------------------------------- */
export const Radio = React.forwardRef(function Radio({ className, label, description, id, ...rest }, ref) {
  const inputId = id || React.useId();
  return (
    <label htmlFor={inputId} className={cn('flex items-start gap-2.5 cursor-pointer', className)}>
      <span className="relative inline-flex mt-0.5 h-4 w-4">
        <input ref={ref} id={inputId} type="radio" className="peer sr-only" {...rest} />
        <span className="absolute inset-0 rounded-full border border-border bg-background transition-all peer-checked:border-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
        <span className="pointer-events-none absolute inset-0 m-auto h-2 w-2 rounded-full bg-foreground scale-0 peer-checked:scale-100 transition-transform" />
      </span>
      {(label || description) && (
        <span className="flex-1">
          {label && <span className="block text-[13.5px] text-foreground leading-5">{label}</span>}
          {description && <span className="block text-[12px] text-muted-foreground leading-5 mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
});

/* ------------------------------- Switch ------------------------------- */
export const Switch = React.forwardRef(function Switch({ className, checked, defaultChecked, onChange, label, description, id, ...rest }, ref) {
  const inputId = id || React.useId();
  return (
    <label htmlFor={inputId} className={cn('flex items-start gap-3 cursor-pointer', className)}>
      <span className="relative inline-flex mt-0.5">
        <input ref={ref} id={inputId} type="checkbox" role="switch"
          checked={checked} defaultChecked={defaultChecked} onChange={onChange} className="peer sr-only" {...rest} />
        <span className="h-5 w-9 rounded-full bg-muted border border-border transition-colors peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background border border-border transition-transform peer-checked:translate-x-4" />
      </span>
      {(label || description) && (
        <span className="flex-1">
          {label && <span className="block text-[13.5px] text-foreground leading-5">{label}</span>}
          {description && <span className="block text-[12px] text-muted-foreground leading-5 mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
});

/* ------------------------------- Label & Hint (standalone) ------------------------------- */
export const Label = ({ children, htmlFor, className }) => (
  <label htmlFor={htmlFor} className={cn('text-[12.5px] font-medium text-foreground', className)}>{children}</label>
);
export const Hint = ({ children, className }) => (
  <div className={cn('text-[11.5px] text-muted-foreground', className)}>{children}</div>
);
