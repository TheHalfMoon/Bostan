/**
 * Reduce an owned V8 CPU profile to a bounded, privacy-safe import diagnosis.
 * Never return raw CPU frames, source locations, script URLs, native paths,
 * function names, secrets or arbitrary profile metadata.
 *
 * A profile is diagnostic evidence, not runtime correctness or an E2E pass.
 */
const MAX_NODES=500_000;
const MAX_SAMPLES=2_000_000;
const MAX_OUTPUT_PACKAGES=8;
const BUCKETS=[
  "idle","program","garbageCollector","packedRuntime","thirdParty",
  "nodeInternal","workspace","otherScript","unattributed",
];
const safePackage=/^(?:@[a-z0-9][a-z0-9._-]{0,62}\/)?[a-z0-9][a-z0-9._-]{0,62}$/;

function categorize(frame) {
  const name=frame?.functionName;
  if(name==="(idle)")return {bucket:"idle"};
  if(name==="(program)")return {bucket:"program"};
  if(name==="(garbage collector)")return {bucket:"garbageCollector"};
  const url=typeof frame?.url==="string" ? frame.url.replaceAll("\\","/") : "";
  if(url.startsWith("node:")||url.startsWith("internal/"))return {bucket:"nodeInternal"};
  // Absolute file-backed sources only. No profile URL is ever printed.
  const file=url.startsWith("file:/")||/^[a-z]:\//i.test(url)||url.startsWith("/");
  if(!file)return {bucket:url?"otherScript":"unattributed"};
  const lower=url.toLowerCase();
  if(lower.includes("/dist-runtime/"))return {bucket:"packedRuntime"};
  if(lower.includes("/node_modules/")){
    // Last node_modules is the actual dependency name under pnpm's store.
    const fragment=lower.slice(lower.lastIndexOf("/node_modules/")+"/node_modules/".length);
    const parts=fragment.split("/");
    const candidate=parts[0]?.startsWith("@") ? parts.slice(0,2).join("/") : parts[0];
    return {bucket:"thirdParty",pkg:safePackage.test(candidate||"")?candidate:undefined};
  }
  if(lower.includes("/packages/")||lower.includes("/server/")||lower.includes("/ui/"))
    return {bucket:"workspace"};
  return {bucket:"otherScript"};
}

export function summarizePrivateWindowsCpuProfile(profile) {
  if(!profile || !Array.isArray(profile.nodes) || !Array.isArray(profile.samples) ||
    profile.nodes.length>MAX_NODES || profile.samples.length>MAX_SAMPLES)
    throw new Error("Malformed or oversized private CPU profile");
  const frames=new Map();
  for(const item of profile.nodes){
    if(!item || !Number.isSafeInteger(item.id))throw Error("Invalid CPU node");
    frames.set(item.id,categorize(item.callFrame));
  }
  const counts=Object.fromEntries(BUCKETS.map(bucket=>[bucket,0]));
  const packages=new Map();
  for(const sample of profile.samples){
    if(!Number.isSafeInteger(sample))throw Error("Invalid CPU sample");
    const frame=frames.get(sample) || {bucket:"unattributed"};
    counts[frame.bucket]++;
    if(frame.pkg)packages.set(frame.pkg,(packages.get(frame.pkg)||0)+1);
  }
  const topPackages=[...packages].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,MAX_OUTPUT_PACKAGES).map(([name,samples])=>({name,samples}));
  return {schema:"bostan.private-windows-cpu-attribution.v1",
    totalSamples:profile.samples.length,counts,topPackages,
    rawPathsEmitted:false,rawFunctionsEmitted:false,realPostgresUsed:false,
    startupQualified:false,releaseQualified:false};
}

/**
 * Whitelist-only reduction of child stderr/stdout. Never surface diagnostic
 * text, raw errors, arbitrary error codes, executable paths, URLs or secrets.
 */
const EXIT_ERROR_CODES=Object.freeze([
  "ERR_MODULE_NOT_FOUND","ERR_UNSUPPORTED_ESM_URL_SCHEME",
  "ERR_UNKNOWN_FILE_EXTENSION","ERR_PACKAGE_PATH_NOT_EXPORTED",
  "ERR_INVALID_ARG_TYPE","ERR_REQUIRE_ESM","ERR_DLOPEN_FAILED",
  "MODULE_NOT_FOUND","ERR_OUT_OF_MEMORY",
]);
const EXIT_ERROR_CLASSES=Object.freeze([
  "SyntaxError","TypeError","ReferenceError","RangeError","AggregateError",
]);
export function summarizePrivateWindowsImportExit({observed,exitCode,signal}) {
  const content=typeof observed==="string" ? observed.slice(-65536) : "";
  const errorCode=EXIT_ERROR_CODES.find(code=>content.includes(code)) || "unclassified";
  const errorClass=EXIT_ERROR_CLASSES.find(name=>
    new RegExp("(?:^|\\n)\\s*"+name+":").test(content)) || "unclassified";
  const safeExitCode=Number.isInteger(exitCode)&&exitCode>=0&&exitCode<=255?exitCode:null;
  const safeSignal=["SIGTERM","SIGKILL","SIGINT"].includes(signal)?signal:"none";
  return {schema:"bostan.private-windows-import-exit.v1",exitCode:safeExitCode,
    signal:safeSignal,errorCode,errorClass,
    rawDiagnosticEmitted:false,releaseQualified:false};
}

/** Parse only a narrow, controlled JSON line emitted by the QA preloader.
 * Reject every unrecognized value and all arbitrary strings.
 */
export function summarizePrivateWindowsMonitor(observed) {
  const lines=typeof observed==="string"?
    observed.slice(-65536).split(/\r?\n/).filter(x=>x.startsWith("BOSTAN_WIN_MONITOR=")):[];
  const allowedNames=new Set(["Error","TypeError","SyntaxError","ReferenceError",
    "RangeError","AggregateError","EvalError","other"]);
  const allowedCodes=new Set(["unknown","ENOENT","EACCES","EPERM","EADDRINUSE",
    "ECONNREFUSED","ERR_MODULE_NOT_FOUND","MODULE_NOT_FOUND",
    "ERR_PACKAGE_PATH_NOT_EXPORTED","42P01","42703","28P01","23505"]);
  let uncaught=null,exit=null,beforeExit=false,exitCalled=null;
  for(const line of lines.slice(-6)) {
    let obj;
    try{obj=JSON.parse(line.slice("BOSTAN_WIN_MONITOR=".length));}catch{continue}
    if(!obj || typeof obj!=="object")continue;
    if(obj.event==="before_exit")beforeExit=true;
    if(obj.event==="exit_called" && Number.isInteger(obj.code) &&
      obj.code>=0&&obj.code<=255 &&
      ["packed_entry","packed_server","packed_chunk","compiled_server",
       "qa_preload","third_party","workspace","unknown"].includes(obj.site))
      exitCalled={code:obj.code,site:obj.site};
    if(obj.event==="exit" && Number.isInteger(obj.code) && obj.code>=0 && obj.code<=255)
      exit=obj.code;
    if(obj.event==="uncaught" && allowedNames.has(obj.name) &&
      allowedCodes.has(obj.code) && ["rejection","exception"].includes(obj.origin)) {
      const site=typeof obj.site==="string" && obj.site.length<=180 &&
        /^(unknown|(?:server\/src|packages)\/[a-zA-Z0-9_/-]+\.(?:ts|tsx|js|mjs):[1-9][0-9]{0,5})$/.test(obj.site) ? obj.site:"unknown";
      const pkg=typeof obj.package==="string" && obj.package.length<=100 &&
        /^(unknown|package:(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)$/.test(obj.package)?obj.package:"unknown";
      const local=typeof obj.local==="string" && obj.local.length<=190 &&
        /^(unknown|repo:(?:server|packages)\/[a-zA-Z0-9_./-]+\.(?:ts|tsx|js|mjs|json))$/.test(obj.local) &&
        !obj.local.includes("../") ? obj.local:"unknown";
      uncaught={name:obj.name,code:obj.code,origin:obj.origin,site,package:pkg,local};
    }
  }
  return {schema:"bostan.private-windows-packed-import-monitor.v1",
    uncaught,exit,beforeExit,exitCalled,monitorInstalled:lines.length>0,
    redacted:true,releaseQualified:false};
}

/** Reduce ONLY the logger's exact startup-error event to fixed categorical
 * fields. No raw JSON, message, stack, URL, path or code is returned.
 */
export function summarizePrivateWindowsStartupFailure(observed) {
  const content=typeof observed==="string" ? observed.slice(-65536) : "";
  const marker="Bostan server failed to start";
  const markerOffset=content.lastIndexOf(marker);
  const found=markerOffset>=0;
  let cause="unclassified",type="unclassified",code="unclassified",
    serialized=false,prettyFallback=false;
  const codes=new Set(["ECONNREFUSED","ECONNRESET","ETIMEDOUT","EPIPE",
    "ENOTFOUND","ENOENT","EACCES","ERR_MODULE_NOT_FOUND",
    "ERR_UNSUPPORTED_ESM_URL_SCHEME","57P01","08006","28P01","42P01"]);
  const types=new Set(["Error","TypeError","SyntaxError","ReferenceError",
    "RangeError","PostgresError","AggregateError","DatabaseError"]);
  const classifyMessage=(message)=>{
    if(/(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|connection|connect|socket|postgres|database|terminated)/i.test(message))
      return "database_or_transport";
    if(/(?:module|package|import|cannot find)/i.test(message))
      return "module_or_dependency";
    if(/(?:configuration|config|environment|invalid|missing required)/i.test(message))
      return "configuration";
    return message?"other":"unclassified";
  };
  for(const line of content.split(/\r?\n/).slice(-70)) {
    if(!line.startsWith("{")||line.length>15000)continue;
    let obj;
    try{obj=JSON.parse(line);}catch{continue}
    if(obj?.msg!==marker)continue;
    serialized=true;
    const err=obj.err&&typeof obj.err==="object"?obj.err:
      obj.error&&typeof obj.error==="object"?obj.error:{};
    if(types.has(err.type))type=err.type;
    const rawCode=typeof err.code==="string"?err.code:"";
    if(codes.has(rawCode))code=rawCode;
    cause=classifyMessage(typeof err.message==="string"?err.message.slice(0,2000):"");
    break;
  }
  if(found&&!serialized){
    // pino-pretty's development logger is ANSI-colored and multiline.
    // Search a short adjacent region for *fixed, known tokens only*.
    const context=content.slice(markerOffset,markerOffset+5000);
    const matchCode=[...codes].find(v=>new RegExp("(?:^|[^A-Z0-9_])"+v+"(?:$|[^A-Z0-9_])").test(context));
    if(matchCode)code=matchCode;
    const matchType=[...types].find(v=>new RegExp("(?:^|[^a-zA-Z])"+v+"(?:$|[^a-zA-Z])").test(context));
    if(matchType)type=matchType;
    cause=classifyMessage(context);
    prettyFallback=true;
  }
  return {schema:"bostan.private-windows-startup-failure.v1",
    startupFailureMarker:found,structuredLog:serialized,
    prettyFallback,errorType:type,allowlistedCode:code,messageCategory:cause,
    fullMessageEmitted:false,releaseQualified:false};
}

/** Do not equate an early preload stage with a stalled static import.
 * A packed server may execute startServer() and its failure catch without
 * printing any additional preload stage markers.
 */
export function classifyPrivateWindowsPackedPhase({monitor,startup}={}) {
  if(monitor?.exitCalled?.site==="packed_server" &&
     monitor.exitCalled.code===1 && startup?.startupFailureMarker===true)
    return "application_startup_failure";
  if(monitor?.uncaught) return "unhandled_exception";
  return "unclassified";
}
