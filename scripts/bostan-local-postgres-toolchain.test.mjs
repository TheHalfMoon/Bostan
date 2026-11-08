import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {captureLocalPostgresToolchain as pin, LOCAL_PG_TOOLS} from './bostan-local-postgres-toolchain.mjs';
const synthetic = () => '#!/bin/sh\necho SYNTHETIC_POSTGRES_QA\n';
function make(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b233-owned-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir=path.join(root,'bin');fs.mkdirSync(dir, {mode:0o700});
  for(const name of LOCAL_PG_TOOLS){const p=path.join(dir,name);fs.writeFileSync(p,synthetic(),{mode:0o700});}
  return {root,dir};
}
test('pins six synthetic PostgreSQL executables and really runs one by absolute path',t=>{
  const f=make(t),g=pin(f.dir);for(const name of LOCAL_PG_TOOLS)assert.equal(g.pathFor(name),path.join(f.dir,name));
  const child=spawnSync(g.pathFor('psql'),['--version'],{encoding:'utf8',env:{PATH:'/nonexistent'}});
  assert.equal(child.status,0);assert.equal(child.stdout.trim(),'SYNTHETIC_POSTGRES_QA');
});
test('PATH shadow binary never replaces the explicitly pinned executable',t=>{
  const f=make(t),other=path.join(f.root,'shadow');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'psql'),'#!/bin/sh\necho WRONG\n',{mode:0o700});
  const g=pin(f.dir),child=spawnSync(g.pathFor('psql'),[],{encoding:'utf8',env:{PATH:other}});
  assert.equal(child.stdout.trim(),'SYNTHETIC_POSTGRES_QA');
});
test('same-path ordinary executable replacement after capture is refused',t=>{
  const f=make(t),g=pin(f.dir),filename=path.join(f.dir,'pg_ctl');fs.renameSync(filename,filename+'-original');fs.writeFileSync(filename,synthetic(),{mode:0o700});
  assert.throws(()=>g.pathFor('pg_ctl'),/unverified; retaining fixture/);
  assert.equal(g.pathFor('psql'),path.join(f.dir,'psql'));
});
test('symlink replacement after capture is refused',t=>{
  const f=make(t),g=pin(f.dir),filename=path.join(f.dir,'initdb');fs.renameSync(filename,filename+'-original');fs.symlinkSync(filename+'-original',filename);
  assert.throws(()=>g.pathFor('initdb'),/unverified; retaining fixture/);
});
test('changed original executable bits and group writable mode fail closed',t=>{
  const f=make(t),g=pin(f.dir),filename=path.join(f.dir,'pg_dump');fs.chmodSync(filename,0o600);assert.throws(()=>g.pathFor('pg_dump'),/unverified/);
  fs.chmodSync(filename,0o777);assert.throws(()=>g.pathFor('pg_dump'),/unverified/);
});
test('foreign symlinked bin directory cannot be pinned',t=>{
  const f=make(t),alias=path.join(f.root,'linked');fs.symlinkSync(f.dir,alias,'dir');assert.throws(()=>pin(alias),/unverified/);
});
test('unrelated or missing binary denies entire toolchain before executing any command',t=>{
  const f=make(t);fs.unlinkSync(path.join(f.dir,'pg_restore'));assert.throws(()=>pin(f.dir),/unverified/);
});
test('insecure shared bin directory is rejected',t=>{
  const f=make(t);fs.chmodSync(f.dir,0o777);assert.throws(()=>pin(f.dir),/unverified/);
});
test('symlinked or hardlinked binary in original directory is refused',t=>{
  const f=make(t),file=path.join(f.dir,'psql');fs.renameSync(file,file+'-original');fs.symlinkSync(file+'-original',file);assert.throws(()=>pin(f.dir),/unverified/);
  fs.unlinkSync(file);fs.linkSync(file+'-original',file);assert.throws(()=>pin(f.dir),/unverified/);
});
test('no arbitrary executable name can be read from the authority',t=>{
  const f=make(t),g=pin(f.dir);for(const name of ['pnpm','../pg_ctl','/bin/sh','pg_ctl.exe'])assert.throws(()=>g.pathFor(name),/unverified/);
});
test('missing/relative/root/nonexistent path denied with path-free diagnostic',t=>{
  const f=make(t);for(const p of [null,'bin','./bin','/',path.join(f.root,'absent')])assert.throws(()=>pin(p),e=>e.message==='Bostan local PostgreSQL toolchain unverified; retaining fixture');
});
test('replacing entire bin directory refuses previously captured tools',t=>{
  const f=make(t),g=pin(f.dir);fs.renameSync(f.dir,f.dir+'-original');fs.mkdirSync(f.dir,{mode:0o700});fs.writeFileSync(path.join(f.dir,'psql'),synthetic(),{mode:0o700});
  assert.throws(()=>g.pathFor('psql'),/unverified/);
});
