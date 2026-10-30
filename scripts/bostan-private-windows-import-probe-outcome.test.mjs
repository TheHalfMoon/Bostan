import test from 'node:test';
import assert from 'node:assert/strict';
import {admitPrivateWindowsProbeChildExit as admit} from
  './bostan-private-windows-import-probe-outcome.mjs';

test('actual child exit 1 from a missing package must fail the diagnostic',()=>{
  assert.equal(admit({outcome:'child_exited',exitCode:1}),false);
  assert.equal(admit({outcome:'child_exited',exitCode:2}),false);
  assert.equal(admit({outcome:'child_exited',exitCode:null}),false);
  assert.equal(admit({outcome:'child_exited',exitCode:0}),true);
});
test('bounded import observation is not misclassified as child exit failure',()=>{
  assert.equal(admit({outcome:'bounded_36s',exitCode:null}),true);
  assert.equal(admit({outcome:'not_started',exitCode:null}),false);
  assert.equal(admit({outcome:'unknown',exitCode:0}),false);
});
