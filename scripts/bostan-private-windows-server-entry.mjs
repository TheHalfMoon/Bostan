#!/usr/bin/env node
/**
 * Strictly private Windows synthetic server entry stage probe.
 * Only the Bostan QA harness may enable this module; it must not start the
 * app against operator settings, user data, other hosts or managed Cloud.
 */
import {fileURLToPath} from "node:url";
import {isPrivateWindowsQaEntryAllowed} from "./bostan-private-windows-entry-admission.mjs";
import {safeWindowsStartupSite,safeWindowsStartupCode,safeWindowsMissingPackage,safeWindowsMissingLocalModule} from "./bostan-private-windows-failure-site.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
// The source and compiled test entries share one fail-closed fixture gate.
const allowed=isPrivateWindowsQaEntryAllowed({root});
if(!allowed){
  console.error("Bostan Windows server stage entry refuses a missing or unsafe synthetic test fixture");
  process.exit(2);
}
const stage=name=>process.stdout.write("BOSTAN_WIN_SERVER_STAGE="+name+"\n");
async function run(){
  stage("static_import_start");
  // file:// is required by Windows Node's ESM loader; importing D:\... fails.
  const module=await import(new URL("../server/src/index.ts",import.meta.url).href);
  stage("static_import_complete");
  if(typeof module.startServer!=="function")throw Error("Bostan server entry export missing");
  stage("runtime_start");
  await module.startServer();
  stage("runtime_ready");
}
run().catch(error=>{
  // Exception messages may contain customer URLs or credentials. Do not print.
  const kind=error instanceof Error &&
    ["Error","TypeError","SyntaxError","ReferenceError","RangeError"].includes(error.name)
    ?error.name:"other";
  stage("runtime_failed");
  process.stderr.write("BOSTAN_WIN_SERVER_ERROR_TYPE="+kind+"\n");
  // Emit ONLY a verified repo-relative source frame. Never echo thrown text.
  process.stderr.write("BOSTAN_WIN_SERVER_ERROR_SITE="+
    safeWindowsStartupSite(error instanceof Error ? error.stack : null,root)+"\n");
  process.stderr.write("BOSTAN_WIN_SERVER_ERROR_CODE="+safeWindowsStartupCode(error)+"\n");
  process.stderr.write("BOSTAN_WIN_SERVER_MISSING_PACKAGE="+safeWindowsMissingPackage(error)+"\n");
  process.stderr.write("BOSTAN_WIN_SERVER_MISSING_LOCAL="+safeWindowsMissingLocalModule(error,root)+"\n");
  process.exitCode=1;
});
