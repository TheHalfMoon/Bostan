// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BostanLockup } from "./BostanLockup";

describe("BostanLockup", () => {
  it("renders an accessible Bostan mark instead of the previous wordmark", () => {
    const html = renderToStaticMarkup(<BostanLockup />);
    expect(html).toContain('aria-label="Bostan"');
    expect(html).toContain(">B</span>");
    expect(html).toContain(">Bostan</span>");
    expect(html).not.toContain("Paperclip");
  });

  it("preserves caller sizing and accessibility attributes", () => {
    const html = renderToStaticMarkup(<BostanLockup className="h-5" data-testid="brand" />);
    expect(html).toContain("h-5");
    expect(html).toContain('data-testid="brand"');
  });
});
