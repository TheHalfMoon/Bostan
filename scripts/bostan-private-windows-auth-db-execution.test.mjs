import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {buildPrivateWindowsAuthDbExecution} from './bostan-private-windows-auth-db-execution.mjs';
const osPaths = {systemRoot:'C:\\Windows',system32:'C:\\Windows\\System32',cmd:'C:\\Windows\\System32\\cmd.exe'};
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
function fixture(fn) {
  const outer=mkdtempSync(join(tmpdir(),'bostan-b209-unit-'));
  const root=join(outer,'Bostan-B209-qa'),temp=join(outer,'Bostan-B209-temp');
  mkdirSync(root);mkdirSync(temp);
  const make=(p,content='x')=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,content);};
  for(const [scope,pkg,entry] of [
    ['packages/shared','typescript','bin/tsc'],
    ['packages/plugins/sdk','typescript','bin/tsc'],
    ['server','vitest','vitest.mjs'],['packages/db','vitest','vitest.mjs'],
  ]){
    const base=join(root,scope,'node_modules',pkg);
    make(join(base,'package.json'),JSON.stringify({name:pkg}));make(join(base,entry));
  }
  make(join(root,'scripts','bostan-native-windows-postgres-no-orphans.ps1'));
  make(join(root,'packages/shared/scripts/copy-cliplab-notices.mjs'));
  const nodeBinary=join(outer,'node.exe');make(nodeBinary);
  const inherited={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',
    PATH:'C:\\untrusted',ComSpec:'C:\\untrusted\\cmd.exe',NODE_OPTIONS:'--require foreign',
    AWS_SECRET_ACCESS_KEY:'SENSITIVE_TEST_SENTINEL',DATABASE_URL:'postgres://foreign',
    USERPROFILE:'C:\\Users\\foreign',APPDATA:'C:\\foreign',TEMP:'C:\\foreign'};
  const input={root,temp,inherited,osPaths,powershell,nodeBinary,platform:'win32'};
  try{return fn({input,root,temp,outer,make});}finally{rmSync(outer,{recursive:true,force:true});}
}
test('commands are absolute pinned Node/PowerShell, no cmd, pnpm or PATH resolution',()=>fixture(({input})=>{
  const plan=buildPrivateWindowsAuthDbExecution(input);
  assert.equal(plan.commands.length,7);
  assert.equal(plan.commands[0].binary,powershell);
  assert.equal(plan.commands[6].binary,powershell);
  for(const c of plan.commands.slice(1,6)){
    assert.equal(c.binary,input.nodeBinary);
    assert.ok(c.args[0].startsWith(input.root));
    assert.ok(!c.args.includes('pnpm.cmd'));
  }
  assert.ok(plan.commands[2].args[0].endsWith('copy-cliplab-notices.mjs'));
}));
test('child environment excludes secrets, operator executable search paths and profile',()=>fixture(({input})=>{
  const {env}=buildPrivateWindowsAuthDbExecution(input);
  for(const value of ['SENSITIVE_TEST_SENTINEL','C:\\untrusted','C:\\Users\\foreign','postgres://foreign'])
    assert.ok(!JSON.stringify(env).includes(value));
  assert.equal(env.PATH,osPaths.system32);
  assert.equal(env.ComSpec,osPaths.cmd);
  assert.equal(env.HOME,input.temp);
  assert.equal(env.SystemDrive,'C:');
  assert.equal(env.NODE_OPTIONS,undefined);
}));
test('rejects inconsistent Windows OS roots before execution',()=>fixture(({input})=>{
  assert.throws(()=>buildPrivateWindowsAuthDbExecution({...input,inherited:{...input.inherited,WINDIR:'D:\\Windows'}}));
  assert.throws(()=>buildPrivateWindowsAuthDbExecution({...input,powershell:'C:\\foreign\\powershell.exe'}));
}));
test('rejects an out-of-checkout linked package executable',()=>fixture(({input,root,outer})=>{
  const target=join(root,'server','node_modules','vitest');
  rmSync(target,{recursive:true});
  const external=join(outer,'external');mkdirSync(external);
  writeFileSync(join(external,'package.json'),JSON.stringify({name:'vitest'}));
  writeFileSync(join(external,'vitest.mjs'),'x');
  symlinkSync(external,target,'dir');
  assert.throws(()=>buildPrivateWindowsAuthDbExecution(input));
}));
test('rejects forged installed package identity',()=>fixture(({input,root})=>{
  writeFileSync(join(root,'packages/db/node_modules/vitest/package.json'),JSON.stringify({name:'other'}));
  assert.throws(()=>buildPrivateWindowsAuthDbExecution(input));
}));
test('rejects linked workspace scope before package execution',()=>fixture(({input,root,outer})=>{
  const scope=join(root,'server');
  const target=join(outer,'moved-server');
  renameSync(scope,target);symlinkSync(target,scope,'dir');
  assert.throws(()=>buildPrivateWindowsAuthDbExecution(input));
}));
test('rejects linked Node binary even when the target exists',()=>fixture(({input,outer})=>{
  const actual=join(outer,'actual-node.exe');writeFileSync(actual,'x');
  rmSync(input.nodeBinary);symlinkSync(actual,input.nodeBinary,'file');
  assert.throws(()=>buildPrivateWindowsAuthDbExecution(input));
}));
test('rejects absent package CLI before any subprocess',()=>fixture(({input,root})=>{
  rmSync(join(root,'server/node_modules/vitest/vitest.mjs'));
  assert.throws(()=>buildPrivateWindowsAuthDbExecution(input));
}));
test('rejects nested temporary directory under checkout',()=>fixture(({input,root})=>{
  const nested=join(root,'nested-temp');mkdirSync(nested);
  assert.throws(()=>buildPrivateWindowsAuthDbExecution({...input,temp:nested}));
}));
test('rejects a linked Node ancestor even when node.exe leaf is an ordinary file',()=>fixture(({input,outer})=>{
  const realDir=join(outer,'actual-node-dir');mkdirSync(realDir);
  writeFileSync(join(realDir,'node.exe'),'x');
  const linkedDir=join(outer,'linked-node-dir');symlinkSync(realDir,linkedDir,'dir');
  assert.throws(()=>buildPrivateWindowsAuthDbExecution({...input,nodeBinary:join(linkedDir,'node.exe')}));
}));
test('rejects noncanonical dot segments in the Node executable path',()=>fixture(({input,outer})=>{
  const raw=outer+'/../'+outer.split('/').at(-1)+'/node.exe';
  assert.throws(()=>buildPrivateWindowsAuthDbExecution({...input,nodeBinary:raw}));
}));
