import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import diagnostics from "../app/startup-diagnostics.cjs";

for (const useBundledEntry of [false, true]) for (const failStartup of [false, true, "postgres", "no-callback", "early-ack", "shutdown-during-failure"]) {
test(`actual Electron Node child preserves startup contract (bundled=${useBundledEntry}, case=${failStartup})`, { timeout: 30000 }, async () => {
  const expectedFailure = failStartup === true || failStartup === "postgres" || failStartup === "no-callback" || failStartup === "shutdown-during-failure";
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "bostan-electron-child-test-"));
  const desktop = path.resolve(import.meta.dirname, "..");
  const electronPackage = JSON.parse(fs.readFileSync(path.join(desktop, "node_modules/electron/package.json"), "utf8"));
  const binary = path.join(desktop, "node_modules/electron/dist", fs.readFileSync(path.join(desktop, "node_modules/electron/path.txt"), "utf8").trim());
  assert.equal(electronPackage.version, "45.2.3");
  try {
    fs.mkdirSync(path.join(root, "runtime/dist"), { recursive: true });
    fs.writeFileSync(path.join(root, "runtime/package.json"), JSON.stringify({ type: "module" }));
    fs.mkdirSync(path.join(root, "runtime/node_modules/@bostan/fixture"), { recursive: true });
    fs.writeFileSync(path.join(root, "runtime/node_modules/@bostan/fixture/package.json"), JSON.stringify({ type: "module", exports: { "bostan-compiled": "./compiled.js", default: "./source-is-unavailable.ts" } }));
    fs.writeFileSync(path.join(root, "runtime/node_modules/@bostan/fixture/compiled.js"), "export const value = 'compiled';");
    const serverModule = `
      import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
      import {spawnSync} from 'node:child_process'; import {value} from '@bostan/fixture';
      export async function startServer(options = {}) {
        if (options.embeddedPostgresRuntimeRoot !== process.env.BOSTAN_DESKTOP_SERVER_ROOT) throw Error('Installed runtime root was not forwarded');
        options.onStartupProgress?.('server_start_entered');
        options.onStartupProgress?.('config_loaded');
        ${failStartup === "postgres" ? 'const cause = Object.assign(new TypeError("SYNTHETIC_PRIVATE_CAUSE"), {code:"ENOENT"}); const error = Object.assign(new Error("Postgres init script exited with code 1. Recent embedded Postgres logs: Library not loaded: /private/SYNTHETIC_PRIVATE_BACKEND_MESSAGE/lib.dylib", {cause}), {code:"POSTGRES_INIT_FAILED"}); throw error;' : failStartup === true || failStartup === "shutdown-during-failure" || failStartup === "no-callback" ? 'const cause = Object.assign(new TypeError("SYNTHETIC_PRIVATE_CAUSE"), {code:"ENOENT"}); const error = Object.assign(new Error("SYNTHETIC_PRIVATE_BACKEND_MESSAGE", {cause}), {code:"SYNTHETIC_PRIVATE_CODE"}); if (' + JSON.stringify(failStartup !== "no-callback") + ') options.onStartupFailure?.("SERVER_STARTUP_FAILED", undefined, error); throw error;' : ''}
        if(value!=='compiled')throw Error('Wrong export');
        const sub=spawnSync(process.execPath,['--input-type=module','-e',"import {value} from '@bostan/fixture'; console.log(value,process.versions.node)"],{
          cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),encoding:'utf8',timeout:5000,windowsHide:true
        });
        if(sub.status!==0)throw Error('Embedded Node subprocess failed');
        fs.writeFileSync(path.join(process.env.HOME,'subprocess'),sub.stdout.trim());
        await new Promise(resolve=>setTimeout(resolve,250));
        return { listenPort:43117, shutdown:async()=>fs.writeFileSync(path.join(process.env.HOME,'stopped'),'clean') };
      }
    `;
    if (useBundledEntry) {
      fs.mkdirSync(path.join(root, "runtime/dist-runtime"), { recursive: true });
      fs.writeFileSync(path.join(root, "runtime/dist-runtime/server.mjs"), serverModule);
      fs.writeFileSync(path.join(root, "runtime/dist/index.js"), "throw new Error('DIST_ENTRY_SHOULD_NOT_BE_USED');\n");
    } else {
      fs.writeFileSync(path.join(root, "runtime/dist/index.js"), serverModule);
    }
    const childModule = fileURLToPath(new URL("../app/server-child.mjs", import.meta.url));
    fs.writeFileSync(path.join(root, "main.cjs"), `
      const {app,utilityProcess}=require('electron'); const path=require('node:path');
      app.setPath('userData',path.join(process.env.HOME,'profile'));
      app.disableHardwareAcceleration();
      app.whenReady().then(()=>{
        const child=utilityProcess.fork(${JSON.stringify(childModule)},[],{
          stdio:'pipe',
          env:{...process.env,BOSTAN_DESKTOP_SERVER_ROOT:path.join(process.env.HOME,'runtime'),BOSTAN_DESKTOP_PACKAGED:'1'}
        });
        child.stderr.on('data',chunk=>process.stderr.write(chunk));
        child.on('message',message=>{
          console.log(JSON.stringify(message));
          if(message?.type==='startup-failed')child.postMessage({type:'startup-failure-ack'});
          if(message?.type==='ready')child.postMessage({type:'shutdown'});
          if(${JSON.stringify(failStartup === "early-ack")} && message?.type==='startup-phase' && message.phase==='importing_server')
            child.postMessage({type:'startup-failure-ack'});
          if(${JSON.stringify(failStartup === "shutdown-during-failure")} && message?.type==='startup-phase' && message.phase==='importing_server')
            child.postMessage({type:'shutdown'});
        });
        child.on('exit',code=>{console.log('CHILD_EXIT='+code);app.exit(code)});
      });
    `);
    const env = { ...process.env, HOME: root, USERPROFILE: root, APPDATA: path.join(root, "AppData/Roaming"), LOCALAPPDATA: path.join(root, "AppData/Local") };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
    const child = spawn(binary, [path.join(root, "main.cjs")], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
    const timer = setTimeout(() => child.kill(), 20000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer);
    assert.equal(code, expectedFailure ? 1 : 0, output);
    const phases = output.split(/\r?\n/).filter(line => line.startsWith('{"type":"startup-phase"')).map(line => JSON.parse(line).phase);
    assert.deepEqual(phases, expectedFailure ? ["utility_bootstrap", "importing_server", "starting_server"] : ["utility_bootstrap", "importing_server", "starting_server", "ready"]);
    const entries = output.split(/\r?\n/).filter(line => line.startsWith('{"type":"startup-entry"')).map(line => JSON.parse(line));
      assert.deepEqual(entries, [
        { type: "startup-entry", stage: "server_start_entered" },
        { type: "startup-entry", stage: "config_loaded" },
      ]);
    assert.equal(diagnostics.isStartupDiagnosticLine(diagnostics.startupEntryLine(entries[0].stage)), true);
    if (expectedFailure) {
      const failure = output.split(/\r?\n/).filter(line => line.startsWith('{"type":"startup-failed"')).map(line => JSON.parse(line));
      assert.equal(failure.length, 1);
      assert.equal(failure[0].code, failStartup === "postgres" ? "POSTGRES_LIBRARY_MISSING" : failStartup === "no-callback" ? "STARTUP_FAILED" : "SERVER_STARTUP_FAILED");
      assert.match(failure[0].site, /^BOSTAN_DESKTOP_STARTUP_SITE server:[1-9]\d*:[1-9]\d*$/);
      assert.match(failure[0].context, /^BOSTAN_DESKTOP_STARTUP_CONTEXT entry=yes callback=(?:yes|no) error=(?:Error:OTHER|Error:POSTGRES_INIT_FAILED) causes=TypeError:ENOENT$/);
      assert.equal(diagnostics.isStartupDiagnosticLine(failure[0].context), true);
      assert.equal(failure[0].context.includes("SYNTHETIC_PRIVATE"), false);
      assert.equal(failure[0].context.includes("private"), false);
      assert.equal(failure[0].context.includes("/private"), false);
      assert.equal(failure[0].context.includes("SYNTHETIC_PRIVATE_CODE"), false);
      assert.equal(failure[0].context.includes("SYNTHETIC_PRIVATE_CAUSE"), false);
      assert.equal(failure[0].context.includes("ENOENT"), true);
      assert.equal(failure[0].context.includes(`callback=${failStartup === "no-callback" || failStartup === "postgres" ? "no" : "yes"}`), true);
      assert.equal(output.includes('{"type":"shutdown-failed"}'), false);
      assert.equal(output.includes("SYNTHETIC_PRIVATE_BACKEND_MESSAGE"), false);
    } else {
      assert.match(output, /CHILD_EXIT=0/);
      assert.equal(fs.readFileSync(path.join(root, "stopped"), "utf8"), "clean");
      assert.equal(fs.readFileSync(path.join(root, "subprocess"), "utf8"), "compiled 24.22.2");
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
}
