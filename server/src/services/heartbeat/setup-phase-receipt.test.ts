import { describe, expect, it } from "vitest";
import { buildPreDispatchLeaseReleaseReceipt } from "./setup-phase-receipt.js";

describe("safe legacy pre-dispatch lease release receipt", () => {
  it("reports checkpoint and safe error class without a secret or stack", () => {
    const error = new TypeError("user-secret-token /Users/private/file");
    const result = buildPreDispatchLeaseReleaseReceipt("runtime_prepared", error);
    expect(result).toEqual({
      checkpoint: "runtime_prepared",
      errorClass: "TypeError",
      reason: "legacy_pre_dispatch_lease_release",
      providerWorkStarted: false,
    });
    expect(JSON.stringify(result)).not.toContain("user-secret-token");
    expect(JSON.stringify(result)).not.toContain("/Users/private");
  });

  it("refuses custom error names that can contain user content", () => {
    const error = new Error("private");
    error.name = "secret_private_credentials";
    expect(buildPreDispatchLeaseReleaseReceipt("claimed", error).errorClass)
      .toBe("unclassified");
  });

  it("represents an unreported early return without claiming a provider error", () => {
    expect(buildPreDispatchLeaseReleaseReceipt("session_prepared", null))
      .toMatchObject({
        checkpoint: "session_prepared",
        errorClass: "unclassified",
        providerWorkStarted: false,
      });
  });
});
