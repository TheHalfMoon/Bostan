/** Fail-closed native Windows Bostan onboarding health qualification. */
export function isBostanWindowsHealthReady(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && value.status === "ok"
    && value.deploymentMode === "authenticated"
    && value.deploymentExposure === "private"
    && value.bootstrapStatus === "bootstrap_pending";
}
