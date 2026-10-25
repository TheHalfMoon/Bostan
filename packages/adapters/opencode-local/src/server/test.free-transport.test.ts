import { describe, expect, it } from "vitest";
import { safeOpenRouterFreeTransportSignal } from "./test.js";

describe("zero-price source-only OpenCode transport errors", () => {
  const model = "openrouter/cohere/north-mini-code:free";
  it.each([
    "ECONNRESET", "FetchError: fetch failed",
    "ECONNREFUSED connecting", "ETIMEDOUT",
    "network error while fetching", "connection timed out",
    "EAI_AGAIN", "ENOTFOUND",
  ])("identifies explicit connection errors: %s", error => {
    expect(safeOpenRouterFreeTransportSignal(model, error)).toBe(true);
  });
  it.each([
    "Model not found", "Request failed: 429", "Quota exceeded",
    "Authentication required", "Hello, how can I help?",
    "timeout configured to 60 seconds", "",
  ])("never guesses transport error from unrelated text", error => {
    expect(safeOpenRouterFreeTransportSignal(model, error)).toBe(false);
  });
  it.each([
    "openrouter/cohere/north-mini-code", "opencode/beam-free",
    "openrouter/cohere/north-mini-code:paid",
    "openrouter/../north-mini-code:free",
  ])("refuses unsupported model identities", modelId => {
    expect(safeOpenRouterFreeTransportSignal(modelId, "ECONNRESET")).toBe(false);
  });
  it("fails closed on oversized error material", () => {
    expect(safeOpenRouterFreeTransportSignal(model, "ECONNRESET".repeat(15000))).toBe(false);
  });
});
