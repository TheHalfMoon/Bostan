import test from 'node:test';
import assert from 'node:assert/strict';
import {win32} from 'node:path';
import {assertPrivateWindowsQaOsExecutablePaths as admit} from './bostan-private-windows-os-executable-admission.mjs';

const ordinaryDir = {isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false};
const ordinaryFile = {isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>false};
const linkedDir = {isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>true};
const linkedFile = {isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>true};
const base = {'C:\\':ordinaryDir,'C:\\Windows':ordinaryDir,'C:\\Windows\\System32':ordinaryDir,'C:\\Windows\\System32\\cmd.exe':ordinaryFile};
function run({inherited={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},entries=base,platform='win32'}={}) {
  return admit({inherited,platform,statPath:path=>{
    if (!Object.hasOwn(entries,path)) throw Error('unavailable');
    return entries[path];
  }});
}
const rejected = options => assert.throws(()=>run(options),/^Error: Private Windows QA OS executable identity unverified$/);

test('admit direct ordinary drive, Windows, System32 and cmd.exe',()=>{
  const result=run();
  assert.equal(result.cmd,win32.join('C:\\Windows','System32','cmd.exe'));
  assert.equal(Object.isFrozen(result),true);
});
test('accept matching case-insensitive WINDIR without inheriting PATH',()=>{
  const result=run({inherited:{systemroot:'C:\\Windows',windir:'c:\\WINDOWS',PATH:'Z:\\Operator\\bin'}});
  assert.equal(result.system32,'C:\\Windows\\System32');
});
test('reject missing SystemRoot even with WINDIR',()=>rejected({inherited:{WINDIR:'C:\\Windows'}}));
test('reject mismatched WINDIR drive',()=>rejected({inherited:{SystemRoot:'C:\\Windows',WINDIR:'D:\\Windows'}}));
test('reject noncanonical nested Windows path',()=>rejected({inherited:{SystemRoot:'C:\\Operator\\Windows'}}));
test('reject linked drive root',()=>rejected({entries:{...base,'C:\\':linkedDir}}));
test('reject linked Windows directory',()=>rejected({entries:{...base,'C:\\Windows':linkedDir}}));
test('reject linked System32 directory',()=>rejected({entries:{...base,'C:\\Windows\\System32':linkedDir}}));
test('reject linked cmd.exe',()=>rejected({entries:{...base,'C:\\Windows\\System32\\cmd.exe':linkedFile}}));
test('reject missing cmd.exe',()=>rejected({entries:{'C:\\':ordinaryDir,'C:\\Windows':ordinaryDir,'C:\\Windows\\System32':ordinaryDir}}));
test('reject file at System32 directory',()=>rejected({entries:{...base,'C:\\Windows\\System32':ordinaryFile}}));
test('reject non-Windows execution',()=>rejected({platform:'linux'}));
