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

test("real free-model runtime requires separate opt-in and an allowlisted model before filesystem use", () => {
  const base = { BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1" };
  assert.throws(() => requireBostanSourceSmokeAdmission(base, "darwin"), /explicit BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL/);
  assert.throws(() => requireBostanSourceSmokeAdmission({
    ...base, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1", BOSTAN_E2E_FREE_MODEL: "anthropic/paid",
  }, "darwin"), /Only explicitly permitted free test models/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    ...base, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
    BOSTAN_E2E_FREE_MODEL: "opencode/deepseek-v4.1-flash-free",
  }, "darwin"));
  assert.throws(() => requireBostanSourceSmokeAdmission({
    ...base, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
  }, "win32"), /not qualified for Windows/);
});


test("two-agent live QA requires both the free agent and online provider opt-ins", () => {
  assert.throws(() => requireBostanSourceSmokeAdmission({
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
  }, "darwin"), /explicit real free-agent/);
  assert.throws(() => requireBostanSourceSmokeAdmission({
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1",
  }, "darwin"), /explicit BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL/);
  assert.doesNotThrow(() => requireBostanSourceSmokeAdmission({
    BOSTAN_LIVE_LOCAL_QA_CONFIRM: "1", BOSTAN_E2E_TWO_AGENT_TEAM: "1",
    BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E: "1",
    BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
    BOSTAN_E2E_FREE_MODEL: "opencode/deepseek-v4.1-flash-free",
  }, "darwin"));
});
