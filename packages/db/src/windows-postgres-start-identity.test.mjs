import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePostmasterStartEpochSeconds, matchesPostmasterStartToCim } from './windows-postgres-start-identity.mjs';
const creation = '2026-10-30T12:00:00.1234567Z';
const start = Math.floor(Date.parse(creation)/1000);
test('accepts canonical PostgreSQL epoch and corresponding CIM creation',()=>{
  assert.equal(parsePostmasterStartEpochSeconds(String(start)),start);
  assert.equal(matchesPostmasterStartToCim(start,creation),true);
});
test('accepts bounded native startup delay',()=>{
  assert.equal(matchesPostmasterStartToCim(start+90,creation),true);
  assert.equal(matchesPostmasterStartToCim(start+120,creation),true);
});
test('refuses reused PID from an earlier launch of the same binary',()=>{
  assert.equal(matchesPostmasterStartToCim(start+121,creation),false);
  assert.equal(matchesPostmasterStartToCim(start+3600,creation),false);
  assert.equal(matchesPostmasterStartToCim(start-120,creation),false);
});
test('refuses a CIM process created after the marker',()=>{
  assert.equal(matchesPostmasterStartToCim(start,'2026-10-30T12:00:02Z'),false);
});
test('refuses absent, malformed and noncanonical PID start markers',()=>{
  for(const value of ['', '0','-1',' 123','123 ','+123','123.0','1e9','0012345678','9999999999999999999','12\n34','abc']) {
    assert.equal(parsePostmasterStartEpochSeconds(value),null,value);
  }
});
test('refuses malformed CIM timestamps and invalid epochs',()=>{
  for(const value of ['2026-10-30 12:00:00Z','2026-02-30T12:00:00Z','2026-10-30T12:00:00+00:00','2026-10-30T12:00:00.12345678Z','secret']) {
    assert.equal(matchesPostmasterStartToCim(start,value),false,value);
  }
  assert.equal(matchesPostmasterStartToCim(-1,creation),false);
  assert.equal(matchesPostmasterStartToCim(Number.MAX_SAFE_INTEGER,creation),false);
});
