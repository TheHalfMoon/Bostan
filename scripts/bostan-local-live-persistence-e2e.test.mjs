import test from "node:test";
import assert from "node:assert/strict";
import { requireBostanSourceSmokeAdmission } from "./bostan-local-live-persistence-e2e.mjs";

test("real database smoke refuses non-opted-in execution before any process starts", () => {
  assert.throws(() => requireBostanSourceSmokeAdmission({}, "darwin"), /requires/);
  assert.throws(() => requireBostanSourceSmokeAdmission({BOSTAN_LIVE_LOCAL_QA_CONFIRM:"true"}, "linux"), /requires/);
});
test("does not bypass unsupported Windows temporary runtime security policy", () => {
  assert.throws(() => requireBostanSourceSmokeAdmission({BOSTAN_LIVE_LOCAL_QA_CONFIRM:"1"}, "win32"), /not qualified for Windows/);
});
test("only macOS and Linux admit an explicitly requested isolated smoke", () => {
  for (const platform of ["darwin", "linux"]) {
    assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({BOSTAN_LIVE_LOCAL_QA_CONFIRM:"1"},platform));
  }
});
