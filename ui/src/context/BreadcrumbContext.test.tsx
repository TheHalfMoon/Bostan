import { describe, expect, it } from "vitest";
import { buildDocumentTitle } from "./BreadcrumbContext";

describe("Bostan browser title identity", () => {
  it("defaults to Bostan on a fresh onboarding page", () => {
    expect(buildDocumentTitle([])).toBe("Bostan");
  });
  it("keeps a Bostan suffix across workspace navigation", () => {
    expect(buildDocumentTitle([
      { label: "Projects" }, { label: "Issue" },
    ], "  Acme Labs  ")).toBe("Issue • Projects • Acme Labs • Bostan");
  });
  it("never includes the inherited project name as the application suffix", () => {
    const result = buildDocumentTitle([{label:"Settings"}]);
    expect(result).toBe("Settings • Bostan");
    expect(result).not.toMatch(/Paperclip/);
  });
});
