import test from 'node:test';
import assert from 'node:assert/strict';
import {appendPrivateWindowsImportCapture} from './bostan-private-windows-import-capture.mjs';

test('bounded import capture preserves complete in-budget diagnostics',()=>{
  let c={text:'',truncated:false};
  c=appendPrivateWindowsImportCapture(c,'BOSTAN_WIN_CHUNK_EVAL=123456789abc\n',{limit:64});
  assert.equal(c.text,'BOSTAN_WIN_CHUNK_EVAL=123456789abc\n');
  assert.equal(c.truncated,false);
});

test('overflow is explicit, bounded and permanently marked',()=>{
  let c={text:'',truncated:false};
  c=appendPrivateWindowsImportCapture(c,'a'.repeat(64),{limit:64});
  assert.equal(c.truncated,false);
  c=appendPrivateWindowsImportCapture(c,'b',{limit:64});
  assert.equal(c.truncated,true);
  assert.equal(c.text,'a'.repeat(63)+'b');
  c=appendPrivateWindowsImportCapture(c,'c',{limit:64});
  assert.equal(c.truncated,true);
  assert.equal(c.text.length,64);
});

test('large chunks cannot bypass the cap or reset truncation',()=>{
  const c=appendPrivateWindowsImportCapture({text:'',truncated:false},'x'.repeat(200),{limit:32});
  assert.equal(c.text,'x'.repeat(32));
  assert.equal(c.truncated,true);
});

test('invalid capture configuration fails closed',()=>{
  assert.throws(()=>appendPrivateWindowsImportCapture(null,'x'),/refused/);
  assert.throws(()=>appendPrivateWindowsImportCapture({text:'',truncated:false},'x',{limit:0}),/refused/);
  assert.throws(()=>appendPrivateWindowsImportCapture({text:'',truncated:false},'x',{limit:65537}),/refused/);
});

test('same-stream split markers remain intact',()=>{
  let c={text:'',truncated:false};
  c=appendPrivateWindowsImportCapture(c,'BOSTAN_WIN_CHUNK_EVAL=',{source:'stderr'});
  c=appendPrivateWindowsImportCapture(c,'123456789abc\n',{source:'stderr'});
  assert.match(c.text,/^BOSTAN_WIN_CHUNK_EVAL=123456789abc\n$/);
  assert.equal(c.interleaved,false);
});

test('cross-stream partial markers cannot forge an ESM evaluation receipt',()=>{
  let c={text:'',truncated:false};
  c=appendPrivateWindowsImportCapture(c,'BOSTAN_WIN_CHUNK_EVAL=',{source:'stdout'});
  c=appendPrivateWindowsImportCapture(c,'123456789abc\n',{source:'stderr'});
  assert.doesNotMatch(c.text,/(?:^|\n)BOSTAN_WIN_CHUNK_EVAL=([a-f0-9]{12})(?=\r?\n|$)/);
  assert.equal(c.interleaved,true);
  c=appendPrivateWindowsImportCapture(c,'safe\n',{source:'stdout'});
  assert.equal(c.interleaved,true);
});

test('completed lines may switch streams without invalidating completeness',()=>{
  let c={text:'',truncated:false};
  c=appendPrivateWindowsImportCapture(c,'BOSTAN_WIN_CHUNK_EVAL=123456789abc\n',{source:'stderr'});
  c=appendPrivateWindowsImportCapture(c,'BOSTAN_WIN_SERVER_STAGE=runtime_start\n',{source:'stdout'});
  assert.equal(c.interleaved,false);
  assert.equal(c.truncated,false);
  assert.match(c.text,/BOSTAN_WIN_SERVER_STAGE=runtime_start/);
});
