import { describe, expect, it } from "vitest";
import { agentNetworkPostureView } from "./agent-network-posture.js";

const linuxWithSandbox = { platform: "linux" as const, sandboxAvailable: () => true };

describe("agentNetworkPostureView", () => {
  it("is not applicable to adapters that do not run a local agent process", () => {
    expect(agentNetworkPostureView({ adapterType: "openclaw_gateway", adapterConfig: {} })).toEqual({ mode: "not_applicable" });
  });

  it("shows the enforced default allowlist for sandboxed adapters on Linux", () => {
    expect(agentNetworkPostureView({ adapterType: "claude_local", adapterConfig: {} }, linuxWithSandbox)).toMatchObject({
      mode: "enforced",
      scope: "allowlist",
      allowlist: ["api.anthropic.com"],
      defaulted: true,
      acknowledged: true,
    });
  });

  it("requires an acknowledgement when access is unrestricted on this host", () => {
    const view = agentNetworkPostureView({ adapterType: "codex_local", adapterConfig: {} }, { platform: "win32", sandboxAvailable: () => true });
    expect(view).toMatchObject({ mode: "unrestricted", reason: "unsupported_platform", acknowledged: false });
    expect("description" in view && view.description).toContain("UNRESTRICTED");
  });

  it("treats an acknowledgement as valid only for the reason it was given", () => {
    const metadata = { networkPostureAcknowledgement: { reason: "unsupported_platform", acknowledgedAt: "2026-11-09T00:00:00Z" } };
    expect(agentNetworkPostureView({ adapterType: "claude_local", adapterConfig: {}, metadata }, { platform: "win32", sandboxAvailable: () => true }))
      .toMatchObject({ acknowledged: true });
    // A different reason (sandbox missing on Linux) needs a fresh acknowledgement.
    expect(agentNetworkPostureView({ adapterType: "claude_local", adapterConfig: {}, metadata }, { platform: "linux", sandboxAvailable: () => false }))
      .toMatchObject({ reason: "sandbox_unavailable", acknowledged: false });
  });

  it("flags local adapters without network controls", () => {
    expect(agentNetworkPostureView({ adapterType: "gemini_local", adapterConfig: {} }, linuxWithSandbox))
      .toMatchObject({ mode: "unrestricted", reason: "adapter_unsupported", acknowledged: false });
  });

  it("reports an explicit opt-out and invalid settings distinctly", () => {
    expect(agentNetworkPostureView({ adapterType: "claude_local", adapterConfig: { networkScope: "unrestricted" } }, linuxWithSandbox))
      .toMatchObject({ mode: "unrestricted", reason: "explicit_opt_out" });
    expect(agentNetworkPostureView({ adapterType: "claude_local", adapterConfig: { networkScope: "open" } }, linuxWithSandbox))
      .toMatchObject({ mode: "unrestricted", reason: "invalid_settings", acknowledged: false });
  });
});
