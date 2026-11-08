import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsolatedLocalPostgresEnv } from './bostan-local-postgres-isolated-env.mjs';

const input = {port: 34567, identity: 'bostan_verify', database: 'bostan_qualification', configPath: '/tmp/synthetic/absent-config.json'};
const build = (ambient = {}) => buildIsolatedLocalPostgresEnv(ambient, input);

test('pins both libpq host and hostaddr to loopback with exact synthetic DB', () => {
  const env = build({PATH: '/synthetic/bin'});
  assert.equal(env.PGHOST, '127.0.0.1');
  assert.equal(env.PGHOSTADDR, '127.0.0.1');
  assert.equal(env.PGPORT, '34567');
  assert.equal(env.PGUSER, 'bostan_verify');
  assert.equal(env.PGDATABASE, 'bostan_qualification');
  assert.equal(env.DATABASE_URL, 'postgres://bostan_verify@127.0.0.1:34567/bostan_qualification');
  assert.equal(env.PAPERCLIP_CONFIG, input.configPath);
  assert.equal(env.PATH, '/synthetic/bin');
});
test('scrubs inherited libpq hostaddr, service, options, credentials and config paths', () => {
  const env = build({PGHOSTADDR:'192.0.2.20', PGHOST:'external', PGPORT:'5432', PGPASSWORD:'secret',
    PGPASSFILE:'/private/pass', PGSERVICE:'foreign', PGSERVICEFILE:'/private/service',
    PGOPTIONS:'-c search_path=foreign', PGSSLMODE:'require', PGSYSCONFDIR:'/private',
    PGCONNECT_TIMEOUT:'1000', DATABASE_URL:'postgres://foreign', PAPERCLIP_CONFIG:'/private/config'});
  for (const key of ['PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGSSLMODE','PGSYSCONFDIR','PGCONNECT_TIMEOUT'])
    assert.equal(Object.hasOwn(env,key), false, key);
  assert.equal(env.PGHOSTADDR, '127.0.0.1');
  assert.equal(env.PGPORT, '34567');
  assert.equal(env.PAPERCLIP_CONFIG, input.configPath);
});
test('case-folded ambient libpq aliases cannot override pinned keys', () => {
  const env = build({pghostaddr:'192.0.2.30', pgpassword:'secret', database_url:'foreign',
    paperclip_config:'foreign', PgSeRvIcE:'foreign', Path:'/synthetic/bin'});
  for (const key of ['pghostaddr','pgpassword','database_url','paperclip_config','PgSeRvIcE'])
    assert.equal(Object.hasOwn(env,key),false,key);
  assert.equal(env.PGHOSTADDR,'127.0.0.1');
  assert.equal(env.Path,'/synthetic/bin');
});
test('ambient environment remains unchanged', () => {
  const ambient={PGHOSTADDR:'192.0.2.30',PATH:'/synthetic/bin'};
  const snapshot={...ambient}; build(ambient);
  assert.deepEqual(ambient,snapshot);
});
test('non-string ambient values are not propagated', () => {
  const env=build({PATH:'/synthetic/bin',SYNTHETIC_OBJECT:{secret:'x'},SYNTHETIC_NULL:null});
  assert.equal(Object.hasOwn(env,'SYNTHETIC_OBJECT'),false);
  assert.equal(Object.hasOwn(env,'SYNTHETIC_NULL'),false);
});
test('invalid ports, identities and paths fail closed with a fixed diagnostic', () => {
  for (const overrides of [{port:0},{port:65536},{port:5432.1},{identity:'x@remote'},
    {database:'name/other'},{configPath:''},{configPath:'bad\0path'}]) {
    assert.throws(()=>buildIsolatedLocalPostgresEnv({}, {...input,...overrides}),
      error=>error.message==='invalid_local_postgres_env');
  }
});
test('invalid ambient objects fail closed', () => {
  for (const ambient of [null,[],1,'text']) {
    assert.throws(()=>buildIsolatedLocalPostgresEnv(ambient,input),
      error=>error.message==='invalid_local_postgres_env');
  }
});
