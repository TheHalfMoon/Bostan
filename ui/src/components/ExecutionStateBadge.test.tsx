// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXECUTION_STATES, EXECUTION_STATE_META } from "../lib/execution-state";
import { ExecutionStateBadge } from "./ExecutionStateBadge";

describe("ExecutionStateBadge", () => {
  it("renders a text label and a distinct glyph for each of the nine states", () => {
    const glyphs = new Set<string>();
    for (const state of EXECUTION_STATES) {
      const html = renderToStaticMarkup(<ExecutionStateBadge state={state} />);
      expect(html).toContain(`data-execution-state="${state}"`);
      expect(html).toContain(EXECUTION_STATE_META[state].label);
      const svg = html.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? "";
      glyphs.add(svg.replace(/class="[^"]*"/g, ""));
    }
    expect(glyphs.size).toBe(9);
  });

  it("keeps Completed and Verified visibly different", () => {
    const completed = renderToStaticMarkup(<ExecutionStateBadge state="completed" />);
    const verified = renderToStaticMarkup(<ExecutionStateBadge state="verified" />);
    expect(completed).toContain("bg-muted");
    expect(verified).toContain("bg-ok-bg");
  });

  it("shows the description in the card variant", () => {
    const html = renderToStaticMarkup(<ExecutionStateBadge state="outcome_unknown" variant="card" />);
    expect(html).toContain("Outcome unknown");
    expect(html).toContain("Reconcile receipt");
    expect(html).toContain("border-dashed");
  });
});
