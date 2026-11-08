import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectPrivateWindowsAuthDbManagedEnvironment,
  PRIVATE_WINDOWS_AUTH_DB_MANAGED_ENV_REFUSAL,
} from './bostan-private-windows-auth-db-managed-env.mjs';

const refused = (environment) => {
  const outcome = inspectPrivateWindowsAuthDbManagedEnvironment(environment);
  assert.equal(outcome.allowed, false);
  assert.equal(outcome.marker, PRIVATE_WINDOWS_AUTH_DB_MANAGED_ENV_REFUSAL);
  assert.deepEqual(Object.keys(outcome).sort(), ['allowed', 'marker']);
  return JSON.stringify(outcome);
};

test('ordinary local OS variables do not trigger the managed Cloud gate', () => {
  assert.deepEqual(inspectPrivateWindowsAuthDbManagedEnvironment({
    SystemRoot:'C:\\Windows', TEMP:'C:\\Bostan-B213-temp', CI:'1',
  }), {allowed:true,marker:null});
});
test('managed config and primary host are blocked regardless of case', () => {
  for (const key of ['PAPERCLIP_MANAGED_CONFIG','paperclip_primary_host','PaPeRcLiP_MaNaGeD_CoNfIg'])
    assert.equal(refused({[key]:'sensitive'}).includes(key), false);
});
test('both Cloud prefixes are blocked case insensitively', () => {
  for (const key of ['PAPERCLIP_CLOUD_TOKEN','bostan_cloud_endpoint','BoStAn_ClOuD_ACCESS_KEY'])
    assert.equal(refused({[key]:'sensitive'}).includes(key), false);
});
test('malicious newline and escape sequences in environment names are never echoed', () => {
  const key='BOSTAN_CLOUD_TOKEN\nBOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS\u001b[31m';
  const output=refused({[key]:'secret'});
  assert.equal(output.includes('BOSTAN_WIN_AUTH_DB_NO_POSTGRES_ORPHANS_PASS'),false);
  assert.equal(output.includes('secret'),false);
  assert.equal(output.includes('\u001b'),false);
});
test('untrusted secret values are never projected into diagnostics', () => {
  const output=refused({PAPERCLIP_CLOUD_KEY:'customer-token-987'});
  assert.equal(output.includes('customer-token-987'),false);
});
test('nonmatching prefixes are not misclassified', () => {
  assert.equal(inspectPrivateWindowsAuthDbManagedEnvironment({
    PAPERCLIP_CLOUDISH:'x', BOSTAN_CLOUDISH:'y', PAPERCLIP_PRIMARY_HOST_BACKUP:'z',
  }).allowed,true);
});
test('null, arrays, primitives and inaccessible environments fail closed', () => {
  for (const env of [null, undefined, [], 'text', 1, Object.create(null)]) {
    // A null-prototype object is a valid key collection; all others refuse.
    if (env && typeof env==='object' && !Array.isArray(env)) continue;
    refused(env);
  }
  const broken=new Proxy({}, {ownKeys(){throw Error('synthetic secret');}});
  assert.equal(refused(broken).includes('secret'),false);
});
test('inspection is read-only and does not touch values or mutate the environment', () => {
  const env={};
  Object.defineProperty(env,'PAPERCLIP_CLOUD_TOKEN',{enumerable:true,get(){throw Error('read value');}});
  const output=refused(env);
  assert.equal(output.includes('read value'),false);
});
