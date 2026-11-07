import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createOwnedLocalPostgresProfileEnv as make} from './bostan-local-postgres-owned-profile.mjs';
const testEnv = {PATH:process.env.PATH||'/usr/bin',HOME:'/foreign/profile',USERPROFILE:'/foreign/winprofile',APPDATA:'/foreign/appdata',LOCALAPPDATA:'/foreign/local',PNPM_HOME:'/foreign/pnpm',COREPACK_HOME:'/foreign/corepack',TMPDIR:'/foreign/tmp',NPM_CONFIG_USERCONFIG:'/foreign/.npmrc',OPENAI_API_KEY:'synthetic-secret',PGHOSTADDR:'127.0.0.1',DATABASE_URL:'postgres://local'};
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bostan-b232-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return {root,create:(env=testEnv,more={})=>make(env,{scratch:root,ownedScratch:()=>true,...more})};
}
test('creates a fresh nonlinked profile under test scratch and retains localhost PG variables',t=>{
 const f=fixture(t),p=f.create();
 assert.equal(p.home,path.join(f.root,'qa-home'));assert.equal(p.env.PGHOSTADDR,'127.0.0.1');
 assert.equal(p.env.DATABASE_URL,'postgres://local');assert.equal(p.owned(),true);
 for(const key of ['HOME','USERPROFILE','APPDATA','LOCALAPPDATA','COREPACK_HOME','PNPM_HOME','TMP','TEMP','TMPDIR'])assert(p.env[key].startsWith(p.home),key);
});
test('actual child sees only the profile-local home and no foreign profile paths',t=>{
 const f=fixture(t),p=f.create();const child=spawnSync(process.execPath,['-e',`process.stdout.write(JSON.stringify({HOME:process.env.HOME,USERPROFILE:process.env.USERPROFILE,PNPM_HOME:process.env.PNPM_HOME,NPM_CONFIG_USERCONFIG:process.env.NPM_CONFIG_USERCONFIG}))`],{env:p.env,encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);const out=JSON.parse(child.stdout);
 for(const v of Object.values(out)){assert(v.startsWith(p.home),v);assert(!v.includes('/foreign/'));}
});
test('private profile prevents user npmrc content from being read through HOME',t=>{
 const f=fixture(t),p=f.create();const userNpmrc=path.join(f.root,'foreign-token');fs.writeFileSync(userNpmrc,'synthetic-NPM-token');
 assert(!fs.existsSync(p.env.NPM_CONFIG_USERCONFIG));assert(!p.env.NPM_CONFIG_USERCONFIG.includes('foreign-token'));
 assert.equal(fs.readFileSync(userNpmrc,'utf8'),'synthetic-NPM-token');
});
test('rejects a pre-planted home instead of reusing it',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.root,'qa-home'));fs.writeFileSync(path.join(f.root,'qa-home','KEEP.txt'),'operator');
 assert.throws(()=>f.create(),/retaining fixture/);assert.equal(fs.readFileSync(path.join(f.root,'qa-home','KEEP.txt'),'utf8'),'operator');
});
test('refuses swapped private home before later subprocess or deletion',t=>{
 const f=fixture(t),p=f.create();fs.renameSync(p.home,p.home+'-original');fs.mkdirSync(p.home);fs.writeFileSync(path.join(p.home,'KEEP.txt'),'foreign');
 assert.equal(p.owned(),false);assert.equal(fs.readFileSync(path.join(p.home,'KEEP.txt'),'utf8'),'foreign');
});
test('refuses symlinked private home even when its target is within scratch',t=>{
 const f=fixture(t),p=f.create();fs.renameSync(p.home,p.home+'-original');fs.symlinkSync(p.home+'-original',p.home,process.platform==='win32'?'junction':'dir');assert.equal(p.owned(),false);
});
test('nested profile directory replacement invalidates ownership',t=>{
 const f=fixture(t),p=f.create();const cache=path.join(p.home,'cache');fs.renameSync(cache,cache+'-original');fs.mkdirSync(cache);assert.equal(p.owned(),false);
});
test('refuses mutation of original scratch ownership claim',t=>{
 const f=fixture(t);let allowed=true;const p=f.create(testEnv,{ownedScratch:()=>allowed});allowed=false;assert.equal(p.owned(),false);
});
test('does not modify caller-provided environment object or keep foreign profile aliases',t=>{
 const f=fixture(t),src={...testEnv,Home:'/foreign/home-variant',Npm_Config_Cache:'/foreign/npm-cache'};const before={...src};const p=f.create(src);assert.deepEqual(src,before);for(const k of ['Home','Npm_Config_Cache'])assert(!Object.hasOwn(p.env,k));
});
test('refuses noncanonical and unverified root without a secret-bearing error',t=>{
 const f=fixture(t);for(const opts of [{scratch:'relative',ownedScratch:()=>true},{scratch:f.root,ownedScratch:()=>false}])assert.throws(()=>make(testEnv,opts),e=>e.message==='Bostan local PostgreSQL private profile unverified; retaining fixture');
});
