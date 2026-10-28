/**
 * Bostan B1-03: deterministic, dependency-free Windows private HTTP proof.
 * Accept only exact ordered event names and bounded boolean lifecycle gates.
 * Does not inspect user files, process output, environment variables or tokens.
 */
export const WINDOWS_HTTP_REQUIRED_STAGES = Object.freeze([
  "BOSTAN_WINDOWS_LIVE_POSTGRES_MIGRATED",
  "BOSTAN_WINDOWS_LIVE_HTTP_AUTH_HEALTH_PASS",
  "BOSTAN_WINDOWS_LIVE_ANONYMOUS_CLAIM_DENIED",
  "BOSTAN_WINDOWS_LIVE_AUTH_SIGNUP_PASS",
  "BOSTAN_WINDOWS_LIVE_SIGNED_IN_SESSION_PASS",
  "BOSTAN_WINDOWS_LIVE_CROSS_ORIGIN_CLAIM_DENIED",
  "BOSTAN_WINDOWS_LIVE_SPOOFED_REFERER_CLAIM_DENIED",
  "BOSTAN_WINDOWS_LIVE_MISSING_ORIGIN_CLAIM_DENIED",
  "BOSTAN_WINDOWS_LIVE_DENIALS_PRESERVE_PENDING",
  "BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS",
  "BOSTAN_WINDOWS_LIVE_REPEAT_CLAIM_DENIED",
  "BOSTAN_WINDOWS_LIVE_POST_CLAIM_HEALTH_PASS",
  "BOSTAN_WINDOWS_LIVE_SERVER_CLOSED",
  "BOSTAN_WINDOWS_LIVE_POSTGRES_CLEANED",
  "BOSTAN_WINDOWS_LIVE_OWNED_FIXTURE_CLEANED",
]);

export function evaluateWindowsPrivateHttpEvidence({
  events = [], httpComplete = false, childClosed = false,
  spawnError = false, forceUsed = false, postgresCleaned = false,
  ownedFixtureCleaned = false, priorFailure = false,
} = {}) {
  const validEvents = Array.isArray(events) && events.length <= 64 &&
    Array.from({length:events.length},(_,i)=>i).every(i =>
      Object.hasOwn(events,i) && typeof events[i] === "string" &&
      events[i].length <= 128);
  const exactEvents = validEvents &&
    events.length === WINDOWS_HTTP_REQUIRED_STAGES.length &&
    events.every((event, i) => event === WINDOWS_HTTP_REQUIRED_STAGES[i]);
  const stages = Object.fromEntries(WINDOWS_HTTP_REQUIRED_STAGES.map(stage =>
    [stage, validEvents && events.filter(event => event === stage).length === 1]));
  const lifecycle = httpComplete === true && childClosed === true &&
    spawnError === false && forceUsed === false &&
    postgresCleaned === true && ownedFixtureCleaned === true &&
    priorFailure === false;
  const qualified = exactEvents && lifecycle;
  return {
    schema:"bostan.private-windows-http-evidence.v1",
    windowsAuthenticatedHttpQualified:qualified,
    outcome:!validEvents?"invalid_events":!exactEvents?"missing_duplicate_or_out_of_order_stage":
      !lifecycle?"lifecycle_not_clean":"pass",
    stages,
    childClosed:childClosed===true,
    postgresCleaned:postgresCleaned===true,
    ownedFixtureCleaned:ownedFixtureCleaned===true,
    noOrphanPostgresProcessVerified:false,
    releaseQualified:false,
  };
}
