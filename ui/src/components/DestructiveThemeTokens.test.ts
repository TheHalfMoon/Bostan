import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bostanThemes, contrastRatio } from "../brand/tokens";

const stylesheet = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

function cssBlock(selector: string): string {
  const start = stylesheet.indexOf(`\n${selector} {`);
  expect(start, `Missing CSS selector: ${selector}`).toBeGreaterThanOrEqual(0);
  const bodyStart = stylesheet.indexOf("{", start);
  const bodyEnd = stylesheet.indexOf("\n}", bodyStart);
  return stylesheet.slice(bodyStart + 1, bodyEnd);
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"));
  expect(match, `Missing token --${name}`).not.toBeNull();
  return match![1].trim();
}

describe("destructive theme tokens", () => {
  // Confirm buttons use `bg-destructive text-destructive-foreground`. Both map
  // onto the Bostan danger tokens, whose values live in src/brand/tokens.ts
  // (mirrored as --bostan-* in index.css). The label must meet WCAG AA (4.5:1)
  // on the destructive fill in both themes.
  it("maps destructive colours onto the Bostan danger tokens", () => {
    const root = cssBlock(":root");
    expect(token(root, "destructive")).toBe("var(--bostan-danger)");
    expect(token(root, "destructive-foreground")).toBe("var(--bostan-on-danger)");
  });

  for (const [selector, theme] of [
    [":root", "light"],
    [".dark", "dark"],
  ] as const) {
    it(`keeps destructive-foreground readable on the destructive fill in ${selector}`, () => {
      const block = cssBlock(selector);
      const fill = token(block, "bostan-danger");
      const foreground = token(block, "bostan-on-danger");
      expect(fill).toBe(bostanThemes[theme].danger);
      expect(foreground).toBe(bostanThemes[theme]["on-danger"]);
      expect(contrastRatio(foreground, fill)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
