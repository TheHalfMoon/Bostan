import { cn } from "../lib/utils";
import { BostanMark } from "./brand/BostanMark";

/** Branded, reduced-motion-safe loading indicator. */
export function BostanLoading({ className }: { className?: string }) {
  return (
    <div role="status" className={cn("flex min-h-dvh w-full items-center justify-center", className)}>
      <span aria-hidden="true" className="inline-flex text-foreground animate-pulse motion-reduce:animate-none">
        <BostanMark size={64} />
      </span>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
