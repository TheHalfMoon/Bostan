import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWindowsLiveMemory as evaluate} from './bostan-private-windows-live-memory-policy.mjs';
const good = (freeGiB, allowed=true) => Object.freeze({
  allowed,freeGiB,reason:allowed?'pass':'low_free_memory',
});
test('Chromium at 4 GiB passes and at 3.99 GiB is refused', () => {
  assert.deepEqual(evaluate(good(4),{browserMode:true}),{allowed:true,reason:'pass'});
  assert.deepEqual(evaluate(good(3.99),{browserMode:true}),{allowed:false,reason:'chromium_low_free_memory'});
});
test('Chromium memory at 3.5 GiB must not pass after a database migration', () => {
  assert.equal(evaluate(good(3.5),{browserMode:true}).allowed,false);
});
test('headless HTTP remains permitted by the existing 2 GiB base gate', () => {
  assert.equal(evaluate(good(2.01),{browserMode:false}).allowed,true);
});
test('the base memory-admission refusal always wins', () => {
  assert.deepEqual(evaluate(good(10,false),{browserMode:true}),{allowed:false,reason:'memory_refused'});
});
test('malformed or ambiguous memory receipts fail closed', () => {
  for (const reading of [undefined,null,{}, {allowed:true},{allowed:true,freeGiB:NaN},
    {allowed:true,freeGiB:'8'}, {allowed:true,freeGiB:-1},
    {allowed:true,freeGiB:Infinity}, {allowed:'true',freeGiB:10}]) {
    assert.equal(evaluate(reading,{browserMode:true}).allowed,false,JSON.stringify(reading));
  }
});
test('rejects malformed browserMode rather than treating strings as true', () => {
  assert.equal(evaluate(good(8),{browserMode:'false'}).allowed,false);
});
test('receipts are frozen and never reveal injected secrets', () => {
  const result=evaluate({allowed:false,freeGiB:3,reason:'postgres://user:secret@localhost'}, {browserMode:true});
  assert.equal(Object.isFrozen(result),true);
  assert.equal(JSON.stringify(result).includes('postgres://'),false);
});
