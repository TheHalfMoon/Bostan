import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("actual Electron Node child honors compiled exports and drains startup before quit", { timeout: 30000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-electron-child-test-"));
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
    fs.writeFileSync(path.join(root, "runtime/dist/index.js"), `
      import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
      import {spawnSync} from 'node:child_process'; import {value} from '@bostan/fixture';
      export async function startServer() {
        if(value!=='compiled')throw Error('Wrong export');
        const sub=spawnSync(process.execPath,['--input-type=module','-e',"import {value} from '@bostan/fixture'; console.log(value,process.versions.node)"],{
          cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),encoding:'utf8',timeout:5000,windowsHide:true
        });
        if(sub.status!==0)throw Error('Embedded Node subprocess failed');
        fs.writeFileSync(path.join(process.env.HOME,'subprocess'),sub.stdout.trim());
        await new Promise(resolve=>setTimeout(resolve,250));
        return { listenPort:43117, shutdown:async()=>fs.writeFileSync(path.join(process.env.HOME,'stopped'),'clean') };
      }
    `);
    const childModule = fileURLToPath(new URL("../app/server-child.mjs", import.meta.url));
    fs.writeFileSync(path.join(root, "main.cjs"), `
      const {app,utilityProcess}=require('electron'); const path=require('node:path');
      app.setPath('userData',path.join(process.env.HOME,'profile'));
      app.disableHardwareAcceleration();
      app.whenReady().then(()=>{
        const child=utilityProcess.fork(${JSON.stringify(childModule)},[],{
          stdio:'pipe',
          env:{...process.env,BOSTAN_DESKTOP_SERVER_ROOT:path.join(process.env.HOME,'runtime')}
        });
        child.stderr.on('data',chunk=>process.stderr.write(chunk));
        child.on('message',message=>console.log(JSON.stringify(message)));
        child.on('exit',code=>{console.log('CHILD_EXIT='+code);app.exit(code)});
        setTimeout(()=>child.postMessage({type:'shutdown'}),50);
      });
    `);
    const env = { ...process.env, HOME: root, USERPROFILE: root, APPDATA: path.join(root, "AppData/Roaming"), LOCALAPPDATA: path.join(root, "AppData/Local") };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
    const child = spawn(binary, [path.join(root, "main.cjs")], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
    const timer = setTimeout(() => child.kill(), 20000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    clearTimeout(timer);
    assert.equal(code, 0, output);
    assert.match(output, /CHILD_EXIT=0/);
    assert.equal(fs.readFileSync(path.join(root, "stopped"), "utf8"), "clean");
    assert.equal(fs.readFileSync(path.join(root, "subprocess"), "utf8"), "compiled 24.22.2");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
