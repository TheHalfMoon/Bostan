#!/usr/bin/env node
/**
 * B0-93 PRIVATE, opt-in, native macOS authenticated HTTP smoke.
 * Disposable localhost PostgreSQL and synthetic credentials only.
 * No operator environment, agents, deployment, paid providers or publishing.
 */
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync, readFileSync, lstatSync, realpathSync, statfsSync,
  mkdtempSync, writeFileSync, rmSync, openSync, closeSync, statSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const markerContents = "BOSTAN_PRIVATE_SYNTHETIC_ONLY\n";
const receipt = {
  schema: "bostan.private-mac-real-http.v1",
  run: false, releaseQualified: false, macAuthenticatedHttpQualified: false,
  windowsQualified: false, browserQualified: false, agentQualified: false,
  localhostOnly: true, syntheticOnly: true, publishes: false, paidModels: false,
};
function validRepo() {
  if (process.platform !== "darwin") return false;
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 24 || (major === 24 && minor < 11)) return false;
  try {
    const real = realpathSync(root);
    const pkg = JSON.parse(readFileSync(join(real, "package.json"), "utf8"));
    return real.startsWith("/private/tmp/") &&
      /^bostan-b0[0-9]+$/i.test(basename(real)) &&
      pkg.name === "bostan" && pkg.private === true &&
      existsSync(join(real, ".git"));
  } catch { return false; }
}
function enoughDisk() {
  try {
    const s = statfsSync(root, { bigint: true });
    return s.bavail * s.bsize >= 10n * 1024n ** 3n;
  } catch { return false; }
}
function validMarker() {
  const marker = process.env.BOSTAN_MAC_HTTP_QA_MARKER || "";
  try {
    return marker.startsWith("/private/tmp/bostan-b093-mac-http-") &&
      basename(marker) === "BOSTAN_QA_OWNED" &&
      existsSync(marker) && lstatSync(marker).isFile() &&
      !lstatSync(marker).isSymbolicLink() &&
      readFileSync(marker, "utf8") === markerContents;
  } catch { return false; }
}
const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === "--plan")) {
  console.log(JSON.stringify(receipt));
} else if (args.length === 1 && args[0] === "--run") {
  if (!validRepo() || !enoughDisk() ||
      process.env.BOSTAN_MAC_HTTP_QA !== "SYNTHETIC_ONLY") {
    console.error("Bostan private macOS HTTP QA refuses unsafe or unowned fixture");
    process.exitCode = 2;
  } else if (!existsSync(join(root, "server/node_modules/tsx/package.json")) ||
             !existsSync(join(root, "packages/db/dist/index.js")) ||
             !existsSync(join(root, "packages/shared/dist/index.js"))) {
    console.error("Bostan private macOS HTTP QA requires installed built dependencies");
    process.exitCode = 2;
  } else {
    const home = mkdtempSync("/private/tmp/bostan-b093-mac-http-");
    const marker = join(home, "BOSTAN_QA_OWNED");
    writeFileSync(marker, markerContents, { mode: 0o600 });
    const env = {
      PATH: process.env.PATH || "/usr/bin:/bin",
      HOME: home, TMPDIR: home, XDG_CONFIG_HOME: home, PAPERCLIP_HOME: home,
      PAPERCLIP_CONFIG: join(home, "nonexistent-config.json"),
      PAPERCLIP_TEST_POSTGRES_TEMPLATE: "0",
      PAPERCLIP_MIGRATION_PROMPT: "never",
      PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
      PAPERCLIP_DEPLOYMENT_MODE: "authenticated",
      PAPERCLIP_DEPLOYMENT_EXPOSURE: "private",
      PAPERCLIP_AUTH_BASE_URL_MODE: "explicit",
      PAPERCLIP_AUTH_DISABLE_SIGN_UP: "false",
      PAPERCLIP_AUTH_RATE_LIMIT_ENABLED: "false",
      SERVE_UI: "false", HEARTBEAT_SCHEDULER_ENABLED: "false",
      PAPERCLIP_OPEN_ON_LISTEN: "false", BOSTAN_FEEDBACK_EXPORT_ENABLED: "0",
      OTEL_SDK_DISABLED: "true", DO_NOT_TRACK: "1", CI: "1",
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      BOSTAN_MAC_HTTP_QA_MARKER: marker,
      BOSTAN_MAC_HTTP_QA_CHILD: "SYNTHETIC_ONLY",
    };
    const started = Date.now();
    // File-backed stdio: tsx/esbuild descendants must not keep pipes open.
    const logPath = join(home, "BOSTAN_QA_CHILD_LOG");
    const fd = openSync(logPath, "w", 0o600);
    let child;
    try {
      child = spawnSync(process.execPath, [
        "--import", "tsx", fileURLToPath(import.meta.url), "--child",
      ], {
        cwd: join(root, "server"), env, timeout: 110000,
        stdio: ["ignore", fd, fd],
      });
    } finally { closeSync(fd); }
    const boundedLog = statSync(logPath).size <= 2 * 1024 * 1024;
    const output = boundedLog ? readFileSync(logPath, "utf8") : "";
    const stages = [
      "BOSTAN_MAC_HTTP_POSTGRES_MIGRATED",
      "BOSTAN_MAC_HTTP_PRIVATE_HEALTH_PASS",
      "BOSTAN_MAC_HTTP_SYNTHETIC_SIGNUP_PASS",
      "BOSTAN_MAC_HTTP_FIRST_ADMIN_CLAIM_PASS",
      "BOSTAN_MAC_HTTP_POST_CLAIM_HEALTH_PASS",
      "BOSTAN_MAC_HTTP_SERVER_SHUTDOWN_PASS",
      "BOSTAN_MAC_HTTP_POSTGRES_CLEANUP_PASS",
    ];
    const flags = stages.map(stage => output.includes(stage + "\n"));
    const passed = child.status === 0 && !child.error && !child.signal &&
      boundedLog && flags.every(Boolean);
    // Preserve a failed, possibly still-live DB cluster instead of deleting
    // data files under it. Never touch unrelated PostgreSQL processes.
    if (flags[6] || !flags[0]) rmSync(home, { recursive: true, force: true });
    console.log(JSON.stringify({
      ...receipt, run: true, macAuthenticatedHttpQualified: passed,
      postgresMigrated: flags[0], privateHealth: flags[1],
      syntheticSignup: flags[2], firstAdminClaim: flags[3],
      postClaimHealthy: flags[4], serverShutdown: flags[5],
      postgresCleanup: flags[6],
      timeout: child.error?.code === "ETIMEDOUT",
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
      outcome: passed ? "pass" : "failed_or_incomplete",
    }));
    if (!passed) process.exitCode = 1;
  }
} else if (args.length === 1 && args[0] === "--child") {
  if (!validRepo() || !validMarker() ||
      process.env.BOSTAN_MAC_HTTP_QA_CHILD !== "SYNTHETIC_ONLY" ||
      process.env.PAPERCLIP_DEPLOYMENT_MODE !== "authenticated" ||
      process.env.PAPERCLIP_DEPLOYMENT_EXPOSURE !== "private") {
    console.error("Bostan macOS HTTP child refuses unsafe synthetic invocation");
    process.exitCode = 2;
  } else {
    let db = null, started = null;
    try {
      const { startEmbeddedPostgresTestDatabase } =
        await import("../packages/db/src/test-embedded-postgres.ts");
      db = await startEmbeddedPostgresTestDatabase("bostan-b093-mac-http-db-");
      const database = new URL(db.connectionString);
      if (!["127.0.0.1", "localhost"].includes(database.hostname))
        throw Error("Non-loopback synthetic PostgreSQL");
      console.log("BOSTAN_MAC_HTTP_POSTGRES_MIGRATED");
      const port = await new Promise((resolve, reject) => {
        const probe = createServer();
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", () => {
          const p = probe.address().port;
          probe.close(err => err ? reject(err) : resolve(p));
        });
      });
      const origin = "http://127.0.0.1:" + port;
      Object.assign(process.env, {
        DATABASE_URL: db.connectionString, HOST: "127.0.0.1",
        PORT: String(port), PAPERCLIP_AUTH_PUBLIC_BASE_URL: origin,
      });
      const { startServer } = await import("../server/src/index.ts");
      started = await startServer();
      const health = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(12000), redirect: "error",
      });
      const h = await health.json();
      if (health.status !== 200 || h?.status !== "ok" ||
          h?.deploymentMode !== "authenticated" ||
          h?.deploymentExposure !== "private" ||
          h?.bootstrapStatus !== "bootstrap_pending")
        throw Error("Unexpected private authenticated health");
      console.log("BOSTAN_MAC_HTTP_PRIVATE_HEALTH_PASS");
      const signup = await fetch(origin + "/api/auth/sign-up/email", {
        method: "POST", redirect: "error",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          email: "bostan-b093-" + randomUUID() + "@example.invalid",
          password: "Qa-Only-" + randomBytes(18).toString("hex") + "A!2",
          name: "Synthetic Bostan QA",
        }), signal: AbortSignal.timeout(14000),
      });
      const user = await signup.json().catch(() => null);
      if (signup.status !== 200 || typeof user?.user?.id !== "string")
        throw Error("Synthetic signup failed");
      const cookie = signup.headers.getSetCookie?.()
        .map(x => x.split(";")[0]).find(x => x.includes("session_token="));
      if (!cookie) throw Error("Synthetic session cookie absent");
      console.log("BOSTAN_MAC_HTTP_SYNTHETIC_SIGNUP_PASS");
      const claim = await fetch(origin + "/api/bootstrap/claim", {
        method: "POST", redirect: "error",
        headers: { cookie, origin, "content-type": "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (claim.status !== 200) throw Error("Synthetic first-admin claim failed");
      console.log("BOSTAN_MAC_HTTP_FIRST_ADMIN_CLAIM_PASS");
      const after = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(12000), redirect: "error",
      });
      const a = await after.json();
      if (after.status !== 200 || a?.bootstrapStatus !== "ready")
        throw Error("Post-claim bootstrap not ready");
      console.log("BOSTAN_MAC_HTTP_POST_CLAIM_HEALTH_PASS");
    } catch (error) {
      // Never print exception messages or stacks: they may contain credentials.
      console.log("BOSTAN_MAC_HTTP_FAILED_TYPE=" +
        (error instanceof Error ? error.name : "other"));
      process.exitCode = 1;
    } finally {
      if (started) {
        try {
          await started.shutdown("SIGTERM");
          console.log("BOSTAN_MAC_HTTP_SERVER_SHUTDOWN_PASS");
        } catch { process.exitCode = 1; }
      }
      if (db) {
        try {
          await db.cleanup();
          console.log("BOSTAN_MAC_HTTP_POSTGRES_CLEANUP_PASS");
        } catch { process.exitCode = 1; }
      }
      // tsx/esbuild can keep an event-loop handle after successful teardown.
      // Exit only AFTER awaited server and PostgreSQL shutdown.
      process.exit(process.exitCode || 0);
    }
  }
} else {
  console.error("Usage: node scripts/bostan-private-mac-live-http.mjs [--plan|--run]");
  process.exitCode = 2;
}
