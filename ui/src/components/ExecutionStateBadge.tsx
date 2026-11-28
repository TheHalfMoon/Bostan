import { cn } from "../lib/utils";
import { EXECUTION_STATE_META, type ExecutionState, type ExecutionTone } from "../lib/execution-state";

/** Pill colours per tone: tinted background + AA text token. */
const PILL_TONE: Record<ExecutionTone, string> = {
  neutral: "bg-muted text-ink-2",
  accent: "bg-selected text-bad",
  info: "bg-info-bg text-info",
  ok: "bg-ok-bg text-ok",
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  unknown: "bg-muted text-ink-2 outline-1 outline-dashed -outline-offset-1 outline-line-strong",
};

/** Card colours per tone (tile layout with description). */
const CARD_TONE: Record<ExecutionTone, string> = {
  neutral: "border-border bg-card",
  accent: "border-border bg-card",
  info: "border-transparent bg-info-bg text-info",
  ok: "border-transparent bg-ok-bg text-ok",
  bad: "border-transparent bg-bad-bg text-bad",
  warn: "border-transparent bg-warn-bg text-warn",
  unknown: "border-dashed border-line-strong bg-muted",
};

/**
 * One glyph per state so the state reads without colour: dashed ring
 * (requested), ring + check (approved), lines (queued), progress arc
 * (running), filled check (completed), seal (verified), filled cross
 * (failed), square bar (blocked), diamond question (outcome unknown).
 * Glyphs use currentColor; inner marks use the card colour.
 */
export function ExecutionStateIcon({ state, className }: { state: ExecutionState; className?: string }) {
  const inner = "var(--color-card)";
  const common = { viewBox: "0 0 16 16", width: 16, height: 16, "aria-hidden": true, focusable: false } as const;
  const cls = cn("size-4 shrink-0", className);
  switch (state) {
    case "requested":
      return (
        <svg {...common} className={cls}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2" />
        </svg>
      );
    case "approved":
      return (
        <svg {...common} className={cls}>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.2 8.2l2 2 3.6-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "queued":
      return (
        <svg {...common} className={cls}>
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 5h10" />
            <path d="M3 8h10" />
            <path d="M3 11h6" />
          </g>
        </svg>
      );
    case "running":
      return (
        <svg {...common} className={cn(cls, "motion-safe:animate-spin")}>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.8" />
          <path d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "completed":
      return (
        <svg {...common} className={cls}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <path d="M5.2 8.2l2 2 3.6-4" fill="none" stroke={inner} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "verified":
      return (
        <svg {...common} className={cls}>
          <path
            d="M8 1.5l1.7 1.2 2.1-.1.7 2 1.7 1.2-.6 2 .6 2-1.7 1.2-.7 2-2.1-.1L8 14.5l-1.7-1.2-2.1.1-.7-2L1.8 10.2l.6-2-.6-2 1.7-1.2.7-2 2.1.1z"
            fill="currentColor"
          />
          <path d="M5.4 8.2l1.8 1.8 3.4-3.6" fill="none" stroke={inner} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "failed":
      return (
        <svg {...common} className={cls}>
          <circle cx="8" cy="8" r="6.2" fill="currentColor" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke={inner} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "blocked":
      return (
        <svg {...common} className={cls}>
          <rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor" />
          <path d="M5 8h6" stroke={inner} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "outcome_unknown":
      return (
        <svg {...common} className={cls}>
          <path d="M8 1.6l6.4 6.4L8 14.4 1.6 8z" fill="currentColor" />
          <path d="M6.6 6.4a1.5 1.5 0 1 1 2 1.4c-.5.2-.6.5-.6 1" fill="none" stroke={inner} strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8" cy="10.7" r=".8" fill={inner} />
        </svg>
      );
  }
}

interface ExecutionStateBadgeProps {
  state: ExecutionState;
  /** `pill` (default) for rows; `card` shows the description as a tile. */
  variant?: "pill" | "card";
  /** Override the default description in the card variant. */
  description?: string;
  className?: string;
}

/** Labelled execution state. The text label is always present. */
export function ExecutionStateBadge({ state, variant = "pill", description, className }: ExecutionStateBadgeProps) {
  const meta = EXECUTION_STATE_META[state];
  if (variant === "card") {
    return (
      <div
        data-execution-state={state}
        className={cn("flex items-center gap-2.5 rounded-xl border p-3", CARD_TONE[meta.tone], className)}
      >
        <ExecutionStateIcon state={state} />
        <div className="min-w-0">
          <div className="text-sm font-semibold">{meta.label}</div>
          <div className="text-xs opacity-90">{description ?? meta.description}</div>
        </div>
      </div>
    );
  }
  return (
    <span
      data-execution-state={state}
      title={meta.description}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        PILL_TONE[meta.tone],
        className,
      )}
    >
      <ExecutionStateIcon state={state} className="size-3.5" />
      {meta.label}
    </span>
  );
}
