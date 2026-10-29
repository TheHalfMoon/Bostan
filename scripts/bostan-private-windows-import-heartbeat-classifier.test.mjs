import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPrivateWindowsImportHeartbeat as classify} from
  './bostan-private-windows-import-heartbeat-classifier.mjs';
const marker=name=>'BOSTAN_WIN_SERVER_STAGE='+name+'\n';
test('worker timer while main timer is silent is an observation, never a definite cause',()=>{
 const r=classify(marker('static_import_start')+
   marker('static_import_worker_alive')+
   marker('static_import_worker_pending'));
 assert.equal(r.finding,'worker_timer_seen_main_timer_not_seen');
 assert.equal(r.worker,'timer_observed');
 assert.equal(r.main,'start_only');
 assert.equal(r.releaseQualified,false);
});
test('both timers observed are a separate fixed diagnostic',()=>{
 const r=classify(marker('static_import_start')+
   marker('static_import_worker_alive')+
   marker('static_import_pending')+
   marker('static_import_worker_pending'));
 assert.equal(r.finding,'both_timers_seen');
});
test('worker cannot start is not claimed as a main-thread import stall',()=>{
 const r=classify(marker('static_import_start')+
   marker('static_import_worker_failed'));
 assert.equal(r.finding,'worker_failed');
});
test('untrusted, oversized, forged or missing output cannot create leaked details',()=>{
 const secret='Bearer PRIVATE_API_KEY https://private.invalid/postgres?token=ABC';
 for(const input of [secret,marker('static_import_start')+secret,
    'BOSTAN_WIN_SERVER_STAGE=static_import_worker_pending_PRIVATE',
    secret+'\nBOSTAN_WIN_SERVER_STAGE=static_import_worker_pending'+'x'.repeat(66000),
    null,undefined]){
  const r=classify(input);
  assert.ok(!JSON.stringify(r).includes('PRIVATE_API_KEY'));
  assert.ok(!JSON.stringify(r).includes('private.invalid'));
  assert.equal(r.releaseQualified,false);
 }
 assert.equal(classify(null).finding,'insufficient_evidence');
 assert.equal(classify(marker('static_import_start')).finding,'insufficient_evidence');
});
