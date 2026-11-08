// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentNetworkPostureView } from "@bostan/shared";
import { AgentNetworkPostureBanner } from "./AgentNetworkPostureBanner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

function render(networkPosture: AgentNetworkPostureView | undefined, onAcknowledge = vi.fn(async () => undefined)) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <AgentNetworkPostureBanner agent={{ networkPosture, metadata: { keep: "me" } }} onAcknowledge={onAcknowledge} />,
    );
  });
  return { container, onAcknowledge };
}

const unrestricted: AgentNetworkPostureView = {
  mode: "unrestricted",
  reason: "unsupported_platform",
  description: "network access is UNRESTRICTED (network rules are not enforceable on win32)",
  acknowledged: false,
};

describe("AgentNetworkPostureBanner", () => {
  it("asks the operator to acknowledge an unrestricted posture and saves the reason with existing metadata", async () => {
    const { container, onAcknowledge } = render(unrestricted);
    expect(container.querySelector('[data-agent-network-posture="unrestricted"]')?.textContent).toContain("UNRESTRICTED");
    const button = [...container.querySelectorAll("button")].find((element) => element.textContent === "I understand");
    expect(button).toBeDefined();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onAcknowledge).toHaveBeenCalledWith({
      metadata: {
        keep: "me",
        networkPostureAcknowledgement: { reason: "unsupported_platform", acknowledgedAt: expect.any(String) },
      },
    });
  });

  it("shows an acknowledged posture as information without a button", () => {
    const { container } = render({ ...unrestricted, acknowledged: true });
    expect(container.querySelector('[data-agent-network-posture="acknowledged"]')).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("does not offer to acknowledge invalid network settings", () => {
    const { container } = render({ ...unrestricted, reason: "invalid_settings", description: "network settings are invalid" });
    expect(container.querySelector('[data-agent-network-posture="unrestricted"]')).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows enforced restrictions and renders nothing when not applicable", () => {
    const { container } = render({
      mode: "enforced",
      scope: "allowlist",
      allowlist: ["api.anthropic.com"],
      defaulted: true,
      description: "network limited to api.anthropic.com (default)",
      acknowledged: true,
    });
    expect(container.querySelector('[data-agent-network-posture="enforced"]')?.textContent).toContain("api.anthropic.com");
    act(() => root?.unmount());
    root = null;
    container.remove();

    const empty = render({ mode: "not_applicable" });
    expect(empty.container.innerHTML).toBe("");
  });
});
