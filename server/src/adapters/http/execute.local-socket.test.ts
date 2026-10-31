import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { execute } from "./execute.js";

const ALLOWLIST_ENV = "PAPERCLIP_HTTP_ADAPTER_PRIVATE_ENDPOINT_ALLOWLIST";
const previousAllowlist = process.env[ALLOWLIST_ENV];
let active: Server | null = null;

afterEach(async () => {
  if (previousAllowlist === undefined) delete process.env[ALLOWLIST_ENV];
  else process.env[ALLOWLIST_ENV] = previousAllowlist;
  if (active) {
    const server = active;
    active = null;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

describe("private local HTTP stream lifecycle, actual Node socket", () => {
  for (const status of [200, 429]) {
    it(`closes an unread long-lived response stream for HTTP ${status}`, async () => {
      let resolveClosed!: () => void;
      const closed = new Promise<void>(resolve => { resolveClosed = resolve; });
      const server = createServer((_req, res) => {
        res.on("close", resolveClosed);
        res.writeHead(status, { "content-type": "text/plain" });
        res.write("synthetic-ack");
        // Intentionally NEVER call res.end(). This peer's body remains live
        // until the consumer explicitly cancels it or the test tears down.
      });
      active = server;
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw Error("No local test port");
      const origin = `http://127.0.0.1:${address.port}`;
      process.env[ALLOWLIST_ENV] = origin;
      const invocation = execute({
        runId: "synthetic-local-test",
        agent: { id: "synthetic-agent", companyId: "synthetic-company",
          name: "Synthetic", adapterType: "http", adapterConfig: {} },
        runtime: { sessionId: null, sessionParams: null,
          sessionDisplayId: null, taskKey: null },
        config: { url: origin + "/synthetic-hook", method: "POST", timeoutMs: 2000 },
        context: {}, onLog: async () => {},
      });
      if (status === 200) {
        const result = await invocation;
        expect(result.exitCode).toBe(0);
      } else {
        await expect(invocation).rejects.toThrow("HTTP adapter request rejected with status 429");
      }
      const closeResult = await Promise.race([
        closed.then(() => "closed"),
        new Promise<string>(resolve => setTimeout(() => resolve("still_open"), 1400)),
      ]);
      expect(closeResult).toBe("closed");
    }, 6500);
  }
});
