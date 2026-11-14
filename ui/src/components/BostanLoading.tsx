import { cn } from "../lib/utils";
import { BostanTree } from "./brand/BostanMark";

/**
 * Splash / loading usage of the Bostan identity: the primary tree above the
 * wordmark on the page background. The tree breathes gently unless the user
 * prefers reduced motion.
 */
export function BostanLoading({ className }: { className?: string }) {
  return (
    <div role="status" className={cn("flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-background text-foreground", className)}>
      <BostanTree title="" className="h-20 w-auto animate-pulse motion-reduce:animate-none" />
      <span aria-hidden="true" className="font-serif text-2xl font-semibold tracking-tight">Bostan</span>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
