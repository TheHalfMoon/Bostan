/**
 * Safe, bounded startup evidence for the private Windows compiled runtime.
 * This preloader runs only after the existing synthetic-QA admission guard.
 * It never prints an environment value, module path, URL, user or credential.
 */
export const COMPILED_IMPORT_START = "BOSTAN_WIN_SERVER_STAGE=static_import_start";
export const COMPILED_IMPORT_PENDING = "BOSTAN_WIN_SERVER_STAGE=static_import_pending";

export function startCompiledStartupProbe({
  platform = process.platform,
  environment = process.env,
  emit = message => console.error(message),
  schedule = setInterval,
} = {}) {
  if (platform !== "win32" || environment?.BOSTAN_PRIVATE_QA_ENTRY !== "B087_TEST_ONLY") {
    return false;
  }
  emit(COMPILED_IMPORT_START);
  const interval = schedule(() => emit(COMPILED_IMPORT_PENDING), 30000);
  interval.unref();
  return true;
}

startCompiledStartupProbe();
