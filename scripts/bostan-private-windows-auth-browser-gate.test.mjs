import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const entry=fileURLToPath(new URL('./bostan-private-windows-live-http.mjs',import.meta.url));
const source=readFileSync(entry,'utf8');
test('Windows browser mode requires explicit opt-in and scoped assets before real Postgres starts',()=>{
  for(const value of [
    '"--run-compiled-browser"','BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_REFUSED',
    'BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_PASS',
    'lstatSync(browserRoot).isSymbolicLink()',
    'lstatSync(dist).isSymbolicLink()',
    'PLAYWRIGHT_BROWSERS_PATH','serveUi:browserMode',
    'BOSTAN_WINDOWS_CHROMIUM_SIGNUP_PASS',
    'BOSTAN_WINDOWS_CHROMIUM_FIRST_ADMIN_PASS',
    'browserClaim.claimedUserIdMatchesSession===1',
    'authenticatedBrowserQualified:browserQualified',
  ])assert.ok(source.includes(value),value);
  assert.ok(source.indexOf('BOSTAN_WINDOWS_CHROMIUM_ASSET_PREFLIGHT_PASS')<
    source.indexOf('startEmbeddedPostgresTestDatabase'), 'Preflight must precede actual PG');
});
test('no implicit user-facing mode or publishing, native platform gate remains',()=>{
  assert.doesNotMatch(source,/pnpm\\s+publish|npm\\s+publish/);
  if(process.platform!=='win32'){
    const outcome=spawnSync(process.execPath,[entry,'--run-compiled-browser'],{
      timeout:5000,encoding:'utf8'});
    assert.equal(outcome.status,2);
    assert.match(outcome.stderr,/requires an isolated/);
  }
});
