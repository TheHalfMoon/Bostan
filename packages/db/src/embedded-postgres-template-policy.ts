/**
 * The template cache is on by default and can be turned off with
 * PAPERCLIP_TEST_POSTGRES_TEMPLATE=0. Windows was excluded until native
 * teardown proved that every owned PostgreSQL child exits (Bostan #234). Each
 * Windows stop now runs pg_ctl and then waits for the stopped postmaster and
 * all of its children to disappear before any directory is reused, renamed or
 * deleted; live runs showed 0 surviving owned processes.
 */
export function isEmbeddedPostgresTemplateCacheDisabled(
  _platform: string,
  configuredValue: string | undefined,
): boolean {
  return configuredValue === "0";
}
