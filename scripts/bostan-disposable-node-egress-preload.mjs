/**
 * TEST ONLY. Guard recognized Node outbound APIs during a disposable source
 * smoke. This is NOT a production network sandbox or a host firewall.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import http2 from "node:http2";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

export const isPrivateNodeQaDestination = (value) => {
  if (typeof value !== "string" || value.trim() !== value || !value) return false;
  const hostname = value.replace(/^\[|\]$/g, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
};

export function outboundNodeQaDestination(args) {
  const [input, second] = args;
  if (input instanceof URL || typeof input === "string" && /^\w+:\/\//.test(input)) {
    const url = new URL(input);
    return { host: url.hostname, url };
  }
  if (typeof input === "string" && !/^\d+$/.test(input)) {
    // Unix socket or named pipe only; a bare remote hostname isn't a connect address.
    return { unix: input.startsWith("/") || input.startsWith("\\\\.\\pipe\\") };
  }
  if (typeof input === "number") {
    return { host: typeof second === "string" ? second : "localhost" };
  }
  if (input && typeof input === "object") {
    if (input.socketPath || input.path) {
      return { unix: typeof (input.socketPath ?? input.path) === "string" &&
        (input.socketPath ?? input.path).startsWith("/") };
    }
    const h = input.hostname ?? input.host ?? "localhost";
    if (typeof h !== "string") return { host: "" };
    if (h.startsWith("[")) return { host: h.slice(1, h.indexOf("]")) };
    return { host: h.replace(/:(\d+)$/, "") };
  }
  return { host: "" };
}

export function assertPrivateNodeQaDestination(args, category, record = () => {}) {
  let allowed = false;
  try {
    const dest = outboundNodeQaDestination(args);
    allowed = dest.unix === true || (
      isPrivateNodeQaDestination(dest.host) &&
      (dest.url === undefined || !dest.url.username && !dest.url.password)
    );
  } catch { /* Invalid address is not admitted. */ }
  if (!allowed) {
    record(category);
    throw new Error("Bostan disposable Node QA blocked a non-loopback destination");
  }
  return true;
}

/**
 * A local URL is NOT a sufficient network boundary when Node allows the
 * second options argument to override hostname, DNS lookup or the Agent.
 * Also forbid user-supplied connect hooks that could route a local hostname
 * through an arbitrary remote socket. Fail closed in the QA preload only.
 */
export function assertPrivateNodeQaConnectionOptions(args, category, record = () => {}) {
  const [input, second] = args;
  const isUrl = input instanceof URL ||
    typeof input === "string" && /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  const options = isUrl
    ? (second && typeof second === "object" ? second : null)
    : input && typeof input === "object" && !(input instanceof URL) ? input : null;
  if (!options) return true;
  let unsafe = false;
  if (typeof options.lookup === "function" ||
      typeof options.createConnection === "function" ||
      typeof options.createSocket === "function") unsafe = true;
  if (["http", "http2"].includes(category)) {
    // A custom HTTP agent or HTTP/2 connect hook can bypass this file's
    // guarded built-ins. Don't infer safety from the URL alone.
    if (options.agent && options.agent !== http.globalAgent &&
        options.agent !== https.globalAgent) unsafe = true;
  }
  if (isUrl) {
    // The full URL has already passed the primary destination check.
    // Options can silently replace its authority; qualify each override.
    for (const name of ["hostname", "host"]) {
      if (options[name] != null &&
          !isPrivateNodeQaDestination(options[name])) unsafe = true;
    }
    if (options.socketPath && !(typeof options.socketPath === "string" &&
        options.socketPath.startsWith("/"))) unsafe = true;
  }
  if (unsafe) {
    record(category);
    throw new Error("Bostan disposable Node QA blocked an override of its private network destination");
  }
  return true;
}

export function activateDisposableNodeEgressGuard(env = process.env) {
  if (env.BOSTAN_TEST_ONLY_NODE_EGRESS_GUARD !== "1") return false;
  const home = env.HOME;
  if (!home || !path.isAbsolute(home)) {
    throw new Error("Bostan Node QA guard requires a disposable absolute HOME");
  }
  // Never allow a user-provided arbitrary audit output path.
  const receipt = path.join(home, "bostan-node-egress-attempts.log");
  if (!fs.existsSync(home) || !fs.statSync(home).isDirectory()) {
    throw new Error("Bostan Node QA requires an existing disposable HOME");
  }
  const record = category => fs.appendFileSync(receipt, category + "\n", { flag: "a", mode: 0o600 });
  record("armed");
  const wrap = (original, label) => function (...args) {
    assertPrivateNodeQaDestination(args, label, record);
    assertPrivateNodeQaConnectionOptions(args, label, record);
    return Reflect.apply(original, this, args);
  };
  for (const mod of [http, https]) {
    mod.request = wrap(mod.request, "http");
    mod.get = wrap(mod.get, "http");
  }
  http2.connect = wrap(http2.connect, "http2");
  net.connect = wrap(net.connect, "tcp");
  net.createConnection = wrap(net.createConnection, "tcp");
  tls.connect = wrap(tls.connect, "tls");
  syncBuiltinESMExports();

  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === "function") {
    globalThis.fetch = function (input, ...rest) {
      try {
        assertPrivateNodeQaDestination([typeof input === "string" || input instanceof URL
          ? input : input?.url], "fetch", record);
      } catch (error) {
        return Promise.reject(error);
      }
      // Undici dispatchers are opaque transports: an allowed URL can be
      // forwarded by a custom dispatcher to another host.
      if (rest[0]?.dispatcher || rest[0]?.agent) {
        record("fetch");
        return Promise.reject(new Error(
          "Bostan disposable Node QA blocked an override of its private network destination",
        ));
      }
      // Node fetch follows redirects inside Undici, outside wrapped Node sockets.
      // Force one-hop requests in disposable QA and reject any returned redirect.
      const init = rest[0] ?? {};
      if (typeof init !== "object" || Array.isArray(init)) {
        record("fetch");
        return Promise.reject(new Error("Bostan disposable Node QA refused malformed fetch options"));
      }
      return Promise.resolve(Reflect.apply(originalFetch, this,
        [input, { ...init, redirect: "manual" }])).then(response => {
        if (response.status >= 300 && response.status < 400 &&
            response.headers.has("location")) {
          record("fetch-redirect");
          throw new Error("Bostan disposable Node QA blocked a redirect");
        }
        return response;
      });
    };
  }
  const OriginalWebSocket = globalThis.WebSocket;
  if (typeof OriginalWebSocket === "function") {
    globalThis.WebSocket = class extends OriginalWebSocket {
      constructor(url, ...rest) {
        assertPrivateNodeQaDestination([url], "websocket", record);
        super(url, ...rest);
      }
    };
  }
  return true;
}

// Only explicit disposable source QA opt-in ever activates this hook.
activateDisposableNodeEgressGuard();
