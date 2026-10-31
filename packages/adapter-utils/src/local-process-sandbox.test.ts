import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildLocalProcessSandboxSpawnTarget,
  parseLocalProcessFilesystemScope,
  buildLocalProcessProxyOriginHeaders,
  filterLocalProcessProxyHopByHopHeaders,
  parseLocalProcessNetworkAllowlist,
  isValidLocalProcessProxyConnectPort,
  parseLocalProcessNetworkScope,
  parseLocalProcessSandboxExtraPaths,
} from "./local-process-sandbox.js";
import { runChildProcess } from "./server-utils.js";

const cleanup: string[] = [];

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
  it.runIf(process.platform !== "linux")("rejects sandbox scopes on unsupported hosts", async () => {
    await expect(buildLocalProcessSandboxSpawnTarget({
      executable: process.execPath, args: ["-e", "process.exit(0)"], cwd: process.cwd(),
      options: { workspaceDir: process.cwd(), networkScope: "deny" },
    })).rejects.toThrow("supported only on Linux");
  });

  it("parses read-only and writable extra paths", () => {
    expect(parseLocalProcessSandboxExtraPaths(["/opt/cache", { path: "/var/lib/tool", access: "rw" }])).toEqual([
      { path: "/opt/cache", access: "ro" },
      { path: "/var/lib/tool", access: "rw" },
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
    expect(() => parseLocalProcessNetworkScope("public")).toThrow('"deny" or "allowlist"');
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
          socket.end("CONNECT 127.0.0.1:444 HTTP/1.1\\r\\nHost: 127.0.0.1:444\\r\\n\\r\\n");
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
        socket.end(`CONNECT ${authority} HTTP/1.1\\r\\nHost: ${authority}\\r\\n\\r\\n`);
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
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-network-rules-"));
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

  it.runIf(process.platform === "linux")("builds a fresh-root bubblewrap command with workspace access", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-fs-sandbox-"));
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
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-fs-alias-"));
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

  it.runIf(process.platform === "linux")("rejects writable out-of-tree paths without an outbound restore mapping", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-fs-outbound-"));
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
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-network-sandbox-"));
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

  it.runIf(process.platform === "linux")("forwards allowed proxy targets with a deep TMPDIR and rejects other hosts", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-network-proxy-"));
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
    expect(Buffer.byteLength(path.join(deepTmpDir, "paperclip-network-sandbox-XXXXXX", "proxy.sock"))).toBeGreaterThan(107);
    expect(Buffer.byteLength(socketPath)).toBeLessThanOrEqual(107);
    expect(socketPath).toMatch(/^\/tmp\/paperclip-network-sandbox-/);
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
        body: '{"error":{"code":"network_target_denied","message":"Network target denied by Paperclip sandbox policy."}}\n',
      });
      const connectResponse = await new Promise<string>((resolve, reject) => {
        const socket = net.createConnection(socketPath, () => {
          socket.end("CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n");
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
        '{"error":{"code":"network_target_denied","message":"Network target denied by Paperclip sandbox policy."}}\n',
      );
    } finally {
      await target.cleanup?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it.runIf(process.platform === "linux")("always permits trusted Paperclip control-plane URLs", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-network-trusted-"));
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
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-fs-sandbox-missing-"));
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

  it.runIf(Boolean(process.env.PAPERCLIP_TEST_BWRAP))(
    "prevents reads outside the workspace while allowing workspace writes",
    async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-fs-sandbox-integration-"));
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
          command: process.env.PAPERCLIP_TEST_BWRAP,
        },
      });

      expect(result.exitCode, result.stderr).toBe(0);
      await expect(fs.readFile(path.join(workspace, "workspace-ok.txt"), "utf8")).resolves.toBe("ok");
    },
  );

  it.runIf(Boolean(process.env.PAPERCLIP_TEST_BWRAP && process.env.PAPERCLIP_TEST_SANDBOX_BUILD))(
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
            command: process.env.PAPERCLIP_TEST_BWRAP,
          },
        },
      );

      expect(result.exitCode, result.stderr).toBe(0);
    },
  );

  it.runIf(Boolean(process.env.PAPERCLIP_TEST_BWRAP))(
    "denies direct network egress",
    async () => {
      const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-network-deny-"));
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
            command: process.env.PAPERCLIP_TEST_BWRAP,
          },
        });
        expect(result.exitCode, result.stderr).toBe(0);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );

  it.runIf(Boolean(process.env.PAPERCLIP_TEST_BWRAP))(
    "allows only configured network targets through the proxy bridge",
    async () => {
      const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-network-allowlist-"));
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
                command: process.env.PAPERCLIP_TEST_BWRAP,
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
