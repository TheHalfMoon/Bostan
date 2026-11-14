// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BostanLoading } from "./BostanLoading";

describe("BostanLoading", () => {
  it("renders an accessible full-page loading state", () => {
    const html = renderToStaticMarkup(<BostanLoading />);

    expect(html).toContain('role="status"');
    expect(html).toContain("min-h-dvh");
    expect(html).toContain('aria-hidden="true"');
    // Splash usage: the brand tree (slate nodes) above the Newsreader wordmark.
    expect(html).toContain("<svg");
    expect(html).toContain('fill="var(--bostan-slate)"');
    expect(html).toContain("font-serif");
    expect(html).toContain(">Bostan</span>");
    expect(html).not.toContain("paperclip-thinking-icon");
    expect(html).toContain('<span class="sr-only">Loading…</span>');
  });

  it("allows containing layouts to override the full-page height", () => {
    const html = renderToStaticMarkup(<BostanLoading className="min-h-0" />);

    expect(html).toContain("min-h-0");
    expect(html).not.toContain("min-h-dvh");
  });
});
