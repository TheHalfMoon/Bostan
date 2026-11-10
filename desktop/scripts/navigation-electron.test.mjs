import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

test("actual Electron blocks a cross-origin HTTP redirect before the target is requested", { timeout: 30000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-electron-navigation-"));
  const desktop = path.resolve(import.meta.dirname, "..");
  const binary = path.join(desktop, "node_modules/electron/dist", fs.readFileSync(path.join(desktop, "node_modules/electron/path.txt"), "utf8").trim());
  try {
    fs.writeFileSync(path.join(root, "main.cjs"), `
      const {app,BrowserWindow}=require('electron');const path=require('node:path');const http=require('node:http');
      app.setPath('userData',path.join(process.env.HOME,'profile'));app.disableHardwareAcceleration();
      app.whenReady().then(async()=>{
        const {configureWindowNavigation}=await import(${JSON.stringify(new URL("../app/policy.mjs", import.meta.url).href)});
        let targetRequests=0;
        const target=http.createServer((_req,res)=>{targetRequests++;res.end('foreign')});
        await new Promise(resolve=>target.listen(0,'127.0.0.1',resolve));
        const targetUrl='http://127.0.0.1:'+target.address().port;
        const source=http.createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:targetUrl});res.end()}else res.end('Bostan fixture')});
        await new Promise(resolve=>source.listen(0,'127.0.0.1',resolve));
        const origin='http://127.0.0.1:'+source.address().port;
        const window=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
        configureWindowNavigation(window.webContents,{getOrigin:()=>origin,openExternal:()=>{throw Error('Unexpected handoff')}});
        window.webContents.once('will-redirect',details=>{
          if(!details.defaultPrevented)app.exit(2);
          window.webContents.once('did-stop-loading',()=>{
            if(targetRequests!==0)app.exit(3);
            console.log('DESKTOP_REDIRECT_BLOCKED_WITHOUT_TARGET_REQUEST');app.exit(0);
          });
        });
        await window.loadURL(origin);
        await window.webContents.executeJavaScript("location.href='/redirect'");
      }).catch(error=>{console.error(error);app.exit(1)});
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
    assert.match(output, /DESKTOP_REDIRECT_BLOCKED_WITHOUT_TARGET_REQUEST/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
