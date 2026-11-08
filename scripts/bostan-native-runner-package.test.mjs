import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const bins=['eval-session','codex-proxy','opencode-proxy','acpx-sidecar','copilot-metadata-probe'];

test('native Bostan runner package is private, internally owned and cannot publish',()=>{
 const m=json('packages/paperclip-runner/package.json');
 assert.equal(m.name,'@bostan/runner');
 assert.equal(m.private,true);
 assert.equal(m.publishConfig,undefined);
 assert.equal(m.repository.url,'https://github.com/TheHalfMoon/Bostan');
 assert.equal(m.scripts.prepack,'node ../../scripts/bostan-release-disabled.mjs');
 assert.equal(m.scripts.prepublishOnly,m.scripts.prepack);
 assert.deepEqual(Object.keys(m.bin).sort(),bins.map(x=>`bostan-runner-${x}`).sort());
 assert.ok(!Object.keys(m.bin).some(n=>n.startsWith('paperclip-')));
 assert.ok(!json('scripts/release-package-manifest.json').some(e=>e.name==='@bostan/runner'));
 for(const target of Object.values(m.bin)){
  assert.ok(target.startsWith('./dist/cli/'),`no unsafe path ${target}`);
  assert.ok(existsSync(resolve(root,'packages/paperclip-runner',target)),`TypeScript provider build must produce ${target}`);
 }
});

test('standalone server and core consumers resolve Bostan runner workspace, not inherited npm identity',()=>{
 const m=json('server/package.json');
 assert.equal(m.devDependencies['@bostan/runner'],'workspace:*');
 assert.ok(!Object.hasOwn(m.devDependencies,'@paperclipai/paperclip-runner'));
 const lock=read('pnpm-lock.yaml');
 assert.match(lock,/\n      '@bostan\/runner':\n        specifier: workspace:\*/);
 assert.equal(json('packages/paperclip-runner/package.json').devDependencies['@bostan/eval-kernel'],'workspace:*');
});

test('runner transport schema and the versioned native executable binary contract are preserved',()=>{
 const m=json('packages/paperclip-runner/package.json');
 assert.equal(m.exports['./testing'].import,'./dist/testing.js');
 assert.equal(m.exports['./evals'].import,'./dist/evals/index.js');
 const scripts=m.scripts;
 assert.match(scripts['build:binary'],/--bin paperclip-runnerd/,'do not silently rename versioned Rust native binary');
 assert.match(scripts['typecheck:rust'],/cargo check/);
 assert.match(read('packages/paperclip-runner/scripts/check-package-boundaries.mjs'),/bostan-eval-kernel/);
});

test('Bostan release guard refuses npm packaging before writing artifacts',()=>{
 const res=spawnSync(process.execPath,[resolve(root,'scripts/bostan-release-disabled.mjs')],{encoding:'utf8'});
 assert.equal(res.status,2);
});
