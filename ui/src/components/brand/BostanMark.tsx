import type { SVGAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  ICON_ART_PATH,
  ICON_ART_VIEWBOX,
  LOCKUP_VIEWBOX,
  LOCKUP_WORDMARK_TRANSFORM,
  MARK_PATH,
  MARK_VIEWBOX,
  TREE_INK_PATH,
  TREE_NODES_PATH,
  TREE_VIEWBOX,
  WORDMARK_PATH,
} from "@/brand/paths";

type BrandSvgProps = Omit<SVGAttributes<SVGSVGElement>, "children" | "viewBox"> & {
  /** Accessible name. Omit (or pass "") when the mark sits beside visible "Bostan" text. */
  title?: string;
};

function a11y(title: string | undefined) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const, focusable: "false" as const };
}

/**
 * The Bostan tree. `tone="color"` (default) draws ink linework in
 * `currentColor` with slate nodes; `tone="mono"` draws everything in
 * `currentColor`. Size it with `className` (e.g. `h-6 w-auto`).
 */
export function BostanTree({
  title = "Bostan",
  tone = "color",
  className,
  ...props
}: BrandSvgProps & { tone?: "color" | "mono" }) {
  return (
    <svg viewBox={TREE_VIEWBOX} className={cn("shrink-0", className)} {...a11y(title)} {...props}>
      <path d={TREE_INK_PATH} fill="currentColor" />
      <path d={TREE_NODES_PATH} fill={tone === "mono" ? "currentColor" : "var(--bostan-slate)"} />
    </svg>
  );
}

/** Standalone mark from the logo system, for small and system surfaces. Single colour. */
export function BostanMark({ title = "Bostan", className, ...props }: BrandSvgProps) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn("shrink-0", className)} {...a11y(title)} {...props}>
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Compact app icon: cream tree on a slate rounded square. */
export function BostanAppIcon({ title = "Bostan", className, ...props }: BrandSvgProps) {
  return (
    <svg viewBox="0 0 98 98" className={cn("shrink-0", className)} {...a11y(title)} {...props}>
      <rect width="98" height="98" rx="22" fill="var(--bostan-slate)" />
      <svg x="11.5" y="10" width="75" height="78" viewBox={ICON_ART_VIEWBOX} preserveAspectRatio="none">
        <path d={ICON_ART_PATH} fill="var(--bostan-cream)" />
      </svg>
    </svg>
  );
}

/**
 * Horizontal lockup: tree plus the outlined Newsreader wordmark. The wordmark
 * and linework take `currentColor`, so the lockup reverses automatically on
 * dark surfaces.
 */
export function BostanLockupGraphic({ title = "Bostan", tone = "color", className, ...props }: BrandSvgProps & { tone?: "color" | "mono" }) {
  return (
    <svg viewBox={LOCKUP_VIEWBOX} className={cn("shrink-0", className)} {...a11y(title)} {...props}>
      <path d={TREE_INK_PATH} fill="currentColor" />
      <path d={TREE_NODES_PATH} fill={tone === "mono" ? "currentColor" : "var(--bostan-slate)"} />
      <path transform={LOCKUP_WORDMARK_TRANSFORM} d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}
