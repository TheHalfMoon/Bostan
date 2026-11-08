/**
 * Minimal inherited environment for disposable localhost-only PostgreSQL QA.
 * Scrubbing PG* alone is insufficient: a child can read unrelated API tokens,
 * credentials and loader hooks inherited from the operator's shell.
 */
const SAFE_RUNTIME_KEYS = new Set([
  'PATH', 'PATHEXT', 'HOME', 'USER', 'USERNAME', 'LOGNAME', 'SHELL',
  'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM',
  'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'USERPROFILE',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)',
  'HOMEDRIVE', 'HOMEPATH', 'PNPM_HOME', 'COREPACK_HOME',
]);

export function buildIsolatedLocalPostgresEnv(ambient, { port, identity, database, configPath } = {}) {
  if (!ambient || typeof ambient !== 'object' || Array.isArray(ambient) ||
      !Number.isInteger(port) || port < 1 || port > 65535 ||
      typeof identity !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(identity) ||
      typeof database !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(database) ||
      typeof configPath !== 'string' || !configPath || configPath.includes('\0')) {
    throw new Error('invalid_local_postgres_env');
  }
  const env = Object.create(null);
  const seen = new Set();
  for (const [key, value] of Object.entries(ambient)) {
    const folded = key.toUpperCase();
    if (!SAFE_RUNTIME_KEYS.has(folded)) continue;
    // Windows environment variables are case-insensitive. Refuse ambiguous
    // PATH/Path or other duplicated aliases instead of depending on ordering.
    if (seen.has(folded)) throw new Error('invalid_local_postgres_env');
    seen.add(folded);
    if (typeof value !== 'string' || value.includes('\0')) continue;
    env[key] = value;
  }
  return {
    ...env,
    DATABASE_URL: 'postgres://' + identity + '@127.0.0.1:' + port + '/' + database,
    PAPERCLIP_CONFIG: configPath,
    PGHOST: '127.0.0.1',
    PGHOSTADDR: '127.0.0.1',
    PGPORT: String(port),
    PGUSER: identity,
    PGDATABASE: database,
  };
}
