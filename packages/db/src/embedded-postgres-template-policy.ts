/**
 * Fail closed on Windows template reuse until native teardown proves that all
 * owned PostgreSQL io_worker children have exited (Bostan issue #234).
 * This gate does not remove or modify any pre-existing template directories.
 */
export function isEmbeddedPostgresTemplateCacheDisabled(
  platform: string,
  configuredValue: string | undefined,
): boolean {
  return platform === "win32" || configuredValue === "0";
}
