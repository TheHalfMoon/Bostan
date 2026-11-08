/**
 * Opt-in Node preload after the strict synthetic Windows QA entry guard.
 * An uncaughtExceptionMonitor hook does not handle or suppress the failure.
 * Emit ONLY static labels, bounded error class/code and a validated package
 * or repository-relative location, never messages, stacks, credentials or URLs.
 */
import {fileURLToPath} from "node:url";
import {isPrivateWindowsQaEntryAllowed} from "./bostan-private-windows-entry-admission.mjs";
import {classifyPrivatePackedExitSite} from "./bostan-private-windows-packed-exit-site.mjs";
import {
  safeWindowsStartupCode,safeWindowsStartupSite,
  safeWindowsMissingPackage,safeWindowsMissingLocalModule,
} from "./bostan-private-windows-failure-site.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
if(!isPrivateWindowsQaEntryAllowed({root})) {
  console.error("BOSTAN_WIN_IMPORT_MONITOR_REFUSED");
  process.exit(2);
}
const names=new Set(["Error","TypeError","SyntaxError","ReferenceError",
  "RangeError","AggregateError","EvalError"]);
function emit(value){try{process.stderr.write("BOSTAN_WIN_MONITOR="+JSON.stringify(value)+"\n");}catch{}}
process.on("uncaughtExceptionMonitor",(error,origin)=>{
  try {
    const name=names.has(error?.name)?error.name:"other";
    const originKind=origin==="unhandledRejection"?"rejection":"exception";
    emit({event:"uncaught",name,origin:originKind,
      code:safeWindowsStartupCode(error),
      site:safeWindowsStartupSite(error?.stack,root),
      package:safeWindowsMissingPackage(error),
      local:safeWindowsMissingLocalModule(error,root)});
  } catch {emit({event:"uncaught",name:"other",origin:"exception",code:"unknown",
    site:"unknown",package:"unknown",local:"unknown"});}
});
// Test-only observation: preserve Node's actual process.exit behavior.
const nativeExit=process.exit.bind(process);
process.exit=function(...args){
  try {
    const code=Number.isInteger(args[0])&&args[0]>=0&&args[0]<=255?args[0]:null;
    const site=classifyPrivatePackedExitSite(new Error().stack,root);
    emit({event:"exit_called",code,site});
  }catch{}
  return nativeExit(...args);
};
process.on("beforeExit",()=>emit({event:"before_exit"}));
process.on("exit",code=>emit({event:"exit",code:Number.isInteger(code)&&code>=0&&code<=255?code:null}));
