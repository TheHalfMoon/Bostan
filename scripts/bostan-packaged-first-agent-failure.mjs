const stages = new Set([
  "model_admission",
  "desktop_startup",
  "signup",
  "first_admin",
  "company_create",
  "agent_create",
  "agent_readiness",
  "first_task_create",
  "first_task_assignment",
  "first_task_execution",
  "first_task_persistence",
  "restart_recovery",
  "second_task_create",
  "second_task_assignment",
  "second_task_execution",
  "second_task_persistence",
  "cancellation_create",
  "cancellation_settlement",
  "recovery_task_create",
  "recovery_task_assignment",
  "recovery_task_execution",
  "recovery_task_persistence",
  "shutdown",
  "cleanup",
]);
const safeHttpFailureCode = /^(?:synthetic_signup|synthetic_first_admin_claim|synthetic_company_create|native_agent_create|synthetic_task_create|synthetic_second_task_create|synthetic_cancellation_task_create|synthetic_post_cancellation_recovery_task_create)_failed_http_[1-5][0-9]{2}$/;

export function packagedFirstAgentFailureReceipt(stage, error) {
  const safeStage = stages.has(stage) ? stage : "unclassified";
  const message = typeof error?.message === "string" ? error.message : "unknown";
  const firstLine = message.split(/[\r\n]/, 1)[0];
  const normalized = firstLine.startsWith("qa_failed_") ? firstLine.slice("qa_failed_".length) : firstLine;
  let code = "unclassified";

  if (normalized.startsWith("Bostan synthetic heartbeat ended without success:")) {
    code = "heartbeat_not_succeeded";
  } else if (safeHttpFailureCode.test(normalized)) {
    code = normalized;
  }

  return `BOSTAN_PACKAGED_FIRST_AGENT_FAIL stage=${safeStage} code=${code}`;
}
