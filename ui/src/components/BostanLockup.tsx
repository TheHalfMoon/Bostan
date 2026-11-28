import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";
import { BostanMark, BostanWordmark, type BostanMarkTone } from "./brand/BostanMark";

interface BostanLockupProps extends HTMLAttributes<HTMLSpanElement> {
  /** Mark size in px; the wordmark scales with it. */
  size?: number;
  tone?: BostanMarkTone;
}

/** Horizontal Bostan lockup: the tree mark beside the custom wordmark. */
export function BostanLockup({ className, size = 24, tone = "default", ...props }: BostanLockupProps) {
  return (
    <span {...props} role="img" aria-label="Bostan" className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <BostanMark size={size} tone={tone} />
      <BostanWordmark height={Math.round(size * 0.62)} tone={tone} aria-hidden="true" role={undefined} aria-label={undefined} />
    </span>
  );
}
