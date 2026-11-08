/**
 * Strict, read-only Windows native PostgreSQL process-tree receipt.
 * A zero exit is not sufficient: the PowerShell scanner must prove three
 * separate zero-process scans, with bounded gaps, before claiming success.
 */
export const PG_ORPHAN_CHECK_OUTPUT_LIMIT = 8192;
export const WINDOWS_PG_ORPHAN_REQUIRED_SNAPSHOTS = 3;
export const WINDOWS_PG_ORPHAN_CHECK_LINES = Object.freeze([
  `BOSTAN_WINDOWS_PG_SNAPSHOTS=${WINDOWS_PG_ORPHAN_REQUIRED_SNAPSHOTS}`,
  'BOSTAN_WINDOWS_PG_OWNED_PROCESSES=0',
  'BOSTAN_WINDOWS_PG_UNINSPECTABLE=0',
  'BOSTAN_WINDOWS_POSTGRES_NO_ORPHANS_PASS',
]);

export function evaluateWindowsPgOrphanCheck({
  status = null, signal = null, errorCode = null, stdout = '', stderr = '',
} = {}) {
  const validText = typeof stdout === 'string' &&
    typeof stderr === 'string' &&
    stdout.length <= PG_ORPHAN_CHECK_OUTPUT_LIMIT &&
    stderr.length <= PG_ORPHAN_CHECK_OUTPUT_LIMIT;
  const childClean = status === 0 && (signal === null || signal === undefined) &&
    (errorCode === null || errorCode === undefined);
  const lines = validText ? stdout.replace(/\r\n/g, '\n').split('\n') : [];
  const exactProof = validText && stderr.length === 0 &&
    lines.length === WINDOWS_PG_ORPHAN_CHECK_LINES.length + 1 &&
    lines.at(-1) === '' &&
    WINDOWS_PG_ORPHAN_CHECK_LINES.every((line, i) => lines[i] === line);
  const verified = childClean && exactProof;
  return Object.freeze({
    schema: 'bostan.private-windows-pg-orphan-check.v1',
    noOrphanPostgresProcessVerified: verified,
    outcome: !validText ? 'invalid_output' : !childClean ? 'child_exit_or_timeout' :
      !exactProof ? 'missing_or_invalid_process_proof' : 'pass',
  });
}
