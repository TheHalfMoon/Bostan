import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNetworkProxyBridge,
  buildLocalProcessSandboxSpawnTarget,
  parseLocalProcessFilesystemScope,
  buildLocalProcessProxyOriginHeaders,
  filterLocalProcessProxyHopByHopHeaders,
  parseLocalProcessNetworkAllowlist,
  isValidLocalProcessProxyConnectPort,
  parseLocalProcessNetworkScope,
  parseLocalProcessSandboxExtraPaths,
  resolveAgentNetworkPosture,
  describeAgentNetworkPosture,
} from "./local-process-sandbox.js";
import { runChildProcess } from "./server-utils.js";

const cleanup: string[] = [];
// Prefer the Bostan qualification knobs while honoring the legacy test
// environment variables until external QA runners can be migrated safely.
const sandboxTestBwrap = process.env.BOSTAN_TEST_BWRAP || process.env.PAPERCLIP_TEST_BWRAP;
const sandboxTestBuild = process.env.BOSTAN_TEST_SANDBOX_BUILD || process.env.PAPERCLIP_TEST_SANDBOX_BUILD;

// Build real HTTP/1.1 wire bytes. Literal backslash-r/backslash-n sequences
// do not terminate an HTTP line and cannot exercise the sandbox CONNECT path.
function connectFixtureRequest(authority: string): string {
  return `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`;
}

async function withTmpDir<T>(tmpDir: string, run: () => Promise<T>): Promise<T> {
  const previousTmpDir = process.env.TMPDIR;
  process.env.TMPDIR = tmpDir;
  try {
    return await run();
  } finally {
    if (previousTmpDir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTmpDir;
  }
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((candidate) => fs.rm(candidate, { recursive: true, force: true })));
});

describe("local process sandbox", () => {
  it("builds CONNECT request fixtures with real CRLF wire delimiters", () => {
    const frame = connectFixtureRequest("api.example.test:443");
    expect(frame).toBe("CONNECT api.example.test:443 HTTP/1.1\r\nHost: api.example.test:443\r\n\r\n");
    expect(frame.includes(String.raw`\r\n`)).toBe(false);
    expect(Buffer.from(frame).subarray(-4)).toEqual(Buffer.from([13, 10, 13, 10]));
  });

  it.runIf(process.platform !== "linux")("rejects sandbox scopes on unsupported hosts", async () => {
    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath, args: ["-e", "process.exit(0)"], cwd: process.cwd(),
      options: { workspaceDir: process.cwd(), networkScope: "deny" },
    })).rejects.toThrow("supported only on Linux");
  });

  it("parses read-only and writable extra paths", () => {
    expect(parseLocalProcessSandboxExtraPaths(["/opt/cache", { path: "/var/lib/tool", access: "rw" }])).toEqual([
      // Paths are normalized with path.resolve, which is drive-qualified on Windows.
      { path: path.resolve("/opt/cache"), access: "ro" },
      { path: path.resolve("/var/lib/tool"), access: "rw" },
    ]);
    expect(() => parseLocalProcessSandboxExtraPaths(["relative"])).toThrow("must be an absolute path");
  });

  it("parses network scopes and exact-host allowlists", () => {
    expect(parseLocalProcessFilesystemScope("workspace")).toBe("workspace");
    expect(parseLocalProcessFilesystemScope(undefined)).toBeNull();
    expect(() => parseLocalProcessFilesystemScope("workpace")).toThrow('filesystemScope must be "workspace"');
    expect(parseLocalProcessNetworkScope("deny")).toBe("deny");
    expect(parseLocalProcessNetworkScope("allowlist")).toBe("allowlist");
    expect(parseLocalProcessNetworkScope(undefined)).toBeNull();
    expect(parseLocalProcessNetworkAllowlist(["api.openai.com", "https://api.anthropic.com", "gateway.test:8443"]))
      .toEqual(["api.openai.com", "api.anthropic.com", "gateway.test:8443"]);
    expect(() => parseLocalProcessNetworkAllowlist(["*.example.com"])).toThrow("exact hostname");
    for (const malformedPort of ["https://api.example.test:", "https://api.example.test:/"]) {
      expect(() => parseLocalProcessNetworkAllowlist([malformedPort])).toThrow("hostname, hostname:port, or origin URL");
    }
    expect(() => parseLocalProcessNetworkScope("public")).toThrow('"deny", "allowlist" or "unrestricted"');
  });

  it("preserves an explicitly pinned default port instead of granting every port", () => {
    expect(parseLocalProcessNetworkAllowlist([
      "https://api.example.test:443",
      "http://api.example.test:80/",
      "gateway.example.test:443",
      "gateway.example.test:8443",
    ])).toEqual([
      "api.example.test:443",
      "api.example.test:80",
      "gateway.example.test:443",
      "gateway.example.test:8443",
    ]);
    // An unqualified hostname intentionally retains the legacy any-port policy.
    expect(parseLocalProcessNetworkAllowlist(["api.example.test"])).toEqual(["api.example.test"]);
  });

  it("rejects normalized origin suffixes instead of widening explicit default ports", () => {
    // WHATWG URL canonicalizes dot-segments and backslashes to '/', and
    // empty query/hash delimiters can disappear from parsed properties.
    // None may turn a :443 or :80 allowlist into unrestricted any-port.
    for (const entry of [
      "https://api.example.test:443/.",
      "https://api.example.test:443/..",
      "https://api.example.test:443/%2e",
      "https://api.example.test:443\\",
      "http://api.example.test:80/.",
      "api.example.test:443/.",
      "https://api.example.test:443?",
      "https://api.example.test:443#",
      "https://api.example.test:443\t/",
      "https://api.example.test:443\n/",
      "https://api.example.test:443\r/",
    ]) {
      expect(() => parseLocalProcessNetworkAllowlist([entry])).toThrow(
        "hostname, hostname:port, or origin URL",
      );
    }
    expect(parseLocalProcessNetworkAllowlist([
      "https://api.example.test:443/",
      "http://api.example.test:80/",
      "api.example.test",
    ])).toEqual(["api.example.test:443", "api.example.test:80", "api.example.test"]);
  });

  it("rejects non-HTTP protocols in sandbox network origins", () => {
    for (const entry of ["ftp://api.example.test", "file://api.example.test", "ws://api.example.test"]) {
      expect(() => parseLocalProcessNetworkAllowlist([entry])).toThrow(
        "hostname, hostname:port, or origin URL",
      );
    }
  });

  it.runIf(process.platform === "linux")("denies CONNECT to another port when HTTPS 443 is explicitly pinned", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-port-pin-"));
    cleanup.push(workspace);
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        networkScope: "allowlist",
        networkAllowlist: ["https://127.0.0.1:443"],
      },
    });
    try {
      const dashIndex = target.args.indexOf("--");
      const proxySocket = target.args[dashIndex + 3];
      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection(proxySocket, () => {
          socket.end(connectFixtureRequest("127.0.0.1:444"));
        });
        let text = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => { text += chunk; });
        socket.on("end", () => resolve(text));
        socket.on("error", reject);
      });
      expect(response).toContain("HTTP/1.1 403 Forbidden");
      expect(response).toContain("network_target_denied");
    } finally {
      await target.cleanup?.();
    }
  });

  it("retains exact bracketed IPv6 allowlist host and explicit ports", () => {
    expect(parseLocalProcessNetworkAllowlist(["http://[::1]:80", "https://[::1]:443", "[::1]:8443"]))
      .toEqual(["[::1]:80", "[::1]:443", "[::1]:8443"]);
  });

  it.runIf(process.platform === "linux")("allows an exact IPv6 origin while denying other IPv6 hosts and ports", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-ipv6-network-allowlist-"));
    cleanup.push(workspace);
    const origin = http.createServer((_request, response) => response.end("ipv6-allowed"));
    await new Promise<void>((resolve, reject) => {
      origin.once("error", reject);
      origin.listen(0, "::1", () => { origin.off("error", reject); resolve(); });
    });
    const address = origin.address();
    if (!address || typeof address === "string") {
      await new Promise<void>((resolve) => origin.close(() => resolve()));
      throw new Error("Expected native IPv6 loopback listener");
    }
    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`[::1]:${address.port}`],
        },
      });
      const dash = target.args.indexOf("--");
      const socketPath = target.args[dash + 3];
      const request = (url: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
        const outgoing = http.request({
          socketPath,
          path: url,
          headers: { host: new URL(url).host },
        }, (incoming) => {
          let body = "";
          incoming.setEncoding("utf8");
          incoming.on("data", (chunk) => { body += chunk; });
          incoming.on("end", () => resolve({ status: incoming.statusCode ?? 0, body }));
        });
        outgoing.on("error", reject);
        outgoing.end();
      });
      expect(await request(`http://[::1]:${address.port}/allowed`)).toEqual({
        status: 200,
        body: "ipv6-allowed",
      });
      const otherPort = address.port === 65535 ? 65534 : address.port + 1;
      expect((await request(`http://[::1]:${otherPort}/denied-port`)).status).toBe(403);
      expect((await request(`http://[::2]:${address.port}/denied-host`)).status).toBe(403);
    } finally {
      await target?.cleanup?.();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it("rejects out-of-range and noncanonical TCP CONNECT ports before socket creation", () => {
    for (const allowed of ["1", "80", "443", "65535"]) {
      expect(isValidLocalProcessProxyConnectPort(allowed)).toBe(true);
    }
    for (const denied of [
      "", "0", "00", "080", "0443", "65536", "99999",
      "99999999999999999999999999999999999999999999999999",
      "-1", "+443", "443.0", "443 ", " 443", "443\\n", "0x1bb", "NaN", "Infinity",
    ]) {
      expect(isValidLocalProcessProxyConnectPort(denied)).toBe(false);
    }
  });

  it.runIf(process.platform === "linux")("keeps sandbox proxy alive after an out-of-range CONNECT with a host-only allowlist", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-sandbox-connect-guard-"));
    cleanup.push(workspace);
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        networkScope: "allowlist",
        networkAllowlist: ["127.0.0.1"],
      },
    });
    const delimiter = target.args.indexOf("--");
    const socketPath = target.args[delimiter + 3];
    const send = async (authority: string) => new Promise<string>((resolve, reject) => {
      const socket = net.createConnection(socketPath, () => {
        socket.end(connectFixtureRequest(authority));
      });
      let output = "";
      socket.setEncoding("utf8");
      socket.on("data", (data) => { output += data; });
      socket.on("end", () => resolve(output));
      socket.on("error", reject);
    });
    try {
      for (const invalid of ["127.0.0.1:65536", "127.0.0.1:99999", "127.0.0.1:000443"]) {
        const response = await send(invalid);
        expect(response).toContain("HTTP/1.1 403 Forbidden");
        expect(response).toContain("network_target_denied");
      }
      // A later request must still get a normal policy response, proving
      // that malformed inputs did not terminate the long-lived proxy.
      const response = await send("example.invalid:443");
      expect(response).toContain("HTTP/1.1 403 Forbidden");
    } finally {
      await target.cleanup?.();
    }
  });

  it.runIf(process.platform === "linux")("survives abrupt Unix client disconnects from allowed CONNECT tunnels", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-connect-reset-"));
    cleanup.push(workspace);
    const originSockets = new Set<net.Socket>();
    const origin = net.createServer((socket) => {
      originSockets.add(socket);
      socket.once("close", () => originSockets.delete(socket));
      socket.on("error", () => {});
    });
    await new Promise<void>((resolve, reject) => {
      origin.once("error", reject);
      origin.listen(0, "127.0.0.1", () => { origin.off("error", reject); resolve(); });
    });
    const address = origin.address();
    if (!address || typeof address === "string") throw new Error("Expected localhost TCP origin");
    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      });
      const delimiter = target.args.indexOf("--");
      const socketPath = target.args[delimiter + 3]!;
      for (let index = 0; index < 3; index++) {
        await new Promise<void>((resolve, reject) => {
          const client = net.createConnection(socketPath);
          const guard = setTimeout(() => {
            client.destroy();
            reject(new Error("Timed out opening a test CONNECT tunnel"));
          }, 2000);
          client.once("connect", () => {
            client.write(connectFixtureRequest(`127.0.0.1:${address.port}`));
            // This client uses a Unix socket, not TCP: resetAndDestroy() throws
            // ERR_INVALID_HANDLE_TYPE. Abrupt destroy() can still emit
            // ECONNRESET on the proxy's accepted Unix socket.
            setTimeout(() => {
              clearTimeout(guard);
              if (!client.destroyed) client.destroy();
              resolve();
            }, 25);
          });
          client.once("error", (error) => { clearTimeout(guard); reject(error); });
        });
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      // The same long-lived proxy must still serve a new, valid tunnel.
      const statusLine = await new Promise<string>((resolve, reject) => {
        const client = net.createConnection(socketPath, () => {
          client.write(connectFixtureRequest(`127.0.0.1:${address.port}`));
        });
        const guard = setTimeout(() => {
          client.destroy();
          reject(new Error("CONNECT did not recover after client TCP resets"));
        }, 2000);
        client.once("data", (chunk) => {
          clearTimeout(guard);
          resolve(chunk.toString("utf8").split("\r\n", 1)[0]!);
          client.destroy();
        });
        client.once("error", (error) => { clearTimeout(guard); reject(error); });
      });
      expect(statusLine).toBe("HTTP/1.1 200 Connection Established");
    } finally {
      await target?.cleanup?.();
      for (const socket of originSockets) socket.destroy();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("survives denied CONNECT client disconnects and serves a later policy response", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-denied-connect-reset-"));
    cleanup.push(workspace);
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        networkScope: "allowlist",
        networkAllowlist: ["127.0.0.1:443"],
      },
    });
    const delimiter = target.args.indexOf("--");
    const socketPath = target.args[delimiter + 3]!;
    try {
      // Denied CONNECT returns before the allowed-tunnel error listener.
      // A Unix peer closing mid-response can still deliver ECONNRESET on
      // the accepted Socket, crashing an unprotected proxy.
      for (let index = 0; index < 12; index++) {
        await new Promise<void>((resolve, reject) => {
          const client = net.createConnection(socketPath, () => {
            client.write(connectFixtureRequest("denied.invalid:443"));
            setTimeout(() => { client.destroy(); resolve(); }, 0);
          });
          client.once("error", reject);
        });
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const response = await new Promise<string>((resolve, reject) => {
        const client = net.createConnection(socketPath, () => {
          client.end(connectFixtureRequest("denied.invalid:443"));
        });
        let body = "";
        const guard = setTimeout(() => {
          client.destroy();
          reject(new Error("Denied CONNECT proxy stopped responding after disconnects"));
        }, 3000);
        client.setEncoding("utf8");
        client.on("data", (chunk) => { body += chunk; });
        client.once("end", () => { clearTimeout(guard); resolve(body); });
        client.once("error", (error) => { clearTimeout(guard); reject(error); });
      });
      expect(response).toContain("HTTP/1.1 403 Forbidden");
      expect(response).toContain("network_target_denied");
    } finally {
      await target.cleanup?.();
    }
  });

  it("drops fixed and Connection-nominated hop-only headers before forwarding", () => {
    const incoming = {
      host: "local-proxy.example.test",
      connection: "keep-alive, X-Bostan-Hop-Token, Authorization-Local",
      "x-bostan-hop-token": "SYNTHETIC_HOP_SECRET",
      "authorization-local": "SYNTHETIC_LOCAL_ONLY",
      "proxy-authorization": "Basic SYNTHETIC_PROXY_ONLY",
      "proxy-connection": "keep-alive",
      "keep-alive": "timeout=5",
      "proxy-authenticate": "Basic realm=synthetic",
      te: "trailers",
      trailer: "x-test-trailer",
      "transfer-encoding": "chunked",
      upgrade: "websocket",
      authorization: "Bearer SYNTHETIC_ORIGIN_TOKEN",
      "x-origin-metadata": "retained",
    };
    expect(buildLocalProcessProxyOriginHeaders(incoming, "origin.example.test:80")).toEqual({
      host: "origin.example.test:80",
      authorization: "Bearer SYNTHETIC_ORIGIN_TOKEN",
      "x-origin-metadata": "retained",
    });
    expect(incoming["x-bostan-hop-token"]).toBe("SYNTHETIC_HOP_SECRET");
    expect(incoming.connection).toContain("X-Bostan-Hop-Token");
  });

  it("removes upstream response hop-only headers including dynamically named values", () => {
    const incoming = {
      connection: "close, X-Bostan-Origin-Hop-Token",
      "x-bostan-origin-hop-token": "SYNTHETIC_HOP_SECRET",
      "proxy-authenticate": "Basic realm=synthetic",
      "keep-alive": "timeout=3",
      "transfer-encoding": "chunked",
      "content-type": "application/json",
      "content-length": "2",
      "x-origin-response": "retained",
    };
    expect(filterLocalProcessProxyHopByHopHeaders(incoming)).toEqual({
      "content-type": "application/json",
      "content-length": "2",
      "x-origin-response": "retained",
    });
    expect(incoming["x-bostan-origin-hop-token"]).toBe("SYNTHETIC_HOP_SECRET");
  });

  it.runIf(process.platform === "linux")("closes truncated HTTP responses and remains usable after an allowed origin resets", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-aborted-http-origin-"));
    cleanup.push(workspace);
    const origin = http.createServer((request, response) => {
      if (request.url === "/aborted") {
        response.writeHead(200, { "Content-Length": "4096", "Content-Type": "text/plain" });
        response.write("partial");
        const socket = response.socket;
        setTimeout(() => socket?.destroy(), 20);
      } else {
        response.end("healthy");
      }
    });
    await new Promise<void>((resolve, reject) => {
      origin.once("error", reject);
      origin.listen(0, "127.0.0.1", () => { origin.off("error", reject); resolve(); });
    });
    const address = origin.address();
    if (!address || typeof address === "string") throw new Error("Expected loopback HTTP origin");
    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      });
      const delimiter = target.args.indexOf("--");
      const socketPath = target.args[delimiter + 3]!;
      let sawPartialBody = false;
      const truncated = await new Promise<boolean>((resolve, reject) => {
        const request = http.request({
          socketPath, agent: false, path: `http://127.0.0.1:${address.port}/aborted`,
        }, (reply) => {
          reply.on("data", (chunk: Buffer) => { if (chunk.length > 0) sawPartialBody = true; });
          // A truncated Content-Length can legitimately report ECONNRESET.
          // The proxy MUST still close, rather than retain a stalled client.
          reply.on("error", () => {});
          reply.once("close", () => { clearTimeout(guard); resolve(!reply.complete); });
        });
        const guard = setTimeout(() => {
          request.destroy();
          reject(new Error("Proxy left a truncated HTTP origin response open"));
        }, 2000);
        request.once("error", (error) => { clearTimeout(guard); reject(error); });
        request.end();
      });
      expect(sawPartialBody).toBe(true);
      expect(truncated).toBe(true);
      const healthy = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const request = http.request({
          socketPath, agent: false, path: `http://127.0.0.1:${address.port}/healthy`,
        }, (reply) => {
          let body = "";
          reply.setEncoding("utf8");
          reply.on("data", (chunk) => { body += chunk; });
          reply.once("end", () => resolve({ status: reply.statusCode ?? 0, body }));
          reply.once("error", reject);
        });
        request.once("error", reject);
        request.end();
      });
      expect(healthy).toEqual({ status: 200, body: "healthy" });
    } finally {
      await target?.cleanup?.();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("does not forward Connection-nominated secrets in either HTTP proxy direction", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-hop-header-proxy-"));
    cleanup.push(workspace);
    const origin = http.createServer((request, response) => {
      const body = JSON.stringify(request.headers);
      response.writeHead(200, {
        "content-type": "application/json",
        "connection": "close, x-bostan-origin-hop-token",
        "x-bostan-origin-hop-token": "SYNTHETIC_ORIGIN_HOP_TOKEN",
        "x-origin-response": "allowed",
      });
      response.end(body);
    });
    await new Promise<void>((resolve) => origin.listen(0, "127.0.0.1", resolve));
    const address = origin.address();
    if (!address || typeof address === "string") {
      await new Promise<void>((resolve) => origin.close(() => resolve()));
      throw new Error("Expected localhost test origin");
    }
    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      });
      const dash = target.args.indexOf("--");
      const socketPath = target.args[dash + 3];
      const got = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Record<string, string> }>((resolve, reject) => {
        const request = http.request({
          socketPath,
          path: `http://127.0.0.1:${address.port}/fixture`,
          headers: {
            "connection": "close, x-bostan-hop-token",
            "x-bostan-hop-token": "SYNTHETIC_LOCAL_HOP_TOKEN",
            "proxy-authorization": "Basic SYNTHETIC_PROXY_ONLY",
            "authorization": "Bearer SYNTHETIC_ORIGIN_TOKEN",
            "x-app-metadata": "retained",
          },
        }, (response) => {
          let data = "";
          response.setEncoding("utf8");
          response.on("data", (part) => { data += part; });
          response.on("end", () => {
            try { resolve({ status: response.statusCode ?? 0, headers: response.headers, body: JSON.parse(data) }); }
            catch (error) { reject(error); }
          });
        });
        request.on("error", reject);
        request.end();
      });
      expect(got.status).toBe(200);
      expect(got.body["x-bostan-hop-token"]).toBeUndefined();
      expect(got.body["proxy-authorization"]).toBeUndefined();
      expect(got.body.authorization).toBe("Bearer SYNTHETIC_ORIGIN_TOKEN");
      expect(got.body["x-app-metadata"]).toBe("retained");
      expect(got.headers["x-bostan-origin-hop-token"]).toBeUndefined();
      expect(got.headers["x-origin-response"]).toBe("allowed");
    } finally {
      await target?.cleanup?.();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it("does not send client proxy credentials to the HTTP origin", () => {
    const incoming = {
      host: "local-proxy.example.test",
      "proxy-authorization": "Basic SYNTHETIC_PROXY_SECRET",
      "proxy-connection": "keep-alive",
      authorization: "Bearer SYNTHETIC_ORIGIN_TOKEN",
      "x-bostan-fixture": "allowed",
    };
    const forwarded = buildLocalProcessProxyOriginHeaders(incoming, "api.example.test:8443");
    expect(forwarded).toEqual({
      host: "api.example.test:8443",
      authorization: "Bearer SYNTHETIC_ORIGIN_TOKEN",
      "x-bostan-fixture": "allowed",
    });
    // Do not mutate the request object, which may be used for audit/policy.
    expect(incoming["proxy-authorization"]).toBe("Basic SYNTHETIC_PROXY_SECRET");
    expect(incoming["proxy-connection"]).toBe("keep-alive");
  });

  it.runIf(process.platform === "linux")("never forwards proxy credentials to an allowed local HTTP origin", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-proxy-origin-header-"));
    cleanup.push(workspace);
    const origin = http.createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(request.headers));
    });
    await new Promise<void>((resolve) => origin.listen(0, "127.0.0.1", resolve));
    const address = origin.address();
    if (!address || typeof address === "string") {
      await new Promise<void>((resolve) => origin.close(() => resolve()));
      throw new Error("Expected loopback test server.");
    }
    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      });
      const separator = target.args.indexOf("--");
      const socketPath = target.args[separator + 3];
      const received = await new Promise<Record<string, string>>((resolve, reject) => {
        const request = http.request({
          socketPath,
          path: `http://127.0.0.1:${address.port}/fixture`,
          headers: {
            host: "local-proxy.example.test",
            "proxy-authorization": "Basic SYNTHETIC_PROXY_SECRET",
            "proxy-connection": "keep-alive",
            authorization: "Bearer SYNTHETIC_ORIGIN_TOKEN",
            "x-bostan-fixture": "allowed",
          },
        }, (response) => {
          let data = "";
          response.setEncoding("utf8");
          response.on("data", (part) => { data += part; });
          response.on("end", () => {
            try { resolve(JSON.parse(data) as Record<string, string>); }
            catch (error) { reject(error); }
          });
        });
        request.on("error", reject);
        request.end();
      });
      expect(received["proxy-authorization"]).toBeUndefined();
      expect(received["proxy-connection"]).toBeUndefined();
      expect(received.authorization).toBe("Bearer SYNTHETIC_ORIGIN_TOKEN");
      expect(received["x-bostan-fixture"]).toBe("allowed");
      expect(received.host).toBe(`127.0.0.1:${address.port}`);
    } finally {
      await target?.cleanup?.();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("describes every valid allowlist input when no proxy rules remain", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-rules-"));
    cleanup.push(workspace);

    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        networkScope: "allowlist",
        networkAllowlist: [],
        networkTrustedUrls: ["file:///not-a-network-target"],
      },
    })).rejects.toThrow("valid networkAllowlist hostname or HTTP(S) networkTrustedUrl");
  });

  it.runIf(process.platform === "linux")("terminates the network proxy bridge after an agent exits with an active tunnel", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-bridge-exit-"));
    cleanup.push(workspace);
    const socketPath = path.join(workspace, "origin.sock");
    const heldOriginSockets = new Set<net.Socket>();
    const origin = net.createServer((socket) => {
      heldOriginSockets.add(socket);
      socket.once("close", () => heldOriginSockets.delete(socket));
    });
    await new Promise<void>((resolve) => origin.listen(socketPath, resolve));
    // Reserve an ephemeral loopback port so concurrent Vitest files cannot
    // collide with the production bridge port 31337.
    const portReservation = net.createServer();
    await new Promise<void>((resolve) => portReservation.listen(0, "127.0.0.1", resolve));
    const portAddress = portReservation.address();
    if (!portAddress || typeof portAddress === "string") throw new Error("Expected TCP port");
    const listenPort = portAddress.port;
    await new Promise<void>((resolve) => portReservation.close(() => resolve()));

    const scriptPath = path.join(workspace, "bridge.cjs");
    await fs.writeFile(scriptPath, await createNetworkProxyBridge(listenPort));
    const bridge = spawn(process.execPath, [
      scriptPath, socketPath, process.execPath, "-e", "setTimeout(() => process.exit(0), 400)",
    ], { stdio: "ignore" });
    const bridgeClosed = new Promise<number | null>((resolve, reject) => {
      bridge.once("error", reject);
      bridge.once("close", (code) => resolve(code));
    });
    let heldClient: net.Socket | undefined;
    try {
      const deadline = Date.now() + 2000;
      while (!heldClient && Date.now() < deadline) {
        try {
          heldClient = await new Promise<net.Socket>((resolve, reject) => {
            const socket = net.connect(listenPort, "127.0.0.1");
            socket.once("connect", () => resolve(socket));
            socket.once("error", reject);
          });
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      expect(heldClient, "Expected an active agent proxy bridge tunnel").toBeDefined();
      heldClient?.on("error", () => {});
      const bridgeExited = await Promise.race([
        bridgeClosed.then((code) => ({ closed: true, code })),
        new Promise<{ closed: boolean; code: number | null }>((resolve) =>
          setTimeout(() => resolve({ closed: false, code: null }), 2000)),
      ]);
      expect(bridgeExited).toEqual({ closed: true, code: 0 });
    } finally {
      heldClient?.destroy();
      bridge.kill("SIGKILL");
      for (const socket of heldOriginSockets) socket.destroy();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("does not hang after the bridge cannot spawn an agent executable", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-bridge-spawn-error-"));
    cleanup.push(workspace);
    const scriptPath = path.join(workspace, "bridge.cjs");
    await fs.writeFile(scriptPath, await createNetworkProxyBridge(0));
    const bridge = spawn(process.execPath, [
      scriptPath, path.join(workspace, "unused.sock"), path.join(workspace, "not-an-executable"),
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    bridge.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    try {
      const result = await Promise.race([
        new Promise<{ closed: boolean; code: number | null }>((resolve, reject) => {
          bridge.once("error", reject);
          bridge.once("close", (code) => resolve({ closed: true, code }));
        }),
        new Promise<{ closed: boolean; code: number | null }>((resolve) =>
          setTimeout(() => resolve({ closed: false, code: null }), 2000)),
      ]);
      expect(result.closed).toBe(true);
      expect(result.code).not.toBe(0);
      expect(stderr).toContain("Bostan sandbox bridge spawn failed");
    } finally {
      bridge.kill("SIGKILL");
    }
  });

  it.runIf(process.platform === "linux")("pins managed read-write and read-only host sources when a symlink retargets", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-managed-sources-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const approved = path.join(root, "approved");
    const foreign = path.join(root, "foreign");
    const managedLink = path.join(root, "managed-link");
    await fs.mkdir(workspace);
    await fs.mkdir(approved);
    await fs.mkdir(foreign);
    await fs.symlink(approved, managedLink, "dir");

    const targets = await Promise.all((["rw", "ro"] as const).map((access) =>
      buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          filesystemScope: "workspace",
          managedPaths: [{ path: managedLink, access }],
        },
      }),
    ));
    await fs.unlink(managedLink);
    await fs.symlink(foreign, managedLink, "dir");
    expect(await fs.realpath(managedLink)).toBe(foreign);
    for (const [index, access] of (["rw", "ro"] as const).entries()) {
      const argv = targets[index]!.args;
      const operation = access === "rw" ? "--bind" : "--ro-bind";
      const destination = argv.findIndex((arg, offset) =>
        arg === managedLink && offset >= 2 && argv[offset - 2] === operation);
      expect(destination).toBeGreaterThanOrEqual(2);
      expect(argv[destination - 1]).toBe(approved);
      expect(await fs.realpath(argv[destination - 1]!)).toBe(approved);
    }
  });

  it.runIf(process.platform === "linux")("skips missing optional managed paths and rejects dangling managed symlinks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-managed-absence-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const missing = path.join(root, "absent");
    const link = path.join(root, "dangling");
    await fs.mkdir(workspace);
    const options = {
      workspaceDir: workspace,
      filesystemScope: "workspace" as const,
      managedPaths: [{ path: missing, access: "rw" as const }],
    };
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath, args: ["-e", "process.exit(0)"], cwd: workspace, options,
    });
    expect(target.args).not.toContain(missing);
    await fs.symlink(missing, link, "dir");
    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: { ...options, managedPaths: [{ path: link, access: "rw" }] },
    })).rejects.toThrow();
  });

  it.runIf(process.platform === "linux")("builds a fresh-root bubblewrap command with workspace access", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-fs-sandbox-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const managedHome = path.join(root, "managed-home");
    await fs.mkdir(workspace);
    await fs.mkdir(managedHome);

    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "console.log('ok')"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        managedPaths: [{ path: managedHome, access: "rw" }],
        homeDir: managedHome,
      },
    });

    expect(target.command).toBe("bwrap");
    expect(target.args).toContain("--tmpfs");
    expect(target.args).toContain(workspace);
    expect(target.args).toContain(managedHome);
    expect(target.args.slice(-3)).toEqual([process.execPath, "-e", "console.log('ok')"]);
  });

  it.runIf(process.platform === "linux")("binds a confined absolute alias to the synchronized workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-fs-alias-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    await fs.mkdir(workspace);

    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        pathAliases: [{ path: "/app", target: workspace }],
      },
    });

    expect(target.args).toEqual(expect.arrayContaining(["--bind", workspace, "/app"]));
  });

  it.runIf(process.platform === "linux")("rejects writable workspace extra paths that resolve outside via symlinks", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-workspace-rw-link-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const outside = path.join(root, "outside");
    await fs.mkdir(workspace);
    await fs.mkdir(outside);
    const indirect = path.join(workspace, "linked-outside");
    await fs.symlink(outside, indirect, "dir");

    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        extraPaths: [{ path: indirect, access: "rw" }],
      },
    })).rejects.toThrow("has no outbound restore mapping");
  });

  it.runIf(process.platform === "linux")("rejects path alias targets that resolve outside the synchronized workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-alias-link-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const outside = path.join(root, "outside");
    await fs.mkdir(workspace);
    await fs.mkdir(outside);
    const indirect = path.join(workspace, "linked-outside");
    await fs.symlink(outside, indirect, "dir");

    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        pathAliases: [{ path: "/app", target: indirect }],
      },
    })).rejects.toThrow("must target the synchronized workspace");
  });

  it.runIf(process.platform === "linux")("rejects an apparent workspace cwd whose symlink resolves outside", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-cwd-link-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const outside = path.join(root, "outside");
    await fs.mkdir(workspace);
    await fs.mkdir(outside);
    const indirect = path.join(workspace, "linked-outside");
    await fs.symlink(outside, indirect, "dir");

    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: indirect,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
      },
    })).rejects.toThrow("must be inside workspaceDir");
  });

  it.runIf(process.platform === "linux")("allows an alias symlink whose resolved target stays within the workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-alias-internal-link-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const inside = path.join(workspace, "inside");
    const indirect = path.join(workspace, "alias");
    await fs.mkdir(workspace);
    await fs.mkdir(inside);
    await fs.symlink(inside, indirect, "dir");

    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        pathAliases: [{ path: "/app", target: indirect }],
        extraPaths: [{ path: indirect, access: "rw" }],
      },
    });
    expect(target.args).toEqual(expect.arrayContaining(["--bind", inside, "/app"]));
    expect(target.args).toEqual(expect.arrayContaining(["--bind", inside, indirect]));
  });

  it.runIf(process.platform === "linux")("pins the physical workspace bind source when its root symlink changes after validation", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-workspace-root-source-"));
    cleanup.push(root);
    const approved = path.join(root, "approved");
    const outside = path.join(root, "outside");
    const workspaceLink = path.join(root, "workspace");
    await fs.mkdir(approved);
    await fs.mkdir(outside);
    await fs.symlink(approved, workspaceLink, "dir");

    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspaceLink,
      options: {
        workspaceDir: workspaceLink,
        filesystemScope: "workspace",
      },
    });

    // A writable parent can redirect the path spelling after policy approval
    // but before bubblewrap starts. The host SOURCE must be the exact realpath
    // approved for the root workspace, not the retargetable symlink.
    await fs.unlink(workspaceLink);
    await fs.symlink(outside, workspaceLink, "dir");
    expect(await fs.realpath(workspaceLink)).toBe(outside);
    const destinationIndex = target.args.findIndex((argument, index) =>
      argument === workspaceLink && index >= 2 && target.args[index - 2] === "--bind");
    expect(destinationIndex).toBeGreaterThanOrEqual(2);
    const approvedBindSource = target.args[destinationIndex - 1];
    expect(approvedBindSource).toBe(approved);
    expect(await fs.realpath(approvedBindSource)).toBe(approved);
  });

  it.runIf(process.platform === "linux")("pins alias and writable extra bind sources even if a workspace symlink changes afterward", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-bind-source-pin-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const inside = path.join(workspace, "inside");
    const outside = path.join(root, "outside");
    const indirect = path.join(workspace, "retargetable");
    await fs.mkdir(inside, { recursive: true });
    await fs.mkdir(outside);
    await fs.symlink(inside, indirect, "dir");

    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        extraPaths: [{ path: indirect, access: "rw" }],
        pathAliases: [{ path: "/app", target: indirect }],
      },
    });

    // After the policy decision but before bubblewrap executes, a writable
    // workspace link may be retargeted. The selected host source must remain
    // the previously validated physical directory, not this mutable link.
    await fs.unlink(indirect);
    await fs.symlink(outside, indirect, "dir");
    expect(await fs.realpath(indirect)).toBe(outside);
    const findSource = (destination: string): string | undefined => {
      const offset = target.args.findIndex((item, index) => item === destination && index > 0
        && (target.args[index - 2] === "--bind" || target.args[index - 2] === "--ro-bind"));
      return offset >= 2 ? target.args[offset - 1] : undefined;
    };
    expect(findSource("/app")).toBe(inside);
    expect(findSource(indirect)).toBe(inside);
    expect(await fs.realpath(findSource("/app")!)).toBe(inside);
    expect(await fs.realpath(findSource(indirect)!)).toBe(inside);
  });

  it.runIf(process.platform === "linux")("pins read-only extra bind sources when an authorized symlink is retargeted", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-readonly-source-pin-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const approved = path.join(root, "approved-readonly");
    const foreign = path.join(root, "foreign-readonly");
    const link = path.join(root, "read-only-link");
    await fs.mkdir(workspace);
    await fs.mkdir(approved);
    await fs.mkdir(foreign);
    await fs.symlink(approved, link, "dir");

    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        extraPaths: [{ path: link, access: "ro" }],
      },
    });

    await fs.unlink(link);
    await fs.symlink(foreign, link, "dir");
    expect(await fs.realpath(link)).toBe(foreign);
    const destinationIndex = target.args.findIndex((argument, index) =>
      argument === link && index >= 2 && target.args[index - 2] === "--ro-bind");
    expect(destinationIndex).toBeGreaterThanOrEqual(2);
    const pinnedSource = target.args[destinationIndex - 1];
    expect(pinnedSource).toBe(approved);
    expect(await fs.realpath(pinnedSource)).toBe(approved);
  });

  it.runIf(process.platform === "linux")("permits an explicitly restored writable path outside the workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-explicit-restore-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const outside = path.join(root, "outbound");
    await fs.mkdir(workspace);
    await fs.mkdir(outside);
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        extraPaths: [{ path: outside, access: "rw" }],
        outboundRestorePaths: [outside],
      },
    });
    expect(target.args).toEqual(expect.arrayContaining(["--bind", outside, outside]));
  });

  it.runIf(process.platform === "linux")("rejects dangling path alias links before constructing bubblewrap mounts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-dangling-alias-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    await fs.mkdir(workspace);
    const missing = path.join(root, "does-not-exist");
    const indirect = path.join(workspace, "dangling");
    await fs.symlink(missing, indirect, "dir");
    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        pathAliases: [{ path: "/app", target: indirect }],
      },
    })).rejects.toThrow();
  });

  it.runIf(process.platform === "linux")("rejects writable out-of-tree paths without an outbound restore mapping", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-fs-outbound-"));
    cleanup.push(root);
    const workspace = path.join(root, "workspace");
    const outside = path.join(root, "outside");
    await fs.mkdir(workspace);
    await fs.mkdir(outside);

    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        filesystemScope: "workspace",
        extraPaths: [{ path: outside, access: "rw" }],
      },
    })).rejects.toThrow("has no outbound restore mapping");
  });

  it.runIf(process.platform === "linux")("builds a network-only namespace without changing filesystem visibility", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-sandbox-"));
    cleanup.push(workspace);
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "console.log('ok')"],
      cwd: workspace,
      options: { workspaceDir: workspace, networkScope: "deny" },
    });

    expect(target.args).toContain("--unshare-net");
    expect(target.args).toContain("--bind");
    expect(target.args).not.toContain("--tmpfs");
    expect(target.env?.HTTP_PROXY).toBeUndefined();
  });

  it.runIf(process.platform === "linux")("closes an idle allowlisted upstream when the HTTP proxy client abandons its request", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-abandoned-proxy-upstream-"));
    cleanup.push(workspace);

    let originRequestSeen!: () => void;
    const seenOriginRequest = new Promise<void>((resolve) => { originRequestSeen = resolve; });
    let originSocketClosed!: () => void;
    const closedOriginSocket = new Promise<void>((resolve) => { originSocketClosed = resolve; });
    const origin = http.createServer((_request, _response) => {
      // Keep the response intentionally pending until the client disconnects.
      originRequestSeen();
    });
    const originSockets = new Set<net.Socket>();
    origin.on("connection", (socket) => {
      originSockets.add(socket);
      socket.once("close", () => {
        originSockets.delete(socket);
        originSocketClosed();
      });
    });
    await new Promise<void>((resolve) => origin.listen(0, "127.0.0.1", resolve));
    const address = origin.address();
    if (!address || typeof address === "string") {
      origin.closeAllConnections();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
      throw new Error("Expected a local HTTP origin listener");
    }

    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    let client: http.ClientRequest | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      });
      const dash = target.args.indexOf("--");
      const socketPath = target.args[dash + 3];
      client = http.request({
        socketPath,
        path: `http://127.0.0.1:${address.port}/intentionally-idle`,
        headers: { host: `127.0.0.1:${address.port}` },
      });
      client.on("error", () => { /* expected when the client disconnects */ });
      client.end();

      await Promise.race([
        seenOriginRequest,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("HTTP proxy never forwarded the request to the allowed origin")), 2000)),
      ]);
      // The browser/agent abandons its request; the sandbox must not hold
      // on to an idle, no-longer-needed connection to the origin.
      client.destroy();
      const closed = await Promise.race([
        closedOriginSocket.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);
      expect(closed, "The abandoned agent request must cancel the pending origin connection").toBe(true);
    } finally {
      client?.destroy();
      for (const socket of originSockets) socket.destroy();
      await target?.cleanup?.();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("closes origin socket when an HTTP proxy client aborts mid-upload", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-aborted-proxy-upload-"));
    cleanup.push(workspace);
    let seen!: () => void;
    const originSawHeaders = new Promise<void>((resolve) => { seen = resolve; });
    let closed!: () => void;
    const originClosed = new Promise<void>((resolve) => { closed = resolve; });
    const sockets = new Set<net.Socket>();
    let originBodyWasComplete: boolean | undefined;
    const origin = http.createServer((request, _response) => {
      originBodyWasComplete = request.complete;
      request.on("data", () => {});
      seen();
    });
    origin.on("connection", (socket) => {
      sockets.add(socket);
      socket.once("close", () => {
        sockets.delete(socket);
        closed();
      });
    });
    await new Promise<void>((resolve) => origin.listen(0, "127.0.0.1", resolve));
    const address = origin.address();
    if (!address || typeof address === "string") {
      await new Promise<void>((resolve) => origin.close(() => resolve()));
      throw new Error("Expected local HTTP origin");
    }
    let target: Awaited<ReturnType<typeof buildLocalProcessSandboxSpawnTarget>> | undefined;
    let client: http.ClientRequest | undefined;
    try {
      target = await buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      });
      const dash = target.args.indexOf("--");
      const socketPath = target.args[dash + 3];
      client = http.request({
        method: "POST",
        socketPath,
        path: `http://127.0.0.1:${address.port}/unfinished-upload`,
        headers: {
          host: `127.0.0.1:${address.port}`,
          "content-length": 100000,
        },
      });
      client.on("error", () => { /* expected after early socket close */ });
      client.write("only-a-small-part-of-the-declared-body");
      await Promise.race([
        originSawHeaders,
        new Promise<never>((_, reject) => setTimeout(() =>
          reject(new Error("HTTP proxy did not forward incomplete upload headers")), 2000)),
      ]);
      expect(originBodyWasComplete, "The upload body must still be incomplete at abort time").toBe(false);
      client.destroy();
      const disconnected = await Promise.race([
        originClosed.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);
      expect(disconnected, "Client abort during upload must tear down the origin request").toBe(true);
    } finally {
      client?.destroy();
      for (const socket of sockets) socket.destroy();
      await target?.cleanup?.();
      await new Promise<void>((resolve) => origin.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("forwards allowed proxy targets with a deep TMPDIR and rejects other hosts", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-proxy-"));
    cleanup.push(workspace);
    const deepTmpDir = path.join(workspace, ...Array.from({ length: 6 }, () => "deep-temporary-directory-segment"));
    await fs.mkdir(deepTmpDir, { recursive: true });
    const server = http.createServer((_request, response) => response.end("allowed-response"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
    const target = await withTmpDir(deepTmpDir, () =>
      buildLocalProcessSandboxSpawnTarget({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: workspace,
        options: {
          workspaceDir: workspace,
          filesystemScope: "workspace",
          networkScope: "allowlist",
          networkAllowlist: [`127.0.0.1:${address.port}`],
        },
      }),
    );
    const delimiterIndex = target.args.indexOf("--");
    const socketPath = target.args[delimiterIndex + 3];
    expect(Buffer.byteLength(path.join(deepTmpDir, "bostan-network-sandbox-XXXXXX", "proxy.sock"))).toBeGreaterThan(107);
    expect(Buffer.byteLength(socketPath)).toBeLessThanOrEqual(107);
    expect(socketPath).toMatch(/^\/tmp\/bostan-network-sandbox-/);
    expect(target.args).toContain(path.dirname(socketPath));
    const request = (url: string) => new Promise<{ status: number; contentType: string | null; body: string }>((resolve, reject) => {
      const outgoing = http.request({ socketPath, path: url, headers: { host: new URL(url).host } }, (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve({
          status: response.statusCode ?? 0,
          contentType: typeof response.headers["content-type"] === "string" ? response.headers["content-type"] : null,
          body,
        }));
      });
      outgoing.on("error", reject);
      outgoing.end();
    });

    try {
      await expect(request(`http://127.0.0.1:${address.port}/canary`)).resolves.toEqual({
        status: 200,
        contentType: null,
        body: "allowed-response",
      });
      await expect(request("http://example.com/")).resolves.toEqual({
        status: 403,
        contentType: "application/json; charset=utf-8",
        body: '{"error":{"code":"network_target_denied","message":"Network target denied by Bostan sandbox policy."}}\n',
      });
      const connectResponse = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection(socketPath, () => {
          socket.end(connectFixtureRequest("example.com:443"));
        });
        let response = "";
        socket.setEncoding("utf8");
        socket.on("data", (chunk) => { response += chunk; });
        socket.on("end", () => resolve(response));
        socket.on("error", reject);
      });
      expect(connectResponse).toContain("HTTP/1.1 403 Forbidden\r\n");
      expect(connectResponse).toContain("Content-Type: application/json; charset=utf-8\r\n");
      expect(connectResponse).toContain(
        '{"error":{"code":"network_target_denied","message":"Network target denied by Bostan sandbox policy."}}\n',
      );
    } finally {
      await target.cleanup?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("always permits trusted Bostan control-plane URLs", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-trusted-"));
    cleanup.push(workspace);
    const server = http.createServer((_request, response) => response.end("control-plane-response"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
    const target = await buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
      cwd: workspace,
      options: {
        workspaceDir: workspace,
        networkScope: "allowlist",
        networkAllowlist: ["api.openai.com"],
        networkTrustedUrls: [`http://127.0.0.1:${address.port}/api/issues/issue-1`],
      },
    });
    const delimiterIndex = target.args.indexOf("--");
    const socketPath = target.args[delimiterIndex + 3];

    try {
      const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const outgoing = http.request({
          socketPath,
          path: `http://127.0.0.1:${address.port}/api/issues/issue-1`,
          headers: { host: `127.0.0.1:${address.port}` },
        }, (incoming) => {
          let body = "";
          incoming.on("data", (chunk) => { body += chunk; });
          incoming.on("end", () => resolve({ status: incoming.statusCode ?? 0, body }));
        });
        outgoing.on("error", reject);
        outgoing.end();
      });
      expect(response).toEqual({ status: 200, body: "control-plane-response" });
    } finally {
      await target.cleanup?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails clearly when Bubblewrap is unavailable", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-fs-sandbox-missing-"));
    cleanup.push(workspace);
    await expect(
      runChildProcess("filesystem-sandbox-missing", process.execPath, ["-e", "process.exit(0)"], {
        cwd: workspace,
        env: {},
        timeoutSec: 10,
        graceSec: 1,
        onLog: async () => {},
        localProcessSandbox: {
          workspaceDir: workspace,
          filesystemScope: "workspace",
          command: path.join(workspace, "missing-bwrap"),
        },
      }),
    ).rejects.toThrow("requires Bubblewrap");
  });

  it.runIf(Boolean(sandboxTestBwrap))(
    "prevents reads outside the workspace while allowing workspace writes",
    async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-fs-sandbox-integration-"));
      cleanup.push(root);
      const workspace = path.join(root, "workspace");
      const outside = path.join(root, "canary.txt");
      const allowed = path.join(root, "allowed.txt");
      await fs.mkdir(workspace);
      await fs.writeFile(outside, "host-secret", "utf8");
      await fs.writeFile(allowed, "allowed-value", "utf8");

      const script = [
        "const fs = require('node:fs');",
        `try { fs.readFileSync(${JSON.stringify(outside)}, 'utf8'); process.exit(9); } catch (error) {`,
        "  if (!['ENOENT', 'EACCES'].includes(error.code)) throw error;",
        "}",
        `if (fs.readFileSync(${JSON.stringify(allowed)}, 'utf8') !== 'allowed-value') process.exit(8);`,
        "fs.writeFileSync('workspace-ok.txt', 'ok');",
      ].join("\n");
      const result = await runChildProcess("filesystem-sandbox-test", process.execPath, ["-e", script], {
        cwd: workspace,
        env: {},
        timeoutSec: 10,
        graceSec: 1,
        onLog: async () => {},
        localProcessSandbox: {
          workspaceDir: workspace,
          filesystemScope: "workspace",
          extraPaths: [{ path: allowed, access: "ro" }],
          command: sandboxTestBwrap,
        },
      });

      expect(result.exitCode, result.stderr).toBe(0);
      await expect(fs.readFile(path.join(workspace, "workspace-ok.txt"), "utf8")).resolves.toBe("ok");
    },
  );

  it.runIf(Boolean(sandboxTestBwrap && sandboxTestBuild))(
    "runs the adapter-utils TypeScript build inside the confined workspace",
    async () => {
      const workspace = process.cwd();
      const result = await runChildProcess(
        "filesystem-sandbox-build-test",
        path.join(workspace, "node_modules", ".bin", "tsc"),
        ["--noEmit", "-p", "packages/adapter-utils/tsconfig.json"],
        {
          cwd: workspace,
          env: {},
          timeoutSec: 60,
          graceSec: 2,
          onLog: async () => {},
          localProcessSandbox: {
            workspaceDir: workspace,
            filesystemScope: "workspace",
            command: sandboxTestBwrap,
          },
        },
      );

      expect(result.exitCode, result.stderr).toBe(0);
    },
  );

  it.runIf(Boolean(sandboxTestBwrap))(
    "denies direct network egress",
    async () => {
      const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-deny-"));
      cleanup.push(workspace);
      const server = http.createServer((_request, response) => response.end("host-network"));
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      const script = `require("node:http").get("http://127.0.0.1:${address.port}", () => process.exit(9)).on("error", () => process.exit(0));`;
      try {
        const result = await runChildProcess("network-sandbox-deny-test", process.execPath, ["-e", script], {
          cwd: workspace,
          env: {},
          timeoutSec: 10,
          graceSec: 1,
          onLog: async () => {},
          localProcessSandbox: {
            workspaceDir: workspace,
            networkScope: "deny",
            command: sandboxTestBwrap,
          },
        });
        expect(result.exitCode, result.stderr).toBe(0);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );

  it.runIf(Boolean(sandboxTestBwrap))(
    "allows only configured network targets through the proxy bridge",
    async () => {
      const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bostan-network-allowlist-"));
      cleanup.push(workspace);
      const server = http.createServer((_request, response) => response.end("allowed-response"));
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      const targetUrl = `http://127.0.0.1:${address.port}/canary`;
      const deniedUrl = "http://example.com/";
      const script = `
const http = require("node:http");
const proxy = new URL(process.env.HTTP_PROXY);
function request(url) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: proxy.hostname, port: proxy.port, path: url }, (response) => {
      let body = "";
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => resolve({ status: response.statusCode, body }));
    }).on("error", reject);
  });
}
(async () => {
  const allowed = await request(${JSON.stringify(targetUrl)});
  const denied = await request(${JSON.stringify(deniedUrl)});
  if (allowed.status !== 200 || allowed.body !== "allowed-response" || denied.status !== 403) process.exit(8);
})().catch((error) => { console.error(error); process.exit(7); });
`;
      try {
        const deepTmpDir = path.join(workspace, ...Array.from({ length: 6 }, () => "deep-temporary-directory-segment"));
        await fs.mkdir(deepTmpDir, { recursive: true });
        const result = await withTmpDir(deepTmpDir, () =>
          runChildProcess(
            "network-sandbox-allowlist-test",
            process.execPath,
            ["-e", script],
            {
              cwd: workspace,
              env: {},
              timeoutSec: 10,
              graceSec: 1,
              onLog: async () => {},
              localProcessSandbox: {
                workspaceDir: workspace,
                filesystemScope: "workspace",
                networkScope: "allowlist",
                networkAllowlist: [`127.0.0.1:${address.port}`],
                command: sandboxTestBwrap,
              },
            },
          ),
        );
        expect(result.exitCode, result.stderr).toBe(0);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );
});

describe("agent network posture", () => {
  const base = { networkScope: undefined, networkAllowlist: undefined, providerHosts: ["api.anthropic.com"] };

  it("defaults to a provider allowlist on Linux when the sandbox works", () => {
    expect(resolveAgentNetworkPosture({ ...base, networkAllowlist: ["github.com"], platform: "linux", sandboxAvailable: () => true }))
      .toEqual({ mode: "enforced", scope: "allowlist", allowlist: ["api.anthropic.com", "github.com"], defaulted: true });
  });

  it("reports why access stays unrestricted where it cannot be enforced", () => {
    expect(resolveAgentNetworkPosture({ ...base, platform: "win32", sandboxAvailable: () => true }))
      .toEqual({ mode: "unrestricted", reason: "unsupported_platform" });
    expect(resolveAgentNetworkPosture({ ...base, platform: "linux", sandboxAvailable: () => false }))
      .toEqual({ mode: "unrestricted", reason: "sandbox_unavailable" });
    expect(resolveAgentNetworkPosture({ ...base, platform: "linux", executionTargetIsRemote: true, sandboxAvailable: () => true }))
      .toEqual({ mode: "unrestricted", reason: "remote_execution" });
  });

  it("honours an explicit opt-out and explicit scopes on any platform", () => {
    const probe = vi.fn(() => true);
    expect(resolveAgentNetworkPosture({ ...base, networkScope: "unrestricted", platform: "linux", sandboxAvailable: probe }))
      .toEqual({ mode: "unrestricted", reason: "explicit_opt_out" });
    expect(resolveAgentNetworkPosture({ ...base, networkScope: "deny", platform: "win32", sandboxAvailable: probe }))
      .toEqual({ mode: "enforced", scope: "deny", allowlist: [], defaulted: false });
    expect(probe).not.toHaveBeenCalled();
  });

  it("accepts unrestricted as no scope and rejects unknown values", () => {
    expect(parseLocalProcessNetworkScope("unrestricted")).toBeNull();
    expect(() => parseLocalProcessNetworkScope("open")).toThrow('"deny", "allowlist" or "unrestricted"');
  });

  it("describes unrestricted posture loudly", () => {
    expect(describeAgentNetworkPosture({ mode: "unrestricted", reason: "sandbox_unavailable" }))
      .toBe("network access is UNRESTRICTED (the bubblewrap sandbox is unavailable on this host)");
  });
});
