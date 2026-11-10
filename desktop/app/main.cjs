const { app, BrowserWindow, dialog, utilityProcess, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

app.setName("Bostan");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  let child;
  let exited = false;
  let quitting = false;
  let stopping = false;

  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });

  async function freePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = server.address().port;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
  }

  async function start() {
    const { desktopEnvironment, isApplicationNavigation } = await import("./policy.mjs");
    const { protectDataDirectory } = await import("./data-directory.mjs");
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "Bostan", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] },
      { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
    ]));
    let origin = null;
    window = new BrowserWindow({
      title: "Bostan", width: 1280, height: 840, minWidth: 720, minHeight: 480,
      icon: path.join(__dirname, "bostan.ico"),
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (!isApplicationNavigation(url, origin)) event.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
    await window.loadFile(path.join(__dirname, "starting.html"));
    if (quitting) return;
    const dataDir = path.join(app.getPath("userData"), "data");
    protectDataDirectory(dataDir);
    const runtimeRoot = app.isPackaged ? path.join(process.resourcesPath, "runtime") : path.resolve(__dirname, "../../server");
    if (app.isPackaged && process.platform === "win32") {
      const { restoreRuntimeLinks } = await import("./runtime-links.mjs");
      restoreRuntimeLinks(runtimeRoot);
    }
    if (!fs.existsSync(path.join(runtimeRoot, "dist/index.js")) || !fs.existsSync(path.join(runtimeRoot, "ui-dist/index.html"))) {
      throw new Error("Bostan compiled server or interface is missing. Reinstall the application.");
    }
    const port = await freePort();
    if (quitting) return;
    child = utilityProcess.fork(path.join(__dirname, "server-child.mjs"), [], {
      cwd: runtimeRoot,
      env: { ...desktopEnvironment({ dataDir, port }), BOSTAN_DESKTOP_SERVER_ROOT: runtimeRoot },
      stdio: "ignore", serviceName: "Bostan local server",
    });
    child.once("exit", () => {
      exited = true;
      if (!quitting && !stopping) {
        dialog.showErrorBox("Bostan stopped", "The local backend stopped unexpectedly. Your data is retained. Reopen Bostan to recover.");
        app.quit();
      }
    });
    const actualPort = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Bostan startup did not complete. Your data is retained.")), 180_000);
      child.on("message", message => {
        if (message?.type === "ready" && Number.isSafeInteger(message.port) && message.port > 0 && message.port <= 65535) {
          clearTimeout(timer); resolve(message.port);
        } else if (message?.type === "startup-failed") {
          clearTimeout(timer); reject(new Error("Bostan could not initialize its local backend. Your data is retained."));
        }
      });
      child.once("exit", () => { clearTimeout(timer); reject(new Error("Bostan backend exited during startup.")); });
    });
    origin = `http://127.0.0.1:${actualPort}`;
    await window.loadURL(origin);
    window.show();
  }

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", event => {
    if (quitting) return;
    if (!child || exited) { quitting = true; return; }
    event.preventDefault();
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => {
      stopping = false;
      dialog.showErrorBox("Bostan is still stopping", "The backend has not confirmed a clean shutdown. Your data is retained. Close Bostan again to retry.");
    }, 60_000);
    child.once("exit", () => {
      clearTimeout(timer); quitting = true; app.quit();
    });
    child.postMessage({ type: "shutdown" });
  });

  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox("Bostan could not start", error.message);
    app.quit();
  });
}
