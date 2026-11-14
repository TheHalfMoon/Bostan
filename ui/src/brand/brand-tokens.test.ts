import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bostanBrand, bostanThemes, contrastRatio, TEXT_PAIRS, THEMED_TOKEN_NAMES } from "./tokens";

const stylesheet = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
const assetsDir = fileURLToPath(new URL("../assets/brand/", import.meta.url));

function cssBlock(selector: string): string {
  const start = stylesheet.indexOf(`\n${selector} {`);
  expect(start, `Missing CSS selector: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = stylesheet.indexOf("{", start);
  return stylesheet.slice(bodyStart + 1, stylesheet.indexOf("\n}", bodyStart));
}

function cssToken(block: string, name: string): string | null {
  return block.match(new RegExp(`^\\s*--bostan-${name}:\\s*([^;]+);`, "m"))?.[1].trim() ?? null;
}

/** Hue in degrees and saturation (0–1) of a #RRGGBB colour. */
function hueSaturation(hex: string): [number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, s];
}

/** Orange / terracotta / clay: hue 10–45° with real chroma (not a warm near-white or near-black). */
function isOrange(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const [h] = hueSaturation(hex);
  return h >= 10 && h <= 45 && chroma >= 0.2;
}

describe("Bostan brand tokens", () => {
  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ] as const)("declares every themed token in %s with the TypeScript value", (selector, theme) => {
    const block = cssBlock(selector);
    for (const name of THEMED_TOKEN_NAMES) {
      expect(cssToken(block, name), `--bostan-${name} in ${selector}`).toBe(bostanThemes[theme][name]);
    }
  });

  it("declares the theme-independent brand colours once, in :root", () => {
    const root = cssBlock(":root");
    const dark = cssBlock(".dark");
    for (const [name, value] of Object.entries(bostanBrand)) {
      expect(cssToken(root, name), `--bostan-${name}`).toBe(value);
      expect(cssToken(dark, name), `--bostan-${name} must not change in dark`).toBeNull();
    }
  });

  it.each(["light", "dark"] as const)("meets WCAG AA (4.5:1) for every text pairing in the %s theme", (theme) => {
    const tokens = bostanThemes[theme];
    const failures = TEXT_PAIRS.map(([fg, bg]) => ({ fg, bg, ratio: contrastRatio(tokens[fg], tokens[bg]) }))
      .filter(({ ratio }) => ratio < 4.5)
      .map(({ fg, bg, ratio }) => `${fg} on ${bg}: ${ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it("keeps slate-700 as the text-safe slate on cream (6.3:1)", () => {
    expect(contrastRatio(bostanBrand["slate-700"], bostanBrand.cream)).toBeGreaterThanOrEqual(6.3);
  });

  it("maps the shadcn semantic layer onto the brand tokens", () => {
    const root = cssBlock(":root");
    const semantic = (name: string) => root.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"))?.[1].trim();
    expect(semantic("background")).toBe("var(--bostan-bg)");
    expect(semantic("foreground")).toBe("var(--bostan-ink)");
    expect(semantic("card")).toBe("var(--bostan-card)");
    expect(semantic("primary")).toBe("var(--bostan-ink)");
    expect(semantic("primary-foreground")).toBe("var(--bostan-on-ink)");
    expect(semantic("accent")).toBe("var(--bostan-sage)");
    expect(semantic("border")).toBe("var(--bostan-line)");
    expect(semantic("ring")).toBe("var(--bostan-accent-text)");
    expect(semantic("sidebar")).toBe("var(--bostan-chrome)");
  });

  it("contains no orange or terracotta in the brand palette or logo assets", () => {
    const brandColours = [
      ...Object.values(bostanBrand),
      // Warning colours are semantic status colours, not brand; they are amber/olive by design.
      ...(["light", "dark"] as const).flatMap((theme) =>
        Object.entries(bostanThemes[theme])
          .filter(([name]) => !name.startsWith("warn") && !name.startsWith("bad") && !name.includes("danger"))
          .map(([, value]) => value),
      ),
    ];
    expect(brandColours.filter(isOrange)).toEqual([]);

    const assetColours = readdirSync(assetsDir)
      .filter((file) => file.endsWith(".svg"))
      .flatMap((file) => readFileSync(`${assetsDir}${file}`, "utf8").match(/#[0-9A-Fa-f]{6}\b/g) ?? []);
    expect(assetColours.length).toBeGreaterThan(0);
    expect(assetColours.filter(isOrange)).toEqual([]);
    // The detector itself must catch the retired terracotta/clay values.
    expect(["#D9765A", "#D77457", "#E2A18D"].every(isOrange)).toBe(true);
    for (const legacy of ["#D9765A", "#D77457", "#E2A18D", "#DCC4B0"]) {
      expect(stylesheet.toUpperCase()).not.toContain(legacy);
    }
  });
});
