import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createEmbeddedPostgresSupervisor, type SupervisedEmbeddedPostgres } from "../embedded-postgres-supervisor.js";

function createInstance(startError?: Error) {
  const process = new EventEmitter();
  const instance: SupervisedEmbeddedPostgres = {
    process,
    start: vi.fn(async () => { if (startError) throw startError; }),
    stop: vi.fn(async () => undefined),
  };
  return { instance, process };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("embedded PostgreSQL supervisor", () => {
  it("restarts PostgreSQL after its managed child exits unexpectedly", async () => {
    const initial = createInstance();
    const replacement = createInstance();
    const onRestarted = vi.fn();
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: () => replacement.instance,
      restartDelaysMs: [0],
      onRestarted,
    });
    initial.process.emit("exit", 137, "SIGKILL");
    await supervisor.waitForRecovery();
    expect(replacement.instance.start).toHaveBeenCalledOnce();
    expect(supervisor.current()).toBe(replacement.instance);
    expect(onRestarted).toHaveBeenCalledWith(1);
  });

  it("does not restart PostgreSQL during orderly shutdown", async () => {
    const initial = createInstance();
    const createReplacement = vi.fn(() => createInstance().instance);
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: createReplacement,
      restartDelaysMs: [0],
    });
    await supervisor.shutdown();
    expect(initial.instance.stop).toHaveBeenCalledOnce();
    expect(createReplacement).not.toHaveBeenCalled();
  });

  it("shares one pending shutdown with every concurrent caller", async () => {
    const initial = createInstance();
    const stopGate = deferred();
    const stop = vi.fn(() => stopGate.promise);
    initial.instance.stop = stop;
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: () => createInstance().instance,
    });

    const first = supervisor.shutdown();
    const second = supervisor.shutdown();
    expect(second).toBe(first);
    let secondFinished = false;
    void second.then(() => { secondFinished = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(stop).toHaveBeenCalledOnce();
    expect(secondFinished).toBe(false);

    stopGate.resolve();
    await Promise.all([first, second]);
    expect(secondFinished).toBe(true);
    await supervisor.shutdown();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("reports the same native stop rejection to all concurrent callers", async () => {
    const initial = createInstance();
    const stopFailure = new Error("synthetic native stop refusal");
    const stop = vi.fn(async () => { throw stopFailure; });
    initial.instance.stop = stop;
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: () => createInstance().instance,
    });
    const first = supervisor.shutdown();
    const second = supervisor.shutdown();
    await expect(first).rejects.toBe(stopFailure);
    await expect(second).rejects.toBe(stopFailure);
    expect(stop).toHaveBeenCalledOnce();
    await expect(supervisor.shutdown()).rejects.toBe(stopFailure);
  });

  it("waits for an in-flight recovery replacement to stop before both shutdowns resolve", async () => {
    const initial = createInstance();
    const replacement = createInstance();
    const startGate = deferred();
    const stopGate = deferred();
    replacement.instance.start = vi.fn(() => startGate.promise);
    const stopReplacement = vi.fn(() => stopGate.promise);
    replacement.instance.stop = stopReplacement;
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: () => replacement.instance,
      restartDelaysMs: [0],
    });

    initial.process.emit("exit", 137, "SIGKILL");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(replacement.instance.start).toHaveBeenCalledOnce();

    const first = supervisor.shutdown();
    const second = supervisor.shutdown();
    expect(second).toBe(first);
    startGate.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(stopReplacement).toHaveBeenCalledOnce();
    let secondFinished = false;
    void second.then(() => { secondFinished = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(secondFinished).toBe(false);
    stopGate.resolve();
    await Promise.all([first, second]);
    expect(stopReplacement).toHaveBeenCalledOnce();
    expect(initial.instance.stop).not.toHaveBeenCalled();
  });

  it("propagates a recovery replacement stop rejection to every shutdown caller", async () => {
    const initial = createInstance();
    const replacement = createInstance();
    const started = deferred();
    const stopError = new Error("replacement stop refused");
    replacement.instance.start = vi.fn(() => started.promise);
    replacement.instance.stop = vi.fn(async () => { throw stopError; });
    const onFailed = vi.fn();
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: () => replacement.instance,
      restartDelaysMs: [0],
      onRestartAttemptFailed: onFailed,
    });

    initial.process.emit("exit", 137, "SIGKILL");
    await new Promise<void>((resolve) => setImmediate(resolve));
    const first = supervisor.shutdown();
    const second = supervisor.shutdown();
    started.resolve();
    await expect(first).rejects.toBe(stopError);
    await expect(second).rejects.toBe(stopError);
    expect(replacement.instance.stop).toHaveBeenCalledOnce();
  });

  it("stops a failed-start owned replacement before retrying recovery", async () => {
    const initial = createInstance();
    const failed = createInstance(new Error("synthetic start failure"));
    const next = createInstance();
    const stopGate = deferred();
    failed.instance.stop = vi.fn(() => stopGate.promise);
    const createReplacement = vi.fn()
      .mockReturnValueOnce(failed.instance)
      .mockReturnValueOnce(next.instance);
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: createReplacement,
      restartDelaysMs: [0, 0],
    });

    initial.process.emit("exit", 1, null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(failed.instance.start).toHaveBeenCalledOnce();
    expect(failed.instance.stop).toHaveBeenCalledOnce();
    expect(createReplacement).toHaveBeenCalledTimes(1);

    stopGate.resolve();
    await supervisor.waitForRecovery();
    expect(createReplacement).toHaveBeenCalledTimes(2);
    expect(next.instance.start).toHaveBeenCalledOnce();
    expect(supervisor.current()).toBe(next.instance);
  });

  it("fails closed when a failed-start replacement cannot be verified stopped", async () => {
    const initial = createInstance();
    const failed = createInstance(new Error("synthetic start failure"));
    const stopError = new Error("synthetic native stop refusal");
    failed.instance.stop = vi.fn(async () => { throw stopError; });
    const createReplacement = vi.fn(() => failed.instance);
    const onRecoveryExhausted = vi.fn();
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: createReplacement,
      restartDelaysMs: [0, 0, 0],
      onRecoveryExhausted,
    });

    initial.process.emit("exit", 1, null);
    await expect(supervisor.waitForRecovery()).rejects.toThrow("replacement stop unverified");
    expect(failed.instance.stop).toHaveBeenCalledOnce();
    expect(createReplacement).toHaveBeenCalledOnce();
    expect(onRecoveryExhausted).toHaveBeenCalledOnce();
    await expect(supervisor.shutdown()).rejects.toThrow("replacement stop unverified");
  });

  it("does not report shutdown complete while a failed-start replacement stop is pending", async () => {
    const initial = createInstance();
    const failed = createInstance(new Error("synthetic start failure"));
    const stopGate = deferred();
    failed.instance.stop = vi.fn(() => stopGate.promise);
    const createReplacement = vi.fn(() => failed.instance);
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: createReplacement,
      restartDelaysMs: [0, 0],
    });

    initial.process.emit("exit", 1, null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const first = supervisor.shutdown();
    const second = supervisor.shutdown();
    expect(second).toBe(first);
    let settled = false;
    void first.then(() => { settled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(failed.instance.stop).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    stopGate.resolve();
    await Promise.all([first, second]);
    expect(createReplacement).toHaveBeenCalledOnce();
    expect(initial.instance.stop).not.toHaveBeenCalled();
  });

  it("bounds recovery attempts and reports the final failure", async () => {
    const initial = createInstance();
    const failures = [new Error("first"), new Error("second"), new Error("third")];
    const onRecoveryExhausted = vi.fn();
    const supervisor = createEmbeddedPostgresSupervisor({
      initialInstance: initial.instance,
      createInstance: () => createInstance(failures.shift()).instance,
      restartDelaysMs: [0, 0, 0],
      onRecoveryExhausted,
    });
    initial.process.emit("exit", 1, null);
    await supervisor.waitForRecovery();
    expect(onRecoveryExhausted).toHaveBeenCalledOnce();
    expect(onRecoveryExhausted).toHaveBeenCalledWith(expect.objectContaining({ message: "third" }));
  });
});
