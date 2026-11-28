import type { SVGProps } from "react";
import geometry from "../../brand/geometry.json";
import { cn } from "../../lib/utils";

/**
 * Colour treatment.
 * - `default`: strokes follow `currentColor` (ink in light, near-white in
 *   dark), nodes use the themed brand accent.
 * - `reversed`: all white, for use on Bostan Red.
 * - `on-navy`: white strokes with the --bostan-dark-node red, for use on navy.
 */
export type BostanMarkTone = "default" | "reversed" | "on-navy";

const NODE_FILL: Record<BostanMarkTone, string> = {
  default: "var(--color-brand-accent)",
  reversed: "var(--bostan-paper)",
  "on-navy": "var(--bostan-dark-node)",
};
const STROKE: Record<BostanMarkTone, string> = {
  default: "currentColor",
  reversed: "var(--bostan-paper)",
  "on-navy": "var(--bostan-paper)",
};

type SvgProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox">;

export interface BostanMarkProps extends SvgProps {
  /** Rendered size in px. 32 and below switch to the small-size drawing. */
  size?: number;
  tone?: BostanMarkTone;
  /** Accessible name. Omit for a decorative mark (aria-hidden). */
  title?: string;
}

function smallStrokeWidth(size: number): number {
  const table = geometry.markSmall.strokeWidthBySize as Record<string, number>;
  if (size <= 16) return table["16"];
  if (size <= 24) return table["24"];
  return table["32"];
}

/**
 * The Bostan tree mark: a stem with two branches, three red nodes and a
 * ground line. At 32px and below the ground is dropped and strokes thicken.
 */
export function BostanMark({ size = 24, tone = "default", title, className, ...props }: BostanMarkProps) {
  const small = size <= 32;
  const drawing = small ? geometry.markSmall : geometry.mark;
  const strokeWidth = small ? smallStrokeWidth(size) : geometry.mark.strokeWidth;
  const strokes = small ? geometry.markSmall.strokes : [...geometry.mark.strokes, geometry.mark.ground];
  return (
    <svg
      viewBox={drawing.viewBox}
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-variant={small ? "small" : "full"}
      className={cn("shrink-0", className)}
      {...props}
    >
      <g fill="none" stroke={STROKE[tone]} strokeWidth={strokeWidth}>
        {strokes.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill={NODE_FILL[tone]}>
        {drawing.nodes.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}

export interface BostanWordmarkProps extends SvgProps {
  /** Rendered height in px; width follows the 482:112 aspect ratio. */
  height?: number;
  tone?: BostanMarkTone;
}

/**
 * Custom-drawn BOSTAN wordmark: geometric monoline caps, the T carries two
 * red nodes. Always exposes the accessible name "Bostan".
 */
export function BostanWordmark({ height = 20, tone = "default", className, ...props }: BostanWordmarkProps) {
  const { wordmark } = geometry;
  const width = Math.round((height * wordmark.width) / wordmark.height);
  return (
    <svg
      viewBox={wordmark.viewBox}
      width={width}
      height={height}
      role="img"
      aria-label="Bostan"
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      <g fill="none" stroke={STROKE[tone]} strokeWidth={wordmark.strokeWidth} strokeLinejoin="round">
        {wordmark.strokes.map((d) => (
          <path key={d} d={d} />
        ))}
        {wordmark.circles.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g fill={NODE_FILL[tone]}>
        {wordmark.nodes.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}
