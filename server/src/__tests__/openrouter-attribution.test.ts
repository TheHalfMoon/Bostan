import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { AiProviderRouting } from "@bostan/shared";
import { isOpenRouterUrl, OPENROUTER_ATTRIBUTION_HEADERS } from "@bostan/shared/openrouter-attribution";
import { managedProviderRouting } from "../services/ai-provider-routing.js";

describe("Paperclip OpenRouter connection attribution", () => {
  // The standalone Runner copy is pinned by the qualified Pi ACPX profile
  // (openRouterAttributionSourceSha256), so it keeps the donor attribution values
  // until a Pi profile requalification moves it to the Bostan policy. Until then it
  // must not drift, and its destination matching must agree with the control plane.
  it("keeps the standalone Runner policy frozen at its qualified profile pin", async () => {
    const runnerUrl = new URL("../../../packages/paperclip-runner/src/drivers/openrouter-attribution.ts", import.meta.url);
    const profile = JSON.parse(await readFile(new URL("../../../packages/paperclip-runner/test-fixtures/pi-acp/profile-v28-identity.json", import.meta.url), "utf8"));
    expect(createHash("sha256").update(await readFile(runnerUrl)).digest("hex")).toBe(profile.declaration.openRouterAttributionSourceSha256);
    const runner = await import(runnerUrl.href) as typeof import("@bostan/shared/openrouter-attribution");
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
