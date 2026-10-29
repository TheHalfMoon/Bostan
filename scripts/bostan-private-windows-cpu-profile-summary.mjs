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
