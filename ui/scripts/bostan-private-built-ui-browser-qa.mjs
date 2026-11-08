#!/usr/bin/env node
/**
 * Opt-in, zero-cost REAL Chromium first paint of built Bostan Vite assets.
 * The only server is a directly owned Vite preview on ephemeral loopback.
 * No HTTP from this test can reach third-party hosts; Playwright blocks it.
 * This is NOT proof of an authenticated app journey or a deployable release.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { lstat, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL("../../",import.meta.url));
const args=process.argv.slice(2);
if(args.length===0 || (args.length===1 && args[0]==="--plan")) {
  console.log(JSON.stringify({schema:"bostan.private-vite-browser-qa.v1",
    realChromium:true,requiresBuiltUi:true,syntheticOnly:true,
    localhostOnly:true,externalRequestsAllowed:false,
    publishing:false,releaseQualified:false,run:false}));
} else if(args.length===1 && args[0]==="--run") {
  try { await run(); }
  catch { console.error("BOSTAN_PRIVATE_UI_CHROMIUM_QA_FAILED");process.exitCode=1; }
} else {
  console.error("Usage: node ui/scripts/bostan-private-built-ui-browser-qa.mjs [--plan|--run]");
  process.exitCode=2;
}

async function run() {
  if(process.platform!=="darwin" || !/^Bostan-B[0-9]{3}-qa$/i.test(basename(root)))
    throw Error("Only an owned Mac Bostan QA checkout is supported");
  const identity=JSON.parse(await readFile(join(root,"package.json"),"utf8"));
  if(identity.name!=="bostan" || identity.private!==true)
    throw Error("Unexpected repository identity");
  const dist=await lstat(join(root,"ui","dist","index.html"));
  if(!dist.isFile() || dist.isSymbolicLink())
    throw Error("Vite production UI has not been prepared");
  const executable=join(root,"ui","node_modules","vite","bin","vite.js");
  const vite=await lstat(executable);
  if(!vite.isFile() || vite.isSymbolicLink())
    throw Error("Local pinned Vite executable missing");
  const browserRoot=join(root,".qa-playwright-browsers");
  const browserDir=await lstat(browserRoot);
  if(!browserDir.isDirectory() || browserDir.isSymbolicLink())
    throw Error("QA-only Chromium installation required");
  // Avoid sending any inherited provider credentials or cloud configuration
  // into the served Vite preview process.
  const forwarded={CI:"true",DO_NOT_TRACK:"1",OTEL_SDK_DISABLED:"true"};
  for(const key of ["PATH","HOME","TMPDIR","SystemRoot","WINDIR","ComSpec","PATHEXT"]) {
    if(typeof process.env[key]==="string")forwarded[key]=process.env[key];
  }
  const listener=createServer();
  listener.listen(0,"127.0.0.1");
  await once(listener,"listening");
  const port=listener.address().port;
  await new Promise((ok,fail)=>listener.close(e=>e?fail(e):ok()));
  const origin="http://127.0.0.1:"+port;
  const child=spawn(process.execPath,[
    executable,"preview","--host","127.0.0.1","--port",String(port),"--strictPort",
  ],{cwd:join(root,"ui"),env:forwarded,stdio:["ignore","ignore","ignore"]});
  let closed=false,spawnError=false;
  const closePromise=new Promise(resolve=>child.once("close",()=>{
    closed=true;resolve();
  }));
  child.on("error",()=>{spawnError=true;});
  try {
    let ready=false;
    for(let i=0;i<60 && !closed && !spawnError;i++) {
      try {
        const result=await fetch(origin+"/",{signal:AbortSignal.timeout(800)});
        if(result.status===200){ready=true;break;}
      }catch{}
      await new Promise(ok=>setTimeout(ok,200));
    }
    if(!ready)throw Error("Owned localhost preview not ready");
    console.log("BOSTAN_PRIVATE_UI_VITE_PREVIEW_HTTP_200");
    process.env.PLAYWRIGHT_BROWSERS_PATH=browserRoot;
    const {verifyLocalBrowser}=await import("./bostan-private-staged-browser.mjs");
    const proof=await verifyLocalBrowser(origin+"/");
    if(proof.qualified!==true || proof.jsErrors!==0 || proof.externalRequests!==0 ||
       proof.title!=="Bostan")throw Error("Native Chromium qualification failed");
    console.log(JSON.stringify(proof));
    console.log("BOSTAN_PRIVATE_MAC_CHROMIUM_FIRST_PAINT_QUALIFIED");
  } finally {
    if(!closed)child.kill("SIGTERM");
    await Promise.race([closePromise,new Promise(ok=>setTimeout(ok,5000))]);
    if(!closed)child.kill("SIGKILL");
    await Promise.race([closePromise,new Promise(ok=>setTimeout(ok,5000))]);
    console.log("BOSTAN_PRIVATE_UI_OWNED_PREVIEW_CLOSED="+closed);
    if(!closed)process.exitCode=1;
  }
}
