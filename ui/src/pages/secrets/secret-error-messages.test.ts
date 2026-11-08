import { describe, expect, it } from "vitest";
import { safeSecretUiError, safeVaultImportRowReason } from "./secret-error-messages";

describe("secret UI provider error privacy", () => {
  const hostile = "https://example.invalid/authorize?code=private&state=sk-test-secret";
  it("never displays arbitrary provider exception fields", () => {
    for (const error of [new Error(hostile), { message: hostile }, hostile, null]) {
      expect(safeSecretUiError(error)).not.toContain("private");
      expect(safeSecretUiError(error)).toContain("Retry");
    }
  });
  it("never reflects result-row provider reasons, including tooltips", () => {
    for (const status of ["error", "skipped", "imported"]) {
      const rendered = safeVaultImportRowReason(status, hostile);
      expect(rendered ?? "").not.toContain("private");
      expect(rendered ?? "").not.toContain("sk-test-secret");
    }
    expect(safeVaultImportRowReason("error", null)).toBeNull();
    expect(safeVaultImportRowReason("error", hostile)).toContain("Import failed");
    expect(safeVaultImportRowReason("skipped", hostile)).toContain("Not imported");
  });
});
