import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import test from "node:test";
import { executable, inspectLocalRuntime, isolatedEnv, runLocalRuntime } from "./bostan-local-runtime.mjs";

test("isolated application environment ignores inherited telemetry, external providers and unsafe binding", () => {
  const parent = {
    HOME: "/forbidden/legacy",
    PATH: "/bin:/usr/bin",
    LANG: "en_US.UTF-8",
    PAPERCLIP_HOME: "/forbidden/legacy",
    PAPERCLIP_ANNOUNCEMENTS_ENABLED: "true",
    PAPERCLIP_TELEMETRY_DISABLED: "0",
    BOSTAN_TELEMETRY_OPT_IN: "1",
    BOSTAN_TELEMETRY_ENDPOINT: "https://legacy.invalid",
    HOST: "0.0.0.0", PORT: "80", DATABASE_URL: "postgres://legacy",
    ANTHROPIC_API_KEY: "inherited-secret", OPENAI_API_KEY: "inherited-secret",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://telemetry.legacy.invalid",
  };
  const next = isolatedEnv({
    home: "/tmp/bostan-owned-home", port: 3421,
    databaseUrl: "postgres://local:bostan@127.0.0.1:45553/bostan",
    jwt: "test-agent-jwt", config: "/tmp/bostan-owned-home/.bostan/app/config.json",
  }, parent);
  assert.equal(next.HOME, "/tmp/bostan-owned-home");
  assert.equal(next.PAPERCLIP_HOME, "/tmp/bostan-owned-home/.bostan/app/state");
  assert.equal(next.HOST, "127.0.0.1");
  assert.equal(next.PORT, "3421");
  assert.equal(next.BOSTAN_ANNOUNCEMENTS_ENABLED, "0");
  assert.equal(next.BOSTAN_OPENCODE_STANDALONE, "1");
  assert.equal(next.PAPERCLIP_TELEMETRY_DISABLED, "1");
  assert.equal(next.DO_NOT_TRACK, "1");
  assert.equal(next.PAPERCLIP_MIGRATION_AUTO_APPLY, "true");
  assert.equal(next.PAPERCLIP_AGENT_JWT_SECRET, "test-agent-jwt");
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OTEL_EXPORTER_OTLP_ENDPOINT",
    "BOSTAN_TELEMETRY_OPT_IN", "BOSTAN_TELEMETRY_ENDPOINT", "PAPERCLIP_ANNOUNCEMENTS_ENABLED"]) {
    assert.equal(next[key], undefined, key + " must not leak to child");
  }
});

test("doctor reports missing prerequisites without creating files", () => {
  const dir = mkdtempSync(join(tmpdir(), "bostan-app-doctor-"));
  try {
    const results = inspectLocalRuntime(dir, { PATH: "/does/not/exist" });
    assert.equal(results.ready, false);
    assert.ok(results.missing.includes("Bostan checkout"));
    assert.ok(results.missing.includes("initdb"));
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("doctor rejects copied project files with a different package identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "bostan-app-fake-source-"));
  try {
    mkdirSync(join(dir, "cli"), { recursive: true });
    mkdirSync(join(dir, "server", "src"), { recursive: true });
    mkdirSync(join(dir, "server", "node_modules", "tsx", "dist"), { recursive: true });
    mkdirSync(join(dir, "ui", "dist"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "bostan" }));
    writeFileSync(join(dir, "cli", "package.json"), JSON.stringify({ name: "not-bostan" }));
    for (const file of ["server/src/index.ts", "server/node_modules/tsx/dist/loader.mjs", "ui/dist/index.html"]) {
      writeFileSync(join(dir, file), "");
    }
    const results = inspectLocalRuntime(dir, { PATH: "/does/not/exist" });
    assert.ok(results.missing.includes("Bostan package identity"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("invalid ports fail before the runtime touches the user's HOME", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bostan-app-port-"));
  try {
    for (const port of [0, 80, 65536, -1, 3100.5, NaN]) {
      await assert.rejects(() => runLocalRuntime({ port, home: dir }), /Invalid local port/);
    }
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("database executable discovery uses native extensions without invoking script shims", () => {
  const dir = mkdtempSync(join(tmpdir(), "bostan-executable-"));
  try {
    writeFileSync(join(dir, "pg_ctl.exe"), "not an actual program");
    writeFileSync(join(dir, "pg_ctl.cmd"), "malicious shim");
    writeFileSync(join(dir, "initdb.cmd"), "malicious shim");
    writeFileSync(join(dir, "postgres.exe"), "not an actual program");
    const env = { PATH: process.platform === "win32"
      ? `"${dir}"${delimiter}relative-untrusted-path`
      : `${dir}${delimiter}relative-untrusted-path` };
    if (process.platform === "win32") {
      assert.equal(executable("pg_ctl", env), join(dir, "pg_ctl.exe"));
      assert.equal(executable("initdb", env), null);
      assert.equal(executable("postgres", env), join(dir, "postgres.exe"));
    } else {
      assert.equal(executable("pg_ctl", env), null);
      assert.equal(executable("postgres", env), null);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Windows remains release-blocked even if fake PostgreSQL executables are present", () => {
  if (process.platform !== "win32") return;
  const dir = mkdtempSync(join(tmpdir(), "bostan-windows-gate-"));
  try {
    for (const tool of ["initdb", "pg_ctl", "psql", "createdb"]) {
      writeFileSync(join(dir, tool + ".exe"), "synthetic only");
    }
    const result = inspectLocalRuntime(undefined, { PATH: dir });
    assert.ok(result.missing.includes("macOS/Linux platform"));
    for (const tool of ["initdb", "pg_ctl", "psql", "createdb"]) {
      assert.ok(!result.missing.includes(tool), `should resolve ${tool}.exe`);
    }
    assert.equal(result.ready, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
