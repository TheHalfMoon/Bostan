/**
 * Bostan brand tokens: the TypeScript mirror of the CSS custom properties
 * declared in `ui/src/index.css` (`--bostan-*`, in `:root` and `.dark`).
 *
 * The CSS is what the app renders with; this module exists so code that
 * cannot read CSS (charts, canvas drawing, tests, the Electron splash) uses the
 * same values. `brand-tokens.test.ts` fails if the two drift apart, and also
 * checks WCAG AA contrast for every text pairing listed in `TEXT_PAIRS`.
 *
 * Approved palette (identity board, Nov 2026): cream #F6F4EB, sage #D7E7DE,
 * slate blue #7F9EB7, ink #1F1F1C. There is no orange or terracotta in the
 * brand; warning and danger colours below are semantic status colours only.
 */

export const THEMED_TOKEN_NAMES = [
  "bg",
  "chrome",
  "surface",
  "card",
  "muted",
  "sage",
  "ink",
  "ink-2",
  "ink-3",
  "on-ink",
  "line",
  "line-strong",
  "accent-text",
  "info-bg",
  "info-text",
  "warn-bg",
  "warn-text",
  "ok-bg",
  "ok-text",
  "bad-bg",
  "bad-text",
  "danger",
  "on-danger",
  // Execution-state accents (System board): icon fills and chip borders.
  "ok-strong",
  "warn-strong",
  "unknown-bg",
  "unknown-text",
  "unknown-strong",
  "info-line",
  "ok-line",
  "warn-line",
  "bad-line",
  "unknown-line",
] as const;

export type ThemedTokenName = (typeof THEMED_TOKEN_NAMES)[number];
export type ThemeName = "light" | "dark";

export const bostanThemes: Record<ThemeName, Record<ThemedTokenName, string>> = {
  light: {
    bg: "#F4F1E8",
    chrome: "#F6F4EB",
    surface: "#FBFAF5",
    card: "#FFFFFF",
    muted: "#ECE9DC",
    sage: "#D7E7DE",
    ink: "#1F1F1C",
    "ink-2": "#3B3B36",
    "ink-3": "#5A5A52",
    "on-ink": "#F6F4EB",
    line: "#E2DED2",
    "line-strong": "#CFCAB8",
    /** Text-safe brand accent: slate-700, 6.3:1 on cream. */
    "accent-text": "#3D5D75",
    "info-bg": "#EAF0F5",
    "info-text": "#2C4A61",
    "warn-bg": "#F3EEDB",
    "warn-text": "#5E480B",
    "ok-bg": "#E6F0EA",
    "ok-text": "#234536",
    "bad-bg": "#F7E7E4",
    "bad-text": "#7E241E",
    /** Destructive actions and Failed state (semantic, not brand). */
    danger: "#A3322A",
    "on-danger": "#FFFFFF",
    "ok-strong": "#2F5A46",
    "warn-strong": "#7A5E10",
    "unknown-bg": "#EFEDF3",
    "unknown-text": "#3C355A",
    "unknown-strong": "#4E4670",
    "info-line": "#C9D7E3",
    "ok-line": "#BFD6C8",
    "warn-line": "#DCCF9F",
    "bad-line": "#E5C2BC",
    "unknown-line": "#D3CEDF",
  },
  dark: {
    bg: "#141513",
    chrome: "#1B1C1A",
    surface: "#181917",
    card: "#222420",
    muted: "#2E302C",
    sage: "#2C3D34",
    ink: "#ECE9DE",
    "ink-2": "#C9C6BA",
    "ink-3": "#A3A196",
    "on-ink": "#141513",
    line: "#2E302C",
    "line-strong": "#45483F",
    "accent-text": "#A9C3D8",
    "info-bg": "#23303B",
    "info-text": "#A9C3D8",
    "warn-bg": "#3A321A",
    "warn-text": "#E3CB7C",
    "ok-bg": "#1F3328",
    "ok-text": "#9FD0B2",
    "bad-bg": "#3B2220",
    "bad-text": "#F0A39A",
    danger: "#F0A39A",
    "on-danger": "#141513",
    // Dark execution-state accents: ok-strong, info-line and bad-line come from
    // the dark desktop artboard; the rest are derived and contrast-tested.
    "ok-strong": "#6FAF8C",
    "warn-strong": "#D9B85A",
    "unknown-bg": "#2A2737",
    "unknown-text": "#CFC8EC",
    "unknown-strong": "#A79CD6",
    "info-line": "#3A4B59",
    "ok-line": "#2E4A3B",
    "warn-line": "#574A22",
    "bad-line": "#5A302B",
    "unknown-line": "#403A55",
  },
};

/** Brand colours that are identical in both themes. */
export const bostanBrand = {
  /** Slate blue: logo nodes, illustration, non-text accents on dark. */
  slate: "#7F9EB7",
  /** Slate-700: the text-safe slate for links and accents on light surfaces. */
  "slate-700": "#3D5D75",
  /** Eucalyptus: secondary illustration and chart accent. */
  eucalyptus: "#8FB5A2",
  /** Cream: artwork on slate (app icon), identical in both themes. */
  cream: "#F6F4EB",
} as const;

export type BrandTokenName = keyof typeof bostanBrand;

/** CSS custom property for a themed token, e.g. `var(--bostan-ink)`. */
export function bostanVar(name: ThemedTokenName | BrandTokenName): string {
  return `var(--bostan-${name})`;
}

/**
 * Foreground/background pairs that carry body text. Each must reach
 * WCAG 2.1 AA (4.5:1) in both themes.
 */
export const TEXT_PAIRS: ReadonlyArray<readonly [ThemedTokenName, ThemedTokenName]> = [
  ["ink", "bg"],
  ["ink", "chrome"],
  ["ink", "surface"],
  ["ink", "card"],
  ["ink", "muted"],
  ["ink", "sage"],
  ["ink-2", "bg"],
  ["ink-2", "card"],
  ["ink-2", "muted"],
  ["ink-3", "bg"],
  ["ink-3", "chrome"],
  ["ink-3", "surface"],
  ["ink-3", "card"],
  ["ink-3", "muted"],
  ["accent-text", "bg"],
  ["accent-text", "chrome"],
  ["accent-text", "card"],
  ["on-ink", "ink"],
  ["info-text", "info-bg"],
  ["warn-text", "warn-bg"],
  ["ok-text", "ok-bg"],
  ["bad-text", "bad-bg"],
  ["bad-text", "card"],
  ["on-danger", "danger"],
  ["danger", "bg"],
  ["danger", "card"],
  ["unknown-text", "unknown-bg"],
];

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio between two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
