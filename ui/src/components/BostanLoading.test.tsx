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
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('data-variant="full"');
    expect(html).not.toContain("paperclip-thinking-icon");
    expect(html).toContain('<span class="sr-only">Loading…</span>');
  });

  it("allows containing layouts to override the full-page height", () => {
    const html = renderToStaticMarkup(<BostanLoading className="min-h-0" />);

    expect(html).toContain("min-h-0");
    expect(html).not.toContain("min-h-dvh");
  });
});
