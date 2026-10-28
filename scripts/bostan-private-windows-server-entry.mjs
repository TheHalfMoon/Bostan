#!/usr/bin/env node
/**
 * Diagnostic entrypoint for the private, synthetic-only Windows Bostan server
 * acceptance. No app code or auth behavior changed. Fixed, secret-free stages.
 */
import {fileURLToPath} from "node:url";

const path=fileURLToPath(new URL("../server/src/index.ts",import.meta.url));
const safeStage=s=>process.stdout.write("BOSTAN_WIN_SERVER_STAGE="+s+"\n");
const run=async()=>{
  safeStage("static_import_start");
  const module=await import(path);
  safeStage("static_import_complete");
  if(typeof module.startServer!=="function")throw Error("No Bostan startServer export");
  safeStage("runtime_start");
  await module.startServer();
  safeStage("runtime_ready");
};
run().catch(error=>{
  // Never print raw caught errors: DB URL/passwords and environment values may
  // be embedded in dependency messages.
  const name=error instanceof Error?error.name:"unknown";
  const known=["TypeError","SyntaxError","ReferenceError","Error","RangeError"].includes(name)?name:"other";
  process.stderr.write("BOSTAN_WIN_SERVER_STAGE=runtime_failed\n");
  process.stderr.write("BOSTAN_WIN_SERVER_ERROR_TYPE="+known+"\n");
  process.exitCode=1;
});
