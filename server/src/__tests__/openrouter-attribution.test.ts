import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { AiProviderRouting } from "@bostan/shared";
import { isOpenRouterUrl, OPENROUTER_ATTRIBUTION_HEADERS } from "@bostan/shared/openrouter-attribution";
import { managedProviderRouting } from "../services/ai-provider-routing.js";

describe("Bostan OpenRouter connection attribution", () => {
  it("keeps Runner and control-plane attribution byte-identical", async () => {
    const runnerUrl = new URL("../../../packages/bostan-runner/src/drivers/openrouter-attribution.ts", import.meta.url);
    const sharedUrl = new URL("../../../packages/shared/src/openrouter-attribution.ts", import.meta.url);
    expect(await readFile(runnerUrl)).toEqual(await readFile(sharedUrl));
    const runner = await import(runnerUrl.href) as typeof import("@bostan/shared/openrouter-attribution");
    expect(runner.openRouterAttributionHeaders({ "hTtP-rEfErEr": "https://paperclip.ing", "x-title": "Paperclip",
      "X-OPENROUTER-TITLE": "Paperclip", Authorization: "Bearer fixture-key", "X-Route": "fixture" }))
      .toEqual({ Authorization: "Bearer fixture-key", "X-Route": "fixture", ...OPENROUTER_ATTRIBUTION_HEADERS });
    for (const url of ["https://openrouter.ai/api/v1", "https://eu.openrouter.ai/api/v1", "https://us.openrouter.ai/api/v1",
      "http://openrouter.ai/api", "https://openrouter.ai.evil.test", "https://user:secret@openrouter.ai/api", "https://api.anthropic.com"]) {
      expect(runner.isOpenRouterUrl(url)).toBe(isOpenRouterUrl(url));
    }
  });
  it.each(["codex_local", "claude_local", "opencode_local", "hermes_local"])("attributes managed and custom OpenRouter connections for %s", harness => {
    for (const route of [
      { kind: "openrouter", protocol: "chat", auth: "bearer", models: [] },
      { kind: "gateway", protocol: "chat", auth: "bearer", models: [], baseUrl: "https://openrouter.ai/api/v1" },
      { kind: "gateway", protocol: "chat", auth: "bearer", models: [], baseUrl: "https://eu.openrouter.ai/api/v1" },
      { kind: "gateway", protocol: "chat", auth: "bearer", models: [], baseUrl: "https://us.openrouter.ai/api/v1" },
    ] satisfies AiProviderRouting[]) {
      const result = managedProviderRouting(route, harness, "fixture-key", "vendor/model");
      const output = JSON.stringify(result);
      for (const value of Object.values(OPENROUTER_ATTRIBUTION_HEADERS)) expect(output).toContain(value);
    }
  });
  it.each(["codex_local", "claude_local", "opencode_local", "hermes_local"])("does not add attribution to unrelated %s endpoints", harness => {
    const result = managedProviderRouting({ kind: "gateway", protocol: "chat", auth: "bearer", models: [], baseUrl: "https://gateway.example/v1" }, harness, "fixture-key", "model");
    expect(JSON.stringify(result)).not.toMatch(/HTTP-Referer|X-Title|X-OpenRouter/);
  });
});
