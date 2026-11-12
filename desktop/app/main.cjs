const { app, BrowserWindow, dialog, utilityProcess, Menu, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const diagnostics = require("./startup-diagnostics.cjs");

app.setName("Bostan");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window;
  let child;
  let exited = false;
  let quitting = false;
  let stopping = false;
  let shutdownTimer;

  app.on("second-instance", () => {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.show(); window.focus();
    }
  });

  async function freePort() {
    const { selectLoopbackPort } = await import("./loopback-port.mjs");
    return selectLoopbackPort();
  }

  async function start() {
    const { desktopEnvironment, configureWindowNavigation } = await import("./policy.mjs");
    const { protectDataDirectory } = await import("./data-directory.mjs");
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "Bostan", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] },
      { role: "editMenu" },
      { label: "View", submenu: [{ role: "reload" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] },
      { role: "windowMenu" },
    ]));
    let origin = null;
    window = new BrowserWindow({
      title: "Bostan", width: 1280, height: 840, minWidth: 720, minHeight: 480,
      icon: path.join(__dirname, "bostan.ico"),
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    configureWindowNavigation(window.webContents, {
      getOrigin: () => origin,
      openExternal: url => { void shell.openExternal(url).catch(() => dialog.showErrorBox("Could not open browser", "Open your browser and retry the provider's sign-in from Bostan.")); },
    });
    // Keep a reachable window while the backend drains. A failed shutdown must
    // leave the user able to retry or inspect the still-running application.
    window.on("close", event => {
      if (!quitting && child && !exited) { event.preventDefault(); app.quit(); }
    });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
    await window.loadFile(path.join(__dirname, "starting.html"));
    console.info(diagnostics.startupPhaseLine("window_loaded"));
    if (quitting) return;
    const dataDir = path.join(app.getPath("userData"), "data");
    protectDataDirectory(dataDir);
    console.info(diagnostics.startupPhaseLine("data_protected"));
    const runtimeRoot = app.isPackaged ? path.join(process.resourcesPath, "runtime") : path.resolve(__dirname, "../../server");
    if (app.isPackaged && process.platform === "win32") {
      const { restoreRuntimeLinks } = await import("./runtime-links.mjs");
      restoreRuntimeLinks(runtimeRoot);
    }
    if (!fs.existsSync(path.join(runtimeRoot, "dist/index.js")) || !fs.existsSync(path.join(runtimeRoot, "ui-dist/index.html"))) {
      throw Object.assign(new Error("Bostan compiled server or interface is missing. Reinstall the application."), { code: "RUNTIME_MISSING" });
    }
    console.info(diagnostics.startupPhaseLine("runtime_valid"));
    const port = await freePort();
    if (quitting) return;
    child = utilityProcess.fork(path.join(__dirname, "server-child.mjs"), [], {
      cwd: runtimeRoot,
      env: { ...desktopEnvironment({ dataDir, port }), BOSTAN_DESKTOP_SERVER_ROOT: runtimeRoot },
      stdio: "ignore", serviceName: "Bostan local server",
    });
    console.info(diagnostics.startupPhaseLine("child_spawned"));
    child.once("exit", () => {
      exited = true;
      if (!quitting && !stopping) {
        console.error(diagnostics.startupFailureLine("BACKEND_EXITED"));
        dialog.showErrorBox("Bostan stopped", "The local backend stopped unexpectedly. Your data is retained. Reopen Bostan to recover.");
        app.quit();
      }
    });
    child.on("message", message => {
      if (message?.type === "shutdown-failed" && stopping) {
        clearTimeout(shutdownTimer); stopping = false;
        dialog.showErrorBox("Bostan could not stop", "The backend did not confirm a clean shutdown. Your data is retained. Close Bostan again to retry.");
        if (window && !window.isDestroyed()) { window.show(); window.focus(); }
      }
    });
    const actualPort = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Object.assign(new Error("Bostan startup did not complete. Your data is retained."), { code: "STARTUP_TIMEOUT" })), 180_000);
      child.on("message", message => {
        if (message?.type === "startup-phase") {
          const line = diagnostics.startupPhaseLine(message.phase);
          if (line) console.info(line);
        } else if (message?.type === "ready" && Number.isSafeInteger(message.port) && message.port > 0 && message.port <= 65535) {
          clearTimeout(timer); resolve(message.port);
        } else if (message?.type === "startup-failed") {
          clearTimeout(timer); reject(Object.assign(new Error("Bostan could not initialize its local backend. Your data is retained."), { code: diagnostics.startupCode(message.code) }));
        }
      });
      child.once("exit", () => { clearTimeout(timer); reject(Object.assign(new Error("Bostan backend exited during startup."), { code: "BACKEND_EXITED" })); });
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
    shutdownTimer = setTimeout(() => {
      stopping = false;
      dialog.showErrorBox("Bostan is still stopping", "The backend has not confirmed a clean shutdown. Your data is retained. Close Bostan again to retry.");
    }, 60_000);
    child.once("exit", () => {
      clearTimeout(shutdownTimer); quitting = true; app.quit();
    });
    child.postMessage({ type: "shutdown" });
  });

  app.whenReady().then(start).catch(error => {
    console.error(diagnostics.startupFailureLine(error?.code));
    dialog.showErrorBox("Bostan could not start", error.message);
    app.quit();
  });
}
