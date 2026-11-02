/**
 * Test-only native Windows PostgreSQL process identity binding.
 * postmaster.pid line 3 is a Unix timestamp in whole seconds. A PID and
 * executable path alone are insufficient when Windows reuses process IDs.
 */
const MAX_STARTUP_LAG_MS = 120_000;
const MAX_TIMESTAMP_ROUNDING_MS = 1_000;
export function parsePostmasterStartEpochSeconds(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,11}$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && Number.isFinite(seconds * 1000) &&
    seconds * 1000 <= 8_640_000_000_000_000 ? seconds : null;
}
export function matchesPostmasterStartToCim(epochSeconds, creationDate) {
  if (!Number.isSafeInteger(epochSeconds) || epochSeconds <= 0 ||
      epochSeconds * 1000 > 8_640_000_000_000_000 ||
      typeof creationDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(creationDate)) return false;
  const createdMs = Date.parse(creationDate);
  if (!Number.isFinite(createdMs) ||
      new Date(createdMs).toISOString().slice(0, 19) !== creationDate.slice(0, 19)) return false;
  const delta = epochSeconds * 1000 - createdMs;
  // PostgreSQL writes its timestamp after process creation. Allow only the
  // subsecond rounding of the marker, and at most two minutes of startup lag.
  return delta >= -MAX_TIMESTAMP_ROUNDING_MS && delta <= MAX_STARTUP_LAG_MS;
}
