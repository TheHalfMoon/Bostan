import { cn } from "../lib/utils";

/** Branded, reduced-motion-safe loading indicator without a third-party product icon. */
export function BostanLoading({ className }: { className?: string }) {
  return (
    <div role="status" className={cn("flex min-h-dvh w-full items-center justify-center", className)}>
      <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-2xl border border-current/25 text-4xl font-semibold text-muted-foreground animate-pulse motion-reduce:animate-none">B</span>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
