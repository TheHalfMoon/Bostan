#!/usr/bin/env node
/** Windows-only, explicit private Bostan auth + real DB smoke. No release. */
import {readFileSync, statfsSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {invokePrivateWindowsAuthDbCaptured} from "./bostan-private-windows-auth-db-captured-child.mjs";
import {checkBostanWindowsDisk} from "./bostan-private-windows-disk-admission.mjs";
import {assertPrivateWindowsQaOsExecutablePaths} from "./bostan-private-windows-os-executable-admission.mjs";
import {resolvePrivateWindowsPowerShellBinary} from "./bostan-private-windows-powershell-binary.mjs";
import {buildPrivateWindowsAuthDbExecution} from "./bostan-private-windows-auth-db-execution.mjs";
import {executePrivateWindowsAuthDbSteps} from "./bostan-private-windows-auth-db-steps.mjs";
import {assertPrivateWindowsAuthDbWorkspace} from "./bostan-private-windows-auth-db-workspace-admission.mjs";
import {inspectPrivateWindowsAuthDbManagedEnvironment} from "./bostan-private-windows-auth-db-managed-env.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const plan={
  schema:"bostan.private-windows-auth-db.v1",
  releaseQualified:false,explicitOptIn:true,privateOnly:true,
  backendProductionServerQualified:false,authBrowserQualified:false,
  checks:["plugin-sdk build","authenticated HTTP route tests","native PostgreSQL migration tests","no orphan PostgreSQL processes"],
  paidProvidersUsed:false,publishes:false,
};
const args=process.argv.slice(2);
if(args.length===0||(args.length===1&&args[0]==="--plan")){
  console.log(JSON.stringify({...plan,run:false},null,2));
  process.exit(0);
}
if(args.length!==1||args[0]!=="--run"){
  console.error("Usage: node scripts/bostan-private-windows-auth-db.mjs [--plan|--run]");
  process.exit(2);
}
if(process.platform!=="win32"){
  console.error("Native Windows auth/DB qualification refuses non-Windows hosts");
  process.exit(2);
}
const version=process.versions.node.split(".").map(Number);
if(version[0]<24||(version[0]===24&&version[1]<11)){
  console.error("Bostan Windows auth/DB QA requires Node >=24.11.0");
  process.exit(2);
}
const pkg=JSON.parse(readFileSync(join(root,"package.json"),"utf8"));
if(pkg.name!=="bostan"||pkg.private!==true){
  console.error("Bostan Windows auth/DB QA refuses foreign manifests");
  process.exit(2);
}
// Reject intermediate junctions, redirected Git metadata, and TEMP aliases
// before constructing any subprocess plan, checking volumes or starting PG.
const tmp=process.env.TEMP||"";
try {
  assertPrivateWindowsAuthDbWorkspace({root:resolve(root),temp:tmp});
} catch {
  console.error("BOSTAN_WINDOWS_AUTH_DB_WORKSPACE_REFUSED");
  process.exit(2);
}
// A managed Cloud key name is untrusted diagnostic text, not safe to echo.
const managedEnvironment=inspectPrivateWindowsAuthDbManagedEnvironment(process.env);
if(!managedEnvironment.allowed){
  console.error(managedEnvironment.marker);
  process.exit(2);
}
// Fail closed before any command, test database, or process inspection.
// Verify real OS executables and all checkout-local CLI entrypoints.
let execution;
try {
  const osPaths=assertPrivateWindowsQaOsExecutablePaths();
  const powershell=resolvePrivateWindowsPowerShellBinary();
  execution=buildPrivateWindowsAuthDbExecution({
    root:resolve(root),temp:resolve(tmp),inherited:process.env,osPaths,powershell,
  });
} catch {
  console.error("BOSTAN_WINDOWS_AUTH_DB_EXECUTION_ADMISSION_REFUSED");
  process.exit(2);
}
const admission=checkBostanWindowsDisk({workspace:root,tempDir:tmp});
if(!admission.allowed){
  console.error("BOSTAN_WINDOWS_AUTH_DB_STORAGE_REFUSED="+admission.reason);
  console.error(JSON.stringify(admission));
  process.exit(2);
}
const stat=statfsSync(root,{bigint:true});
if(stat.bavail*stat.bsize<1024n*1024n*1024n){
  console.error("Bostan Windows auth/DB QA requires >=1 GiB free on checkout volume");
  process.exit(2);
}
const {env,commands}=execution;
const outcome=executePrivateWindowsAuthDbSteps({
  commands,
  // Never let untrusted child stdout/stderr forge trusted QA receipts.
  invoke:command=>invokePrivateWindowsAuthDbCaptured(command,{env}),
  log:line=>console.log(line),
  error:line=>console.error(line),
});
if(!outcome.passed)process.exit(1);
console.log(JSON.stringify({...plan,run:true,nativeWindows:true,externalProviderCalls:0},null,2));
