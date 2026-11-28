import assert from "node:assert/strict";
import test from "node:test";
import {
  captureFirstAgentFailure,
  packagedFirstAgentCleanupReceipt,
  packagedFirstAgentFailureReceipt,
} from "./bostan-packaged-first-agent-failure.mjs";

test("failure receipts retain a bounded stage and safe enum-like error code", () => {
  assert.equal(
    packagedFirstAgentFailureReceipt("company_create", new Error("synthetic_company_create_failed_http_500")),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=company_create code=synthetic_company_create_failed_http_500",
  );
});

test("heartbeat diagnostics are summarized without forwarding their payload", () => {
  const error = new Error('Bostan synthetic heartbeat ended without success: {"providerOutput":"private text"}');
  assert.equal(
    packagedFirstAgentFailureReceipt("first_task_execution", error),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=first_task_execution code=heartbeat_not_succeeded",
  );
});

test("untrusted error text and stages are not copied into receipts", () => {
  assert.equal(
    packagedFirstAgentFailureReceipt("company\nsecret", new Error("token sk-private-value")),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=unclassified code=unclassified",
  );
  assert.equal(
    packagedFirstAgentFailureReceipt("company_create", new Error("token_sk_private_value")),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=company_create code=unclassified",
  );
});

test("the earliest failing stage survives later shutdown and cleanup failures", () => {
  const first = captureFirstAgentFailure(null, "agent_readiness", new Error("native_agent_setup_harness_test_failed"));
  const afterShutdown = captureFirstAgentFailure(first, "shutdown", new Error("desktop_graceful_shutdown_unverified"));
  const afterCleanup = captureFirstAgentFailure(afterShutdown, "cleanup", new Error("temporary_profile_cleanup_failed"));

  assert.equal(afterCleanup, first);
  assert.equal(
    packagedFirstAgentFailureReceipt(afterCleanup.stage, afterCleanup.error),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=agent_readiness code=native_agent_setup_harness_test_failed",
  );
});

test("shutdown and temporary-profile cleanup errors have bounded categories", () => {
  assert.equal(
    packagedFirstAgentFailureReceipt("shutdown", new Error("desktop_did_not_confirm_graceful_shutdown")),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=shutdown code=desktop_did_not_confirm_graceful_shutdown",
  );
  assert.equal(
    packagedFirstAgentFailureReceipt("cleanup", new Error("qa_process_still_owns_temp_profile")),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=cleanup code=qa_process_still_owns_temp_profile",
  );
});

test("cleanup failures retain a separate safe receipt after an earlier journey failure", () => {
  const first = captureFirstAgentFailure(null, "agent_readiness", new Error("native_agent_readiness_timeout"));
  const afterCleanup = captureFirstAgentFailure(first, "cleanup", new Error("qa_process_still_owns_temp_profile"));

  assert.equal(
    packagedFirstAgentFailureReceipt(afterCleanup.stage, afterCleanup.error),
    "BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=agent_readiness code=native_agent_readiness_timeout",
  );
  assert.equal(
    packagedFirstAgentCleanupReceipt(new Error("qa_process_still_owns_temp_profile")),
    "BOSTAN_PACKAGED_FIRST_AGENT_CLEANUP_FAILURE code=qa_process_still_owns_temp_profile",
  );
  assert.equal(
    packagedFirstAgentCleanupReceipt(new Error("C:\\Users\\private token sk-secret")),
    "BOSTAN_PACKAGED_FIRST_AGENT_CLEANUP_FAILURE code=unclassified",
  );
});
