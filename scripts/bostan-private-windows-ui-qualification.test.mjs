import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('./bostan-private-windows-ui-qualification.mjs',import.meta.url));
const source=readFileSync(script,'utf8');
const run=(...args)=>spawnSync(process.execPath,[script,...args],{
  encoding:'utf8',timeout:5000,
});

test('Windows UI gate is inert by default and exposes a scoped plan',()=>{
  for(const args of [[],['--plan']]){
    const response=run(...args);
    assert.equal(response.status,0,response.stderr);
    const plan=JSON.parse(response.stdout);
    assert.equal(plan.run,false);
    assert.equal(plan.releaseQualified,false);
    assert.equal(plan.invokesProviders,false);
    assert.equal(plan.publishes,false);
    assert.match(plan.optionalBrowser,/offline Playwright Chromium/);
  }
});
test('unknown and publish flags rejected, non-Windows execution refused',()=>{
  for(const args of [['--publish'],['--install'],['--run','--publish'],['--run-browser','--publish']]){
    assert.equal(run(...args).status,2);
  }
  if(process.platform!=='win32'){
    const response=run('--run');
    assert.equal(response.status,2);
    assert.match(response.stderr,/refuses non-Windows/);
    const browserResponse=run('--run-browser');
    assert.equal(browserResponse.status,2);
    assert.match(browserResponse.stderr,/refuses non-Windows/);
  }
});
test('real qualification is fixed to official UI typecheck, build, output ownership and no models',()=>{
  for(const token of [
    "pkg.private!==true", "ui.private!==true",
    "bostan-release-disabled.mjs", "requires >=3 GiB",
    "PAPERCLIP_CLOUD_", "BOSTAN_CLOUD_",
    "pnpm --filter @bostan/plugin-sdk build",
    "BOSTAN_WINDOWS_PRIVATE_PLUGIN_SDK_BUILT",
    "json-schema-to-ts/package.json",
    "ajv/dist/2020.js",
    "pnpm --filter @bostan/ui typecheck",
    "pnpm --filter @bostan/ui build",
    "BOSTAN_WINDOWS_PRIVATE_UI_TYPECHECK_PASS",
    "BOSTAN_WINDOWS_PRIVATE_UI_BUILD_PASS",
    "BOSTAN_WINDOWS_PRIVATE_UI_ASSETS_VERIFIED",
    "realpathSync(dist)", "npm_config_offline:'true'",
    "externalModelCalls:0",
    "Node >=24.11.0",
    "chromium.launch({headless:true,timeout:15000,env:inherited})",
    "BOSTAN_WINDOWS_OFFLINE_CHROMIUM_DEPENDENCY_ADMITTED",
    "'--run-browser'",
    "pnpm --filter @bostan/ui exec node scripts/bostan-preview-browser-smoke.mjs",
    "BOSTAN_WINDOWS_OFFLINE_CHROMIUM_FIRST_PAINT_PASS",
  ])assert.ok(source.includes(token),token);
  assert.doesNotMatch(source,/pnpm\s+(?:publish|deploy)/);
});

test('offline Chromium verification blocks service-worker bypass and external origins',()=>{
  const browserSource=readFileSync(fileURLToPath(new URL('../ui/scripts/bostan-preview-browser-smoke.mjs',import.meta.url)),'utf8');
  assert.match(browserSource,/browser\.newContext\(\{serviceWorkers:'block'\}\)/);
  assert.match(browserSource,/context\.route\('\*\*\/\*'/);
  assert.match(browserSource,/url\.origin!==origin/);
  assert.match(browserSource,/route\.abort\('blockedbyclient'\)/);
  assert.match(browserSource,/assert\.equal\(nonlocalRequests,0/);
  assert.ok(browserSource.includes('waitForFunction(()=>/Bostan/i.test(document.body.innerText)'));

});
