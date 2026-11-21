import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qualifyFreeQaModel } from "./bostan-free-model-policy.mjs";
import { admitFreeOpenCodeModel } from "./bostan-opencode-free-admission.mjs";
import { nativeGovernedCaseAgentConfig } from "./bostan-governed-case-free-e2e.mjs";
import { classifyPackagedStartupProgress } from "./bostan-packaged-startup-progress.mjs";
import {
  assertHeartbeatQaSucceeded,
  buildFirstWorkerTask,
  observeHeartbeatQaStatus,
  requirePersistedRunComment,
  safeHeartbeatQaDiagnostic,
  safeHeartbeatQaEventDiagnostic,
  safeHeartbeatQaLogDiagnostic,
  safeAgentLifecycleDiagnostic,
  selectSingleAssignmentRun,
} from "./bostan-first-agent-free-e2e.mjs";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const DEFAULT_APP = path.join(REPO, "desktop", "dist", "win-unpacked");
const APP_EXE = process.env.BOSTAN_E2E_APP_EXE
  ? path.resolve(process.env.BOSTAN_E2E_APP_EXE)
  : path.join(DEFAULT_APP, "Bostan.exe");
const APP = path.dirname(APP_EXE);
const RUNTIME = path.join(APP, "resources", "runtime");
const MODEL = process.env.BOSTAN_E2E_FREE_MODEL || "opencode/hy4-flash-free";
const MARKER = "BOSTAN_CLEAN_RUN_PASS";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function requireOptIn() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("windows_x64_only");
  }
  if (process.env.BOSTAN_E2E_CONFIRM_TEMP_DATA !== "1" ||
      process.env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL !== "1") {
    throw new Error("explicit_temp_and_free_model_opt_in_required");
  }
  if (process.env.BOSTAN_E2E_APP_EXE && !path.isAbsolute(process.env.BOSTAN_E2E_APP_EXE)) {
    throw new Error("absolute_bostan_application_executable_required");
  }
  qualifyFreeQaModel(MODEL);
  const info = JSON.parse(fs.readFileSync(path.join(REPO, "desktop", "package.json"), "utf8"));
  if (info.productName !== "Bostan" || info.build?.appId !== "io.bostan.desktop") {
    throw new Error("unexpected_desktop_identity");
  }
  for (const file of [APP_EXE, path.join(RUNTIME, "dist", "index.js"), path.join(RUNTIME, "ui-dist", "index.html")]) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      throw new Error("unsafe_or_incomplete_unpacked_application");
    }
  }
  const opencode = process.env.BOSTAN_E2E_OPENCODE_EXE;
  if (!opencode || !path.isAbsolute(opencode) || !fs.lstatSync(opencode).isFile()) {
    throw new Error("absolute_native_opencode_executable_required");
  }
  return opencode;
}

function ps(script) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    encoding: "utf8", timeout: 15_000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
  });
}

function processTree(rootPid) {
  const result = ps(`$ErrorActionPreference='Stop'; $all=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId; if(-not ($all | Where-Object { [int]$_.ProcessId -eq ${rootPid} })) { ConvertTo-Json -InputObject @() -Compress; exit 0 }; $ids=[System.Collections.Generic.HashSet[int]]::new(); [void]$ids.Add(${rootPid}); do { $added=$false; foreach($p in $all) { if($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)) { $added=$true } } } while($added); ConvertTo-Json -InputObject @($ids) -Compress`);
  if (result.error || result.status !== 0) throw new Error("process_ownership_unavailable");
  const value = JSON.parse(result.stdout.trim());
  return new Set((Array.isArray(value) ? value : [value]).map(Number));
}

function verifyOwnedApplicationTree(rootPid, pids, profile) {
  const ids = [...pids].filter(Number.isSafeInteger).join(",");
  if (!ids || !pids.has(rootPid)) return false;
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const app = quote(fs.realpathSync(APP));
  const tempProfile = quote(fs.realpathSync(profile));
  const result = ps(`$ErrorActionPreference='Stop'; $ids=@(${ids}); $app=${app}.TrimEnd('\\')+'\\'; $profile=${tempProfile}.TrimEnd('\\')+'\\'; $rows=@(Get-CimInstance Win32_Process | Where-Object { $ids -contains [int]$_.ProcessId }); $valid=$rows.Count -eq $ids.Count -and @($rows | Where-Object { -not ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($app,[StringComparison]::OrdinalIgnoreCase)) -and -not ($_.CommandLine -and $_.CommandLine.IndexOf($profile,[StringComparison]::OrdinalIgnoreCase) -ge 0) }).Count -eq 0; $root=@($rows | Where-Object { [int]$_.ProcessId -eq ${rootPid} -and $_.ExecutablePath -and $_.ExecutablePath.Equals(${quote(fs.realpathSync(APP_EXE))},[StringComparison]::OrdinalIgnoreCase) }); ConvertTo-Json -InputObject @{owned=($valid -and $root.Count -eq 1);count=$rows.Count} -Compress`);
  if (result.error || result.status !== 0) return false;
  try {
    const value = JSON.parse(result.stdout.trim());
    return value.owned === true && value.count === ids.split(",").length;
  } catch { return false; }
}

async function terminateOwnedApplicationTree(child, profile) {
  const pids = processTree(child.pid);
  if (!verifyOwnedApplicationTree(child.pid, pids, profile)) {
    throw new Error("startup_cleanup_ownership_unverified");
  }
  const result = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
    encoding: "utf8", timeout: 15_000, windowsHide: true, stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) throw new Error("owned_startup_process_cleanup_failed");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processTree(child.pid).size === 0) return;
    await sleep(250);
  }
  throw new Error("owned_startup_process_exit_unverified");
}

function createStartupEvidence() {
  return {
    startedAt: Date.now(), phases: [], firstFailureCode: null,
    healthOutcome: "not_probed", ownedListenerCount: 0,
    metricsAt: 0, metrics: null, lastPhaseAt: Date.now(), lastProcessActivityAt: 0,
    lastCpuActivityAt: 0, lastMemoryChangeAt: 0, cpuActivitySamples: 0,
    memoryChangeSamples: 0, processCountChanges: 0, lastProcessCountChangeAt: 0,
  };
}

function recordStartupLine(evidence, line) {
  const phase = line.match(/^BOSTAN_DESKTOP_STARTUP_PHASE (window_loaded|data_protected|runtime_valid|child_spawned|utility_bootstrap|importing_server|starting_server|ready)$/);
  if (phase && evidence.phases.at(-1)?.phase !== phase[1]) {
    evidence.phases.push({ phase: phase[1], at: Date.now() });
    if (evidence.phases.length > 24) evidence.phases.shift();
    evidence.lastPhaseAt = Date.now();
    console.log(`BOSTAN_PACKAGED_STARTUP_PHASE ${phase[1]}`);
  }
  const failure = line.match(/^BOSTAN_DESKTOP_STARTUP_FAILURE ([A-Z0-9_]{1,80})$/);
  if (failure && !evidence.firstFailureCode) {
    evidence.firstFailureCode = failure[1];
    console.error(`BOSTAN_PACKAGED_STARTUP_FAILURE ${failure[1]}`);
  }
}

function processMetrics(pids) {
  const ids = [...pids].filter(Number.isSafeInteger).join(",");
  if (!ids) return null;
  const result = ps(`$ErrorActionPreference='Stop'; $ids=@(${ids}); $items=@(Get-Process -Id $ids -ErrorAction SilentlyContinue); $cpu=($items | Measure-Object -Property CPU -Sum).Sum; $rss=($items | Measure-Object -Property WorkingSet64 -Sum).Sum; ConvertTo-Json -InputObject @{count=$items.Count;cpuMs=[int][math]::Max(0,($cpu*1000));rssMiB=[int][math]::Max(0,($rss/1MB))} -Compress`);
  if (result.error || result.status !== 0) return null;
  try {
    const value = JSON.parse(result.stdout.trim());
    return Number.isInteger(value.count) && Number.isInteger(value.cpuMs) && Number.isInteger(value.rssMiB)
      ? value : null;
  } catch { return null; }
}

function processesReferencing(profile) {
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const result = ps(`$ErrorActionPreference='Stop'; $needle=${quote(profile)}; $ids=@(Get-CimInstance Win32_Process | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0) -or ($_.CommandLine -and $_.CommandLine.IndexOf($needle,[StringComparison]::OrdinalIgnoreCase) -ge 0) } | ForEach-Object { [int]$_.ProcessId }); ConvertTo-Json -InputObject $ids -Compress`);
  if (result.error || result.status !== 0) throw new Error("process_cleanup_verification_unavailable");
  const value = JSON.parse(result.stdout.trim() || "[]");
  return (Array.isArray(value) ? value : [value]).map(Number);
}

function safeDeleteTemp(profile) {
  const root = fs.realpathSync(os.tmpdir()).toLowerCase();
  const resolved = fs.realpathSync(profile).toLowerCase();
  if (!resolved.startsWith(root + path.sep.toLowerCase()) || resolved === root) {
    throw new Error("refusing_temp_cleanup_outside_system_temp");
  }
  if (processesReferencing(resolved).length) throw new Error("qa_process_still_owns_temp_profile");
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}

function listeningPorts(pids) {
  const result = spawnSync("netstat.exe", ["-ano"], { encoding: "utf8", timeout: 10_000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("loopback_listener_inspection_failed");
  const ports = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*TCP\s+127\.0\.0\.1:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (match && pids.has(Number(match[2]))) ports.add(Number(match[1]));
  }
  return ports;
}

async function api(base, operation, route, { body, cookie } = {}) {
  let response;
  try {
    response = await fetch(base + "/api/" + route, {
      method: operation,
      headers: { origin: base, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error", signal: AbortSignal.timeout(12_000),
    });
  } catch { throw new Error("local_api_transport_failed"); }
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function findHealth(child, startupEvidence) {
  const deadline = Date.now() + 180_000;
  let lastMetricSampleAt = 0;
  while (Date.now() < deadline && child.exitCode === null) {
    let pids;
    try { pids = processTree(child.pid); }
    catch { await sleep(1_000); continue; }
    if (Date.now() - lastMetricSampleAt >= 10_000) {
      const current = processMetrics(pids);
      if (current) {
        const previous = startupEvidence.metrics;
        const sampledAt = Date.now();
        if (previous && current.cpuMs - previous.cpuMs >= 250) {
          startupEvidence.lastCpuActivityAt = sampledAt;
          startupEvidence.cpuActivitySamples++;
        }
        if (previous && Math.abs(current.rssMiB - previous.rssMiB) >= 2) {
          startupEvidence.lastMemoryChangeAt = sampledAt;
          startupEvidence.memoryChangeSamples++;
        }
        if (previous && current.count !== previous.count) {
          startupEvidence.processCountChanges++;
          startupEvidence.lastProcessCountChangeAt = sampledAt;
        }
        if (previous && (current.cpuMs - previous.cpuMs >= 250 ||
            Math.abs(current.rssMiB - previous.rssMiB) >= 2 || current.count !== previous.count)) {
          startupEvidence.lastProcessActivityAt = sampledAt;
        }
        startupEvidence.metrics = current;
      }
      lastMetricSampleAt = Date.now();
    }
    const ports = listeningPorts(pids);
    startupEvidence.ownedListenerCount = ports.size;
    if (!ports.size) startupEvidence.healthOutcome = "no_owned_ipv4_loopback_listener";
    for (const port of ports) {
      try {
        const { response, data } = await api(`http://127.0.0.1:${port}`, "GET", "health");
        if (response.ok && data?.status === "ok" && data.deploymentMode === "authenticated" &&
            data.deploymentExposure === "private" && data.bootstrapStatus === "bootstrap_pending") {
          startupEvidence.healthOutcome = "authenticated_private_health_ready";
          return `http://127.0.0.1:${port}`;
        }
        startupEvidence.healthOutcome = response.status === 401 || response.status === 403
          ? "health_authentication_rejected"
          : response.status === 404 ? "health_route_not_found"
            : response.status >= 500 ? "health_backend_error"
              : !response.ok ? "health_http_rejected"
                : data?.status !== "ok" ? "health_payload_invalid"
                  : "private_health_contract_mismatch";
      } catch { startupEvidence.healthOutcome = "owned_loopback_health_transport_failed"; }
    }
    await sleep(1_000);
  }
  const lastPhase = startupEvidence.phases.at(-1);
  const diagnostic = {
    elapsedMs: Date.now() - startupEvidence.startedAt,
    lastSuccessfulPhase: lastPhase?.phase ?? "none",
    lastPhaseAgeMs: lastPhase ? Date.now() - lastPhase.at : null,
    firstFailureCode: startupEvidence.firstFailureCode,
    startupProgress: classifyPackagedStartupProgress(startupEvidence),
    progressEvidence: {
      cpuActivitySamples: startupEvidence.cpuActivitySamples,
      memoryChangeSamples: startupEvidence.memoryChangeSamples,
      processCountChanges: startupEvidence.processCountChanges,
      msSinceCpuActivity: startupEvidence.lastCpuActivityAt
        ? Date.now() - startupEvidence.lastCpuActivityAt : null,
      msSinceMemoryChange: startupEvidence.lastMemoryChangeAt
        ? Date.now() - startupEvidence.lastMemoryChangeAt : null,
      msSinceProcessCountChange: startupEvidence.lastProcessCountChangeAt
        ? Date.now() - startupEvidence.lastProcessCountChangeAt : null,
    },
    ownedLoopbackListeners: startupEvidence.ownedListenerCount,
    healthOutcome: startupEvidence.healthOutcome,
    processMetrics: startupEvidence.metrics,
    childExited: child.exitCode !== null,
  };
  console.error("BOSTAN_PACKAGED_STARTUP_DIAGNOSTIC " + JSON.stringify(diagnostic));
  if (child.exitCode !== null) throw new Error("desktop_exited_before_authenticated_private_health");
  throw new Error("desktop_private_health_startup_timeout_" + diagnostic.lastSuccessfulPhase + "_" + diagnostic.startupProgress);
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value.done) return value.result;
    await sleep(1_000);
  }
  throw new Error(label);
}

async function closeMainWindow(child) {
  if (child.exitCode !== null) return;
  const result = ps(`$ErrorActionPreference='Stop'; $p=Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if($p){[Console]::Out.Write($p.CloseMainWindow())}`);
  if (result.error || result.status !== 0 || result.stdout.trim() !== "True") {
    throw new Error("desktop_graceful_close_request_failed");
  }
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && child.exitCode === null) await sleep(250);
  if (child.exitCode === null) throw new Error("desktop_did_not_confirm_graceful_shutdown");
}

async function run() {
  const opencode = requireOptIn();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-packaged-first-agent-"));
  let child;
  let cleanupAllowed = true;
  let failure;
  let taskReceipt;
  try {
    await admitFreeOpenCodeModel({
      parent: profile, model: MODEL, executable: opencode,
      env: { ...process.env, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1" }, timeoutMs: 75_000,
    });

    const chromiumProfile = path.join(profile, "chromium-profile");
    const appData = path.join(profile, "AppData", "Roaming");
    const localAppData = path.join(profile, "AppData", "Local");
    const temp = path.join(profile, "temp");
    for (const dir of [chromiumProfile, appData, localAppData, temp]) fs.mkdirSync(dir, { recursive: true });
    const pathValue = [path.dirname(process.execPath), path.dirname(opencode), path.join(process.env.SystemRoot || "C:\\Windows", "System32")].join(path.delimiter);
    const env = {
      PATH: pathValue,
      SystemRoot: process.env.SystemRoot || "C:\\Windows",
      WINDIR: process.env.WINDIR || process.env.SystemRoot || "C:\\Windows",
      SystemDrive: process.env.SystemDrive || "C:",
      ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      PROCESSOR_ARCHITECTURE: "AMD64",
      HOME: profile, USERPROFILE: profile,
      APPDATA: appData, LOCALAPPDATA: localAppData, TEMP: temp, TMP: temp,
      DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true",
    };
    const startupEvidence = createStartupEvidence();
    child = spawn(APP_EXE, [`--user-data-dir=${chromiumProfile}`], {
      cwd: APP, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    for (const stream of [child.stdout, child.stderr]) {
      let pending = "";
      stream.on("data", chunk => {
        pending = (pending + chunk.toString()).slice(-16_384);
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline).trim();
          pending = pending.slice(newline + 1);
          recordStartupLine(startupEvidence, line);
        }
      });
    }
    const exited = new Promise(resolve => child.once("exit", code => resolve(code)));
    const pids = await waitFor(async () => {
      if (child.exitCode !== null) return { done: true, result: null };
      try {
        const ids = processTree(child.pid);
        return ids.size > 0 ? { done: true, result: ids } : { done: false };
      } catch { return { done: false }; }
    }, 15_000, "desktop_process_ownership_probe_failed");
    if (!pids) { const code = await exited; throw new Error(`desktop_exited_before_owned_process_tree_${code ?? "unknown"}`); }
    const base = await findHealth(child, startupEvidence);
    console.log("BOSTAN_PACKAGED_DESKTOP_PRIVATE_HEALTH_PASS");

    const email = `qa-${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    const signup = await api(base, "POST", "auth/sign-up/email", {
      body: { name: "Bostan Disposable QA", email, password },
    });
    const cookie = signup.response.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
    if (signup.response.status !== 200 || !cookie || !signup.data?.user?.id) {
      throw new Error("synthetic_signup_failed");
    }
    const claim = await api(base, "POST", "bootstrap/claim", { cookie });
    if (claim.response.status !== 200 || claim.data?.claimed !== true) {
      throw new Error("synthetic_first_admin_claim_failed");
    }
    console.log("BOSTAN_PACKAGED_DESKTOP_FIRST_ADMIN_PASS");

    const companyResult = await api(base, "POST", "companies", { body: { name: "Bostan Free Model QA " + randomUUID() }, cookie });
    const company = companyResult.data;
    if (companyResult.response.status < 200 || companyResult.response.status >= 300 || !company?.id) {
      throw new Error("synthetic_company_create_failed");
    }
    const workspace = path.join(profile, "workspace");
    fs.mkdirSync(workspace);
    const modelConfig = nativeGovernedCaseAgentConfig({ model: MODEL, workspace });
    const agentResult = await api(base, "POST", `companies/${company.id}/agents`, {
      body: {
        name: "Bostan Native Free QA Worker", role: "general",
        adapterType: "paperclip_runner", runner: "paperclip",
        adapterConfig: modelConfig, budgetMonthlyCents: 0,
      }, cookie,
    });
    const agent = agentResult.data;
    if (agentResult.response.status < 200 || agentResult.response.status >= 300 || !agent?.id) {
      throw new Error("native_agent_create_failed");
    }
    const ready = await waitFor(async () => {
      const result = await api(base, "GET", `agents/${agent.id}`, { cookie });
      const state = result.data;
      const diagnostic = safeAgentLifecycleDiagnostic(state);
      if (diagnostic.failureCode) throw new Error("native_agent_setup_" + diagnostic.failureCode);
      if (state?.lifecycleState === "ready") return { done: true, result: state };
      if (["failed", "terminated"].includes(state?.lifecycleState)) throw new Error("native_agent_lifecycle_failed");
      return { done: false };
    }, 240_000, "native_agent_readiness_timeout");
    if (ready.adapterType !== "paperclip_runner") throw new Error("native_runner_not_selected");
    console.log("BOSTAN_PACKAGED_DESKTOP_NATIVE_AGENT_READY_PASS");

    const taskResult = await api(base, "POST", `companies/${company.id}/issues`, {
      body: {
        title: "Synthetic Bostan first free model task " + randomUUID(),
        description: buildFirstWorkerTask(), status: "todo", assigneeAgentId: agent.id,
      }, cookie,
    });
    const task = taskResult.data;
    if (taskResult.response.status < 200 || taskResult.response.status >= 300 || !task?.id) {
      throw new Error("synthetic_task_create_failed");
    }
    const assignedRun = await waitFor(async () => {
      const result = await api(base, "GET", `companies/${company.id}/heartbeat-runs?agentId=${agent.id}&limit=50`, { cookie });
      const selected = selectSingleAssignmentRun(result.data, { agentId: agent.id, issueId: task.id });
      return selected ? { done: true, result: selected } : { done: false };
    }, 60_000, "automatic_assignment_run_not_found");
    const run = await waitFor(async () => {
      const result = await api(base, "GET", `heartbeat-runs/${assignedRun.id}`, { cookie });
      return observeHeartbeatQaStatus(result.data);
    }, 210_000, "native_first_agent_run_timeout");
    let events = null;
    let logDiagnostic = null;
    if (run.status !== "succeeded") {
      const eventResult = await api(base, "GET", `heartbeat-runs/${assignedRun.id}/events?limit=200`, { cookie });
      events = eventResult.data;
      try {
        const logResult = await api(base, "GET", `heartbeat-runs/${assignedRun.id}/log?limitBytes=65536`, { cookie });
        logDiagnostic = safeHeartbeatQaLogDiagnostic(logResult.data?.content);
      } catch { logDiagnostic = { available: false, bytes: 0, safeSignal: null }; }
    }
    console.log("BOSTAN_PACKAGED_FIRST_AGENT_RUN_DIAGNOSTIC " + JSON.stringify({
      ...safeHeartbeatQaDiagnostic(run),
      ...(events === null ? {} : { events: safeHeartbeatQaEventDiagnostic(events) }),
      ...(logDiagnostic === null ? {} : { log: logDiagnostic }),
    }));
    assertHeartbeatQaSucceeded(run);
    if (typeof run.usageJson?.costUsd !== "number" || run.usageJson.costUsd !== 0) {
      throw new Error("first_agent_usage_cost_not_verified_zero");
    }
    const finalTask = await api(base, "GET", `issues/${task.id}`, { cookie });
    if (finalTask.data?.status !== "done") throw new Error("first_agent_task_not_persisted_done");
    const commentsResult = await api(base, "GET", `issues/${task.id}/comments`, { cookie });
    const comments = Array.isArray(commentsResult.data) ? commentsResult.data : commentsResult.data?.comments;
    const comment = requirePersistedRunComment({
      comments, agentId: agent.id, runId: run.id, marker: MARKER,
    });
    taskReceipt = {
      model: MODEL, runStatus: run.status, exitCode: run.exitCode,
      costUsd: run.usageJson.costUsd, taskStatus: finalTask.data.status,
      runAttributedCommentPersisted: true, commentId: comment.commentId,
    };
  } catch (error) {
    failure = error;
  } finally {
    if (child && child.exitCode === null) {
      try { await closeMainWindow(child); }
      catch {
        try {
          await terminateOwnedApplicationTree(child, profile);
          console.error("BOSTAN_PACKAGED_FIRST_AGENT_OWNED_TREE_STOPPED_AFTER_QUALIFICATION_FAILURE");
        } catch { cleanupAllowed = false; }
        if (!failure) failure = new Error("desktop_graceful_shutdown_unverified");
      }
    }
    if (cleanupAllowed) {
      try { safeDeleteTemp(profile); }
      catch { cleanupAllowed = false; }
    }
    if (!cleanupAllowed) console.error("BOSTAN_PACKAGED_FIRST_AGENT_TEMP_PRESERVED_FOR_SAFE_RECOVERY");
  }
  if (failure) {
    const message = String(failure?.message ?? failure ?? "unknown").split(/[\r\n]/, 1)[0]
      .replace(/[^a-z0-9_ -]/gi, "_").slice(0, 80);
    throw new Error("qa_failed_" + (message || "unclassified"));
  }
  if (!cleanupAllowed) throw new Error("packaged_first_agent_qa_cleanup_unverified");
  console.log("BOSTAN_PACKAGED_DESKTOP_FIRST_FREE_AGENT_TASK_PASS " + JSON.stringify({
    ...taskReceipt,
    gracefulShutdown: true,
    temporaryProfileCleanupVerified: !fs.existsSync(profile),
  }));
}

run().catch(error => {
  console.error("BOSTAN_PACKAGED_FIRST_AGENT_FAIL " + String(error?.message || "unknown").replace(/^qa_failed_/, "").slice(0, 100));
  process.exitCode = 1;
});
