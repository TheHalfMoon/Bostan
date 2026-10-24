import { describe, expect, it } from "vitest";
import { canDeferModelConnection, isPersistedDeferredAgent } from "./onboarding-defer";

const ready = {
  companyId: "company-1", setupAgentId: "agent-setup-1",
  setupPrepared: true, createdAgentId: null,
  loading: false, hireInFlight: false,
};

describe("Bostan model setup deferral", () => {
  it("allows a persisted pending setup without credentials", () => {
    expect(canDeferModelConnection(ready)).toBe(true);
  });
  it("rejects missing or in-flight setup and prevents skipping a hired agent", () => {
    expect(canDeferModelConnection({ ...ready, setupPrepared: false })).toBe(false);
    expect(canDeferModelConnection({ ...ready, setupAgentId: null })).toBe(false);
    expect(canDeferModelConnection({ ...ready, companyId: null })).toBe(false);
    expect(canDeferModelConnection({ ...ready, createdAgentId: "hired" })).toBe(false);
    expect(canDeferModelConnection({ ...ready, loading: true })).toBe(false);
    expect(canDeferModelConnection({ ...ready, hireInFlight: true })).toBe(false);
  });
  it("accepts only the server-confirmed paused setup, never an active agent", () => {
    const agent = { id: "a", companyId: "c", lifecycleState: "paused", pauseReason: "setup" };
    expect(isPersistedDeferredAgent(agent, "c", "a")).toBe(true);
    expect(isPersistedDeferredAgent({ ...agent, lifecycleState: "running" }, "c", "a")).toBe(false);
    expect(isPersistedDeferredAgent({ ...agent, pauseReason: null }, "c", "a")).toBe(false);
    expect(isPersistedDeferredAgent(agent, "wrong", "a")).toBe(false);
    expect(isPersistedDeferredAgent(agent, "c", "wrong")).toBe(false);
    expect(isPersistedDeferredAgent(undefined, "c", "a")).toBe(false);
  });
});
