import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeOwnedLocalPostgres} from './bostan-local-postgres-safe-finalize.mjs';
const run=(overrides={})=>{
 const calls=[];
 const options={startAttempted:true,startConfirmed:true,
  stop:()=>{calls.push('stop');return true;},
  owned:()=>{calls.push('owned');return true;},
  remove:()=>{calls.push('remove');return true;},...overrides};
 return {result:finalizeOwnedLocalPostgres(options),calls};
};
test('confirmed start verifies ownership before and after stop and before deletion',()=>{
 const {result,calls}=run();assert.deepEqual(result,{removed:true,reason:'verified'});
 assert.deepEqual(calls,['owned','stop','owned','remove']);
});
test('uncertain start retains without touching the cluster',()=>{
 const {result,calls}=run({startAttempted:true,startConfirmed:false});
 assert.deepEqual(result,{removed:false,reason:'start_unconfirmed'});assert.deepEqual(calls,[]);
});
test('unowned or throwing initial marker prevents even stop',()=>{
 for(const owned of [()=>false,()=>{throw Error('private');}]){
  const {result,calls}=run({owned});assert.deepEqual(result,{removed:false,reason:'ownership_unconfirmed'});assert.deepEqual(calls,[]);
 }
});
test('ownership lost after stop refuses removal',()=>{
 let count=0;const observed=[];const {result}=run({owned:()=>{observed.push('owned');return ++count===1;},stop:()=>{observed.push('stop');return true;}});
 assert.deepEqual(result,{removed:false,reason:'ownership_unconfirmed'});
 assert.deepEqual(observed,['owned','stop','owned']);
});
test('stop failure retains scratch',()=>{
 for(const stop of [()=>false,()=>{throw Error('private');}]){
  const {result,calls}=run({stop});assert.deepEqual(result,{removed:false,reason:'stop_unconfirmed'});assert.deepEqual(calls,['owned']);
 }
});
test('never-started cluster can be removed only after ownership',()=>{
 const {result,calls}=run({startAttempted:false,startConfirmed:false});
 assert.deepEqual(result,{removed:true,reason:'verified'});assert.deepEqual(calls,['owned','remove']);
});
test('removal failure does not report success',()=>{
 const {result,calls}=run({remove:()=>false});assert.deepEqual(result,{removed:false,reason:'removal_unconfirmed'});
 assert.deepEqual(calls,['owned','stop','owned']);
});
test('invalid state refuses callbacks',()=>{
 for(const overrides of [{startAttempted:false,startConfirmed:true},{stop:null},{owned:null},{remove:null}]){
  const {result,calls}=run(overrides);assert.deepEqual(result,{removed:false,reason:'invalid_state'});assert.deepEqual(calls,[]);
 }
});
