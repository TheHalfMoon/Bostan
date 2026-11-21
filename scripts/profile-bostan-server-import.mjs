import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const runtimeRoot = path.resolve(process.argv[2] || path.join(repo, "desktop", "dist", "win-unpacked", "resources", "runtime"));
const mode = process.argv[3] || "both";
const entryRelative = process.env.BOSTAN_IMPORT_PROFILE_ENTRY || "dist/index.js";
const timeLimitMs = 600_000;
const tempRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, "bostan-import-profile-"));
const appData = path.join(profile, "AppData", "Roaming");
const localAppData = path.join(profile, "AppData", "Local");
const temp = path.join(profile, "Temp");
for (const dir of [appData, localAppData, temp]) fs.mkdirSync(dir, { recursive: true });

const probePath = path.join(profile, "probe.mjs");
const mainPath = path.join(profile, "main.cjs");
const appDataJson = JSON.stringify(appData);
const probeSource = `
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import inspector from "node:inspector";

const profileEnabled = process.argv.includes("--profile");
const cpuEnabled = process.argv.includes("--cpu");
const startedAt = performance.now();
const before = { rss: process.memoryUsage().rss, heap: process.memoryUsage().heapUsed, cpu: process.cpuUsage() };
const graph = new Map();
const moduleTimes = new Map();
const packageStats = new Map();
const moduleStats = new Map();
let resolveCalls = 0, resolveMs = 0, loadCalls = 0, loadMs = 0, loadedBytes = 0, evalCount = 0;
const groupOf = (url) => {
  if (url.startsWith("node:")) return "node_builtin";
  if (!url.startsWith("file:")) return "other";
  const file = fileURLToPath(url).replaceAll("\\\\", "/");
  const dep = file.lastIndexOf("/node_modules/");
  if (dep >= 0) {
    let rest = file.slice(dep + 14);
    const parts = rest.split("/");
    const name = parts[0]?.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    return "npm:" + (name || "unknown");
  }
  const runtimeRoot = process.env.BOSTAN_DESKTOP_SERVER_ROOT.replaceAll("\\\\", "/");
  return file.includes(runtimeRoot + "/dist/") || file.includes(runtimeRoot + "/dist-runtime/")
    ? "server_dist" : file.includes("/packages/") ? "workspace_package" : "other_file";
};
const labelOf = (url) => {
  if (!url.startsWith("file:")) return url.startsWith("node:") ? "node:" + url.slice(5) : "other";
  const file = fileURLToPath(url).replaceAll("\\\\", "/");
  const dep = file.lastIndexOf("/node_modules/");
  if (dep >= 0) {
    const parts = file.slice(dep + 14).split("/");
    const count = parts[0]?.startsWith("@") ? 2 : 1;
    return "npm:" + parts.slice(0, count + 2).join("/");
  }
  const server = file.lastIndexOf("/server/dist/");
  if (server >= 0) return "server:" + file.slice(server + 13);
  const packages = file.lastIndexOf("/packages/");
  if (packages >= 0) return "workspace:" + file.slice(packages + 10).split("/").slice(0, 5).join("/");
  const runtimeRoot = process.env.BOSTAN_DESKTOP_SERVER_ROOT.replaceAll("\\\\", "/");
  for (const relativeRoot of ["/dist/", "/dist-runtime/"]) {
    const runtimeDist = runtimeRoot + relativeRoot;
    if (file.includes(runtimeDist)) return "server:" + relativeRoot.slice(1, -1) + "/" + file.slice(file.indexOf(runtimeDist) + runtimeDist.length);
  }
  return "other_file";
};
globalThis.__bostanImportProfile = {
  start(url) { moduleTimes.set(url, performance.now()); },
  end(url) {
    const elapsed = performance.now() - (moduleTimes.get(url) ?? performance.now());
    const group = groupOf(url);
    const item = packageStats.get(group) ?? { count: 0, evalMs: 0, slowestMs: 0 };
    item.count++; item.evalMs += elapsed; item.slowestMs = Math.max(item.slowestMs, elapsed);
    packageStats.set(group, item); evalCount++;
    const label = labelOf(url);
    const module = moduleStats.get(label) ?? { count: 0, evalMs: 0, slowestMs: 0 };
    module.count++; module.evalMs += elapsed; module.slowestMs = Math.max(module.slowestMs, elapsed);
    moduleStats.set(label, module);
  },
};
registerHooks({
    resolve(specifier, context, nextResolve) {
      const started = profileEnabled ? performance.now() : 0;
      const result = nextResolve(specifier, context.conditions.includes("bostan-compiled") || !specifier.startsWith("@bostan/")
        ? context
        : { ...context, conditions: [...context.conditions, "bostan-compiled"] });
      if (profileEnabled) { resolveCalls++; resolveMs += performance.now() - started; }
      if (profileEnabled && context.parentURL && result.url) {
        let edges = graph.get(context.parentURL);
        if (!edges) graph.set(context.parentURL, edges = new Set());
        edges.add(result.url);
      }
      return result;
    },
    load(url, context, nextLoad) {
      if (!profileEnabled) return nextLoad(url, context);
      const started = performance.now();
      const result = nextLoad(url, context);
      loadCalls++; loadMs += performance.now() - started;
      if (result.format === "module" && result.source != null && url.startsWith("file:")) {
        const source = typeof result.source === "string" ? result.source : Buffer.from(result.source).toString("utf8");
        loadedBytes += Buffer.byteLength(source);
        const key = JSON.stringify(url);
        result.source = 'globalThis.__bostanImportProfile?.start(' + key + ');\\n' + source + '\\nglobalThis.__bostanImportProfile?.end(' + key + ');\\n';
      }
      return result;
    },
  });
const session = cpuEnabled ? new inspector.Session() : null;
if (session) { session.connect(); session.post("Profiler.enable"); session.post("Profiler.start"); }
const entry = pathToFileURL(process.env.BOSTAN_DESKTOP_SERVER_ENTRY).href;
process.env.ELECTRON_RUN_AS_NODE = "1";
process.env.NODE_OPTIONS = "--conditions=bostan-compiled";
let importError = null;
try { await import(entry); } catch (error) { importError = error?.code || error?.name || "import_failed"; }
let cpuProfile = null;
if (session) {
  const profileResult = await new Promise((resolve) => session.post("Profiler.stop", (_error, result) => resolve(result?.profile ?? null)));
  session.disconnect();
  if (profileResult) {
    const nodes = new Map(profileResult.nodes.map(node => [node.id, node]));
    const samples = new Map();
    for (let i=0;i<profileResult.samples.length;i++) {
      const id=profileResult.samples[i]; const item=samples.get(id) ?? { ticks: 0 }; item.ticks += profileResult.timeDeltas[i] ?? 0; samples.set(id,item);
    }
    cpuProfile = [...samples].map(([id,item]) => ({
      name: String(nodes.get(id)?.callFrame?.functionName || "anonymous").slice(0,80),
      category: groupOf(nodes.get(id)?.callFrame?.url || ""), selfTimeMs: Math.round(item.ticks/1000),
    })).sort((a,b)=>b.selfTimeMs-a.selfTimeMs).slice(0,20);
  }
}
const usage = process.cpuUsage(before.cpu);
const after = process.memoryUsage();
let cycleBackEdges = 0, maxImportDepth = 0;
const colors = new Map();
for (const start of graph.keys()) {
  if (colors.get(start)) continue;
  colors.set(start, 1);
  const stack = [{ url: start, edges: [...(graph.get(start) ?? [])], index: 0 }];
  while (stack.length) {
    const frame = stack.at(-1);
    maxImportDepth = Math.max(maxImportDepth, stack.length);
    if (frame.index >= frame.edges.length) { colors.set(frame.url, 2); stack.pop(); continue; }
    const target = frame.edges[frame.index++];
    const color = colors.get(target) ?? 0;
    if (color === 1) cycleBackEdges++;
    else if (color === 0) {
      colors.set(target, 1);
      stack.push({ url: target, edges: [...(graph.get(target) ?? [])], index: 0 });
    }
  }
}
const stats = {
  engine: process.versions.electron ? "electron_utility" : "node",
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron ?? null,
  profileEnabled, cpuEnabled,
  importMs: Math.round(performance.now()-startedAt),
  importError,
  cpuMs: Math.round((usage.user+usage.system)/1000),
  rssBeforeMiB: Math.round(before.rss/1048576), rssAfterMiB: Math.round(after.rss/1048576), rssGrowthMiB: Math.round((after.rss-before.rss)/1048576),
  heapBeforeMiB: Math.round(before.heap/1048576), heapAfterMiB: Math.round(after.heapUsed/1048576),
  resolveCalls: profileEnabled ? resolveCalls : null, resolveMs: profileEnabled ? Math.round(resolveMs) : null,
  loadCalls: profileEnabled ? loadCalls : null, loadMs: profileEnabled ? Math.round(loadMs) : null, loadedKiB: profileEnabled ? Math.round(loadedBytes/1024) : null,
  evaluatedModules: profileEnabled ? evalCount : null,
  topEvaluationGroups: profileEnabled ? [...packageStats].map(([group,value])=>({group,...value,evalMs:Math.round(value.evalMs),slowestMs:Math.round(value.slowestMs)})).sort((a,b)=>b.evalMs-a.evalMs).slice(0,20) : null,
  slowestModules: profileEnabled ? [...moduleStats].map(([module,value])=>({module,...value,evalMs:Math.round(value.evalMs),slowestMs:Math.round(value.slowestMs)})).sort((a,b)=>b.evalMs-a.evalMs).slice(0,20) : null,
  parentEdges: profileEnabled ? [...graph.values()].reduce((sum,set)=>sum+set.size,0) : null,
  cycleBackEdges: profileEnabled ? cycleBackEdges : null,
  maxImportDepth: profileEnabled ? maxImportDepth : null,
  cpuHotspots: cpuProfile,
};
const output = JSON.stringify(stats);
if (process.parentPort) {
  process.parentPort.on("message", ({data}) => { if (data?.type === "profile-stop") process.exit(0); });
  process.parentPort.postMessage({type:"profile-result",output});
  await new Promise(resolve => setTimeout(resolve, 20_000));
  process.exit(0);
}
console.log("BOSTAN_IMPORT_PROFILE " + output);
process.exit(importError ? 1 : 0);
`;
fs.writeFileSync(probePath, probeSource, { flag: "wx" });

const electronPackage = JSON.parse(fs.readFileSync(path.join(repo, "desktop", "node_modules", "electron", "package.json"), "utf8"));
const electronExe = path.join(repo, "desktop", "node_modules", "electron", "dist", fs.readFileSync(path.join(repo, "desktop", "node_modules", "electron", "path.txt"), "utf8").trim());
const modes = mode === "both" ? ["node", "electron"] : [mode];
const results = [];
const childEnv = {
  PATH: [path.dirname(process.execPath), path.join(process.env.SystemRoot || "C:\\Windows", "System32")].join(path.delimiter),
  SystemRoot: process.env.SystemRoot || "C:\\Windows", WINDIR: process.env.WINDIR || process.env.SystemRoot || "C:\\Windows",
  SystemDrive: process.env.SystemDrive || "C:", ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
  HOME: profile, USERPROFILE: profile, APPDATA: appData, LOCALAPPDATA: localAppData, TEMP: temp, TMP: temp,
  BOSTAN_DESKTOP_SERVER_ROOT: runtimeRoot, NODE_OPTIONS: "--conditions=bostan-compiled",
  BOSTAN_DESKTOP_SERVER_ENTRY: path.join(runtimeRoot, entryRelative),
  DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true",
};
const electronEnv = { ...childEnv };
delete electronEnv.ELECTRON_RUN_AS_NODE;
delete electronEnv.NODE_OPTIONS;

fs.writeFileSync(mainPath, `
const {app,utilityProcess}=require('electron'); const path=require('node:path');
app.setPath('userData',${appDataJson});
app.whenReady().then(()=>{
 const child=utilityProcess.fork(${JSON.stringify(probePath)},process.argv.slice(2),{env:process.env,stdio:'pipe'});
 let done=false;
 child.stderr.on('data',chunk=>console.error('UTILITY_STDERR '+String(chunk).replaceAll('\\r',' ').replaceAll('\\n',' ').slice(0,300)));
 child.on('message',message=>{if(message?.type==='profile-result'&&!done){done=true;console.log(message.output);child.postMessage({type:'profile-stop'});}});
 child.on('exit',code=>{console.log(JSON.stringify({utilityExit:code,gotResult:done}));app.exit(code??1)});
 setTimeout(()=>{if(!done){console.error('PROFILE_CHILD_TIMEOUT');child.kill();app.exit(124)}},${timeLimitMs});
});
` , { flag: "wx" });

function run(modeName, args) {
  fs.writeSync(1, `BOSTAN_IMPORT_PROFILE_BEGIN ${modeName} ${args.join("_") || "baseline"}\\n`);
  const result = spawnSync(modeName === "node" ? process.execPath : electronExe,
    modeName === "node" ? [probePath, ...args] : [mainPath, ...args],
    { env: modeName === "node" ? childEnv : electronEnv, cwd: runtimeRoot, encoding: "utf8", timeout: timeLimitMs + 60_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  if (result.error) throw result.error;
  const lines = (result.stdout || "").split(/\r?\n/).filter(line => line.startsWith(modeName === "node" ? "BOSTAN_IMPORT_PROFILE " : "{"));
  const json = modeName === "node" ? lines.at(-1)?.slice("BOSTAN_IMPORT_PROFILE ".length) : lines.find(line => line.includes('"cpuMs"'));
  if (!json) throw new Error("profile_result_missing:" + modeName + ":" + result.status + ":" + (result.stdout || "").slice(-800) + ":" + (result.stderr || "").slice(-500));
  const parsed = JSON.parse(json);
  if (parsed.importError) throw new Error("profile_import_failed:" + modeName + ":" + parsed.importError);
  if (modeName === "electron" && parsed.utilityExit !== undefined) {
    throw new Error("utility_import_result_missing:" + parsed.utilityExit + ":" + parsed.gotResult);
  }
  return parsed;
}

try {
  const electronInfo = { version: electronPackage.version };
  for (const engine of modes) {
    const baseline = run(engine, []);
    const profiled = run(engine, ["--profile"]);
    results.push({ engine: electronInfo && engine, baseline, profiled });
    if (engine === "electron") results.at(-1).cpu = run(engine, ["--cpu"]);
  }
  console.log("BOSTAN_IMPORT_PROFILE_RESULTS " + JSON.stringify(results));
} finally {
  const resolved = fs.realpathSync(profile).toLowerCase();
  if (!resolved.startsWith(tempRoot.toLowerCase() + path.sep.toLowerCase())) throw new Error("profile_cleanup_outside_temp");
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
}
