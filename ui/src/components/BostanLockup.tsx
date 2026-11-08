import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

type BostanLockupProps = HTMLAttributes<HTMLSpanElement>;

/** Neutral, accessible product lockup. A final graphic identity can replace the mark separately. */
export function BostanLockup({ className, ...props }: BostanLockupProps) {
  return (
    <span {...props} aria-label="Bostan" className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg border border-current text-sm font-bold">B</span>
      <span aria-hidden="true" className="text-lg leading-none">Bostan</span>
    </span>
  );
}
