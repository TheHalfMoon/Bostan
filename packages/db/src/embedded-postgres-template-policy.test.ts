import { describe, expect, it } from "vitest";
import { isEmbeddedPostgresTemplateCacheDisabled as disabled } from "./embedded-postgres-template-policy.js";

describe("embedded PostgreSQL template cache gate", () => {
  it("is on by default on every platform and honors the explicit opt-out", () => {
    for (const platform of ["win32", "linux", "darwin"]) {
      for (const setting of [undefined, "1", "", "false"]) {
        expect(disabled(platform, setting)).toBe(false);
      }
      expect(disabled(platform, "0")).toBe(true);
    }
  });
});
