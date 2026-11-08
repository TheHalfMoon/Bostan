import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./ensure-workspace-package-links.ts', import.meta.url));
function make(t, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bostan-b208-linker-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['packages', 'server', 'ui', 'cli', 'scripts']) {
    fs.mkdirSync(path.join(root, dir));
  }
  fs.writeFileSync(path.join(root, 'scripts', 'dev-service-profile.ts'),
    'export const repoRoot = '+JSON.stringify(root)+';\n');
  fs.copyFileSync(source, path.join(root,'scripts','ensure-workspace-package-links.ts'));
  const packageRoot = path.join(root, 'packages','shared');
  const consumerRoot = path.join(root, 'packages','consumer');
  fs.mkdirSync(packageRoot);
  fs.mkdirSync(consumerRoot);
  function manifest(dir, name, dependencies={}) {
    fs.writeFileSync(path.join(dir,'package.json'), JSON.stringify({name, dependencies}));
  }
  manifest(packageRoot,'@bostan/shared');
  manifest(consumerRoot,'@bostan/consumer',opts.deps ?? {'@bostan/shared':'workspace:*'});
  if (!opts.missingNodeModules) {
    fs.mkdirSync(path.join(consumerRoot, 'node_modules'));
    if (!opts.missingScope) fs.mkdirSync(path.join(consumerRoot,'node_modules','@bostan'));
  }
  const link = path.join(consumerRoot,'node_modules','@bostan','shared');
  function run() {
    return spawnSync(process.execPath, ['--experimental-strip-types',path.join(root,'scripts','ensure-workspace-package-links.ts')],
      {encoding:'utf8',env:{...process.env, NODE_NO_WARNINGS:'1'}, timeout:10000});
  }
  return {root,packageRoot,consumerRoot,link,manifest,run};
}
function expectRefuse(run,reason) {
  const result=run();
  assert.notEqual(result.status,0,'Expected refusal: '+result.stdout+' '+result.stderr);
  assert.match(result.stderr, new RegExp('BOSTAN_WORKSPACE_LINKS_REFUSED='+reason));
}

test('creates the missing workspace link without deleting anything; rerun idempotent', t=>{
  const f=make(t);
  const first=f.run();
  assert.equal(first.status,0,first.stderr);
  assert.equal(fs.realpathSync(f.link),f.packageRoot);
  assert(fs.lstatSync(f.link).isSymbolicLink());
  const again=f.run();
  assert.equal(again.status,0,again.stderr);
  assert.match(again.stdout,/BOSTAN_WORKSPACE_LINKS_OK=0/);
});
test('creates missing scoped parent but no foreign files',t=>{
  const f=make(t,{missingScope:true});
  assert.equal(f.run().status,0);
  assert.equal(fs.realpathSync(f.link),f.packageRoot);
});
test('existing regular directory is retained with its contents',t=>{
  const f=make(t);
  fs.mkdirSync(f.link);
  const keep=path.join(f.link,'KEEP.txt');
  fs.writeFileSync(keep,'foreign-file');
  expectRefuse(f.run,'existing_nonlink_entry');
  assert.equal(fs.readFileSync(keep,'utf8'),'foreign-file');
});
test('wrong link is retained and target left untouched',t=>{
  const f=make(t);
  const foreign=path.join(f.root,'foreign');
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign,'KEEP'),'external');
  try { fs.symlinkSync(foreign,f.link,process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('native symlink privilege unavailable'); return; } throw error; }
  expectRefuse(f.run,'foreign_link');
  assert.equal(fs.realpathSync(f.link),foreign);
  assert.equal(fs.readFileSync(path.join(foreign,'KEEP'),'utf8'),'external');
});
test('dangling link is not replaced',t=>{
  const f=make(t);
  try { fs.symlinkSync(path.join(f.root,'no-such-target'),f.link,process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('native symlink privilege unavailable'); return; } throw error; }
  expectRefuse(f.run,'dangling_link');
  assert(fs.lstatSync(f.link).isSymbolicLink());
});
test('linked scope refuses, never writes through it',t=>{
  const f=make(t,{missingScope:true});
  const external=path.join(f.root,'other-scope');
  fs.mkdirSync(external);
  try { fs.symlinkSync(external,path.dirname(f.link),process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('native symlink privilege unavailable'); return; } throw error; }
  expectRefuse(f.run,'linked_or_untrusted_scope');
  assert.equal(fs.readdirSync(external).length,0);
});
test('linked node_modules refuses, never writes through it',t=>{
  const f=make(t,{missingNodeModules:true});
  const external=path.join(f.root,'other-modules');
  fs.mkdirSync(external);
  try { fs.symlinkSync(external,path.join(f.consumerRoot,'node_modules'),process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('native symlink privilege unavailable'); return; } throw error; }
  expectRefuse(f.run,'missing_or_linked_node_modules');
  assert.equal(fs.readdirSync(external).length,0);
});
test('missing node_modules refuses with no install claim',t=>{
  const f=make(t,{missingNodeModules:true});
  expectRefuse(f.run,'missing_or_linked_node_modules');
});
test('invalid requested package path ../ exits before touching files',t=>{
  const f=make(t,{deps:{'../../escape':'workspace:*'}});
  expectRefuse(f.run,'invalid_package_name');
  assert(!fs.existsSync(path.join(f.root,'escape')));
});
test('invalid backslash names are refused before any mutation',t=>{
  const f=make(t,{deps:{'@bostan\\..\\escape':'workspace:*'}});
  expectRefuse(f.run,'invalid_package_name');
});
test('invalid discovered package name is refused',t=>{
  const f=make(t);
  f.manifest(f.packageRoot,'../unsafe');
  expectRefuse(f.run,'invalid_package_name');
  assert(!fs.existsSync(f.link));
});
test('two discovered copies of one package name refuse before linking',t=>{
  const f=make(t);
  const duplicate=path.join(f.root,'packages','duplicate');
  fs.mkdirSync(duplicate);
  f.manifest(duplicate,'@bostan/shared');
  expectRefuse(f.run,'duplicate_workspace_name');
  assert(!fs.existsSync(f.link));
});
test('requested workspace dependency not in discovered set refuses',t=>{
  const f=make(t,{deps:{'@bostan/missing':'workspace:*'}});
  expectRefuse(f.run,'unresolved_workspace_package');
});
test('mixed duplicate target existing directory causes zero partial links',t=>{
  const f=make(t,{deps:{'@bostan/shared':'workspace:*','@bostan/second':'workspace:*'}});
  const second=path.join(f.root,'packages','second');
  fs.mkdirSync(second);
  f.manifest(second,'@bostan/second');
  fs.mkdirSync(path.join(f.consumerRoot,'node_modules','@bostan','second'));
  expectRefuse(f.run,'existing_nonlink_entry');
  assert(!fs.existsSync(f.link));
  assert(fs.lstatSync(path.join(f.consumerRoot,'node_modules','@bostan','second')).isDirectory());
});
test('non-workspace declarations do not cause changes',t=>{
  const f=make(t,{deps:{zod:'^4.0.0'}});
  const r=f.run();
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/BOSTAN_WORKSPACE_LINKS_OK=0/);
});
