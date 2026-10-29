import assert from "node:assert/strict";
import {test} from "node:test";
import {summarizePrivateWindowsStartupFailure as summarize} from "./bostan-private-windows-cpu-profile-summary.mjs";
test("extracts only an explicit Pino startup failure with redacted category",()=>{
 const raw=JSON.stringify({level:50,msg:"Bostan server failed to start",
   err:{type:"PostgresError",code:"ECONNREFUSED",
     message:"Connect postgres://username:SENSITIVE_PASSWORD@127.0.0.1:9876/private",
     stack:"C:/Users/secret-user/bostan/server/dist-runtime/server.mjs:333:9"}});
 const v=summarize(raw);
 assert.equal(v.startupFailureMarker,true);
 assert.equal(v.structuredLog,true);
 assert.equal(v.errorType,"PostgresError");
 assert.equal(v.allowlistedCode,"ECONNREFUSED");
 assert.equal(v.messageCategory,"database_or_transport");
 for(const secret of ["SENSITIVE_PASSWORD","secret-user","127.0.0.1","9876","C:/"])
  assert.ok(!JSON.stringify(v).includes(secret));
});
test("refuses arbitrary codes and non-startup log messages",()=>{
 const v=summarize(JSON.stringify({msg:"Bostan server failed to start",
  err:{type:"SecretType",code:"SECRET_CODE",message:"private data"} }));
 assert.equal(v.startupFailureMarker,true);
 assert.equal(v.errorType,"unclassified");
 assert.equal(v.allowlistedCode,"unclassified");
 assert.equal(v.messageCategory,"other");
 assert.equal(summarize(JSON.stringify({msg:"random log",err:{code:"ECONNREFUSED"}})).startupFailureMarker,false);
});

test("parses pino-pretty synthetic multiline error without leaking source",()=>{
 const pretty="\u001b[31m[23:01] ERROR: Bostan server failed to start\u001b[0m\n"+"    err: {\n      \"type\": \"PostgresError\",\n      \"message\": \"connect ECONNRESET to postgres://PRIVATE_TOKEN@127.0.0.1:5432/x\",\n      \"code\": \"ECONNRESET\"\n    }\n";
 const v=summarize(pretty);
 assert.equal(v.prettyFallback,true);
 assert.equal(v.structuredLog,false);
 assert.equal(v.allowlistedCode,"ECONNRESET");
 assert.equal(v.messageCategory,"database_or_transport");
 assert.ok(!JSON.stringify(v).includes("PRIVATE_TOKEN"));
});
