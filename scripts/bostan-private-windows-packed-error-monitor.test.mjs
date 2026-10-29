import assert from "node:assert/strict";
import {test} from "node:test";
import {summarizePrivateWindowsMonitor} from "./bostan-private-windows-cpu-profile-summary.mjs";

test("accepts only strictly sanitized monitor events",()=>{
  const log=[
    "secret=SUPER_PRIVATE",
    'BOSTAN_WIN_MONITOR='+JSON.stringify({event:"uncaught",name:"TypeError",
       origin:"rejection",code:"ERR_MODULE_NOT_FOUND",site:"unknown",
       package:"package:@bostan/shared",local:"unknown"}),
    'BOSTAN_WIN_MONITOR='+JSON.stringify({event:"exit",code:1}),
  ].join("\n");
  const result=summarizePrivateWindowsMonitor(log);
  assert.equal(result.uncaught.code,"ERR_MODULE_NOT_FOUND");
  assert.equal(result.uncaught.package,"package:@bostan/shared");
  assert.equal(result.exit,1);
  assert.equal(result.monitorInstalled,true);
  assert.equal(result.redacted,true);
  assert.ok(!JSON.stringify(result).includes("SUPER_PRIVATE"));
});
test("rejects injected paths or tokens in forged monitor lines",()=>{
  const injected={event:"uncaught",name:"Error",origin:"exception",code:"ENOENT",
    site:"C:/Users/secret-user/config.mjs:5",package:"package:evil;password",local:"repo:../secrets.js"};
  const result=summarizePrivateWindowsMonitor('BOSTAN_WIN_MONITOR='+JSON.stringify(injected));
  assert.equal(result.uncaught.site,"unknown");
  assert.equal(result.uncaught.package,"unknown");
  assert.equal(result.uncaught.local,"unknown");
  for(const key of ["secret-user","password","secrets.js"])assert.ok(!JSON.stringify(result).includes(key));
  assert.equal(summarizePrivateWindowsMonitor("BOSTAN_WIN_MONITOR={bad-json").uncaught,null);
});
