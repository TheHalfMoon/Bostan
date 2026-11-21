#!/usr/bin/env node
/** Import and real-start qualification for the compiled Electron utility server. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { desktopEnvironment } from "../desktop/app/policy.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const runtimeRoot = path.resolve(process.argv[2] || path.join(repo, "desktop/dist/win-unpacked/resources/runtime"));
const tempRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, "bostan-bundled-startup-"));
const appData = path.join(profile, "AppData", "Roaming");
const localAppData = path.join(profile, "AppData", "Local");
const dataDir = path.join(profile, "data");
const temp = path.join(profile, "Temp");
const chromiumData = path.join(profile, "chromium");
for (const directory of [appData, localAppData, dataDir, temp, chromiumData]) fs.mkdirSync(directory, { recursive: true });
const policyEnv = desktopEnvironment({
  dataDir, port: 0,
  inherited: {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    SystemDrive: process.env.SystemDrive, ComSpec: process.env.ComSpec, PATHEXT: process.env.PATHEXT,
  },
});
const portServer = net.createServer();
portServer.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => { portServer.once("listening", resolve); portServer.once("error", reject); });
const port = portServer.address().port;
await new Promise((resolve, reject) => portServer.close(error => error ? reject(error) : resolve()));
policyEnv.PORT = String(port);
policyEnv.PAPERCLIP_AUTH_PUBLIC_BASE_URL = `http://127.0.0.1:${port}`;
const env = {
  PATH: [path.dirname(process.execPath), process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32") : "C:\\Windows\\System32"].join(path.delimiter),
  SystemRoot: process.env.SystemRoot || "C:\\Windows", WINDIR: process.env.WINDIR || process.env.SystemRoot || "C:\\Windows",
  SystemDrive: process.env.SystemDrive || "C:", ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
  PATHEXT: process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD",
  HOME: profile, USERPROFILE: profile, APPDATA: appData, LOCALAPPDATA: localAppData, TEMP: temp, TMP: temp,
  DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true", BOSTAN_DESKTOP_SERVER_ROOT: runtimeRoot,
  ...policyEnv,
};
const modulePath = fileURLToPath(new URL("../desktop/app/server-child.mjs", import.meta.url));
const mainPath = path.join(profile, "main.cjs");
fs.writeFileSync(mainPath, `
const {app,utilityProcess}=require('electron');
app.disableHardwareAcceleration();
app.setPath('userData',${JSON.stringify(chromiumData)});
app.whenReady().then(()=>{
 const child=utilityProcess.fork(${JSON.stringify(modulePath)},[],{cwd:${JSON.stringify(runtimeRoot)},env:${JSON.stringify(env)},stdio:'ignore'});
 const phases=[]; let readyPhase=false, healthReady=false, shutdownRequested=false, failureCode=null, timer;
 const safeResult=exitCode=>{
   clearTimeout(timer);
   console.log('BOSTAN_BUNDLED_STARTUP_RESULT='+JSON.stringify({phases,readyPhase,healthReady,shutdownRequested,failureCode,utilityExitCode:exitCode}));
   app.exit(exitCode===0&&readyPhase&&healthReady&&shutdownRequested?0:1);
 };
 child.on('message',async message=>{
   if(message?.type==='startup-phase'&&['utility_bootstrap','importing_server','starting_server','ready'].includes(message.phase)){
     phases.push(message.phase); console.log('BOSTAN_BUNDLED_STARTUP_PHASE='+message.phase);
     if(message.phase==='ready')readyPhase=true;
   }
   if(message?.type==='ready'){
     if(!readyPhase||!Number.isSafeInteger(message.port)||message.port!==${port}){child.postMessage({type:'shutdown'});return;}
     try{
       const response=await fetch('http://127.0.0.1:'+message.port+'/api/health',{signal:AbortSignal.timeout(12000)});
       const body=await response.json().catch(()=>null);
       healthReady=response.ok&&body?.status==='ok'&&body.deploymentMode==='authenticated'&&body.deploymentExposure==='private'&&body.bootstrapStatus==='bootstrap_pending';
     }catch{}
     console.log('BOSTAN_BUNDLED_STARTUP_PRIVATE_HEALTH='+healthReady);
     shutdownRequested=true; child.postMessage({type:'shutdown'});
   }
   if(message?.type==='startup-failed'){
     failureCode=typeof message.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(message.code)?message.code:'unclassified';
     child.postMessage({type:'startup-failure-ack'});
   }
 });
 child.once('exit',safeResult);
 timer=setTimeout(()=>{failureCode='bounded_probe_timeout';child.kill()},210000);
});
` , { flag: "wx" });

try {
  const electronRoot = path.join(repo, "desktop/node_modules/electron");
  const electronPackage = JSON.parse(fs.readFileSync(path.join(electronRoot, "package.json"), "utf8"));
  assert.equal(electronPackage.version, "45.2.3");
  const electronExe = path.join(electronRoot, "dist", fs.readFileSync(path.join(electronRoot, "path.txt"), "utf8").trim());
  const result = spawnSync(electronExe, [mainPath], {
    env, cwd: runtimeRoot, encoding: "utf8", timeout: 240_000, windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024,
  });
  if (result.error) throw new Error("bundled_start_probe_process_failed:" + (result.error.code || "unknown"));
  const line = (result.stdout || "").split(/\r?\n/).find(value => value.startsWith("BOSTAN_BUNDLED_STARTUP_RESULT="));
  if (!line) throw new Error("bundled_start_probe_result_missing:" + result.status);
  const evidence = JSON.parse(line.slice("BOSTAN_BUNDLED_STARTUP_RESULT=".length));
  console.log("BOSTAN_BUNDLED_STARTUP_EVIDENCE=" + JSON.stringify(evidence));
  assert.deepEqual(evidence.phases, ["utility_bootstrap", "importing_server", "starting_server", "ready"]);
  assert.equal(evidence.readyPhase, true);
  assert.equal(evidence.healthReady, true);
  assert.equal(evidence.shutdownRequested, true);
  assert.equal(evidence.utilityExitCode, 0);
  assert.equal(result.status, 0);
  const resolvedProfile = fs.realpathSync(profile).toLowerCase();
  if (!resolvedProfile.startsWith(tempRoot.toLowerCase() + path.sep.toLowerCase())) throw new Error("profile_cleanup_outside_temp");
  fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  console.log("BOSTAN_BUNDLED_STARTUP_TEMP_PROFILE_CLEANED=true");
} catch (error) {
  console.error("BOSTAN_BUNDLED_STARTUP_TEMP_PROFILE_PRESERVED=true");
  throw error;
}
