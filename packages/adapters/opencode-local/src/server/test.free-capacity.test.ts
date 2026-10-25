import { describe, expect, it } from "vitest";
import { safeOpenRouterFreeCapacitySignal } from "./test.js";

describe("safe zero-price OpenRouter capacity evidence admission", () => {
  const model = "openrouter/cohere/north-mini-code:free";
  it.each([
    "HTTP 429 Too Many Requests", "RateLimitError: current limit reached",
    "Provider overloaded: temporary capacity exhausted",
    "quota exhausted; please wait", "resource exhausted",
  ])("classifies explicit rate/capacity signal without emitting raw provider output", (evidence) => {
    expect(safeOpenRouterFreeCapacitySignal(model, evidence)).toBe(true);
  });
  it.each([
    "hello", "Network timeout", "Authentication required",
    "OpenRouter provider unknown", "Model not found", "Internal server error",
    "Rate: 14 tokens / 10 seconds",
  ])("does not mistake unrelated errors for rate/capacity evidence", (evidence) => {
    expect(safeOpenRouterFreeCapacitySignal(model, evidence)).toBe(false);
  });
  it.each([
    "openrouter/cohere/north-mini-code", "opencode/beam-free",
    "openrouter/cohere/north-mini-code:paid",
    "openrouter/cohere/north-mini-code:FREE",
    "openrouter/../north-mini-code:free", "",
  ])("never assumes a model without exact zero-price identity has provider limit", (modelId) => {
    expect(safeOpenRouterFreeCapacitySignal(modelId, "HTTP 429 Too Many Requests")).toBe(false);
  });
});
