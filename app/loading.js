export default function Loading() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
        </div>
        <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-muted-foreground">Loading</div>
        <span className="sr-only">Loading page…</span>
      </div>
    </div>
  );
}
