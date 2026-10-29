import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 assessNativeLinuxRuntimePreflight,findAdmittedLinuxCommand,
 isAdmittedNativeLinuxExecutable,NATIVE_LINUX_REQUIRED_COMMANDS,
} from './bostan-private-linux-native-runtime-preflight.mjs';
const file=fileURLToPath(new URL('./bostan-private-linux-native-runtime-preflight.mjs',import.meta.url));
const valid=()=>({
 nativeCommands:Object.fromEntries(NATIVE_LINUX_REQUIRED_COMMANDS.map(x=>[x,true])),
});
test('inert default CLI refuses arbitrary modes without mutation',()=>{
  for(const args of [[],['--plan']]){
    const result=spawnSync(process.execPath,[file,...args],{encoding:'utf8',timeout:4000});
    assert.equal(result.status,0);
    const report=JSON.parse(result.stdout.trim());
    assert.equal(report.run,false);
  }
  for(const args of [['--run'],['--publish'],['--check','--force']]){
    const result=spawnSync(process.execPath,[file,...args],{encoding:'utf8',timeout:4000});
    assert.equal(result.status,2);
  }
});
test('native executable path rejects Windows mounts, executable shims and foreign roots',()=>{
  for(const path of ['/mnt/c/Users/A/pnpm','/mnt/d/Bostan/node',
    '/mnt/c/Program Files/nodejs/node.exe','/usr/bin/node.exe',
    '/media/user/usb/pg_ctl','/tmp/fake/psql','./pnpm',
    '/run/desktop/mnt/host/c/bin/pnpm'])
    assert.equal(isAdmittedNativeLinuxExecutable(path),false);
  for(const path of ['/usr/bin/node','/usr/local/bin/pnpm','/opt/postgresql/bin/pg_ctl',
      '/home/qa/.local/bin/pnpm'])
    assert.equal(isAdmittedNativeLinuxExecutable(path),true);
  assert.equal(findAdmittedLinuxCommand('pnpm','/mnt/c/Users/qa/bin:/nonexistent'),false);
  assert.equal(findAdmittedLinuxCommand('unknown','/usr/bin'),false);
});
test('all valid Linux native prerequisites admit read-only without claiming release',()=>{
  const result=assessNativeLinuxRuntimePreflight(valid());
  assert.equal(result.admitted,true);
  assert.deepEqual(result.missingRequirements,[]);
  assert.equal(result.releaseQualified,false);
  assert.equal(result.mutated,false);
});
test('each missing executable fails closed, including native Linux pnpm and PostgreSQL',()=>{
  for(const cmd of NATIVE_LINUX_REQUIRED_COMMANDS){
    const fixture=valid();fixture.nativeCommands[cmd]=false;
    const result=assessNativeLinuxRuntimePreflight(fixture);
    assert.equal(result.admitted,false);
    assert.deepEqual(result.missingRequirements,['missing_native_'+cmd]);
  }
});
test('Linux, Node 24, glibc, real tmpfs, RAM and disk are strict and independently checked',()=>{
  for(const [field,value,marker] of [
    ['platform','win32','not_linux'],['arch','arm64','not_x64'],
    ['glibc',false,'not_glibc'],['nodeMajor',22,'node_below_24'],
    ['tmpfsType',0,'tmp_not_linux_tmpfs'],
    ['tmpfsFreeKiB',1,'tmpfs_below_3_5_gib'],
    ['availableMemoryKiB',1,'ram_below_5_gib'],
    ['sourceFreeKiB',1,'source_below_4_gib']]){
    const result=assessNativeLinuxRuntimePreflight({...valid(),[field]:value});
    assert.equal(result.admitted,false);
    assert.ok(result.missingRequirements.includes(marker));
  }
  const all=assessNativeLinuxRuntimePreflight({
    platform:'win32',arch:'arm64',nodeMajor:22,glibc:false,
    nativeCommands:{},tmpfsType:0,tmpfsFreeKiB:0,
    availableMemoryKiB:0,sourceFreeKiB:0,
  });
  assert.equal(all.admitted,false);
  assert.ok(all.missingRequirements.length>10);
  assert.ok(!JSON.stringify(all).includes('PRIVATE_PASSWORD'));
});
