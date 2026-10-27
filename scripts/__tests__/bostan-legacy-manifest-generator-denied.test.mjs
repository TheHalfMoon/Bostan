import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const script=join(root,'scripts/generate-npm-package-json.mjs');
const cliManifest=join(root,'cli/package.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('retired generator denies any direct run before package manifest writes',()=>{
  const source=readFileSync(script,'utf8');
  const guard=source.indexOf('Bostan: inherited npm manifest generator disabled');
  const exit=source.indexOf('process.exit(2)',guard);
  assert.ok(guard>0 && guard<500 && exit>guard && exit<600,'block must precede inherited generator implementation');
  const before=sha(readFileSync(cliManifest));
  const temp=mkdtempSync(join(tmpdir(),'bostan-private-generator-'));
  try {
    for(const argv of [[],['--help'],['--output',join(temp,'should-not-exist.json')]]) {
      const result=spawnSync(process.execPath,[script,...argv],{
        cwd:temp,env:{...process.env,HOME:temp},encoding:'utf8',timeout:5000,
      });
      assert.equal(result.status,2,result.stderr);
      assert.match(result.stderr,/Bostan: inherited npm manifest generator disabled/);
      assert.equal(result.stdout,'');
      assert.deepEqual(readdirSync(temp),[],'no generated publishable manifest or unrelated output');
      assert.equal(sha(readFileSync(cliManifest)),before,'original private CLI package must remain byte-identical');
    }
    const product=JSON.parse(readFileSync(cliManifest,'utf8'));
    assert.equal(product.private,true);
    assert.equal(product.name,'bostan');
    assert.match(product.scripts.prepack,/bostan-release-disabled/);
  } finally {rmSync(temp,{recursive:true,force:true})}
});
