/**
 * Bostan identity v3 colour tokens.
 *
 * Runtime styling comes from the CSS custom properties in `src/index.css`
 * (`--bostan-*`); this module mirrors them for code that needs literal values
 * (canvas/SVG export, contrast checks, Storybook swatches). `brand-tokens.test.ts`
 * fails if the two drift apart, and checks WCAG AA for every text pairing.
 */

/** Fixed brand colours. Navy, cobalt and sky are for illustration and data only. */
export const BOSTAN_BRAND = {
  red: "#D91F26",
  ink: "#111214",
  paper: "#FFFFFF",
  mist: "#F2F4F7",
  navy: "#17245A",
  cobalt: "#2F5BEA",
  sky: "#C7D8F8",
  /** Mark nodes on the navy "dark" logo variant. */
  darkNode: "#FF5A52",
} as const;

export type BostanThemeName = "light" | "dark";

export interface BostanThemeTokens {
  bg: string;
  chrome: string;
  surface: string;
  card: string;
  muted: string;
  /** Nav/tab highlight background. */
  selected: string;
  ink: string;
  "ink-2": string;
  "ink-3": string;
  line: string;
  "line-strong": string;
  /** Brand accent: mark nodes, active-nav bar, focus ring. Not for text. */
  primary: string;
  /** Fill behind on-primary text (buttons, badges). */
  "primary-fill": string;
  /** Red used as text. */
  "primary-text": string;
  "on-primary": string;
  "info-bg": string;
  "info-text": string;
  "warn-bg": string;
  "warn-text": string;
  "ok-bg": string;
  "ok-text": string;
  "bad-bg": string;
  "bad-text": string;
  cobalt: string;
}

export const BOSTAN_THEMES: Record<BostanThemeName, BostanThemeTokens> = {
  light: {
    bg: "#F5F6F8",
    chrome: "#FFFFFF",
    surface: "#FAFBFC",
    card: "#FFFFFF",
    muted: "#EEF0F3",
    selected: "#FDECEA",
    ink: "#111214",
    "ink-2": "#343841",
    "ink-3": "#5B606B",
    line: "#E3E5EA",
    "line-strong": "#C9CDD5",
    primary: "#D91F26",
    "primary-fill": "#D91F26",
    "primary-text": "#A3141A",
    "on-primary": "#FFFFFF",
    "info-bg": "#EAF0FD",
    "info-text": "#2349C4",
    "warn-bg": "#FBF1D9",
    "warn-text": "#7A5200",
    "ok-bg": "#E5F3EB",
    "ok-text": "#1D6B45",
    "bad-bg": "#FDECEA",
    "bad-text": "#A3141A",
    cobalt: "#2F5BEA",
  },
  dark: {
    bg: "#0E1014",
    chrome: "#14171C",
    surface: "#111318",
    card: "#1A1D23",
    muted: "#252932",
    selected: "#3A1A1C",
    ink: "#EDEEF0",
    "ink-2": "#C5C8CF",
    "ink-3": "#9A9FA9",
    line: "#262A31",
    "line-strong": "#3D424B",
    primary: "#E5382F",
    // White on #E5382F is 4.25:1 (below AA for body text), so filled
    // buttons keep Bostan Red (5.03:1) in dark mode too.
    "primary-fill": "#D91F26",
    "primary-text": "#FF8F86",
    "on-primary": "#FFFFFF",
    "info-bg": "#18223F",
    "info-text": "#9DB7FF",
    "warn-bg": "#3A2E12",
    "warn-text": "#F2C66B",
    "ok-bg": "#13291D",
    "ok-text": "#8FD9B0",
    "bad-bg": "#3A1517",
    "bad-text": "#FF8F86",
    cobalt: "#5F84FF",
  },
};

/** Surfaces body text may sit on. */
export const BOSTAN_TEXT_SURFACES = ["bg", "chrome", "surface", "card", "muted"] as const;

/**
 * Foreground/background pairs that carry text. Every pair must reach WCAG AA
 * (4.5:1) in both themes.
 */
export const BOSTAN_TEXT_PAIRS: ReadonlyArray<readonly [keyof BostanThemeTokens, keyof BostanThemeTokens]> = [
  ...(["ink", "ink-2", "ink-3", "primary-text", "info-text", "bad-text"] as const).flatMap((fg) =>
    BOSTAN_TEXT_SURFACES.map((bg) => [fg, bg] as const),
  ),
  ["on-primary", "primary-fill"],
  ["info-text", "info-bg"],
  ["warn-text", "warn-bg"],
  ["ok-text", "ok-bg"],
  ["bad-text", "bad-bg"],
  ["bad-text", "selected"],
  ["ink", "selected"],
];

/**
 * Non-text UI pairs (WCAG 1.4.11, 3:1): the brand accent against the page,
 * e.g. the active-nav bar, focus ring and mark nodes.
 */
export const BOSTAN_UI_PAIRS: ReadonlyArray<readonly [keyof BostanThemeTokens, keyof BostanThemeTokens]> = [
  ["primary", "bg"],
  ["primary", "chrome"],
  ["primary", "card"],
  ["primary", "selected"],
  ["cobalt", "card"],
];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
