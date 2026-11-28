import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("actual desktop window survives a rejected shutdown and can retry closing", { timeout: 30000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-electron-shutdown-retry-"));
  const desktop = path.resolve(import.meta.dirname, "..");
  const binary = path.join(desktop, "node_modules/electron/dist", fs.readFileSync(path.join(desktop, "node_modules/electron/path.txt"), "utf8").trim());
  try {
    fs.mkdirSync(path.join(root, "desktop"));
    fs.cpSync(path.join(desktop, "app"), path.join(root, "desktop/app"), { recursive: true, filter: source => !source.endsWith(".test.mjs") });
    fs.mkdirSync(path.join(root, "server/dist"), { recursive: true });
    fs.mkdirSync(path.join(root, "server/ui-dist"));
    fs.writeFileSync(path.join(root, "server/ui-dist/index.html"), "synthetic fixture");
    fs.writeFileSync(path.join(root, "server/package.json"), JSON.stringify({ type: "module" }));
    fs.writeFileSync(path.join(root, "server/dist/index.js"), `
      import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
      export async function startServer(){
        const server=http.createServer((_req,res)=>res.end('<title>Bostan lifecycle fixture</title>'));
        await new Promise(resolve=>server.listen(Number(process.env.PORT),'127.0.0.1',resolve));
        let attempts=0;
        return {listenPort:server.address().port,shutdown:async()=>{
          if(++attempts===1)throw Error('Synthetic shutdown failure');
          await new Promise(resolve=>server.close(resolve));
          fs.writeFileSync(path.join(process.env.HOME,'shutdown-retried'),'clean');
        }};
      }
    `);
    fs.writeFileSync(path.join(root, "main.cjs"), `
      const {app,BrowserWindow,dialog}=require('electron');const fs=require('node:fs');const path=require('node:path');
      const profile=path.join(process.env.HOME,'profile');fs.mkdirSync(profile);
      app.setPath('userData',profile);app.setPath('sessionData',profile);app.disableHardwareAcceleration();
      let requested=false,retried=false;
      dialog.showErrorBox=(title)=>{
        const window=BrowserWindow.getAllWindows()[0];
        if(title!=='Bostan could not stop'||!window||window.isDestroyed()||!window.isVisible()){console.error(title);app.exit(2);return}
        retried=true;setImmediate(()=>window.close());
      };
      app.on('browser-window-created',(_event,window)=>{
        window.webContents.on('did-finish-load',()=>{
          if(!requested&&window.webContents.getURL().startsWith('http:')){requested=true;window.close()}
        });
      });
      app.on('will-quit',()=>{
        if(!retried||!fs.existsSync(path.join(profile,'data/shutdown-retried'))){console.error('Shutdown retry missing');process.exitCode=3}
        else console.log('DESKTOP_WINDOW_RETAINED_AND_SHUTDOWN_RETRIED');
      });
      require(${JSON.stringify(path.join(root, "desktop/app/main.cjs"))});
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
    assert.match(output, /DESKTOP_WINDOW_RETAINED_AND_SHUTDOWN_RETRIED/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
