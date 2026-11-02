import test from 'node:test';
import assert from 'node:assert/strict';
import {checkBostanWindowsDisk as check} from './bostan-private-windows-disk-admission.mjs';
const gib = 1024n**3n;
const params = (options={}) => ({platform:'win32', workspace:'D:\\Bostan-B208-qa', tempDir:'D:\\Bostan-B208-temp', systemDrive:'C:', systemRoot:'C:\\Windows',statfs: volume => ({bavail:volume.toUpperCase()==='C:\\'?2n:100n,bsize:gib}), ...options});
test('normal matching SystemRoot/SystemDrive checks actual OS and workspace volumes',()=>{
  const calls=[];const v=check(params({statfs:volume=>{calls.push(volume);return {bavail:volume.toUpperCase()==='C:\\'?2n:100n,bsize:gib};}}));
  assert.equal(v.allowed,true);assert.deepEqual(calls,['C:\\','D:\\']);
});
test('mismatched SystemDrive must not silently inspect a different volume',()=>{
  let calls=0;const v=check(params({systemDrive:'D:',statfs:()=>{calls++;return {bavail:100n,bsize:gib};}}));
  assert.equal(v.allowed,false);assert.equal(v.reason,'invalid_volume');assert.equal(calls,0);
});
test('disguised drive-label paths must be rejected',()=>{
  for(const drive of ['C:\\Users','C:\\Windows','C:/','C:../','C::','c']){
    const v=check(params({systemDrive:drive}));assert.equal(v.reason,'invalid_volume',drive);
  }
});
test('unverified SystemRoot must be rejected even with plenty of space',()=>{
  for(const root of ['',undefined,'D:\\Windows','C:\\Operator\\Windows','C:\\Windows\\..','C:/Windows','C:\\Windows:ads']){
    const v=check(params({systemRoot:root}));assert.equal(v.reason,'invalid_volume',String(root));
  }
});
test('matching alternate OS drive and canonical Windows casing allowed',()=>{
  const v=check(params({systemDrive:'d:',systemRoot:'D:\\WINDOWS\\',workspace:'E:\\Bostan-B208-qa',tempDir:'E:\\Bostan-B208-temp',statfs:()=>({bavail:100n,bsize:gib})}));
  assert.equal(v.allowed,true);assert.deepEqual(v.checks.map(x=>x.purpose),['system','workspace+temp']);
});
