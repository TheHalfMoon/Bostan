import { describe, expect, it } from "vitest";
import { isEmbeddedPostgresTemplateCacheDisabled as disabled } from "./embedded-postgres-template-policy.js";

describe("embedded PostgreSQL template cache platform gate", () => {
  it("refuses all Windows template cache settings, including explicit opt-in", () => {
    for (const setting of [undefined, "0", "1", "", "false"]) {
      expect(disabled("win32", setting)).toBe(true);
    }
  });
  it("preserves Linux and macOS defaults and explicit opt-out", () => {
    for (const platform of ["linux", "darwin"]) {
      for (const setting of [undefined, "1", "", "false"]) {
        expect(disabled(platform, setting)).toBe(false);
      }
      expect(disabled(platform, "0")).toBe(true);
    }
  });
});
