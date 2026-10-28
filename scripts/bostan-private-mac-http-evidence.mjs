/**
 * Private Bostan B0-94: deterministic, dependency-free proof evaluation.
 * Parsing this record never opens network sockets or reads user files.
 */
export const MAC_HTTP_REQUIRED_STAGES = Object.freeze([
  "BOSTAN_MAC_HTTP_POSTGRES_MIGRATED",
  "BOSTAN_MAC_HTTP_PRIVATE_HEALTH_PASS",
  "BOSTAN_MAC_HTTP_ANONYMOUS_CLAIM_DENIED",
  "BOSTAN_MAC_HTTP_SYNTHETIC_SIGNUP_PASS",
  "BOSTAN_MAC_HTTP_SIGNED_IN_SESSION_PASS",
  "BOSTAN_MAC_HTTP_CROSS_ORIGIN_CLAIM_DENIED",
  "BOSTAN_MAC_HTTP_SPOOFED_REFERER_CLAIM_DENIED",
  "BOSTAN_MAC_HTTP_MISSING_ORIGIN_CLAIM_DENIED",
  "BOSTAN_MAC_HTTP_DENIED_CLAIMS_PRESERVE_PENDING",
  "BOSTAN_MAC_HTTP_FIRST_ADMIN_CLAIM_PASS",
  "BOSTAN_MAC_HTTP_REPEAT_CLAIM_DENIED",
  "BOSTAN_MAC_HTTP_POST_CLAIM_HEALTH_PASS",
  "BOSTAN_MAC_HTTP_SERVER_SHUTDOWN_PASS",
  "BOSTAN_MAC_HTTP_POSTGRES_CLEANUP_PASS",
]);
export const MAC_HTTP_LOG_LIMIT = 2 * 1024 * 1024;

export function evaluateMacHttpEvidence({
  status = null, signal = null, errorCode = null,
  logBytes = null, logText = "",
} = {}) {
  const withinBudget = Number.isSafeInteger(logBytes) &&
    logBytes >= 0 && logBytes <= MAC_HTTP_LOG_LIMIT;
  const lines = typeof logText === "string" && withinBudget
    ? logText.split(/\r?\n/) : [];
  const positions = MAC_HTTP_REQUIRED_STAGES.map(stage =>
    lines.reduce((acc, line, i) => {
      if (line === stage) acc.push(i);
      return acc;
    }, []));
  const markersUnique = positions.every(x => x.length === 1);
  const markersInOrder = markersUnique &&
    positions.every((x, i) => i === 0 || x[0] > positions[i - 1][0]);
  const failedEvent = lines.some(line =>
    /^BOSTAN_MAC_HTTP_FAILED_TYPE=/.test(line));
  const childExitClean = status === 0 &&
    (signal === null || signal === undefined) && !errorCode;
  const qualified = withinBudget && childExitClean &&
    markersInOrder && !failedEvent;
  const stages = Object.fromEntries(MAC_HTTP_REQUIRED_STAGES.map((name, i) => [
    name, positions[i].length === 1,
  ]));
  const reason = qualified ? "pass"
    : !withinBudget ? "invalid_log"
    : !childExitClean ? "child_exit_or_timeout"
    : failedEvent ? "child_reported_failure"
    : !markersUnique ? "missing_or_duplicate_stage"
    : "out_of_order_stage";
  return {
    schema: "bostan.private-mac-http-evidence.v1",
    macAuthenticatedHttpQualified: qualified,
    outcome: reason,
    childExitClean,
    stagesUnique: markersUnique,
    stagesInOrder: markersInOrder,
    errorMarkerPresent: failedEvent,
    stages,
  };
}
