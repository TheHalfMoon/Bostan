/**
 * Opt-in Node preload after the strict synthetic Windows QA entry guard.
 * An uncaughtExceptionMonitor hook does not handle or suppress the failure.
 * Emit ONLY static labels, bounded error class/code and a validated package
 * or repository-relative location, never messages, stacks, credentials or URLs.
 */
import {fileURLToPath} from "node:url";
import {isPrivateWindowsQaEntryAllowed} from "./bostan-private-windows-entry-admission.mjs";
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
process.on("beforeExit",()=>emit({event:"before_exit"}));
process.on("exit",code=>emit({event:"exit",code:Number.isInteger(code)&&code>=0&&code<=255?code:null}));
