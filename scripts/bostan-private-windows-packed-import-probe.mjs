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
import { fileURLToPath } from "node:url";
import { checkBostanWindowsDisk } from "./bostan-private-windows-disk-admission.mjs";
import { checkBostanWindowsMemory } from "./bostan-private-windows-memory-admission.mjs";
import { buildPrivateWindowsHttpQaEnvironment } from "./bostan-private-windows-qa-env.mjs";
import { matchingPrivateWindowsQaWave, parsePrivateWindowsQaWave } from "./bostan-private-windows-qa-wave.mjs";
import { resolvePrivateWindowsQaServerCommand } from "./bostan-private-windows-server-command.mjs";
import { observeOwnedQaChild } from "./bostan-private-windows-child-lifecycle.mjs";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const args=process.argv.slice(2);
if(args.length===0 || (args.length===1 && args[0]==="--plan")) {
  console.log(JSON.stringify({schema:"bostan.private-windows-packed-import-probe.v1",
    run:false,realDatabase:false,localhostOnly:true,
    cpuProfile:true,deadlineSeconds:36,releaseQualified:false,
    publishing:false}));
} else if(args.length===1 && args[0]==="--run") {
  try { await run(); }
  catch { console.error("BOSTAN_WINDOWS_PACKED_IMPORT_PROBE_FAILED");process.exitCode=1; }
} else {
  console.error("Usage: node scripts/bostan-private-windows-packed-import-probe.mjs [--plan|--run]");
  process.exitCode=2;
}

async function run() {
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
    child=spawn(process.execPath,[
      "--cpu-prof","--cpu-prof-dir",home,
      ...command.nodeArgs,
    ],{cwd:join(root,"server"),env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    observer=observeOwnedQaChild(child);
    // Only collect into memory, never emit raw logs, paths or network details.
    for(const stream of [child.stdout,child.stderr])stream?.on("data",part=>{
      observed=(observed+String(part)).slice(-65536);
    });
    boundedOutcome=await Promise.race([
      new Promise(ok=>child.once("close",()=>ok("child_exited"))),
      new Promise(ok=>setTimeout(()=>ok("bounded_36s"),36000)),
    ]);
  } finally {
    if(observer){
      const state=await observer.stop({graceMs:6000,forceMs:3000});
      childClosed=state.closed&&!state.spawnError;
      forced=state.forceUsed;
    }
    if(dbStub)await new Promise(ok=>dbStub.close(()=>ok()));
    const stages=[...observed.matchAll(/BOSTAN_WIN_SERVER_STAGE=(static_import_start|static_import_pending|static_import_complete|runtime_start|runtime_ready|runtime_failed)/g)];
    console.log("BOSTAN_WIN_IMPORT_ONLY_OUTCOME="+boundedOutcome);
    console.log("BOSTAN_WIN_IMPORT_ONLY_FIRST_STAGE="+(stages[0]?.[1]||"not_observed"));
    console.log("BOSTAN_WIN_IMPORT_ONLY_LAST_STAGE="+(stages.at(-1)?.[1]||"not_observed"));
    console.log("BOSTAN_WIN_IMPORT_ONLY_STAGE_COUNT="+stages.length);
    console.log("BOSTAN_WIN_IMPORT_ONLY_CHILD_CLOSED="+childClosed);
    console.log("BOSTAN_WIN_IMPORT_ONLY_FORCED="+forced);
    console.log("BOSTAN_WIN_IMPORT_ONLY_REAL_POSTGRES_USED=false");
    if(home && childClosed && !forced) {
      // CPU profile contains source URLs: summarize CATEGORIES ONLY,
      // never print or export the raw profile or personal paths.
      let counts={runtime:0,thirdParty:0,nodeInternal:0,other:0};
      try {
        const files=(await readdir(home)).filter(name=>name.endsWith(".cpuprofile"));
        if(files.length===1) {
          const profile=JSON.parse(await readFile(join(home,files[0]),"utf8"));
          const categories=new Map();
          for(const node of profile.nodes||[]){
            const url=String(node.callFrame?.url||"");
            const group=url.includes("dist-runtime")?"runtime":
              url.includes("node_modules")?"thirdParty":
              url.startsWith("node:")?"nodeInternal":"other";
            categories.set(node.id,group);
          }
          for(const sample of profile.samples||[]){
            const category=categories.get(sample)||"other";counts[category]++;
          }
        }
      }catch{console.log("BOSTAN_WIN_IMPORT_ONLY_CPU_PROFILE=unavailable");}
      console.log("BOSTAN_WIN_IMPORT_ONLY_CPU_SAMPLES="+JSON.stringify(counts));
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
