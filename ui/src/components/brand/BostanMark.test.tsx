// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BostanMark, BostanWordmark } from "./BostanMark";

describe("BostanMark", () => {
  it("draws the full mark with ground line and three nodes above 32px", () => {
    const html = renderToStaticMarkup(<BostanMark size={64} title="Bostan" />);
    expect(html).toContain('data-variant="full"');
    expect(html).toContain('d="M14 60H50"');
    expect(html).toContain('stroke-width="6"');
    expect(html.match(/<circle/g)).toHaveLength(3);
    expect(html).toContain('role="img" aria-label="Bostan"');
  });

  it("switches to the small drawing (no ground, heavier stroke) at 16px", () => {
    const html = renderToStaticMarkup(<BostanMark size={16} />);
    expect(html).toContain('data-variant="small"');
    expect(html).not.toContain("M14 60H50");
    expect(html).toContain('stroke-width="10"');
    expect(html).toContain('r="8"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("uses white nodes when reversed on red", () => {
    const html = renderToStaticMarkup(<BostanMark size={64} tone="reversed" />);
    expect(html).toContain('fill="var(--bostan-paper)"');
    expect(html).not.toContain("currentColor");
  });
});

describe("BostanWordmark", () => {
  it("keeps the 482:112 aspect and two red nodes on the T", () => {
    const html = renderToStaticMarkup(<BostanWordmark height={112} />);
    expect(html).toContain('width="482"');
    expect(html).toContain('cx="270"');
    expect(html).toContain('cx="322"');
    expect(html).toContain('stroke-linejoin="round"');
  });
});
