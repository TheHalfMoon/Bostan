import assert from "node:assert/strict";
import test from "node:test";
import { isBostanWindowsHealthReady } from "./bostan-windows-server-health.mjs";

test("only an authenticated private bootstrap-pending server can start onboarding", () => {
  const expected = { status: "ok", deploymentMode: "authenticated", deploymentExposure: "private", bootstrapStatus: "bootstrap_pending" };
  assert.equal(isBostanWindowsHealthReady(expected), true);
  for (const changed of [
    { status: "starting" },
    { status: "error" },
    { deploymentMode: "local" },
    { deploymentMode: "managed" },
    { deploymentExposure: "public" },
    { bootstrapStatus: "ready" },
    { bootstrapStatus: "unknown" },
  ]) {
    assert.equal(isBostanWindowsHealthReady({ ...expected, ...changed }), false, JSON.stringify(changed));
  }
});

test("rejects missing or malformed health payloads", () => {
  for (const candidate of [null, undefined, false, 0, "", [], {}, { status: "ok" }]) {
    assert.equal(isBostanWindowsHealthReady(candidate), false);
  }
});
