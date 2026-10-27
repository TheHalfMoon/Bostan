import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const file=fileURLToPath(new URL('../ui/scripts/bostan-preview-browser-smoke.mjs',import.meta.url));
const source=readFileSync(file,'utf8');
test('Playwright first-paint script pins local loopback with no release assertions',()=>{
  assert.match(source,/srv\.listen\(0,'127\.0\.0\.1'/);
  assert.match(source,/url\.origin!==origin/);
  assert.match(source,/nonlocalRequests,0/);
  assert.match(source,/title,'Bostan'/);
  assert.match(source,/releaseQualified:false/);
  assert.doesNotMatch(source,/\b(?:cargo|publish|deploy|migrate|seed)\b\s*\(/);
});
test('browser smoke has a safe --help mode without starting preview or a browser',()=>{
  // Help can be read in a working UI workspace even when no built dist exists.
  const r=spawnSync(process.execPath,[file,'--help'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/prior @bostan\/ui build/);
});
