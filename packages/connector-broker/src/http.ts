import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { RequestMeta } from "./broker.js";

const MAX_BODY_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

type Handler = (request: Request, meta: RequestMeta) => Promise<Response>;

/**
 * Plain HTTP listener meant to sit behind the operator's TLS reverse proxy.
 * Request URLs are rebuilt from the configured public origin, never from the
 * Host header, so a spoofed host cannot change audiences or redirect targets.
 */
export function createBrokerHttpServer(input: { publicOrigin: string; trustProxy: boolean; handle: Handler }): Server {
  const server = createServer((req, res) => {
    void serve(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "PROVIDER_OPERATION_FAILED" }));
    });
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;

  async function serve(req: IncomingMessage, res: ServerResponse) {
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
    if (body === null) {
      res.writeHead(413, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "MALFORMED_REQUEST" }));
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    const request = new Request(new URL(req.url ?? "/", input.publicOrigin), {
      method: req.method,
      headers,
      ...(body === undefined ? {} : { body: new Uint8Array(body) }),
    });
    const forwarded = input.trustProxy ? req.headers["x-forwarded-for"] : undefined;
    const remoteAddress = (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) || req.socket.remoteAddress || "unknown";
    const response = await input.handle(request, { remoteAddress });
    const outgoing: Record<string, string> = {};
    response.headers.forEach((value, name) => { outgoing[name] = value; });
    res.writeHead(response.status, outgoing);
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
  }

  return server;
}

async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      req.destroy();
      return null;
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
