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
  it("aborts an in-flight owned HTTP socket on heartbeat cancellation", async () => {
    let arrived!: () => void;
    let closed!: () => void;
    const received = new Promise<void>(resolve => { arrived = resolve; });
    const socketClosed = new Promise<void>(resolve => { closed = resolve; });
    const server = createServer((_req, res) => {
      res.on("close", closed);
      arrived();
      // Headers never arrive: the owner must cancel this pending request.
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
    const controller = new AbortController();
    const onDispatch = () => {};
    const pending = execute({
      runId: "synthetic-cancel-test",
      agent: { id: "synthetic-agent", companyId: "synthetic-company",
        name: "Synthetic", adapterType: "http", adapterConfig: {} },
      runtime: { sessionId: null, sessionParams: null,
        sessionDisplayId: null, taskKey: null },
      config: { url: origin + "/synthetic-cancel", method: "POST" },
      context: {}, onLog: async () => {}, signal: controller.signal, onDispatch,
    });
    const arrival = await Promise.race([
      received.then(() => "received"),
      new Promise<string>(resolve => setTimeout(() => resolve("no_request"), 1250)),
    ]);
    expect(arrival).toBe("received");
    controller.abort(new Error("PRIVATE_ABORT_REASON"));
    const result = await Promise.race([
      pending,
      new Promise<"pending">(resolve => setTimeout(() => resolve("pending"), 1250)),
    ]);
    expect(result).not.toBe("pending");
    expect(result).toMatchObject({
      timedOut: false, errorCode: "cancelled", exitCode: 1,
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_ABORT_REASON");
    expect(await Promise.race([
      socketClosed.then(() => "closed"),
      new Promise<string>(resolve => setTimeout(() => resolve("still_open"), 1250)),
    ])).toBe("closed");
  }, 6500);

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
