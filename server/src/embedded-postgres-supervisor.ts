export type EmbeddedPostgresExitListener = (code: number | null, signal: NodeJS.Signals | null) => void;

export interface SupervisedEmbeddedPostgres {
  start(): Promise<void>;
  stop(): Promise<void>;
  process?: { once(event: "exit", listener: EmbeddedPostgresExitListener): unknown };
}

export interface EmbeddedPostgresSupervisor {
  current(): SupervisedEmbeddedPostgres;
  shutdown(): Promise<void>;
  waitForRecovery(): Promise<void>;
}

type Options = {
  initialInstance: SupervisedEmbeddedPostgres;
  createInstance: () => SupervisedEmbeddedPostgres;
  beforeRestart?: (attempt: number) => Promise<void> | void;
  restartDelaysMs?: number[];
  delay?: (milliseconds: number) => Promise<void>;
  onUnexpectedExit?: EmbeddedPostgresExitListener;
  onRestartAttemptFailed?: (error: unknown, attempt: number) => void;
  onRestarted?: (attempt: number) => void;
  onRecoveryExhausted?: (error: unknown) => void;
};

const defaultDelay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createEmbeddedPostgresSupervisor(options: Options): EmbeddedPostgresSupervisor {
  const restartDelaysMs = options.restartDelaysMs ?? [0, 250, 1_000];
  const wait = options.delay ?? defaultDelay;
  let activeInstance = options.initialInstance;
  let activeInstanceExited = false;
  let shuttingDown = false;
  let recoveryPromise: Promise<void> | null = null;
  let shutdownPromise: Promise<void> | null = null;
  let unverifiedReplacementStop: Error | null = null;

  // Diagnostics are not native lifecycle authority. A throwing observer must
  // never authorize a second PostgreSQL start after an unverified stop.
  const reportRecoveryExhausted = (error: unknown) => {
    try {
      options.onRecoveryExhausted?.(error);
    } catch {
      // Preserve the actual native stop/recovery result.
    }
  };

  const recover = async () => {
    let lastError: unknown = new Error("Embedded PostgreSQL exited unexpectedly");
    for (let index = 0; index < restartDelaysMs.length; index += 1) {
      if (shuttingDown) return;
      const attempt = index + 1;
      const delayMs = restartDelaysMs[index] ?? 0;
      if (delayMs > 0) await wait(delayMs);
      if (shuttingDown) return;
      try {
        await options.beforeRestart?.(attempt);
        // Shutdown may begin while an asynchronous pre-restart hook runs.
        // Never allocate another native PostgreSQL process after that point.
        if (shuttingDown) return;
        const replacement = options.createInstance();
        try {
          await replacement.start();
        } catch (startError) {
          // A rejected start does not prove that the owned native process
          // never launched. Verify its stop before starting another cluster.
          try {
            await replacement.stop();
          } catch (stopError) {
            const unsafe = new Error(
              "Embedded PostgreSQL recovery replacement stop unverified after failed start",
              { cause: stopError },
            );
            unverifiedReplacementStop = unsafe;
            reportRecoveryExhausted(unsafe);
            // Stop retries: another cluster could collide with a still-live
            // failed replacement. Shutdown and waitForRecovery fail closed.
            if (shuttingDown) throw unsafe;
            return;
          }
          // Shutdown during the failed start waits for the owned stop above;
          // the old instance already emitted exit, so there is no live owner
          // left to stop and no reason to retry.
          if (shuttingDown) return;
          throw startError;
        }
        if (shuttingDown) {
          await replacement.stop();
          return;
        }
        activeInstance = replacement;
        activeInstanceExited = false;
        monitor(replacement);
        // A diagnostic observer cannot turn an already-running replacement
        // into a failed attempt: retrying would create a second live cluster.
        try {
          options.onRestarted?.(attempt);
        } catch {
          // The native recovery succeeded; observer errors are non-authoritative.
        }
        return;
      } catch (error) {
        // A shutdown waiting for recovery must not report successful teardown
        // after a replacement failed to stop.
        if (shuttingDown) throw error;
        lastError = error;
        try {
          options.onRestartAttemptFailed?.(error, attempt);
        } catch {
          // A diagnostic failure cannot cancel a safe bounded retry.
        }
      }
    }
    if (!shuttingDown) reportRecoveryExhausted(lastError);
  };

  const monitor = (instance: SupervisedEmbeddedPostgres) => {
    const child = instance.process;
    if (!child) {
      reportRecoveryExhausted(new Error("Embedded PostgreSQL started without a child process to monitor"));
      return;
    }
    child.once("exit", (code, signal) => {
      if (activeInstance !== instance) return;
      activeInstanceExited = true;
      if (shuttingDown) return;
      // Schedule recovery even when an optional diagnostic observer throws.
      // EventEmitter would otherwise propagate the exception before recovery.
      try {
        options.onUnexpectedExit?.(code, signal);
      } catch {
        // Native exit handling must not depend on observer success.
      }
      recoveryPromise = recover().finally(() => { recoveryPromise = null; });
    });
  };

  monitor(activeInstance);
  return {
    current: () => activeInstance,
    waitForRecovery: async () => {
      await recoveryPromise;
      if (unverifiedReplacementStop) throw unverifiedReplacementStop;
    },
    shutdown: () => {
      if (shutdownPromise) return shutdownPromise;
      shuttingDown = true;
      // Share completion and native stop failures with every shutdown caller.
      // An early "already shutting down" return is not proof of quiescence.
      shutdownPromise = (async () => {
        await recoveryPromise;
        if (unverifiedReplacementStop) throw unverifiedReplacementStop;
        if (!activeInstanceExited) await activeInstance.stop();
      })();
      return shutdownPromise;
    },
  };
}
