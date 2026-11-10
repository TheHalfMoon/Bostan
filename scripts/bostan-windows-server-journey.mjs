#!/usr/bin/env node
/**
 * Native Windows source-server qualification (issue #237).
 *
 * Boots `server/src/index.ts` through tsx in an isolated temporary home with
 * its own embedded PostgreSQL, offline mode, authenticated/private deployment
 * and a loopback port. Records secret-safe startup stage timings, then drives
 * a synthetic-account journey: sign-up and cookie flags, first-admin claim and
 * its conflict, and tenant isolation. Always stops the embedded cluster with
 * pg_ctl before ending the server process tree, then removes the temp home.
 *
 * Usage: node scripts/bostan-windows-server-journey.mjs [--port 43117] [--startup-seconds 420]
 *        node scripts/bostan-windows-server-journey.mjs --serve <seconds> --ready-file <path>
 * `--serve` skips the API journey and keeps the fresh, bootstrap_pending server
 * up (for browser onboarding) until the ready file is deleted or the time ends.
 * No provider keys, paid models, telemetry or external network are used.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isBostanWindowsHealthReady } from "./bostan-windows-server-health.mjs";
import { serverJourneyCommand, serverJourneyEnvironment } from "./bostan-server-journey-command.mjs";
import { proveOwnedWindowsHttpListener } from "./bostan-private-windows-http-listener-proof.mjs";
import { resolvePrivateWindowsPowerShellBinary } from "./bostan-private-windows-powershell-binary.mjs";
import { evaluateWindowsPgOrphanCheck } from "./bostan-private-windows-pg-orphan-proof.mjs";

if (process.platform !== "win32") {
  console.error("bostan-windows-server-journey: native Windows only");
  process.exit(2);
}
const args = process.argv.slice(2);
const compiled = args.includes("--compiled");
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? Number(args[index + 1]) : fallback;
};
const port = option("--port", 43117);
const serveSeconds = option("--serve", 0);
const readyIndex = args.indexOf("--ready-file");
const readyFile = readyIndex >= 0 ? args[readyIndex + 1] : null;
if (serveSeconds > 0 && !readyFile) {
  console.error("bostan-windows-server-journey: --serve requires --ready-file <path>");
  process.exit(2);
}
const startupSeconds = option("--startup-seconds", 420);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Resolve before allocating the synthetic home. Compiled mode must use plain
// Node and built workspace exports, with no tsx/development loader fallback.
const serverArgs = serverJourneyCommand(repo, compiled);
const home = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-server-journey-"));
const base = `http://127.0.0.1:${port}`;
const t0 = Date.now();
const seconds = () => ((Date.now() - t0) / 1000).toFixed(1);
const stages = [];
const results = [];
const stage = (name) => stages.push(`${seconds().padStart(6)}s ${name}`);
const result = (name, value, ok) => results.push({ name, value, ok });

const env = serverJourneyEnvironment({ home, base, port, compiled });

// Stage markers come from the server's own log lines; nothing else is kept.
const markers = [
  [/offline mode: scheduled outbound jobs are suppressed/, "server module graph loaded (first log line)"],
  [/Using embedded PostgreSQL/, "embedded PostgreSQL selected"],
  [/Applying \d+ pending migrations/, "migrations started"],
  [/Embedded PostgreSQL ready/, "embedded PostgreSQL ready"],
  [/Server listener bound/, "HTTP listener bound"],
];
const seenMarkers = new Set();
const server = spawn(process.execPath, serverArgs,
  { cwd: path.join(repo, "server"), env, windowsHide: true });
stage("server process spawned");
stage(`server mode: ${compiled ? "compiled (plain Node)" : "source (tsx)"}`);
let exited = null;
server.on("error", () => { exited = 1; stage("server spawn failed"); });
server.on("exit", (code) => { exited = code ?? "signal"; stage(`server exited (code ${code})`); });
const errorCodes = new Set();
for (const stream of [server.stdout, server.stderr]) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      // Retain bounded diagnostic codes only, never raw paths or server logs.
      for (const code of line.match(/\bERR_[A-Z_]{1,80}\b/g) ?? []) {
        if (errorCodes.size < 10) errorCodes.add(code);
      }
      for (const [pattern, name] of markers) if (!seenMarkers.has(name) && pattern.test(line)) { seenMarkers.add(name); stage(name); }
    }
  });
}

async function json(response) {
  return response.json().catch(() => null);
}

async function journey() {
  let health = null;
  const deadline = Date.now() + startupSeconds * 1000;
  while (Date.now() < deadline && exited === null) {
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      health = response.status === 200 ? await json(response) : null;
      if (health?.status === "ok") break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!health || health.status === "starting") {
    result("health ready within startup budget", health?.status ?? "no answer", false);
    return;
  }
  const initialState = `${health.status}/${health.deploymentMode}/${health.deploymentExposure}/${health.bootstrapStatus}`;
  const ready = isBostanWindowsHealthReady(health);
  result("health before claim", initialState, ready);
  if (!ready) return; // Never run signup or open a browser against an unexpected listener.
  if (compiled) {
    await proveOwnedWindowsHttpListener({ port, expectedPid: server.pid, childAlive: () => exited === null });
    result("compiled HTTP listener belongs to spawned server", true, true);
  }
  stage("health ok");
  if (serveSeconds > 0) {
    fs.writeFileSync(readyFile, JSON.stringify({ url: base, bootstrapStatus: health.bootstrapStatus }));
    stage(`serving for browser onboarding (up to ${serveSeconds}s)`);
    const until = Date.now() + serveSeconds * 1000;
    while (Date.now() < until && fs.existsSync(readyFile) && exited === null) await new Promise((resolve) => setTimeout(resolve, 1000));
    fs.rmSync(readyFile, { force: true });
    result("served until released", exited === null ? "released" : `server exited ${exited}`, exited === null);
    return;
  }
  const origin = base;
  async function signUp(tag) {
    const response = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email: `qa-${tag}-${randomBytes(4).toString("hex")}@example.test`, password: `Pw-${randomBytes(12).toString("hex")}`, name: `QA ${tag}` }),
    });
    const cookies = response.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.includes("session_token"));
    const flags = session ? session.split(";").slice(1).map((part) => part.trim().split("=")[0].toLowerCase()) : [];
    result(`sign-up ${tag}`, `${response.status}; flags=${flags.sort().join(",")}`, response.status === 200 && flags.includes("httponly") && flags.includes("samesite"));
    return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  }
  const a = await signUp("a");
  const session = await json(await fetch(`${base}/api/auth/get-session`, { headers: { cookie: a, origin } }));
  result("session resolves user", Boolean(session?.user), Boolean(session?.user));
  const anonymous = await fetch(`${base}/api/bootstrap/claim`, { method: "POST", headers: { origin } });
  result("anonymous first-admin claim refused", anonymous.status, anonymous.status === 401);
  const claimA = await fetch(`${base}/api/bootstrap/claim`, { method: "POST", headers: { cookie: a, origin } });
  result("first-admin claim", claimA.status, claimA.status === 200 && (await json(claimA))?.claimed === true);
  const b = await signUp("b");
  const claimB = await fetch(`${base}/api/bootstrap/claim`, { method: "POST", headers: { cookie: b, origin } });
  result("second claim conflicts", claimB.status, claimB.status === 409);
  const after = await json(await fetch(`${base}/api/health`));
  result("bootstrap ready after claim", after?.bootstrapStatus, after?.bootstrapStatus === "ready");

  const created = await fetch(`${base}/api/companies`, { method: "POST", headers: { cookie: a, origin, "content-type": "application/json" }, body: JSON.stringify({ name: "QA Tenant A" }) });
  const company = await json(created);
  result("tenant A creates company", created.status, created.status === 201 && Boolean(company?.id));
  if (!company?.id) return;
  const own = await fetch(`${base}/api/companies/${company.id}`, { headers: { cookie: a, origin } });
  result("tenant A reads own company", own.status, own.status === 200);
  const foreign = await fetch(`${base}/api/companies/${company.id}`, { headers: { cookie: b, origin } });
  result("tenant B cannot read A's company", foreign.status, foreign.status === 403 || foreign.status === 404);
  const list = await fetch(`${base}/api/companies`, { headers: { cookie: b, origin } });
  const leaked = JSON.stringify(await json(list) ?? "").includes(company.id);
  result("tenant B list excludes A's company", `${list.status}; leaked=${leaked}`, list.status === 200 && !leaked);
  const anon = await fetch(`${base}/api/companies/${company.id}`, { headers: { origin } });
  result("anonymous company read refused", anon.status, anon.status === 401);
}

function cleanup() {
  const pgCtl = path.join(repo, "node_modules", ".pnpm", "@embedded-postgres+windows-x64@18.1.0-beta.16", "node_modules",
    "@embedded-postgres", "windows-x64", "native", "bin", "pg_ctl.exe");
  const markersFound = [];
  (function walk(dir, depth) {
    if (depth > 7) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name === "postmaster.pid") markersFound.push(full);
    }
  })(home, 0);
  for (const marker of markersFound) {
    try {
      execFileSync(pgCtl, ["-D", path.dirname(marker), "-m", "fast", "-w", "-t", "40", "stop"], { windowsHide: true, stdio: "ignore" });
      stage("embedded PostgreSQL stopped with pg_ctl");
    } catch {
      stage("pg_ctl stop FAILED; temp home retained");
      return false;
    }
  }
  if (exited === null) {
    try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {}
    stage("server process tree stopped");
  }
  try {
    process.kill(server.pid, 0);
    stage("server still alive; temporary home retained");
    return false;
  } catch (error) {
    if (error.code !== "ESRCH") return false;
  }
  try {
    const scan = spawnSync(resolvePrivateWindowsPowerShellBinary(), [
      "-NoProfile", "-NonInteractive", "-File", path.join(repo, "scripts/bostan-native-windows-postgres-no-orphans.ps1"), "-Run",
    ], { windowsHide: true, encoding: "utf8", timeout: 15000, maxBuffer: 8192 });
    if (!evaluateWindowsPgOrphanCheck({
      status: scan.status, signal: scan.signal, errorCode: scan.error?.code,
      stdout: scan.stdout, stderr: scan.stderr,
    }).noOrphanPostgresProcessVerified) throw new Error();
    result("independent PostgreSQL orphan scans", "3 clean snapshots", true);
  } catch {
    stage("PostgreSQL orphan verification FAILED; temporary home retained");
    return false;
  }
  fs.rmSync(home, { recursive: true, force: true });
  stage("temporary home removed");
  return true;
}

let failed = false;
try {
  await journey();
} catch (error) {
  result("journey completed", String(error?.message ?? error).slice(0, 200), false);
} finally {
  if (!cleanup()) failed = true;
}
console.log("Stages:");
if (errorCodes.size) console.log("Startup error codes: " + [...errorCodes].join(", "));
for (const line of stages) console.log(`  ${line}`);
console.log("Checks:");
for (const check of results) {
  console.log(`  ${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.value}`);
  if (!check.ok) failed = true;
}
console.log(failed ? "BOSTAN_WINDOWS_SERVER_JOURNEY_FAIL" : "BOSTAN_WINDOWS_SERVER_JOURNEY_PASS");
process.exit(failed ? 1 : 0);
