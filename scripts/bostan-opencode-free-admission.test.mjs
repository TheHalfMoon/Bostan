import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isolatedOpenCodeAdmissionEnvironment,
  freeModelResponseMatches,
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
