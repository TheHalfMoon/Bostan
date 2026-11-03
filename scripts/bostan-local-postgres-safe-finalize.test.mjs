import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeOwnedLocalPostgres} from './bostan-local-postgres-safe-finalize.mjs';

const run = (overrides={}) => {
  const calls=[];
  const options={
    startAttempted:true,startConfirmed:true,
    stop:()=>{calls.push('stop');return true;},
    owned:()=>{calls.push('owned');return true;},
    remove:()=>{calls.push('remove');return true;},
    ...overrides,
  };
  return {result:finalizeOwnedLocalPostgres(options),calls};
};
test('confirmed start requires confirmed stop and ownership before deletion',()=>{
  const {result,calls}=run();
  assert.deepEqual(result,{removed:true,reason:'verified'});
  assert.deepEqual(calls,['stop','owned','remove']);
});
test('uncertain pg_ctl start preserves scratch without attempting a stop or deletion',()=>{
  const {result,calls}=run({startAttempted:true,startConfirmed:false});
  assert.deepEqual(result,{removed:false,reason:'start_unconfirmed'});
  assert.deepEqual(calls,[]);
});
test('stop throws or reports non-success: retain all scratch',()=>{
  for(const stop of [()=>{throw Error('synthetic secret');},()=>false,()=>undefined]){
    const {result,calls}=run({stop});
    assert.deepEqual(result,{removed:false,reason:'stop_unconfirmed'});
    assert.deepEqual(calls,[]);
  }
});
test('no start attempt can remove only after verified ownership',()=>{
  const {result,calls}=run({startAttempted:false,startConfirmed:false});
  assert.deepEqual(result,{removed:true,reason:'verified'});
  assert.deepEqual(calls,['owned','remove']);
});
test('missing or invalid marker refuses deletion',()=>{
  for(const owned of [()=>false,()=>{throw Error('synthetic private path');}]){
    const {result,calls}=run({owned});
    assert.deepEqual(result,{removed:false,reason:'ownership_unconfirmed'});
    assert.deepEqual(calls,['stop']);
  }
});
test('removal failures never claim successful cleanup',()=>{
  for(const remove of [()=>false,()=>{throw Error('synthetic private path');}]){
    const {result,calls}=run({remove});
    assert.deepEqual(result,{removed:false,reason:'removal_unconfirmed'});
    assert.deepEqual(calls,['stop','owned']);
  }
});
test('invalid lifecycle states fail closed before callbacks',()=>{
  for(const overrides of [
    {startAttempted:false,startConfirmed:true},
    {startAttempted:'yes'},
    {stop:null},
    {owned:null},
    {remove:null},
  ]){
    const {result,calls}=run(overrides);
    assert.deepEqual(result,{removed:false,reason:'invalid_state'});
    assert.deepEqual(calls,[]);
  }
});
