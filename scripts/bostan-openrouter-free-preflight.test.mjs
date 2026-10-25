import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  admitOpenRouterZeroCostQa, resolveLocalOpenRouterQaKey,
  selectVerifiedFreeOpenRouterModel,
} from "./bostan-openrouter-free-preflight.mjs";
import { qualifyFreeQaModel, isOpenRouterFreeQaModel } from "./bostan-free-model-policy.mjs";
const model = "openrouter/cohere/north-mini-code:free";
const key = "sk-or-" + "z".repeat(36);
const row = { id: "cohere/north-mini-code:free",
  pricing: { prompt: "0", completion: "0", request: "0" },
  supported_parameters: ["tools", "temperature"] };
const catalog = { data: [row] };
const env = { OPENROUTER_API_KEY: key, BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1" };

test("only pinned free models are accepted, never arbitrary free-looking aliases or paid names", () => {
  assert.equal(qualifyFreeQaModel(model), model);
  assert.equal(qualifyFreeQaModel("openrouter/recursive/flint-v1.0:free"),
    "openrouter/recursive/flint-v1.0:free");
  assert.equal(isOpenRouterFreeQaModel(model), true);
  for (const v of ["openrouter/openrouter/free", "openrouter/cohere/north-mini-code",
    "openrouter/anthropic/claude-sonnet-5.5", "openrouter/google/gemini-pro:free"]) {
    assert.throws(() => qualifyFreeQaModel(v), /Only explicitly permitted/);
  }
});

test("zero-price, tool-capable public catalog qualifies a single exact pinned slug", () => {
  assert.equal(selectVerifiedFreeOpenRouterModel(catalog, model), model);
  for (const override of [
    { pricing: { prompt: "0.0001", completion: "0" } },
    { pricing: { prompt: "0", completion: "0.01" } },
    { pricing: { prompt: "0", completion: "0", request: "0.01" } },
    { supported_parameters: ["temperature"] }, { id: "other:free" },
  ]) {
    assert.throws(() => selectVerifiedFreeOpenRouterModel({
      data: [{ ...row, ...override }],
    }, model), /Refusing OpenRouter route/);
  }
  assert.throws(() => selectVerifiedFreeOpenRouterModel({ data: [] }, model), /Refusing/);
});

test("preflight reads public metadata only and never sends the key to model catalog", async () => {
  let seen = 0;
  const result = await admitOpenRouterZeroCostQa({
    model, env,
    fetchCatalog: async (url, options) => {
      seen += 1;
      assert.equal(url, "https://openrouter.ai/api/v1/models");
      assert.equal(options.method, "GET");
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.headers.authorization, undefined);
      return { ok: true, json: async () => catalog };
    },
  });
  assert.equal(seen, 1);
  assert.deepEqual(result, { model, key });
});

test("preflight refuses missing opt-in, paid catalog, malformed JSON, and absent credentials", async () => {
  const fake = async () => ({ ok: true, json: async () => catalog });
  await assert.rejects(admitOpenRouterZeroCostQa({
    model, env: { OPENROUTER_API_KEY: key }, fetchCatalog: fake,
  }), /explicit free-only/);
  await assert.rejects(admitOpenRouterZeroCostQa({
    model, env: { BOSTAN_E2E_ALLOW_FREE_REMOTE_MODEL: "1" }, fetchCatalog: fake,
  }), /requires a key/);
  await assert.rejects(admitOpenRouterZeroCostQa({
    model, env, fetchCatalog: async () => ({ ok: false }),
  }), /could not be verified/);
  await assert.rejects(admitOpenRouterZeroCostQa({
    model, env, fetchCatalog: async () => ({ ok: true, json: async () => { throw Error("invalid"); } }),
  }), /catalog was invalid/);
});

test("saved OpenCode credential import is opt-in and only reads owned nonsymlinked local profile", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "bostan-saved-openrouter-fixture-"));
  try {
    const file = path.join(home, ".local", "share", "opencode", "auth.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ openrouter: { type: "api", key } }), { mode: 0o600 });
    assert.throws(() => resolveLocalOpenRouterQaKey({}, home), /requires a key/);
    assert.equal(resolveLocalOpenRouterQaKey({
      BOSTAN_E2E_USE_SAVED_OPENROUTER_AUTH: "1",
    }, home), key);
    fs.unlinkSync(file);
    const savedAuthConsent = { BOSTAN_E2E_USE_SAVED_OPENROUTER_AUTH: "1" };
    // Windows cannot always create symlinks without Developer Mode or admin
    // rights. Do not weaken production link rejection just to run the test:
    // cover actual Unix symlink rejection on Unix; cover linked-file refusal
    // via ordinary same-volume hardlinks on both NTFS and Unix filesystems.
    if (process.platform !== "win32") {
      fs.symlinkSync("/dev/null", file);
      assert.throws(() => resolveLocalOpenRouterQaKey(savedAuthConsent, home),
        /missing or unsafe/);
      fs.unlinkSync(file);
    }
    const backing = path.join(path.dirname(file), "linked-auth-backing.json");
    fs.writeFileSync(backing, JSON.stringify({ openrouter: { type: "api", key } }),
      { mode: 0o600 });
    fs.linkSync(backing, file);
    assert.ok(fs.lstatSync(file).nlink > 1,
      "The attacker-controlled auth path must actually be a hardlink");
    assert.throws(() => resolveLocalOpenRouterQaKey(savedAuthConsent, home),
      /missing or unsafe/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
