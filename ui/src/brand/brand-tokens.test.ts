import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOSTAN_BRAND,
  BOSTAN_TEXT_PAIRS,
  BOSTAN_THEMES,
  BOSTAN_UI_PAIRS,
  contrastRatio,
  type BostanThemeName,
} from "./tokens";

const css = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

function block(selector: ":root" | ".dark"): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}", start));
}

function cssTokens(selector: ":root" | ".dark"): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block(selector).matchAll(/--bostan-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6});/g)) {
    tokens[match[1]] = match[2].toUpperCase();
  }
  return tokens;
}

const SELECTOR: Record<BostanThemeName, ":root" | ".dark"> = { light: ":root", dark: ".dark" };

describe("Bostan v3 tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`index.css ${SELECTOR[theme]} matches tokens.ts (${theme})`, () => {
      const fromCss = cssTokens(SELECTOR[theme]);
      for (const [name, value] of Object.entries(BOSTAN_THEMES[theme])) {
        expect(fromCss[name], `--bostan-${name}`).toBe(value);
      }
    });

    it(`every text pairing reaches WCAG AA in ${theme}`, () => {
      const tokens = BOSTAN_THEMES[theme];
      const failures = BOSTAN_TEXT_PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrastRatio(tokens[fg], tokens[bg]) }))
        .filter(({ ratio }) => ratio < 4.5)
        .map(({ fg, bg, ratio }) => `${fg} on ${bg}: ${ratio.toFixed(2)}`);
      expect(failures).toEqual([]);
    });

    it(`brand accent reaches 3:1 for non-text UI in ${theme}`, () => {
      const tokens = BOSTAN_THEMES[theme];
      const failures = BOSTAN_UI_PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrastRatio(tokens[fg], tokens[bg]) }))
        .filter(({ ratio }) => ratio < 3)
        .map(({ fg, bg, ratio }) => `${fg} on ${bg}: ${ratio.toFixed(2)}`);
      expect(failures).toEqual([]);
    });
  }

  it("keeps the fixed brand colours in :root", () => {
    const root = cssTokens(":root");
    expect(root.red).toBe(BOSTAN_BRAND.red);
    expect(root.navy).toBe(BOSTAN_BRAND.navy);
    expect(root.sky).toBe(BOSTAN_BRAND.sky);
    expect(root.mist).toBe(BOSTAN_BRAND.mist);
    expect(contrastRatio(BOSTAN_BRAND.red, BOSTAN_BRAND.paper)).toBeGreaterThanOrEqual(5);
  });

  it("does not reintroduce the retired cream/sage/slate palette or a serif display face", () => {
    for (const retired of ["#F6F4EB", "#D7E7DE", "#7F9EB7", "Newsreader"]) {
      expect(css.includes(retired), retired).toBe(false);
    }
  });

  it("maps the semantic shadcn layer onto the brand tokens", () => {
    const root = block(":root");
    expect(root).toMatch(/--background: var\(--bostan-bg\);/);
    expect(root).toMatch(/--primary: var\(--bostan-primary-fill\);/);
    expect(root).toMatch(/--sidebar-accent: var\(--bostan-muted\);/);
    expect(css).toMatch(/@utility nav-active \{[\s\S]*?background-color: var\(--color-selected\);[\s\S]*?color: var\(--color-bad\);[\s\S]*?box-shadow: var\(--nav-active-bar\);/);
    expect(root).toMatch(/--ring: var\(--bostan-primary\);/);
  });
});
