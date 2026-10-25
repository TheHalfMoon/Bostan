/**
 * Bostan source-runtime/macOS/Linux-only, synthetic persistence smoke.
 * Not an installer and not a substitute for a browser or agent E2E.
 *   BOSTAN_LIVE_LOCAL_QA_CONFIRM=1 node scripts/bostan-local-live-persistence-e2e.mjs
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qualifyFreeQaModel, isOpenRouterFreeQaModel } from "./bostan-free-model-policy.mjs";
import { admitOpenRouterZeroCostQa } from "./bostan-openrouter-free-preflight.mjs";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const MARKER = "bostan-managed-source-runtime-v1";
const MAX_LOG_BYTES = 8192;
// The Bostan source launcher itself now admits up to 180 cold-start probes.
// Give the *outer* synthetic QA a slightly larger finite budget so it cannot
// incorrectly kill a healthy first-run during the internal health window.
const WAIT_START_MS = 215_000;
const WAIT_STOP_MS = 45_000;
const SLEEP_MS = 1000;

export function requireBostanSourceSmokeAdmission(env = process.env, platform = process.platform) {
  if (env.BOSTAN_LIVE_LOCAL_QA_CONFIRM !== "1") {
    throw new Error("Bostan live local QA requires BOSTAN_LIVE_LOCAL_QA_CONFIRM=1");
  }
  if (platform !== "darwin" && platform !== "linux") {
    throw new Error("Bostan live local QA is not qualified for Windows; use its separate TEMP-only workflow");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_LARGE_OCR_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E !== "1") {
    throw new Error("Large image browser OCR QA requires the existing isolated OCR route opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1") {
    throw new Error("Private lazy task bundle QA requires the headless Chromium source opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_HTML_HEADERS_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1") {
    throw new Error("Private static HTML privacy QA requires real Chromium opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_INSIGHTS_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1") {
    throw new Error("Private task-insights browser QA requires confirmed private Chromium opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E === "1" &&
      (env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1" ||
        env.BOSTAN_LOCAL_OCR_PREVIEW_ENABLE !== "1")) {
    throw new Error("Private OCR browser QA requires real browser and enabled local OCR");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_QA_CONFIRM !== "1") {
    throw new Error("Real browser QA requires explicit temporary Bostan app consent");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_ADAPTER_SELECTION_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E !== "1") {
    throw new Error("Browser adapter selection QA requires the inactive first-agent draft opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_AGENT_DRAFT_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E !== "1") {
    throw new Error("First-agent draft browser QA requires the onboarding wizard opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_BROWSER_ONBOARDING_E2E === "1" &&
      env.BOSTAN_LIVE_LOCAL_BROWSER_E2E !== "1") {
    throw new Error("Browser onboarding QA requires a separate headless browser opt-in");
  }
  if (env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1" && env.BOSTAN_E2E_TWO_AGENT_TEAM !== "1") {
    throw new Error("Evidence-read review requires the separately admitted second free agent");
  }
  if (env.BOSTAN_E2E_TWO_AGENT_TEAM === "1" && env.BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E !== "1") {
    throw new Error("Two-agent QA also requires the explicit real free-agent E2E opt-in");
  }
  if (env.BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E === "1") {
    if (env.BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL !== "1") {
      throw new Error("Free online agent QA requires explicit BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL=1");
    }
    qualifyFreeQaModel(env.BOSTAN_E2E_FREE_MODEL);
  }
}

function hold(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function freePort() {
  return await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      listener.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}
async function waitExit(child, elapsedMs) {
  if (child.exitCode !== null) return { code: child.exitCode, signal: child.signalCode };
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.removeListener("exit", exit);
      reject(new Error("Bostan source runtime did not exit within bounded shutdown window"));
    }, elapsedMs);
    const exit = (code, signal) => { clearTimeout(timer); resolve({ code, signal }); };
    child.once("exit", exit);
  });
}
function assertStopped(home) {
  for (const fragment of [
    ["run.lock"], ["postgres", "data", "postmaster.pid"],
  ]) {
    const target = path.join(home, ".bostan", "app", ...fragment);
    if (fs.existsSync(target)) throw new Error("Bostan runtime left a PG or lock marker, data preserved for inspection");
  }
}
async function requestJson(origin, route, body) {
  const response = await fetch(origin + "/api/" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(12_000), redirect: "error",
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`Bostan private QA /api/${route} returned HTTP ${response.status}`);
  return json;
}

export async function runBostanLocalLivePersistenceSmoke(env = process.env) {
  // Refuse any non-free route before allocating temporary Bostan state.
  requireBostanSourceSmokeAdmission(env);
  const openRouterQa = env.BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E === "1" &&
    isOpenRouterFreeQaModel(qualifyFreeQaModel(env.BOSTAN_E2E_FREE_MODEL))
    ? await admitOpenRouterZeroCostQa({
        model: env.BOSTAN_E2E_FREE_MODEL, env,
      })
    : null;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-live-persistence-"));
  fs.chmodSync(root, 0o700);
  const home = path.join(root, "home");
  fs.mkdirSync(home, { mode: 0o700 });
  const childEnv = { ...env, HOME: home, DO_NOT_TRACK: "1", OTEL_SDK_DISABLED: "true",
    ...(openRouterQa ? {
      // Volatile, non-logged secret, scoped to this disposable source QA only.
      OPENROUTER_API_KEY: openRouterQa.key,
      PAPERCLIP_OPENCODE_SMALL_MODEL: openRouterQa.model,
      BOSTAN_OPENCODE_STANDALONE: "1",
      BOSTAN_E2E_OPENROUTER_ZERO_PRICE_VERIFIED: "1",
    } : {}),
  };
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  let proc = null;
  let recent = "";
  let clean = false;
  let marker = null;
  let browserReport = null;
  const app = path.join(home, ".bostan", "app");

  async function start() {
    recent = "";
    proc = spawn(process.execPath, ["cli/src/bostan-preview.mjs", "app", "run", "--local", "--port", String(port)], {
      cwd: REPO, env: childEnv, stdio: ["ignore", "pipe", "pipe"],
    });
    for (const output of [proc.stdout, proc.stderr]) {
      output.on("data", piece => { recent = (recent + piece.toString()).slice(-MAX_LOG_BYTES); });
    }
    const deadline = Date.now() + WAIT_START_MS;
    while (Date.now() < deadline) {
      if (proc.exitCode !== null) throw new Error(`Bostan app exited before health: ${proc.exitCode}`);
      try {
        const health = await requestJson(origin, "health");
        if (health.status === "ok" && health.deploymentMode === "local_trusted"
            && health.deploymentExposure === "private") return;
        if (health.status === "ok") throw new Error("Bostan app is not private local_trusted");
      } catch (error) {
        if (error.message === "Bostan app is not private local_trusted") throw error;
      }
      await hold(SLEEP_MS);
    }
    throw new Error("Bostan source runtime failed health startup within bounded timeout");
  }
  async function stop() {
    const current = proc;
    if (!current) throw new Error("Missing Bostan source process");
    const waiting = waitExit(current, WAIT_STOP_MS);
    current.kill("SIGTERM");
    const result = await waiting;
    proc = null;
    if (result.code !== 0) throw new Error(`Bostan graceful stop returned ${result.code ?? result.signal}`);
    assertStopped(home);
  }
  try {
    await start();
    marker = "Bostan isolated source E2E " + randomUUID();
    const company = await requestJson(origin, "companies", { name: marker });
    if (!company?.id || typeof company.id !== "string") throw new Error("Bostan company insert returned no ID");
    await stop();
    await start();
    const result = await requestJson(origin, "companies");
    const records = Array.isArray(result) ? result : result?.companies;
    if (!Array.isArray(records) || !records.some(value => value.id === company.id && value.name === marker)) {
      throw new Error("Bostan company did not survive a real PostgreSQL restart");
    }
    // OCR browser acceptance needs a *real task*, not a bare isolated
    // component. It is synthetic and only created inside disposable PG.
    const ocrIssue = env.BOSTAN_LIVE_LOCAL_BROWSER_OCR_E2E === "1"
      ? await requestJson(origin, "companies/" + company.id + "/issues", {
          title: "Bostan synthetic local image OCR browser QA " + randomUUID(),
          description: "Disposable read-only OCR source preview task",
          status: "todo",
        })
      : null;
    if (ocrIssue && (!ocrIssue.id || ocrIssue.companyId !== company.id)) {
      throw new Error("Synthetic OCR source task was not persisted in its company");
    }
    const lazyIssue = env.BOSTAN_LIVE_LOCAL_BROWSER_LAZY_ISSUE_E2E === "1"
      ? await requestJson(origin, "companies/" + company.id + "/issues", {
          title: "Bostan synthetic lazy issue chunk QA " + randomUUID(),
          status: "todo",
        })
      : null;
    if (lazyIssue && (!lazyIssue.id || lazyIssue.companyId !== company.id)) {
      throw new Error("Lazy issue route source QA did not persist its synthetic task");
    }
    const insightsIssue = env.BOSTAN_LIVE_LOCAL_BROWSER_INSIGHTS_E2E === "1"
      ? (ocrIssue ?? await requestJson(origin, "companies/" + company.id + "/issues", {
          title: "Bostan synthetic task insights " + randomUUID(),
          status: "todo",
        }))
      : null;
    if (insightsIssue && (!insightsIssue.id || insightsIssue.companyId !== company.id)) {
      throw new Error("Synthetic analytics issue was not persisted inside its source company");
    }
    // Browser checks exercise actual React hydration and private HTTP state
    // without installing an app, using remote providers, or leaving localhost.
    if (env.BOSTAN_LIVE_LOCAL_BROWSER_E2E === "1") {
      const { runPrivateBostanBrowserQa } = await import("./bostan-local-browser-qa.mjs");
      browserReport = await runPrivateBostanBrowserQa({
        origin: origin + "/", expectedCompanyId: company.id, env,
        ...(ocrIssue ? { ocrIssue: { id: ocrIssue.id,
          issuePrefix: company.issuePrefix } } : {}),
        ...(insightsIssue ? { insightCompanyId: {
          id: company.id, issuePrefix: company.issuePrefix,
        } } : {}),
        ...(lazyIssue ? { lazyIssue: {
          id: lazyIssue.id, title: lazyIssue.title,
          issuePrefix: company.issuePrefix,
        } } : {}),
      });
    }
    // An explicit separate opt-in extends the existing private app lifecycle
    // smoke with the existing real-agent API harness. This runs only on the
    // disposable restarted PostgreSQL instance; no installed profile is used.
    if (env.BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E === "1") {
      const { runFirstAgentFreeE2e } = await import("./bostan-first-agent-free-e2e.mjs");
      await runFirstAgentFreeE2e({
        ...childEnv,
        BOSTAN_E2E_URL: origin + "/",
        BOSTAN_E2E_DISPOSABLE_HOME: home,
        BOSTAN_E2E_CONFIRM_TEMP_DATA: "1",
        BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
        BOSTAN_E2E_FREE_MODEL: qualifyFreeQaModel(env.BOSTAN_E2E_FREE_MODEL),
        BOSTAN_E2E_TWO_AGENT_TEAM: env.BOSTAN_E2E_TWO_AGENT_TEAM === "1" ? "1" : "0",
        BOSTAN_E2E_REVIEW_FIRST_AGENT: env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1" ? "1" : "0",
      });
    }
    await stop();
    const storedConfig = JSON.parse(fs.readFileSync(path.join(app, "state", "instances", "local", "config.json"), "utf8"));
    if (storedConfig?.bostanManagedLocalRuntime !== MARKER) throw new Error("Unexpected runtime identity");
    clean = true;
    return { qualified: true, platform: process.platform,
      ...(browserReport ? {
        browserPageErrors: browserReport.pageErrorsSeen,
        browserExternalRequestsBlocked: browserReport.blockedExternalRequests,
      } : {}),
      verified: "private-health,company-create,clean-stop,restart,persistence" +
        (env.BOSTAN_LIVE_LOCAL_FREE_AGENT_E2E === "1" ? ",real-free-agent-heartbeat-task-comment-done" : "") +
        (env.BOSTAN_LIVE_LOCAL_BROWSER_E2E === "1" ? ",real-headless-chromium-private-ui" : "") +
        (browserReport?.onboarding ? ",real-browser-new-company-onboarding" : "") +
        (browserReport?.onboarding?.firstAgentDraft ? ",real-browser-first-agent-inactive-draft" : "") +
        (browserReport?.onboarding?.firstAgentDraft?.localAdapterSelected ? ",real-browser-adapter-selected-still-paused" : "") +
        (browserReport?.insights ? ",real-browser-private-task-insights" : "") +
        (browserReport?.htmlPrivacy ? ",real-browser-html-no-referrer" : "") +
        (browserReport?.lazyIssue ? ",real-browser-route-scoped-issue-bundle" : "") +
        (browserReport?.ocr ? ",real-browser-bilingual-ocr-no-document-write" : "") +
        (browserReport?.ocr?.actualLargeImageNormalizedToJpeg
          ? ",real-browser-large-image-local-jpeg-preprocessing" : "") +
        (env.BOSTAN_E2E_TWO_AGENT_TEAM === "1" ? ",second-distinct-free-agent-same-company" : "") +
        (env.BOSTAN_E2E_REVIEW_FIRST_AGENT === "1" ? ",second-agent-cites-first-persisted-comment" : "") +
        ",clean-stop" };
  } finally {
    if (proc && proc.exitCode === null) {
      proc.kill("SIGTERM");
      try { await waitExit(proc, WAIT_STOP_MS); } catch { /* Preserve diagnostic profile */ }
    }
    // Cleanup is deliberately conservative and only touches our exact
    // newly generated mkdtemp root when both DB and run.lock are absent.
    if (clean) {
      assertStopped(home);
      fs.rmSync(root, { recursive: true, force: true });
    } else {
      process.stderr.write(`Bostan live QA failed; inspect private temporary profile ${root}.\n`);
      if (recent) process.stderr.write("Bostan private server diagnostics retained in memory (not printed).\n");
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runBostanLocalLivePersistenceSmoke();
  console.log("BOSTAN_LOCAL_PERSISTENCE_E2E_PASS", JSON.stringify(result));
}
