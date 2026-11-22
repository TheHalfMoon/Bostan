import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isolatedOpenCodeAdmissionEnvironment,
  freeModelResponseMatches,
  openCodeAdmissionArgs,
  summarizeFreeModelAdmissionOutput,
  runBoundedAdmissionChild,
  admitFreeOpenCodeModel,
} from "./bostan-opencode-free-admission.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-opencode-admission-"));
  const home = path.join(root, "home"), cwd = path.join(root, "empty");
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  return { root, home, cwd, clean: () => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }) };
}

test("native child inherits only safe infrastructure and a fresh private config tree", () => {
  const f = fixture();
  try {
    const env = isolatedOpenCodeAdmissionEnvironment(f.home, {
      PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "",
      OPENAI_API_KEY: "private-api-key", OPENCODE_CONFIG_CONTENT: "override",
      ANTHROPIC_API_KEY: "private-anthropic-key",
      APPDATA: "unsafe", HOME: os.homedir(), USERPROFILE: os.homedir(),
      BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1",
    });
    assert.equal(env.HOME, f.home);
    assert.equal(env.USERPROFILE, f.home);
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal(env.ANTHROPIC_API_KEY, undefined);
    assert.equal(env.OPENCODE_CONFIG_CONTENT, undefined);
    assert.ok(env.APPDATA.startsWith(f.home));
    assert.ok(env.XDG_CONFIG_HOME.startsWith(f.home));
  } finally { f.clean(); }
});

test("only a real JSON text event with exact response qualifies", () => {
  const expected = "BOSTAN_ISOLATED_FREE_MODEL_READY";
  const textEvent = JSON.stringify({ type: "text", part: { text: expected } });
  assert.equal(freeModelResponseMatches(textEvent), true);
  assert.equal(freeModelResponseMatches(JSON.stringify({ type: "step_start", prompt: expected })), false);
  assert.equal(freeModelResponseMatches(JSON.stringify({ type: "text", part: { text: "before " + expected } })), false);
  assert.equal(freeModelResponseMatches("no JSON " + expected), false);
  assert.equal(freeModelResponseMatches(textEvent + "\n{bad json"), true);
  assert.equal(freeModelResponseMatches([
    JSON.stringify({ type: "text", part: { text: "BOSTAN_ISOLATED_" } }),
    JSON.stringify({ type: "text", part: { text: "FREE_MODEL_READY" } }),
  ].join("\n")), true);
  assert.equal(freeModelResponseMatches([
    JSON.stringify({ type: "text", part: { text: "BOSTAN_ISOLATED_" } }),
    JSON.stringify({ type: "text", part: { text: "FREE_MODEL_READY plus extra" } }),
  ].join("\n")), false);
});

test("admission uses only flags supported by the packaged OpenCode run command", () => {
  const args = openCodeAdmissionArgs("ollama/qwen2.5-coder:1.5b", "BOSTAN_LOCAL_MODEL_READY");
  assert.deepEqual(args, ["run", "--print-logs", "--log-level", "DEBUG", "--format", "json", "--model", "ollama/qwen2.5-coder:1.5b",
    "Reply exactly BOSTAN_LOCAL_MODEL_READY. Do not use tools."]);
  assert.ok(!args.includes("--standalone"));
});

test("admission failure summary is bounded and omits URL, path, and credential-like output", () => {
  const output = [
    JSON.stringify({ type: "step_start" }),
    JSON.stringify({ type: "text", part: { text: "wrong https://private.invalid sk-abcdefghijklmnopqrstuvwxyz C:\\\\Users\\\\person\\\\secret" } }),
    JSON.stringify({ type: "error", error: { name: "RequestError", data: { message: "request to https://private.invalid failed with key sk-abcdefghijklmnopqrstuvwxyz at C:\\\\Users\\\\person\\\\secret" } } }),
  ].join("\n");
  const summary = summarizeFreeModelAdmissionOutput(output, undefined,
    "provider failed https://private.invalid sk-abcdefghijklmnopqrstuvwxyz C:\\\\Users\\\\person\\\\secret");
  assert.deepEqual(summary.eventTypes, ["step_start", "text", "error"]);
  assert.equal(summary.textEventCount, 1);
  assert.equal(summary.includesExpected, false);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].name, "RequestError");
  assert.ok(summary.errors[0].message.length <= 160);
  assert.doesNotMatch(summary.errors[0].message, /https?:|sk-|C:\\\\Users|private\.invalid|secret/);
  assert.ok(summary.preview.length <= 160);
  assert.doesNotMatch(summary.preview, /https?:|sk-|C:\\\\Users|private\.invalid|secret/);
  assert.ok(summary.stderrLength > 0);
  assert.ok(summary.stderrPreview.length <= 160);
  assert.doesNotMatch(summary.stderrPreview, /https?:|sk-|C:\\\\Users|private\.invalid|secret/);
  assert.ok(summary.stderrTail.length <= 512);
  assert.doesNotMatch(summary.stderrTail, /https?:|sk-|C:\\\\Users|private\.invalid|secret/);
  assert.equal(summary.errorLogs.length, 1);
  assert.ok(summary.errorLogs[0].length <= 512);
  assert.doesNotMatch(summary.errorLogs[0], /https?:|sk-|C:\\\\Users|private\.invalid|secret/);
});

test("child stdin is EOF from birth and prints the required JSON text event", async () => {
  const f = fixture();
  try {
    const code = [
      "process.stdin.resume();",
      "process.stdin.on('end', () => {",
      "process.stdout.write(JSON.stringify({type:'text',part:{text:'BOSTAN_ISOLATED_FREE_MODEL_READY'}})+'\\n');",
      "});",
    ].join("");
    const result = await runBoundedAdmissionChild({
      executable: process.execPath, args: ["-e", code],
      cwd: f.cwd, env: process.env, timeoutMs: 5000,
    });
    assert.equal(result.timedOut, false);
    assert.equal(result.exitCode, 0);
    assert.equal(freeModelResponseMatches(result.stdout), true);
  } finally { f.clean(); }
});

test("hung local child is killed by bounded deadline, never represented as a pass", async () => {
  const f = fixture();
  try {
    const started = Date.now();
    const result = await runBoundedAdmissionChild({
      executable: process.execPath, args: ["-e", "setInterval(()=>{},10000)"],
      cwd: f.cwd, env: process.env, timeoutMs: 350,
    });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.exitCode, 0);
    assert.ok(Date.now() - started < 12000);
  } finally { f.clean(); }
});

test("free admission refuses paid model, unsafe profile, and missing online consent", async () => {
  const f = fixture();
  const options = {
    parent: f.root, executable: process.execPath,
    env: { BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1" },
  };
  try {
    await assert.rejects(() => admitFreeOpenCodeModel({ ...options, model: "openai/gpt-6" }), /free test models/);
    await assert.rejects(() => admitFreeOpenCodeModel({ ...options, parent: os.homedir() }), /outside disposable/);
    await assert.rejects(() => admitFreeOpenCodeModel({
      ...options, model: "opencode/deepseek-v4.1-flash-free", env: {},
    }), /Explicit free online-model permission/);
    assert.ok(!fs.readdirSync(f.root).some(name => name.startsWith("opencode-free-preflight-")));
  } finally { f.clean(); }
});
