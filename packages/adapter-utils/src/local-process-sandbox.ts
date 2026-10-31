import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

export type LocalProcessSandboxAccess = "ro" | "rw";
export type LocalProcessNetworkScope = "deny" | "allowlist";

export interface LocalProcessSandboxPath {
  path: string;
  access: LocalProcessSandboxAccess;
}

export interface LocalProcessSandboxPathAlias {
  path: string;
  target: string;
}

export interface LocalProcessSandboxOptions {
  workspaceDir: string;
  filesystemScope?: "workspace" | null;
  managedPaths?: LocalProcessSandboxPath[];
  extraPaths?: LocalProcessSandboxPath[];
  pathAliases?: LocalProcessSandboxPathAlias[];
  outboundRestorePaths?: string[];
  homeDir?: string | null;
  networkScope?: LocalProcessNetworkScope | null;
  networkAllowlist?: string[];
  networkTrustedUrls?: string[];
  command?: string;
}

export interface LocalProcessSandboxSpawnTarget {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
  cleanup?: () => Promise<void>;
}

interface NetworkAllowlistRule {
  hostname: string;
  port: string | null;
}

interface NetworkAllowlistProxy {
  close: () => Promise<void>;
}

const SYSTEM_READ_PATHS = [
  "/bin",
  "/sbin",
  "/usr",
  "/lib",
  "/lib64",
  "/etc/ca-certificates",
  "/etc/ssl",
  "/etc/resolv.conf",
  "/etc/hosts",
  "/etc/nsswitch.conf",
  "/etc/passwd",
  "/etc/group",
  "/etc/localtime",
  "/etc/timezone",
  "/etc/gitconfig",
] as const;

const PROXY_ENV_KEYS = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"] as const;
const SANDBOX_PROXY_PORT = 31_337;
const UNIX_SOCKET_PATH_MAX_BYTES = 107;
const NETWORK_PROXY_TEMP_PREFIX = "bostan-network-sandbox-";

function normalizeAbsolutePath(candidate: string, label: string): string {
  const trimmed = candidate.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be an absolute path.`);
  }
  return path.resolve(trimmed);
}

async function pathExists(candidate: string): Promise<boolean> {
  return fs.lstat(candidate).then(() => true).catch(() => false);
}

function isPathWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function parentDirectories(candidate: string): string[] {
  const directories: string[] = [];
  let current = path.dirname(candidate);
  while (current !== path.dirname(current)) {
    directories.push(current);
    current = path.dirname(current);
  }
  return directories.reverse();
}

function addParentDirectories(args: string[], created: Set<string>, candidate: string): void {
  for (const directory of parentDirectories(candidate)) {
    if (created.has(directory)) continue;
    args.push("--dir", directory);
    created.add(directory);
  }
}

async function nearestPackageRoot(candidate: string): Promise<string> {
  let current = path.dirname(candidate);
  while (current !== path.dirname(current)) {
    if (await pathExists(path.join(current, "package.json"))) return current;
    current = path.dirname(current);
  }
  return path.dirname(candidate);
}

async function executableReadPaths(command: string): Promise<string[]> {
  const paths = new Set<string>();
  paths.add(path.dirname(command));
  const realCommand = await fs.realpath(command).catch(() => command);
  paths.add(await nearestPackageRoot(realCommand));
  return Array.from(paths);
}

function parseNetworkAllowlistEntry(entry: string, index: number): NetworkAllowlistRule {
  const trimmed = entry.trim();
  if (!trimmed) throw new Error(`networkAllowlist[${index}] must not be empty.`);
  let hostname: string;
  let port: string | null;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:")
      || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("path");
    }
    hostname = parsed.hostname.toLowerCase();
    // URL.port omits a scheme's default port (e.g. HTTPS :443, HTTP :80).
    // A missing port means ANY port to the proxy, so inspect the authority's
    // original bytes rather than widening an explicitly pinned port.
    const rawAuthority = trimmed.includes("://")
      ? trimmed.slice(trimmed.indexOf("://") + 3)
      : trimmed;
    // WHATWG URL normalizes dot-segments and backslashes, strips ASCII
    // tabs/newlines, and can erase empty query/hash delimiters. Reject these
    // raw bytes before they can hide a default port and grant any port.
    if (/[\\?#\x00-\x20\x7f]/.test(rawAuthority)
      || (rawAuthority.includes("/") && !/^[^/]+\/$/.test(rawAuthority))) {
      throw new Error("noncanonical origin suffix");
    }
    const authority = rawAuthority.endsWith("/") ? rawAuthority.slice(0, -1) : rawAuthority;
    if (authority.endsWith(":")) throw new Error("missing explicit port");
    const explicitPort = /:(\d+)$/.exec(authority)?.[1];
    if (explicitPort !== undefined) {
      const numericPort = Number(explicitPort);
      if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
        throw new Error("port");
      }
      port = String(numericPort);
    } else {
      port = parsed.port || null;
    }
  } catch {
    throw new Error(`networkAllowlist[${index}] must be a hostname, hostname:port, or origin URL.`);
  }
  if (!hostname || hostname === "*" || hostname.startsWith("*.")) {
    throw new Error(`networkAllowlist[${index}] must use an exact hostname; wildcards are not supported.`);
  }
  return { hostname, port };
}

export function parseLocalProcessNetworkAllowlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    if (typeof entry !== "string") throw new Error(`networkAllowlist[${index}] must be a string.`);
    const rule = parseNetworkAllowlistEntry(entry, index);
    return rule.port ? `${rule.hostname}:${rule.port}` : rule.hostname;
  });
}

export function parseLocalProcessNetworkScope(value: unknown): LocalProcessNetworkScope | null {
  if (value == null || value === "") return null;
  if (value === "deny" || value === "allowlist") return value;
  throw new Error('networkScope must be "deny" or "allowlist".');
}

export function parseLocalProcessFilesystemScope(value: unknown): "workspace" | null {
  if (value == null || value === "") return null;
  if (value === "workspace") return value;
  throw new Error('filesystemScope must be "workspace".');
}

// CONNECT is untrusted proxy input. net.connect rejects ports outside the
// valid TCP range synchronously; an exception inside the HTTP "connect"
// callback can otherwise crash the entire process. Reject noncanonical
// numbers (including 0 and leading zeros) before any network effect.
export function isValidLocalProcessProxyConnectPort(value: string): boolean {
  return /^[1-9][0-9]{0,4}$/.test(value) && Number(value) <= 65535;
}

function normalizeProxyNetworkHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  // WHATWG URL.hostname preserves brackets around IPv6 literals, while
  // CONNECT authority parsing removes them. Compare both sides identically.
  return lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
}

function isNetworkTargetAllowed(hostname: string, port: string, rules: NetworkAllowlistRule[]): boolean {
  const normalizedHostname = normalizeProxyNetworkHostname(hostname);
  return rules.some((rule) =>
    normalizeProxyNetworkHostname(rule.hostname) === normalizedHostname
    && (rule.port === null || rule.port === port));
}

function assertUnixSocketPathLength(socketPath: string): void {
  const pathBytes = Buffer.byteLength(socketPath);
  if (pathBytes > UNIX_SOCKET_PATH_MAX_BYTES) {
    throw new Error(
      `Bostan sandbox proxy socket path is ${pathBytes} bytes, exceeding the Linux limit of ${UNIX_SOCKET_PATH_MAX_BYTES}: ${socketPath}`,
    );
  }
}

async function createNetworkProxyTempDir(): Promise<string> {
  const candidates = Array.from(new Set(["/tmp", os.tmpdir()]));
  let lastError: unknown;
  for (const baseDir of candidates) {
    try {
      const tempDir = await fs.mkdtemp(path.join(baseDir, NETWORK_PROXY_TEMP_PREFIX));
      try {
        assertUnixSocketPathLength(path.join(tempDir, "proxy.sock"));
        return tempDir;
      } catch (error) {
        await fs.rm(tempDir, { recursive: true, force: true });
        lastError = error;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("Unable to create a Linux-safe Bostan sandbox proxy socket directory.", { cause: lastError });
}

function parseTrustedNetworkUrl(value: string): NetworkAllowlistRule | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return {
      hostname: parsed.hostname.toLowerCase(),
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return null;
  }
}

function writeProxyError(response: http.ServerResponse, status: number, code: string, message: string): void {
  const body = `${JSON.stringify({ error: { code, message } })}\n`;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  }).end(body);
}

function connectProxyError(code: string, message: string): string {
  const body = `${JSON.stringify({ error: { code, message } })}\n`;
  return [
    "HTTP/1.1 403 Forbidden",
    "Connection: close",
    "Content-Type: application/json; charset=utf-8",
    `Content-Length: ${Buffer.byteLength(body)}`,
    "",
    body,
  ].join("\r\n");
}

// RFC 9110: these fields describe a single transport hop. Connection may
// nominate *additional* hop-local headers, including secrets provisioned by
// a client or origin. Never copy any of them into the next HTTP hop.
const HOP_BY_HOP_HEADER_NAMES = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const;

export function filterLocalProcessProxyHopByHopHeaders(
  incoming: http.IncomingHttpHeaders,
): http.OutgoingHttpHeaders {
  const forwarded: http.OutgoingHttpHeaders = { ...incoming };
  for (const name of HOP_BY_HOP_HEADER_NAMES) delete forwarded[name];
  for (const name of (incoming.connection ?? "").split(",")) {
    const normalized = name.trim().toLowerCase();
    if (normalized) delete forwarded[normalized];
  }
  return forwarded;
}

/** Keep origin authorization, never forward proxy credentials or hop fields. */
export function buildLocalProcessProxyOriginHeaders(
  incoming: http.IncomingHttpHeaders,
  targetHost: string,
): http.OutgoingHttpHeaders {
  return { ...filterLocalProcessProxyHopByHopHeaders(incoming), host: targetHost };
}

async function startNetworkAllowlistProxy(
  allowlist: string[],
  trustedUrls: string[],
  socketPath: string,
): Promise<NetworkAllowlistProxy> {
  assertUnixSocketPathLength(socketPath);
  const rules = [
    ...allowlist.map(parseNetworkAllowlistEntry),
    ...trustedUrls.map(parseTrustedNetworkUrl).filter((rule): rule is NetworkAllowlistRule => rule !== null),
  ];
  if (rules.length === 0) {
    throw new Error(
      'networkScope="allowlist" requires at least one valid networkAllowlist hostname or HTTP(S) networkTrustedUrl.',
    );
  }
  const server = http.createServer((request, response) => {
    let target: URL;
    try {
      target = new URL(request.url ?? "");
    } catch {
      writeProxyError(response, 400, "invalid_request_url", "Bostan sandbox proxy requires an absolute request URL.");
      return;
    }
    const port = target.port || (target.protocol === "https:" ? "443" : "80");
    if (target.protocol !== "http:") {
      writeProxyError(response, 400, "https_requires_connect", "HTTPS targets must use CONNECT through the Bostan sandbox proxy.");
      return;
    }
    if (!isNetworkTargetAllowed(target.hostname, port, rules)) {
      writeProxyError(response, 403, "network_target_denied", "Network target denied by Bostan sandbox policy.");
      return;
    }
    const upstream = http.request(target, {
      method: request.method,
      headers: buildLocalProcessProxyOriginHeaders(request.headers, target.host),
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, filterLocalProcessProxyHopByHopHeaders(upstreamResponse.headers));
      upstreamResponse.pipe(response);
    });
    upstream.on("error", (error) => response.destroy(error));
    // The agent can disconnect while an allowlisted HTTP origin remains idle.
    // Abort the origin request rather than retaining a dangling TCP connection
    // indefinitely after the downstream response is no longer deliverable.
    response.once("close", () => {
      if (!response.writableEnded) upstream.destroy();
    });
    // A client can also disconnect halfway through uploading the request body.
    // 'close' after a fully received body is normal; never cancel for that.
    request.once("close", () => {
      if (!request.complete) upstream.destroy();
    });
    request.pipe(upstream);
  });
  server.on("connect", (request, clientSocket, head) => {
    const separator = request.url?.lastIndexOf(":") ?? -1;
    const hostname = separator > 0 ? request.url!.slice(0, separator).replace(/^\[|\]$/g, "") : "";
    const port = separator > 0 ? request.url!.slice(separator + 1) : "443";
    if (!hostname || !isValidLocalProcessProxyConnectPort(port) || !isNetworkTargetAllowed(hostname, port, rules)) {
      clientSocket.end(connectProxyError(
        "network_target_denied",
        "Network target denied by Bostan sandbox policy.",
      ));
      return;
    }
    const upstream = net.connect(Number(port), hostname, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    // A tunneled client can send a TCP RST, e.g. after cancelling a request.
    // Without an 'error' listener ECONNRESET is an uncaught EventEmitter
    // exception and terminates the entire long-lived sandbox proxy.
    clientSocket.on("error", () => upstream.destroy());
    clientSocket.on("close", () => upstream.destroy());
  });
  const sockets = new Set<net.Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// The source is executed within the Linux sandbox; an optional listen port
// allows local regression tests to avoid competing for the production port.
export async function createNetworkProxyBridge(listenPort = SANDBOX_PROXY_PORT): Promise<string> {
  const source = `
const net = require("node:net");
const { spawn } = require("node:child_process");
const socketPath = process.argv[2];
const executable = process.argv[3];
const args = process.argv.slice(4);
const sockets = new Set();
const server = net.createServer((client) => {
  const upstream = net.connect(socketPath);
  sockets.add(client);
  sockets.add(upstream);
  client.once("close", () => { sockets.delete(client); upstream.destroy(); });
  upstream.once("close", () => { sockets.delete(upstream); client.destroy(); });
  client.pipe(upstream);
  upstream.pipe(client);
  const close = () => { client.destroy(); upstream.destroy(); };
  client.on("error", close);
  upstream.on("error", close);
});
server.listen(${listenPort}, "127.0.0.1", () => {
  const child = spawn(executable, args, { stdio: "inherit", env: process.env });
  const forward = (signal) => { if (!child.killed) child.kill(signal); };
  const forwardTerm = () => forward("SIGTERM");
  const forwardInt = () => forward("SIGINT");
  process.on("SIGTERM", forwardTerm);
  process.on("SIGINT", forwardInt);
  // Failed execs emit 'error' and may never emit 'exit'. 'close' always
  // follows either path; ensure no unhandled process error or bridge hang.
  child.on("error", (error) => { process.stderr.write("Bostan sandbox bridge spawn failed: " + error.message + "\\n"); });
  child.once("close", (code, signal) => {
    for (const socket of sockets) socket.destroy();
    server.close(() => {
      if (signal) {
        process.off("SIGTERM", forwardTerm);
        process.off("SIGINT", forwardInt);
        process.kill(process.pid, signal);
      } else process.exit(code == null || code < 0 ? 1 : code);
    });
  });
});
`;
  return source.trimStart();
}

export async function buildLocalProcessSandboxSpawnTarget(input: {
  executable: string;
  args: string[];
  cwd: string;
  options: LocalProcessSandboxOptions;
}): Promise<LocalProcessSandboxSpawnTarget> {
  if (process.platform !== "linux") {
    throw new Error("Local process filesystem and network scopes are currently supported only on Linux.");
  }
  const filesystemScope = input.options.filesystemScope ?? null;
  const networkScope = input.options.networkScope ?? null;
  if (!filesystemScope && !networkScope) throw new Error("Local process sandbox requires a filesystem or network scope.");

  const workspaceDir = normalizeAbsolutePath(input.options.workspaceDir, "Sandbox workspaceDir");
  const cwd = normalizeAbsolutePath(input.cwd, "Sandbox cwd");
  let physicalWorkspace: string | null = null;
  // Snapshot approved physical mount sources during policy validation.
  // A mutable symlink spelling must never become a later bwrap host source.
  const validatedWritableExtraSources = new Map<string, string>();
  if (filesystemScope === "workspace") {
    // Lexical path checks alone are insufficient: a symlink placed *inside*
    // the workspace may resolve to files the sandbox was never authorized to
    // mount. Resolve existing paths before issuing any bwrap --bind arguments.
    physicalWorkspace = await fs.realpath(workspaceDir);
    const physicalCwd = await fs.realpath(cwd);
    if (!isPathWithinRoot(workspaceDir, cwd) || !isPathWithinRoot(physicalWorkspace, physicalCwd)) {
      throw new Error(`Sandbox cwd "${cwd}" must be inside workspaceDir "${workspaceDir}".`);
    }
    const outboundRestorePaths = (input.options.outboundRestorePaths ?? []).map((candidate, index) =>
      normalizeAbsolutePath(candidate, `Sandbox outboundRestorePaths[${index}]`));
    const physicalRestorePaths = await Promise.all(outboundRestorePaths.map(async (candidate) =>
      await fs.realpath(candidate).catch(() => null)));
    for (const [index, extraPath] of (input.options.extraPaths ?? []).entries()) {
      if (extraPath.access !== "rw") continue;
      const normalizedExtraPath = normalizeAbsolutePath(extraPath.path, `Sandbox extraPaths[${index}].path`);
      const synchronized = isPathWithinRoot(workspaceDir, normalizedExtraPath);
      const restored = outboundRestorePaths.some((restorePath) => isPathWithinRoot(restorePath, normalizedExtraPath));
      // Preserve the existing behavior for unavailable optional paths: the
      // mount() helper skips them. A dangling symlink still exists by lstat
      // and must fail closed when realpath cannot resolve it.
      let physicallyAllowed = true;
      let physicalSource: string | null = null;
      if (await pathExists(normalizedExtraPath)) {
        physicalSource = await fs.realpath(normalizedExtraPath);
        physicallyAllowed = isPathWithinRoot(physicalWorkspace, physicalSource) ||
          physicalRestorePaths.some((restorePath) => restorePath !== null && isPathWithinRoot(restorePath, physicalSource));
      }
      if ((!synchronized && !restored) || !physicallyAllowed) {
        throw new Error(
          `Writable sandbox path "${normalizedExtraPath}" is outside synchronized workspace "${workspaceDir}" and has no outbound restore mapping.`,
        );
      }
      // Retain only a source already admitted above. A formerly absent
      // optional path appearing later in setup must not be mounted unchecked.
      if (physicalSource !== null) validatedWritableExtraSources.set(normalizedExtraPath, physicalSource);
    }
  }

  const bwrapCommand = input.options.command?.trim() || "bwrap";
  const args = ["--die-with-parent", "--new-session", "--unshare-pid", "--unshare-ipc", "--unshare-uts"];
  const env: Record<string, string | undefined> = {};
  let cleanup: (() => Promise<void>) | undefined;
  let executable = input.executable;
  let executableArgs = input.args;

  if (filesystemScope === "workspace") {
    args.push("--tmpfs", "/", "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp");
    args.push(
      "--symlink", "usr/bin", "/bin",
      "--symlink", "usr/sbin", "/sbin",
      "--symlink", "usr/lib", "/lib",
      "--symlink", "usr/lib64", "/lib64",
    );
    const created = new Set<string>(["/", "/proc", "/dev", "/tmp"]);
    const mounted = new Set<string>();
    const mount = async (source: string, access: LocalProcessSandboxAccess, validatedSource?: string) => {
      const normalized = normalizeAbsolutePath(source, "Sandbox path");
      if (mounted.has(normalized) || !(await pathExists(normalized))) return;
      addParentDirectories(args, created, normalized);
      args.push(access === "rw" ? "--bind" : "--ro-bind", validatedSource ?? normalized, normalized);
      mounted.add(normalized);
      created.add(normalized);
    };
    for (const systemPath of SYSTEM_READ_PATHS) await mount(systemPath, "ro");
    for (const executablePath of await executableReadPaths(input.executable)) await mount(executablePath, "ro");
    if (networkScope === "allowlist") {
      for (const nodePath of await executableReadPaths(process.execPath)) await mount(nodePath, "ro");
    }
    for (const [index, managedPath] of (input.options.managedPaths ?? []).entries()) {
      const normalized = normalizeAbsolutePath(managedPath.path, `Sandbox managedPaths[${index}].path`);
      // Managed read-write and read-only paths can intentionally be outside
      // the workspace. Pin their approved physical SOURCE before constructing
      // bwrap argv; a mutable symlink must never redirect that host mount.
      if (!(await pathExists(normalized))) continue;
      const physicalSource = await fs.realpath(normalized);
      await mount(normalized, managedPath.access, physicalSource);
    }
    for (const extraPath of input.options.extraPaths ?? []) {
      if (extraPath.access === "rw") {
        const normalized = normalizeAbsolutePath(extraPath.path, "Sandbox writable extra path");
        const admittedSource = validatedWritableExtraSources.get(normalized);
        if (!admittedSource) continue; // An optional path absent during validation.
        await mount(extraPath.path, extraPath.access, admittedSource);
      } else {
        // Read-only extras may intentionally be outside the workspace, but
        // their host SOURCE must not remain a mutable symlink after approval.
        // Preserve optional missing-path behavior; fail closed on dangling links.
        const normalized = normalizeAbsolutePath(extraPath.path, "Sandbox read-only extra path");
        if (!(await pathExists(normalized))) continue;
        const physicalSource = await fs.realpath(normalized);
        await mount(extraPath.path, extraPath.access, physicalSource);
      }
    }
    // The workspace itself may be a symlink; use the exact realpath already
    // admitted above, not a mutable host link that could be retargeted before
    // the bwrap command executes. Keep the in-sandbox destination unchanged.
    await mount(workspaceDir, "rw", physicalWorkspace ?? undefined);
    for (const [index, alias] of (input.options.pathAliases ?? []).entries()) {
      const aliasPath = normalizeAbsolutePath(alias.path, `Sandbox pathAliases[${index}].path`);
      const aliasTarget = normalizeAbsolutePath(alias.target, `Sandbox pathAliases[${index}].target`);
      if (!(await pathExists(aliasTarget))) {
        throw new Error(`Sandbox path alias target "${aliasTarget}" does not exist.`);
      }
      const physicalAliasTarget = await fs.realpath(aliasTarget);
      if (!physicalWorkspace || !isPathWithinRoot(workspaceDir, aliasTarget) ||
          !isPathWithinRoot(physicalWorkspace, physicalAliasTarget)) {
        throw new Error(
          `Sandbox path alias "${aliasPath}" must target the synchronized workspace "${workspaceDir}".`,
        );
      }
      addParentDirectories(args, created, aliasPath);
      // Use the physical target actually checked above, not a symlink that
      // may be redirected between validation and the bwrap process spawn.
      args.push("--bind", physicalAliasTarget, aliasPath);
      created.add(aliasPath);
    }

    if (networkScope === "allowlist") {
      const tempDir = await createNetworkProxyTempDir();
      const socketPath = path.join(tempDir, "proxy.sock");
      const bridgePath = path.join(tempDir, "bridge.cjs");
      await fs.writeFile(bridgePath, await createNetworkProxyBridge(), { mode: 0o500 });
      const proxy = await startNetworkAllowlistProxy(
        input.options.networkAllowlist ?? [],
        input.options.networkTrustedUrls ?? [],
        socketPath,
      ).catch(async (error) => {
        await fs.rm(tempDir, { recursive: true, force: true });
        throw error;
      });
      await mount(tempDir, "rw");
      executable = process.execPath;
      executableArgs = [bridgePath, socketPath, input.executable, ...input.args];
      cleanup = async () => {
        await proxy.close();
        await fs.rm(tempDir, { recursive: true, force: true });
      };
    }
  } else {
    args.push("--bind", "/", "/");
    if (networkScope === "allowlist") {
      const tempDir = await createNetworkProxyTempDir();
      const socketPath = path.join(tempDir, "proxy.sock");
      const bridgePath = path.join(tempDir, "bridge.cjs");
      await fs.writeFile(bridgePath, await createNetworkProxyBridge(), { mode: 0o500 });
      const proxy = await startNetworkAllowlistProxy(
        input.options.networkAllowlist ?? [],
        input.options.networkTrustedUrls ?? [],
        socketPath,
      ).catch(async (error) => {
        await fs.rm(tempDir, { recursive: true, force: true });
        throw error;
      });
      executable = process.execPath;
      executableArgs = [bridgePath, socketPath, input.executable, ...input.args];
      cleanup = async () => {
        await proxy.close();
        await fs.rm(tempDir, { recursive: true, force: true });
      };
    }
  }

  if (networkScope) {
    args.push("--unshare-net");
    for (const key of PROXY_ENV_KEYS) env[key] = undefined;
    env.NO_PROXY = "";
    env.no_proxy = "";
  }
  if (networkScope === "allowlist") {
    const proxyUrl = `http://127.0.0.1:${SANDBOX_PROXY_PORT}`;
    env.HTTP_PROXY = proxyUrl;
    env.HTTPS_PROXY = proxyUrl;
    env.http_proxy = proxyUrl;
    env.https_proxy = proxyUrl;
  }

  args.push("--chdir", cwd, "--", executable, ...executableArgs);
  return { command: bwrapCommand, args, cwd: "/", env, cleanup };
}

export function parseLocalProcessSandboxExtraPaths(value: unknown): LocalProcessSandboxPath[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    if (typeof entry === "string") {
      return { path: normalizeAbsolutePath(entry, `filesystemExtraPaths[${index}]`), access: "ro" };
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`filesystemExtraPaths[${index}] must be an absolute path or { path, access } object.`);
    }
    const raw = entry as Record<string, unknown>;
    const access = raw.access === "rw" ? "rw" : raw.access === "ro" || raw.access == null ? "ro" : null;
    if (!access || typeof raw.path !== "string") {
      throw new Error(`filesystemExtraPaths[${index}] must use access "ro" or "rw" and an absolute path.`);
    }
    return { path: normalizeAbsolutePath(raw.path, `filesystemExtraPaths[${index}].path`), access };
  });
}
