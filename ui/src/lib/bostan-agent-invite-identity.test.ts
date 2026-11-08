import { describe, expect, it } from "vitest";
import { buildAgentOnboardingPrompt } from "./agent-onboarding-prompt";
import { buildDotSetupPrompt } from "./dot-setup-prompt";
import { buildGrokAccessPrompt, buildGrokRoutinePrompt } from "./grok-bot-setup-prompt";

describe("B6-03 agent invitation and connection identity", () => {
  it("invites external agents into Bostan without changing actual legacy keys", () => {
    const instructions = buildAgentOnboardingPrompt({
      onboardingTextUrl: "https://bostan.example/api/invites/invite-1/onboarding.txt",
    });
    expect(instructions).toContain("join a Bostan company");
    expect(instructions).toContain("BOSTAN_ALLOWED_HOSTNAMES=<host>");
    expect(instructions).not.toContain("npx paperclipai");
    expect(instructions).toContain("PAPERCLIP_API_KEY");
    expect(instructions).toContain("agentDefaultsPayload.paperclipApiUrl");
    expect(instructions).not.toMatch(/\bPaperclip\b/);
  });

  it("labels the Dot agent and company as Bostan while preserving tool contracts", () => {
    const prompt = buildDotSetupPrompt({
      companyId: "company-1", agentId: "agent-1",
      resourceUrl: "https://bostan.example/mcp/runner",
      pairingCode: "sample-code", expiresAt: "2026-10-25T16:00:00Z",
    });
    expect(prompt).toContain('private MCP plugin named "Bostan Dot"');
    expect(prompt).toContain("Bostan company: company-1");
    expect(prompt).toContain("paperclip_dot_inbox");
    expect(prompt).toContain("paperclip.dot.mailbox_updated");
    expect(prompt).not.toMatch(/\bPaperclip\b/);
  });

  it("labels Grok setup and routine as Bostan without changing wake protocol", () => {
    const connection = buildGrokAccessPrompt("https://bostan.example/mcp/runner", "Grok");
    const routine = buildGrokRoutinePrompt("binding-1", "Grok");
    expect(connection).toContain("Connect this Grok Bot (Grok) to Bostan");
    expect(routine).toContain('routine named "Bostan work — Grok"');
    expect(routine).toContain("paperclip.external_bot_wake.v1");
    expect(routine).toContain("paperclip_grok_ack_wake");
    expect(connection).not.toMatch(/\bPaperclip\b/);
    expect(routine).not.toMatch(/\bPaperclip\b/);
  });
});
