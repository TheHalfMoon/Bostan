// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BostanLockup } from "./BostanLockup";

describe("BostanLockup", () => {
  it("renders the v3 tree mark and custom wordmark under one accessible name", () => {
    const html = renderToStaticMarkup(<BostanLockup />);
    expect(html).toContain('role="img" aria-label="Bostan"');
    expect(html.match(/aria-label="Bostan"/g)).toHaveLength(1);
    // Mark nodes and the T's two red nodes use the brand accent.
    expect(html).toContain('fill="var(--color-brand-accent)"');
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('viewBox="0 -6 482 112"');
    expect(html).not.toContain(">B</span>");
    expect(html).not.toContain("Paperclip");
  });

  it("preserves caller sizing and accessibility attributes", () => {
    const html = renderToStaticMarkup(<BostanLockup className="h-5" data-testid="brand" />);
    expect(html).toContain("h-5");
    expect(html).toContain('data-testid="brand"');
  });
});
