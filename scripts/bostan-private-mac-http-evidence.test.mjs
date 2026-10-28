import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluateMacHttpEvidence as audit,MAC_HTTP_REQUIRED_STAGES as STAGES, MAC_HTTP_LOG_LIMIT as LIMIT} from "./bostan-private-mac-http-evidence.mjs";

const log=(lines=STAGES)=>[...lines,""].join("\n");
const receipt=(text=log(), extra={})=>({status:0,signal:null,errorCode:null,logBytes:Buffer.byteLength(text),logText:text,...extra});

test("exactly seven ordered real stage markers and clean child exit qualify",()=>{
 const p=audit(receipt());
 assert.equal(p.macAuthenticatedHttpQualified,true);
 assert.equal(p.outcome,"pass");
 assert.equal(Object.values(p.stages).filter(Boolean).length,7);
});
test("missing, duplicate, and reordered stages are never qualified",()=>{
 for(const ls of [STAGES.slice(0,-1),[...STAGES,STAGES[3]],[STAGES[1],STAGES[0],...STAGES.slice(2)]]){
  const p=audit(receipt(log(ls)));
  assert.equal(p.macAuthenticatedHttpQualified,false);
 }
});
test("embedded log text cannot spoof stages",()=>{
 for(const injected of ["prefix "+STAGES[0],STAGES[0]+" suffix", "\u001b[32m"+STAGES[0]]){
  const ls=[injected,...STAGES.slice(1)];
  assert.equal(audit(receipt(log(ls))).macAuthenticatedHttpQualified,false);
 }
});
test("timeout, signal, or nonzero status fail despite all stage markers",()=>{
 for(const extra of [{status:1},{status:null,errorCode:"ETIMEDOUT"},{status:0,signal:"SIGTERM"},{status:0,errorCode:"EACCES"}]){
  const p=audit(receipt(log(),extra));
  assert.equal(p.macAuthenticatedHttpQualified,false);
  assert.equal(p.outcome,"child_exit_or_timeout");
 }
});
test("explicit failure marker fails even with all success stages",()=>{
 const text=log([...STAGES,"BOSTAN_MAC_HTTP_FAILED_TYPE=TypeError"]);
 const p=audit(receipt(text));
 assert.equal(p.outcome,"child_reported_failure");
 assert.equal(p.macAuthenticatedHttpQualified,false);
});
test("malformed, absent and oversized logs fail closed without echoing secrets",()=>{
 for(const extra of [{logBytes:null},{logBytes:LIMIT+1},{logBytes:-1},{logBytes:Infinity},{logText:null}]){
  assert.equal(audit(receipt(log(),extra)).macAuthenticatedHttpQualified,false);
 }
 const secret=log()+"private-secret-postgresql://password\n";
 const result=audit(receipt(secret));
 assert.equal(JSON.stringify(result).includes("private-secret"),false);
});
test("Windows CRLF logs preserve exact stage verification",()=>{
 const text=STAGES.join("\r\n")+"\r\n";
 assert.equal(audit(receipt(text)).macAuthenticatedHttpQualified,true);
});
