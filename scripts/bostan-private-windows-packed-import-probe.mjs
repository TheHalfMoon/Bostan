#!/usr/bin/env node
/**
 * Opt-in, test-only native Windows packed-runtime import diagnosis.
 * A held loopback TCP stub prevents access to ANY genuine PostgreSQL server.
 * The packed child receives only an allowlisted synthetic, private QA env.
 * No raw stderr, file path, model key, profile URL, or DSN is ever printed.
 * The owned child is stopped at a hard bounded deadline. NOT an E2E pass.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { checkBostanWindowsDisk } from "./bostan-private-windows-disk-admission.mjs";
import { checkBostanWindowsMemory } from "./bostan-private-windows-memory-admission.mjs";
import { buildPrivateWindowsHttpQaEnvironment } from "./bostan-private-windows-qa-env.mjs";
import { matchingPrivateWindowsQaWave, parsePrivateWindowsQaWave } from "./bostan-private-windows-qa-wave.mjs";
import { resolvePrivateWindowsQaServerCommand } from "./bostan-private-windows-server-command.mjs";
import { observeOwnedQaChild } from "./bostan-private-windows-child-lifecycle.mjs";
import { summarizePrivateWindowsCpuProfile, summarizePrivateWindowsImportExit, summarizePrivateWindowsMonitor, summarizePrivateWindowsStartupFailure, classifyPrivateWindowsPackedPhase } from "./bostan-private-windows-cpu-profile-summary.mjs";
import {classifyPrivateWindowsImportHeartbeat} from "./bostan-private-windows-import-heartbeat-classifier.mjs";
import {admitPrivateWindowsProbeChildExit} from "./bostan-private-windows-import-probe-outcome.mjs";
import {waitForPrivateWindowsImportProbeChild} from "./bostan-private-windows-import-probe-deadline.mjs";
import {appendPrivateWindowsImportCapture} from "./bostan-private-windows-import-capture.mjs";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const args=process.argv.slice(2);
if(args.length===0 || (args.length===1 && args[0]==="--plan")) {
  console.log(JSON.stringify({schema:"bostan.private-windows-packed-import-probe.v1",
    run:false,realDatabase:false,localhostOnly:true,
    cpuProfile:true,deadlineSeconds:36,releaseQualified:false,
    publishing:false}));
} else if(args.length===1 && ["--run","--run-trace"].includes(args[0])) {
  try { await run({traceMode:args[0]==="--run-trace"}); }
  catch { console.error("BOSTAN_WINDOWS_PACKED_IMPORT_PROBE_FAILED");process.exitCode=1; }
} else {
  console.error("Usage: node scripts/bostan-private-windows-packed-import-probe.mjs [--plan|--run|--run-trace]");
  process.exitCode=2;
}

async function run({traceMode=false}={}) {
  const temp=process.env.TEMP||"";
  if(process.platform!=="win32" || !parsePrivateWindowsQaWave(basename(root),"qa") ||
     !matchingPrivateWindowsQaWave(basename(root),basename(temp)))
    throw Error("Only an owned matching native Windows synthetic QA wave is allowed");
  const scratch=await lstat(temp);
  if(!scratch.isDirectory() || scratch.isSymbolicLink())throw Error("Unsafe TEMP");
  const identity=JSON.parse(await readFile(join(root,"package.json"),"utf8"));
  if(identity.name!=="bostan" || identity.private!==true)throw Error("Unexpected repository");
  if(Object.keys(process.env).some(key=>
    /^(?:PAPERCLIP_CLOUD_|BOSTAN_CLOUD_|PAPERCLIP_MANAGED_CONFIG$|PAPERCLIP_PRIMARY_HOST$)/i.test(key)))
    throw Error("Managed cloud credentials not permitted");
  if(!checkBostanWindowsDisk({workspace:root,tempDir:temp}).allowed ||
     !checkBostanWindowsMemory().allowed)
    throw Error("Host resource admission refused");
  // Must SHA-256 admit the entire packed runtime BEFORE creating any fixture.
  const command=await resolvePrivateWindowsQaServerCommand({root,mode:"compiled"});
  let dbStub=null,home=null,marker=null,observer=null,child=null;
  let childClosed=false,observed="",boundedOutcome="not_started";
  let capture={text:"",truncated:false};
  let forced=false;
  try {
    // Hold this port for the whole run; its handler immediately destroys all
    // connections. It is impossible to contact a real local PostgreSQL on it.
    dbStub=createServer(socket=>socket.destroy());
    dbStub.listen(0,"127.0.0.1");
    await once(dbStub,"listening");
    const dbPort=dbStub.address().port;
    home=await mkdtemp(join(temp,"bostan-private-packed-import-"));
    marker=join(home,"BOSTAN_QA_OWNED");
    await writeFile(marker,"BOSTAN_PRIVATE_SYNTHETIC_ONLY\n",{mode:0o600});
    const portHolder=createServer();
    portHolder.listen(0,"127.0.0.1");
    await once(portHolder,"listening");
    const httpPort=portHolder.address().port;
    await new Promise((ok,fail)=>portHolder.close(e=>e?fail(e):ok()));
    const env=buildPrivateWindowsHttpQaEnvironment({
      inherited:process.env,home,marker,port:httpPort,
      origin:"http://127.0.0.1:"+httpPort,
      connectionString:"postgres://synthetic:synthetic@127.0.0.1:"+dbPort+"/synthetic_probe",
      secret:randomBytes(32).toString("hex"),
    });
    // Keep the existing strict guard and stage probe *before* this diagnostic
    // preload; do not change the production compiled entrypoint.
    const monitor=pathToFileURL(join(root,"scripts",
      "bostan-private-windows-packed-error-monitor.mjs")).href;
    const entry=command.nodeArgs.at(-1);
    const args=command.nodeArgs.slice(0,-1);
    child=spawn(process.execPath,[
      "--cpu-prof","--cpu-prof-dir",home,
      ...args,"--import",monitor,
      ...(traceMode?["--import",pathToFileURL(join(root,"scripts",
        "bostan-private-windows-chunk-eval-preload.mjs")).href]:[]),
      entry,
    ],{cwd:join(root,"server"),env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    observer=observeOwnedQaChild(child);
    // Only collect into memory, never emit raw logs, paths or network details.
    for(const stream of [child.stdout,child.stderr])stream?.on("data",part=>{
      capture=appendPrivateWindowsImportCapture(capture,part);
    });
    boundedOutcome=await waitForPrivateWindowsImportProbeChild(child);
  } finally {
    if(observer){
      const state=await observer.stop({graceMs:6000,forceMs:3000});
      childClosed=state.closed&&!state.spawnError;
      forced=state.forceUsed;
    }
    if(dbStub)await new Promise(ok=>dbStub.close(()=>ok()));
    observed=capture.text;
    console.log("BOSTAN_WIN_IMPORT_ONLY_TRACE_CAPTURE_TRUNCATED="+capture.truncated);
    console.log("BOSTAN_WIN_IMPORT_ONLY_COUNTS_COMPLETE="+(!capture.truncated));
    if(capture.truncated)process.exitCode=1;
    const stages=[...observed.matchAll(/BOSTAN_WIN_SERVER_STAGE=(static_import_start|static_import_pending|static_import_worker_alive|static_import_worker_pending|static_import_worker_failed|static_import_complete|runtime_start|runtime_ready|runtime_failed)/g)];
    console.log("BOSTAN_WIN_IMPORT_ONLY_OUTCOME="+boundedOutcome);
    console.log("BOSTAN_WIN_IMPORT_ONLY_FIRST_STAGE="+(stages[0]?.[1]||"not_observed"));
    console.log("BOSTAN_WIN_IMPORT_ONLY_LAST_STAGE="+(stages.at(-1)?.[1]||"not_observed"));
    console.log("BOSTAN_WIN_IMPORT_ONLY_STAGE_COUNT="+stages.length);
    if(traceMode){
      const entered=[...observed.matchAll(/(?:^|\n)BOSTAN_WIN_CHUNK_EVAL=([a-f0-9]{12})(?=\r?\n|$)/g)];
      const evalCompleted=[...observed.matchAll(/(?:^|\n)BOSTAN_WIN_CHUNK_EVAL_COMPLETE=([a-f0-9]{12})(?=\r?\n|$)/g)];
      const completedIds=new Set(evalCompleted.map(match=>match[1]));
      const unmatchedIds=[...new Set(entered.map(match=>match[1])
        .filter(id=>!completedIds.has(id)))];
      const loadStarts=[...observed.matchAll(/(?:^|\n)BOSTAN_WIN_CHUNK_LOAD_START=([a-f0-9]{12})(?=\r?\n|$)/g)];
      const loadEnds=[...observed.matchAll(/(?:^|\n)BOSTAN_WIN_CHUNK_LOAD_COMPLETE=([a-f0-9]{12})(?=\r?\n|$)/g)];
      console.log("BOSTAN_WIN_IMPORT_ONLY_CHUNK_LOAD_START_COUNT="+loadStarts.length);
      console.log("BOSTAN_WIN_IMPORT_ONLY_CHUNK_LOAD_COMPLETE_COUNT="+loadEnds.length);
      console.log("BOSTAN_WIN_IMPORT_ONLY_LAST_LOAD_START_ID="+
        (loadStarts.at(-1)?.[1]||"not_observed"));
      console.log("BOSTAN_WIN_IMPORT_ONLY_LAST_LOAD_COMPLETE_ID="+
        (loadEnds.at(-1)?.[1]||"not_observed"));
      console.log("BOSTAN_WIN_IMPORT_ONLY_CHUNK_EVAL_COUNT="+entered.length);
      console.log("BOSTAN_WIN_IMPORT_ONLY_CHUNK_EVAL_COMPLETE_COUNT="+evalCompleted.length);
      console.log("BOSTAN_WIN_IMPORT_ONLY_LAST_CHUNK_ID="+
        (entered.at(-1)?.[1]||"not_observed"));
      console.log("BOSTAN_WIN_IMPORT_ONLY_LAST_EVAL_COMPLETE_ID="+
        (evalCompleted.at(-1)?.[1]||"not_observed"));
      // Bounded digest-only candidates; truncated output may overstate unmatched.
      console.log("BOSTAN_WIN_IMPORT_ONLY_UNMATCHED_EVAL_COUNT="+unmatchedIds.length);
      console.log("BOSTAN_WIN_IMPORT_ONLY_UNMATCHED_EVAL_IDS="+
        (unmatchedIds.slice(0,4).join(",")||"not_observed"));
      console.log("BOSTAN_WIN_IMPORT_ONLY_TRACE_QUALIFIED=false");
    }
    console.log("BOSTAN_WIN_IMPORT_ONLY_HEARTBEAT="+
      JSON.stringify(classifyPrivateWindowsImportHeartbeat(observed)));
    const childExitAdmitted=admitPrivateWindowsProbeChildExit({
      outcome:boundedOutcome,exitCode:child?.exitCode,
    });
    console.log("BOSTAN_WIN_IMPORT_ONLY_CHILD_EXIT_ADMITTED="+childExitAdmitted);
    if(!childExitAdmitted)process.exitCode=1;
    console.log("BOSTAN_WIN_IMPORT_ONLY_CHILD_CLOSED="+childClosed);
    console.log("BOSTAN_WIN_IMPORT_ONLY_FORCED="+forced);
    console.log("BOSTAN_WIN_IMPORT_ONLY_REAL_POSTGRES_USED=false");
    console.log("BOSTAN_WIN_IMPORT_ONLY_SAFE_EXIT="+JSON.stringify(
      summarizePrivateWindowsImportExit({
        observed,exitCode:child?.exitCode,signal:child?.signalCode,
      })));
    console.log("BOSTAN_WIN_IMPORT_ONLY_SAFE_MONITOR="+JSON.stringify(
      summarizePrivateWindowsMonitor(observed)));
    console.log("BOSTAN_WIN_IMPORT_ONLY_SAFE_STARTUP_FAILURE="+JSON.stringify(
      summarizePrivateWindowsStartupFailure(observed)));
    console.log("BOSTAN_WIN_IMPORT_ONLY_PHASE="+classifyPrivateWindowsPackedPhase({
      monitor:summarizePrivateWindowsMonitor(observed),
      startup:summarizePrivateWindowsStartupFailure(observed),
    }));

    if(home && childClosed && !forced) {
      // CPU profile contains source URLs: summarize CATEGORIES ONLY,
      // never print or export the raw profile or personal paths.
      try {
        const files=(await readdir(home)).filter(name=>name.endsWith(".cpuprofile"));
        if(files.length!==1)throw Error("Missing single owned CPU profile");
        const profile=JSON.parse(await readFile(join(home,files[0]),"utf8"));
        const summary=summarizePrivateWindowsCpuProfile(profile);
        console.log("BOSTAN_WIN_IMPORT_ONLY_CPU_ATTRIBUTION="+JSON.stringify(summary));
      }catch{
        // Do not report a successful diagnostic when profiling output was
        // missing, truncated or malformed. Still tear down owned scratch.
        console.log("BOSTAN_WIN_IMPORT_ONLY_CPU_PROFILE=unavailable");
        process.exitCode=1;
      }
      const safe=(await lstat(home)).isDirectory() &&
        !(await lstat(home)).isSymbolicLink() &&
        await readFile(marker,"utf8")==="BOSTAN_PRIVATE_SYNTHETIC_ONLY\n";
      if(safe) {
        await rm(home,{recursive:true,force:true});
        console.log("BOSTAN_WIN_IMPORT_ONLY_OWNED_FIXTURE_CLEANED=true");
      } else {
        console.log("BOSTAN_WIN_IMPORT_ONLY_OWNED_FIXTURE_CLEANED=false");
        process.exitCode=1;
      }
    } else {
      console.log("BOSTAN_WIN_IMPORT_ONLY_OWNED_FIXTURE_CLEANED=false");
      process.exitCode=1;
    }
  }
}
