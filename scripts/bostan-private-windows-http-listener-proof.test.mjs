import test from 'node:test';
import assert from 'node:assert/strict';
import {proveOwnedWindowsHttpListener as prove, parsePrivateWindowsNetstatListeners as parseNetstat} from './bostan-private-windows-http-listener-proof.mjs';
const port=43123,pid=4567;
const row={LocalAddress:'127.0.0.1',LocalPort:port,OwningProcess:pid};
const params={port,expectedPid:pid,childAlive:()=>true,pause:async()=>{}};
const refused=/HTTP listener ownership unverified/;
test('two independent matching read-only listener snapshots qualify',async()=>{
  let samples=0,pauses=0;
  assert.equal(await prove({...params,inspect:async()=>{samples++;return [{...row}];},pause:async ms=>{assert.equal(ms,125);pauses++;}}),true);
  assert.equal(samples,2);assert.equal(pauses,1);
});
test('reject foreign PID and recycled same-port listener on second sample',async()=>{
  for(const index of [0,1]){
    let calls=0;
    await assert.rejects(prove({...params,inspect:async()=>[{...row,OwningProcess:calls++===index?pid+1:pid}]}),refused);
  }
});
test('reject wildcard and IPv6 listeners, including matching child PID',async()=>{
  for(const address of ['0.0.0.0','::','::1','::ffff:127.0.0.1'])
    await assert.rejects(prove({...params,inspect:async()=>[{...row,LocalAddress:address}]}),refused);
});
test('reject multiple, missing or malformed listener observations',async()=>{
  for(const rows of [[],[row,row],null,{},[{...row,LocalPort:'43123'}],[{...row,OwningProcess:'4567'}]])
    await assert.rejects(prove({...params,inspect:async()=>rows}),refused);
});
test('reject process exit before, during, or after snapshots',async()=>{
  for(const deadAt of [1,2,3,4,5]){
    let checks=0;
    await assert.rejects(prove({...params,childAlive:()=>++checks!==deadAt,inspect:async()=>[{...row}]}),refused);
  }
});
test('reject denied inspector and pause failures without leaking details',async()=>{
  await assert.rejects(prove({...params,inspect:async()=>{throw Error('secret path');}}),refused);
  await assert.rejects(prove({...params,inspect:async()=>[{...row}],pause:async()=>{throw Error('secret');}}),refused);
});
test('reject invalid ports and unowned PID before inspecting',async()=>{
  let called=0;
  for(const patch of [{port:0},{port:65536},{port:'43123'},{expectedPid:0},{expectedPid:1.5},{childAlive:null}])
    await assert.rejects(prove({...params,...patch,inspect:async()=>{called++;return [row];}}),refused);
  assert.equal(called,0);
});
test('never treat a healthy HTTP endpoint as listener ownership evidence',async()=>{
  await assert.rejects(prove({...params,inspect:async()=>[{LocalAddress:'127.0.0.1',LocalPort:port,OwningProcess:pid+999}]}),refused);
});

test('bounded failure categories preserve fail-closed behavior without leaking inspector details',async()=>{
  await assert.rejects(prove({...params,inspect:async()=>{throw Error('secret path and token');}}),error=>
    error.message.endsWith('[inspection_failed]') && !error.message.includes('secret'));
  await assert.rejects(prove({...params,inspect:async()=>[]}),/\[listener_count\]/);
  await assert.rejects(prove({...params,inspect:async()=>[{...row,OwningProcess:pid+1}]}),/\[listener_mismatch\]/);
  await assert.rejects(prove({...params,childAlive:()=>false}),/\[child_exited\]/);
});

test('safe OS-query reason survives proof while arbitrary inspector text is suppressed',async()=>{
  await assert.rejects(prove({...params,inspect:async()=>{throw Error('Private Windows QA HTTP listener ownership unverified [query_failed]');}}),/\[query_failed\]/);
  await assert.rejects(prove({...params,inspect:async()=>{throw Error('Private Windows QA HTTP listener ownership unverified [secret]');}}),error=>
    error.message.endsWith('[inspection_failed]') && !error.message.includes('[secret]'));
});

test('netstat fallback parses only the requested TCP listener',()=>{
  const sample='Active Connections\r\n  Proto  Local Address          Foreign Address        State           PID\r\n' +
    '  TCP    127.0.0.1:43123       0.0.0.0:0              LISTENING       4567\r\n' +
    '  TCP    127.0.0.1:43124       0.0.0.0:0              LISTENING       99\r\n';
  assert.deepEqual(parseNetstat(sample,43123),[row]);
  assert.deepEqual(parseNetstat(sample,43125),[]);
});
test('netstat fallback never accepts wildcard, IPv6, duplicate or malformed ownership',()=>{
  const make=(address,pid='4567',state='LISTENING')=>
    ' TCP '+address+':43123  0.0.0.0:0  '+state+'  '+pid+'\r\n';
  for(const address of ['0.0.0.0','[::]','[::1]'])
    assert.notEqual(parseNetstat(make(address),43123)[0].LocalAddress,'127.0.0.1');
  assert.equal(parseNetstat(make('127.0.0.1')+make('127.0.0.1'),43123).length,2);
  for(const text of [make('127.0.0.1','0'),make('127.0.0.1','secret')])
    assert.throws(()=>parseNetstat(text,43123),/invalid_query_output/);
});

test('netstat ignores established and closing connections sharing the listener port',()=>{
  const make=(state,pid='4567')=>
    ' TCP 127.0.0.1:43123 127.0.0.1:51234 '+state+' '+pid+'\r\n';
  const listening=' TCP 127.0.0.1:43123 0.0.0.0:0 LISTENING 4567\r\n';
  assert.deepEqual(parseNetstat(make('ESTABLISHED','9999')+listening+make('TIME_WAIT','0'),43123),[row]);
  assert.deepEqual(parseNetstat(make('ESTABLISHED'),43123),[]);
  assert.equal(parseNetstat(listening+listening,43123).length,2);
});
