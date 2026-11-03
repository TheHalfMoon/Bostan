/**
 * Remove inherited libpq connection controls before contacting a disposable
 * localhost-only PostgreSQL QA cluster. In particular, PGHOSTADDR can override
 * an explicit -h 127.0.0.1 argument in libpq clients.
 */
export function buildIsolatedLocalPostgresEnv(ambient, { port, identity, database, configPath } = {}) {
  if (!ambient || typeof ambient !== 'object' || Array.isArray(ambient) ||
      !Number.isInteger(port) || port < 1 || port > 65535 ||
      typeof identity !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(identity) ||
      typeof database !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(database) ||
      typeof configPath !== 'string' || !configPath || configPath.includes('\0')) {
    throw new Error('invalid_local_postgres_env');
  }
  const env = Object.create(null);
  for (const [key, value] of Object.entries(ambient)) {
    if (/^PG/i.test(key) || /^DATABASE_URL$/i.test(key) || /^PAPERCLIP_CONFIG$/i.test(key)) continue;
    if (typeof value === 'string') env[key] = value;
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
