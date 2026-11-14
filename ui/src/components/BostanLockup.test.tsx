// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BostanLockup } from "./BostanLockup";

describe("BostanLockup", () => {
  it("renders the tree-and-wordmark lockup as one accessible image", () => {
    const html = renderToStaticMarkup(<BostanLockup />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Bostan"');
    // Ink linework and wordmark follow the theme; nodes use the slate brand token.
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('fill="var(--bostan-slate)"');
    expect(html.match(/<path /g)).toHaveLength(3);
    expect(html).not.toContain(">B</span>");
    expect(html).not.toContain("Paperclip");
  });

  it("preserves caller sizing and accessibility attributes", () => {
    const html = renderToStaticMarkup(<BostanLockup className="h-5" data-testid="brand" />);
    expect(html).toContain("h-5");
    expect(html).toContain('data-testid="brand"');
  });
});
