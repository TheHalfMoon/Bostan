import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createEmbeddedPostgresSupervisor, type SupervisedEmbeddedPostgres } from "../embedded-postgres-supervisor.js";

function instance() {
  const process = new EventEmitter();
  const owned: SupervisedEmbeddedPostgres = {
    process,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
  return { owned, process };
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

describe("embedded PostgreSQL supervisor observer and shutdown admission", () => {
  it("continues recovery when the unexpected-exit observer throws", async () => {
    const original = instance();
    const replacement = instance();
    const createInstance = vi.fn(() => replacement.owned);
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: original.owned,
      createInstance,
      restartDelaysMs: [0],
      onUnexpectedExit: () => { throw new Error("synthetic observer failure"); },
    });
    expect(() => original.process.emit("exit", 1, null)).not.toThrow();
    await supervisor.waitForRecovery();
    expect(createInstance).toHaveBeenCalledOnce();
    expect(replacement.owned.start).toHaveBeenCalledOnce();
    expect(supervisor.current()).toBe(replacement.owned);
  });

  it("does not start a second live replacement when the restarted observer throws", async () => {
    const original = instance();
    const replacements = [instance(), instance()];
    const createInstance = vi.fn()
      .mockReturnValueOnce(replacements[0]!.owned)
      .mockReturnValueOnce(replacements[1]!.owned);
    const onRestartAttemptFailed = vi.fn();
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: original.owned,
      createInstance,
      restartDelaysMs: [0, 0],
      onRestarted: () => { throw new Error("synthetic restarted observer failure"); },
      onRestartAttemptFailed,
    });
    original.process.emit("exit", 1, null);
    await supervisor.waitForRecovery();
    expect(createInstance).toHaveBeenCalledOnce();
    expect(replacements[0]!.owned.start).toHaveBeenCalledOnce();
    expect(replacements[0]!.owned.stop).not.toHaveBeenCalled();
    expect(replacements[1]!.owned.start).not.toHaveBeenCalled();
    expect(onRestartAttemptFailed).not.toHaveBeenCalled();
    expect(supervisor.current()).toBe(replacements[0]!.owned);
  });

  it("does not create a replacement after shutdown begins during beforeRestart", async () => {
    const original = instance();
    const waiting = gate();
    const beforeRestart = vi.fn(() => waiting.promise);
    const createInstance = vi.fn(() => instance().owned);
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: original.owned,
      createInstance,
      restartDelaysMs: [0],
      beforeRestart,
    });
    original.process.emit("exit", 1, null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(beforeRestart).toHaveBeenCalledOnce();
    const stopping = supervisor.shutdown();
    waiting.release();
    await stopping;
    expect(createInstance).not.toHaveBeenCalled();
    expect(original.owned.stop).not.toHaveBeenCalled();
  });
});
