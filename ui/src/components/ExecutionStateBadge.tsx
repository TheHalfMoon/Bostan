import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EXECUTION_STATE_COPY, type ExecutionState } from "@/lib/execution-state";

/**
 * Glyphs from the Bostan System board (16-unit grid). Each state has a
 * distinct shape so the state reads without colour. Inner marks use the card
 * colour so they stay legible on the light fills used in dark mode.
 */
const GLYPHS: Record<ExecutionState, ReactNode> = {
  requested: <circle cx="8" cy="8" r="6" fill="none" stroke="var(--bostan-ink-3)" strokeWidth="1.6" strokeDasharray="2.4 2" />,
  approved: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--bostan-accent-text)" strokeWidth="1.6" />
      <path d="M5.2 8.2l2 2 3.6-4" fill="none" stroke="var(--bostan-accent-text)" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  queued: (
    <g stroke="var(--bostan-ink-3)" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 5h10" />
      <path d="M3 8h10" />
      <path d="M3 11h6" />
    </g>
  ),
  running: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--bostan-info-line)" strokeWidth="1.8" />
      <path
        d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2"
        fill="none"
        stroke="var(--bostan-accent-text)"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="origin-center animate-spin motion-reduce:animate-none"
      />
    </>
  ),
  completed: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="var(--bostan-ink-3)" />
      <path d="M5.2 8.2l2 2 3.6-4" fill="none" stroke="var(--bostan-card)" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  verified: (
    <>
      <path
        d="M8 1.5l1.7 1.2 2.1-.1.7 2 1.7 1.2-.6 2 .6 2-1.7 1.2-.7 2-2.1-.1L8 14.5l-1.7-1.2-2.1.1-.7-2L1.8 10.2l.6-2-.6-2 1.7-1.2.7-2 2.1.1z"
        fill="var(--bostan-ok-strong)"
      />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.6" fill="none" stroke="var(--bostan-card)" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  failed: (
    <>
      <circle cx="8" cy="8" r="6.2" fill="var(--bostan-danger)" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--bostan-card)" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  blocked: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="3" fill="var(--bostan-warn-strong)" />
      <path d="M5 8h6" stroke="var(--bostan-card)" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  outcome_unknown: (
    <>
      <path d="M8 1.6l6.4 6.4L8 14.4 1.6 8z" fill="var(--bostan-unknown-strong)" />
      <path d="M6.6 6.4a1.5 1.5 0 1 1 2 1.4c-.5.2-.6.5-.6 1" fill="none" stroke="var(--bostan-card)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="10.7" r=".8" fill="var(--bostan-card)" />
    </>
  ),
};

/* Neutral states use the --bostan-* tokens directly (not shadcn's --card /
   --foreground) so the badge themes correctly inside any `.dark` scope. */
const NEUTRAL = "border-(--bostan-line) bg-(--bostan-card) text-(--bostan-ink)";

/** Chip tone per state: neutral states sit on the card; toned states get their tinted pair. */
const CHIP_TONE: Record<ExecutionState, string> = {
  requested: NEUTRAL,
  approved: "border-(--bostan-line) bg-(--bostan-card) text-accent-text",
  queued: NEUTRAL,
  running: "border-info-line bg-info-bg text-info",
  completed: NEUTRAL,
  verified: "border-ok-line bg-ok-bg text-ok",
  failed: "border-bad-line bg-bad-bg text-bad",
  blocked: "border-warn-line bg-warn-bg text-warn",
  outcome_unknown: "border-unknown-line bg-unknown-bg text-unknown",
};

export function ExecutionStateIcon({ state, className }: { state: ExecutionState; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={cn("size-4 shrink-0", className)} data-execution-state-icon={state}>
      {GLYPHS[state]}
    </svg>
  );
}

interface ExecutionStateBadgeProps {
  state: ExecutionState;
  /** `chip` (default): compact pill for rows. `tile`: label plus description, as on the System board. */
  variant?: "chip" | "tile";
  /** Overrides the default one-line description in the tile variant. */
  description?: string;
  className?: string;
}

export function ExecutionStateBadge({ state, variant = "chip", description, className }: ExecutionStateBadgeProps) {
  const copy = EXECUTION_STATE_COPY[state];
  if (variant === "tile") {
    return (
      <div
        data-execution-state={state}
        className={cn("flex items-center gap-2.5 rounded-lg border p-3", CHIP_TONE[state], className)}
      >
        <ExecutionStateIcon state={state} />
        <div className="min-w-0">
          <div className="text-(length:--text-compact) font-semibold">{copy.label}</div>
          <div className="truncate text-xs opacity-90">{description ?? copy.description}</div>
        </div>
      </div>
    );
  }
  return (
    <span
      data-execution-state={state}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CHIP_TONE[state],
        className,
      )}
    >
      <ExecutionStateIcon state={state} className="size-3" />
      {copy.label}
    </span>
  );
}
