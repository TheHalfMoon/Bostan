import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
const adapterDirs=['claude-local','codex-local','cursor-cloud','cursor-local','gemini-local','grok-local','hermes','kimi-local','openclaw-gateway','opencode-local','pi-local'];
const paths=['packages/adapter-utils/package.json','packages/db/package.json','packages/shared/package.json','packages/skills-catalog/package.json',...adapterDirs.map(p=>`packages/adapters/${p}/package.json`)];

test('all first-party compiled-server source-only workspace modules retain their TypeScript defaults',()=>{
  for(const pkgPath of paths){
    const pkg=read(pkgPath);
    assert.ok(pkg.name.startsWith('@bostan/'),pkgPath);
    let count=0;
    for(const [key,target] of Object.entries(pkg.exports)) {
      const obj=typeof target==='string'?null:target;
      if(!obj)continue;
      assert.match(obj.default,/^\.\/src\/.*\.ts$/,`${pkg.name} ${key} must preserve default TS source`);
      assert.match(obj['bostan-compiled'],/^\.\/dist\/.*\.js$/,`${pkg.name} ${key} needs compiled JS`);
      assert.ok(!obj.default.includes('..') && !obj['bostan-compiled'].includes('..'),'no traversal in export mapping');
      count++;
    }
    assert.ok(count>0,`no compiled contract in ${pkg.name}`);
  }
});
test('Bostan source imports remain TS while explicit private compiled mode resolves JS',()=>{
  const packages=['@bostan/db','@bostan/shared','@bostan/shared/node-version','@bostan/shared/telemetry','@bostan/adapter-codex-local/server','@bostan/adapter-hermes/gateway/server','@bostan/adapter-utils','@bostan/skills-catalog'];
  const expression=`for(const name of ${JSON.stringify(packages)})console.log(name+' '+import.meta.resolve(name));`;
  for(const [mode,args,suffix] of [['source',[],'ts'],['compiled',['--conditions=bostan-compiled'],'js']]){
    const result=spawnSync(process.execPath,[...args,'--input-type=module','-e',expression],{cwd:join(root,'server'),encoding:'utf8',timeout:5000});
    assert.equal(result.status,0,`${mode}: ${result.stderr}`);
    const resolved=result.stdout.trim().split('\n');
    assert.equal(resolved.length,packages.length);
    for(const line of resolved) assert.ok(line.endsWith(`.${suffix}`),`${mode} wrong package mapping: ${line}`);
  }
});
test('only the private server start and explicit HTTP compiled QA use the compiled condition',()=>{
  assert.equal(read('server/package.json').scripts.start,'node --conditions=bostan-compiled dist/index.js');
  const smoke=readFileSync(join(root,'scripts/bostan-local-http-postgres-smoke.sh'),'utf8');
  assert.match(smoke,/--run-dist/);
  assert.match(smoke,/node --conditions=bostan-compiled dist\/index\.js/);
  assert.match(smoke,/node --import tsx src\/index\.ts/);
});
test('compiled HTTP QA is private, offline and refuses implicit execution or publication',()=>{
  const script=join(root,'scripts/bostan-private-compiled-server-http-qualification.sh');
  const plan=spawnSync('bash',[script,'--plan'],{cwd:root,encoding:'utf8',timeout:4000});
  assert.equal(plan.status,0,plan.stderr);
  assert.match(plan.stdout,/private compiled-server HTTP QA/);
  for(const args of [[],['--publish'],['--help'],['--run','--deploy']]){
    const result=spawnSync('bash',[script,...args],{cwd:root,encoding:'utf8',timeout:4000});
    assert.equal(result.status,2,`${args}: ${result.stderr}`);
  }
  const source=readFileSync(script,'utf8');
  assert.match(source,/npm_config_offline=true/);
  assert.doesNotMatch(source,/cargo build --release|npm publish|gh release create/);
  assert.match(source,/bostan-local-http-postgres-smoke.sh --run-dist/);
});
