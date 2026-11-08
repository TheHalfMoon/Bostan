import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BOSTAN_USER_AGENT,
  BOSTAN_CHAT_ATTACHMENTS_USER_AGENT,
  BOSTAN_GITHUB_COMMIT_USER_AGENT,
  BOSTAN_GITHUB_OBJECT_USER_AGENT,
} from "../services/bostan-user-agents.js";

/**
 * Source-owned outbound headers must identify the user-facing Bostan product.
 * This is scoped to HTTP client identity only; old upstream skill IDs, Git refs,
 * compatibility env vars and legally required license attribution are untouched.
 */
describe("Bostan outbound HTTP client identity contract", () => {
  it("uses bounded stable first-party identity values", () => {
    expect(BOSTAN_USER_AGENT).toBe("Bostan/1.0");
    expect(BOSTAN_CHAT_ATTACHMENTS_USER_AGENT).toBe("Bostan/ChatAttachments");
    expect(BOSTAN_GITHUB_COMMIT_USER_AGENT).toBe("Bostan/CommitResolver");
    expect(BOSTAN_GITHUB_OBJECT_USER_AGENT).toBe("Bostan/ExternalObjectResolver");
  });

  for (const relative of [
    "../services/remote-http-fetch.ts",
    "../services/chat-github-attachments.ts",
    "../services/provider-billing-import.ts",
    "../services/connectors/vercel/index.ts",
    "../services/github-commit-details.ts",
    "../services/github-external-object-provider.ts",
  ]) {
    it(`does not advertise an upstream User-Agent from ${relative}`, () => {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      expect(source).toMatch(/BOSTAN_(?:CHAT_ATTACHMENTS_|GITHUB_COMMIT_|GITHUB_OBJECT_)?USER_AGENT/);
      expect(source).not.toMatch(/Paperclip\/|paperclip-(?:work-product|external-object)-resolver|\b"User-Agent": "Paperclip"/);
    });
  }
});
