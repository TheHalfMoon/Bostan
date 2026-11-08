import {test} from "node:test";
import assert from "node:assert/strict";
import {
  evaluateWindowsPrivateHttpEvidence as evaluate,
  WINDOWS_HTTP_REQUIRED_STAGES as STAGES,
} from "./bostan-private-windows-http-evidence.mjs";

const pass=({events=STAGES,...rest}={})=>evaluate({
  events, httpComplete:true,childClosed:true,spawnError:false,forceUsed:false,
  postgresCleaned:true,ownedFixtureCleaned:true,
  postgresProcessTreeVerified:true,priorFailure:false,...rest,
});

test("all eighteen exact ordered stages and clean lifecycle qualify only HTTP",()=>{
  const result=pass();
  assert.equal(STAGES.length,18);
  assert.equal(result.outcome,"pass");
  assert.equal(result.windowsAuthenticatedHttpQualified,true);
  assert.equal(result.noOrphanPostgresProcessVerified,true);
  assert.equal(result.releaseQualified,false);
});
test("each missing stage refuses a green receipt",()=>{
  for (let i=0;i<STAGES.length;i++) {
    const result=pass({events:STAGES.filter((_,j)=>i!==j)});
    assert.equal(result.windowsAuthenticatedHttpQualified,false,STAGES[i]);
    assert.equal(result.outcome,"missing_duplicate_or_out_of_order_stage");
  }
});
test("duplicates and adjacent reorderings fail closed",()=>{
  for(let i=0;i<STAGES.length;i++){
    const duplicate=pass({events:[...STAGES,STAGES[i]]});
    assert.equal(duplicate.windowsAuthenticatedHttpQualified,false);
    if(i>0) {
      const swapped=[...STAGES];
      [swapped[i],swapped[i-1]]=[swapped[i-1],swapped[i]];
      assert.equal(pass({events:swapped}).windowsAuthenticatedHttpQualified,false);
    }
  }
});
test("each teardown or completion gate denies qualification when missing",()=>{
  for(const options of [
    {httpComplete:false},{childClosed:false},{spawnError:true},{forceUsed:true},
    {postgresCleaned:false},{postgresProcessTreeVerified:false},
    {ownedFixtureCleaned:false},{priorFailure:true},
    {httpComplete:1},{childClosed:"true"},{postgresCleaned:1},
  ]) {
    const proof=pass(options);
    assert.equal(proof.windowsAuthenticatedHttpQualified,false,JSON.stringify(options));
    assert.equal(proof.outcome,"lifecycle_not_clean");
  }
});
test("malformed, excessive and forged stage data are not accepted or echoed",()=>{
  for(const events of [
    null,"events",{},Array(65).fill("x"),[...STAGES,123],
    STAGES.map(s=>"prefix "+s),
    STAGES.map(s=>s+"\nPASSWORD=secret"),
    [...STAGES.slice(0,1),"postgres://user:secret@localhost",...STAGES.slice(2)]
  ]) {
    const p=pass({events});
    assert.equal(p.windowsAuthenticatedHttpQualified,false);
    assert.equal(JSON.stringify(p).includes("secret"),false);
  }
});
test("no stage or default options can claim qualification",()=>{
  const proof=evaluate();
  assert.equal(proof.windowsAuthenticatedHttpQualified,false);
  assert.equal(proof.noOrphanPostgresProcessVerified,false);
  assert.equal(proof.releaseQualified,false);
});
test("missing authenticated, anonymous and replay gates never qualify",()=>{
  for(const stage of [
    "BOSTAN_WINDOWS_LIVE_ANONYMOUS_CLAIM_DENIED",
    "BOSTAN_WINDOWS_LIVE_SIGNED_IN_SESSION_PASS",
    "BOSTAN_WINDOWS_LIVE_CROSS_ORIGIN_CLAIM_DENIED",
    "BOSTAN_WINDOWS_LIVE_CROSS_SCHEME_CLAIM_DENIED",
    "BOSTAN_WINDOWS_LIVE_NONCANONICAL_ORIGIN_DENIED",
    "BOSTAN_WINDOWS_LIVE_REPEAT_CLAIM_DENIED",
    "BOSTAN_WINDOWS_LIVE_FIRST_ADMIN_CLAIM_PASS",
  ]) assert.equal(pass({events:STAGES.filter(s=>s!==stage)}).windowsAuthenticatedHttpQualified,false);
});

test("sparse event arrays cannot claim a clean receipt",()=>{
  const sparse=Array.from(STAGES);
  delete sparse[5];
  assert.equal(sparse.length,STAGES.length);
  const proof=pass({events:sparse});
  assert.equal(proof.windowsAuthenticatedHttpQualified,false);
  assert.equal(proof.outcome,"invalid_events");
});

test("a clean but unverified Windows PostgreSQL process tree cannot qualify",()=>{
  const unverified=pass({postgresProcessTreeVerified:false});
  assert.equal(unverified.windowsAuthenticatedHttpQualified,false);
  assert.equal(unverified.noOrphanPostgresProcessVerified,false);
  const stageMissing=pass({events:STAGES.filter(stage=>stage!=="BOSTAN_WINDOWS_LIVE_NO_POSTGRES_ORPHANS_PASS")});
  assert.equal(stageMissing.windowsAuthenticatedHttpQualified,false);
});

test("scheme and Origin serialization denials are mandatory even with valid HTTP lifecycle",()=>{
  for(const stage of [
    "BOSTAN_WINDOWS_LIVE_CROSS_SCHEME_CLAIM_DENIED",
    "BOSTAN_WINDOWS_LIVE_NONCANONICAL_ORIGIN_DENIED",
  ]) {
    const proof=pass({events:STAGES.filter(s=>s!==stage)});
    assert.equal(proof.windowsAuthenticatedHttpQualified,false);
    assert.equal(proof.outcome,"missing_duplicate_or_out_of_order_stage");
  }
});
