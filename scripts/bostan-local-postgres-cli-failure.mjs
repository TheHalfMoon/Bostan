/** Safe, bounded classification of isolated local PostgreSQL child failures.
 * Child stdout/stderr/errors, executable paths and arguments are untrusted;
 * never copy their bytes into a parent error or qualification receipt.
 */
const COMMANDS = new Set(['initdb','pg_ctl','createdb','psql','pg_dump','pg_restore','pnpm']);
const ERROR_CODES = new Set(['ENOENT','EACCES','EPERM','ETIMEDOUT','E2BIG','ENOBUFS','EAGAIN']);
const SIGNALS = new Set(['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV']);
export function formatLocalPostgresCliFailure({command,status,signal,error} = {}) {
  const kind = typeof command === 'string' && COMMANDS.has(command) ? command : 'other';
  const exit = Number.isInteger(status) && status >= 0 && status <= 255 ? String(status) : 'unknown';
  let code = 'unknown';
  try { if (typeof error?.code === 'string' && ERROR_CODES.has(error.code)) code = error.code; }
  catch { /* error objects can have untrusted getters */ }
  const safeSignal = typeof signal === 'string' && SIGNALS.has(signal) ? signal : 'none';
  return `Bostan local PostgreSQL QA child failed (tool=${kind},exit=${exit},code=${code},signal=${safeSignal})`;
}
