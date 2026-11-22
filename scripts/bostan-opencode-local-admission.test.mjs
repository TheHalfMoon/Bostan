import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectLocalOllamaModel,
  LOCAL_OLLAMA_HOST,
  LOCAL_OLLAMA_MANIFEST_DIGEST,
  LOCAL_OPENCODE_QA_MODEL,
  qualifyLoopbackOllamaHost,
} from "./bostan-opencode-local-admission.mjs";
import {
  qualifyLocalOpenCodeQaModel,
  qualifyNativeOpenCodeQaModel,
} from "./bostan-free-model-policy.mjs";

test("admits only the pinned local Qwen model through loopback Ollama", async () => {
  assert.equal(qualifyLocalOpenCodeQaModel(LOCAL_OPENCODE_QA_MODEL), LOCAL_OPENCODE_QA_MODEL);
  assert.equal(qualifyNativeOpenCodeQaModel(LOCAL_OPENCODE_QA_MODEL), LOCAL_OPENCODE_QA_MODEL);
  assert.equal(qualifyLoopbackOllamaHost(), LOCAL_OLLAMA_HOST);
  assert.equal(qualifyLoopbackOllamaHost("http://localhost:11434"), LOCAL_OLLAMA_HOST);
  for (const model of ["ollama/other:latest", "openrouter/example:free", "https://example.invalid"]) {
    assert.throws(() => qualifyLocalOpenCodeQaModel(model), /explicitly permitted local OpenCode QA model/);
  }
  for (const endpoint of ["http://0.0.0.0:11434", "http://192.0.2.10:11434", "https://127.0.0.1:11434", "http://user@127.0.0.1:11434"]) {
    assert.throws(() => qualifyLoopbackOllamaHost(endpoint), /private loopback listener/);
  }
  const model = await inspectLocalOllamaModel({ fetchImpl: async url => {
    assert.equal(String(url), `${LOCAL_OLLAMA_HOST}/api/tags`);
    return { ok: true, json: async () => ({ models: [{
      name: "qwen2.5-coder:1.5b", digest: LOCAL_OLLAMA_MANIFEST_DIGEST, size: 986_048_576,
    }] }) };
  } });
  assert.deepEqual(model, {
    model: LOCAL_OPENCODE_QA_MODEL,
    digest: LOCAL_OLLAMA_MANIFEST_DIGEST,
    size: 986_048_576,
    endpoint: LOCAL_OLLAMA_HOST,
  });
});

test("rejects an absent or changed local model before OpenCode starts", async () => {
  await assert.rejects(inspectLocalOllamaModel({ fetchImpl: async () => ({
    ok: true,
    json: async () => ({ models: [{ name: "qwen2.5-coder:1.5b", digest: "sha256:0000", size: 986_048_576 }] }),
  }) }), /pinned local Qwen2.5 Coder 1.5B model is not installed/);
});
