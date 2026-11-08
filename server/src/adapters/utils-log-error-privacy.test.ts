import { describe, expect, it, vi } from "vitest";
import { logger } from "../middleware/logger.js";
import { runChildProcess } from "./utils.js";

describe("process adapter log callback error privacy", () => {
  it("never records the original exception or callback text in pino", async () => {
    const warning = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      const result = await runChildProcess(
        "synthetic-log-error-privacy",
        process.execPath,
        ["-e", "process.stdout.write('safe')"],
        { cwd: process.cwd(), env: {}, timeoutSec: 10, graceSec: 1,
          onLog: async () => { throw new Error("PRIVATE_UNKNOWN_SECRET_194"); } },
      );
      expect(result.exitCode).toBe(0);
      expect(warning).toHaveBeenCalled();
      expect(warning.mock.calls[0][0]).toEqual({ runId: "synthetic-log-error-privacy" });
      expect(warning.mock.calls[0][1]).toBe("process adapter child callback failed");
    } finally {
      warning.mockRestore();
    }
  });
  it("does not log secrets from rejected post-spawn metadata persistence", async () => {
    const warning = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      const result = await runChildProcess(
        "synthetic-spawn-error-privacy",
        process.execPath,
        ["-e", "process.stdout.write('safe')"],
        { cwd: process.cwd(), env: {}, timeoutSec: 10, graceSec: 1,
          onLog: async () => {},
          onSpawn: async () => { throw new Error("PRIVATE_UNKNOWN_SPAWN_SECRET_194"); } },
      );
      expect(result.exitCode).toBe(0);
      expect(warning).toHaveBeenCalled();
      expect(warning.mock.calls[0][0]).toEqual({ runId: "synthetic-spawn-error-privacy" });
      expect(warning.mock.calls[0][1]).toBe("process adapter child callback failed");
    } finally {
      warning.mockRestore();
    }
  });
});
