import { afterEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_INTENT_AGENT_GUIDANCE } from "@bostan/shared";
import { execute } from "./execute.js";

const guardedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("./remote-fetch.js", () => ({
  guardedHttpAdapterFetch: guardedFetchMock,
}));

afterEach(() => {
  guardedFetchMock.mockReset();
});

describe("http adapter execute", () => {
  it("delivers the complete runtime connection descriptor and shared guidance", async () => {
    const onDispatch = vi.fn();
    guardedFetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      expect(onDispatch).toHaveBeenCalledOnce();
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.paperclipRuntimeTools).toEqual({
        version: 1,
        guidance: CONNECTION_INTENT_AGENT_GUIDANCE,
        mcpEndpoint: "https://paperclip.test/mcp/runtime-tools",
        rest: {
          connectionsSearch: "https://paperclip.test/runtime-tools/connections/search",
          connectionRequest: "https://paperclip.test/runtime-tools/connections/request",
        },
        bearerToken: "run-token",
        expiresAt: "2026-08-26T15:00:00.000Z",
        tools: ["connections_search", "connection_request"],
      });
      return new Response(null, { status: 204 });
    });

    await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Agent",
        adapterType: "http",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: { url: "https://example.test/webhook" },
      context: {},
      runtimeTools: {
        version: 1,
        guidance: CONNECTION_INTENT_AGENT_GUIDANCE,
        mcpEndpoint: "https://paperclip.test/mcp/runtime-tools",
        rest: {
          connectionsSearch: "https://paperclip.test/runtime-tools/connections/search",
          connectionRequest: "https://paperclip.test/runtime-tools/connections/request",
        },
        bearerToken: "run-token",
        expiresAt: "2026-08-26T15:00:00.000Z",
        tools: ["connections_search", "connection_request"],
      },
      onLog: async () => {},
      onDispatch,
    });

    expect(guardedFetchMock).toHaveBeenCalledOnce();
    expect(onDispatch).toHaveBeenCalledOnce();
  });

  it("sends the server snapshot instead of a configured payload instruction block", async () => {
    const snapshot = { text: "Use the release handbook.", digest: "server-digest" };
    guardedFetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).connectionInstructions).toEqual(snapshot);
      return new Response(null, { status: 204 });
    });
    await execute({ runId: "run-1", agent: { id: "agent-1", companyId: "company-1", name: "Agent", adapterType: "http", adapterConfig: {} }, runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { url: "https://example.test/webhook", payloadTemplate: { connectionInstructions: { text: "forged" } } }, context: { connectionInstructions: snapshot }, onLog: async () => {},
    });
    expect(guardedFetchMock).toHaveBeenCalledOnce();
  });

  it("reports configured request timeout as timed_out", async () => {
    guardedFetchMock.mockImplementation(
      (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    );

    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Agent",
        adapterType: "http",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        url: "https://example.test/webhook",
        timeoutMs: 1,
      },
      context: {},
      onLog: async () => {},
    });

    expect(result.timedOut).toBe(true);
    expect(result.errorCode).toBe("timeout");
    expect(result.errorMessage).toContain("timed out after 1ms");
  });
});

  it("does not reveal credential-bearing endpoint in successful run summary", async () => {
    const secretUrl = "https://user:PRIVATE_PASSWORD@example.test/hook/PRIVATE_PATH?token=PRIVATE_QUERY#PRIVATE_FRAGMENT";
    guardedFetchMock.mockResolvedValue(new Response(null,{status:204}));
    const result = await execute({
      runId:"run-safe",agent:{id:"agent-safe",companyId:"company-safe",
        name:"Agent",adapterType:"http",adapterConfig:{}},
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{url:secretUrl,method:"POST"},context:{},onLog:async()=>{},
    });
    expect(guardedFetchMock).toHaveBeenCalledWith(secretUrl,expect.any(Object));
    expect(result.exitCode).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_PASSWORD|PRIVATE_PATH|PRIVATE_QUERY|PRIVATE_FRAGMENT|example\.test/);
  });

  it("does not expose URL or untrusted method on aborted HTTP runs", async () => {
    const secretUrl = "https://example.test/PRIVATE_PATH?access_token=PRIVATE_QUERY";
    guardedFetchMock.mockImplementation((_url:string,init?:RequestInit)=>
      new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>
        reject(new DOMException("Aborted", "AbortError")))));
    const result = await execute({
      runId:"run-safe",agent:{id:"agent-safe",companyId:"company-safe",
        name:"Agent",adapterType:"http",adapterConfig:{}},
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{url:secretUrl,method:"POST\nBearer PRIVATE_HEADER",timeoutMs:1},
      context:{},onLog:async()=>{},
    });
    expect(result.timedOut).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_PATH|PRIVATE_QUERY|PRIVATE_HEADER|example\.test/);
  });

  it("redacts untrusted fetch errors and preserves only allowlisted rejection classes",async()=>{
    const url="https://host.example/PRIVATE_PATH?token=PRIVATE_QUERY";
    guardedFetchMock.mockRejectedValueOnce(Object.assign(
      new Error("Bearer PRIVATE_SECRET in /PRIVATE_PATH"),{
        code:"remote_http_private_endpoint",
      }));
    const ctx={
      runId:"run-safe",agent:{id:"agent-safe",companyId:"company-safe",
        name:"Agent",adapterType:"http" as const,adapterConfig:{}},
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{url},context:{},onLog:async()=>{},
    };
    await expect(execute(ctx)).rejects.toThrow("HTTP adapter request failed (remote_http_private_endpoint)");
    guardedFetchMock.mockRejectedValueOnce(Object.assign(
      new Error("PRIVATE_SECRET leaked from remote server"),{code:"PRIVATE_SECRET_CODE"}));
    await expect(execute(ctx)).rejects.toThrow("HTTP adapter request failed (unclassified)");
  });

  it("reports rejected status without disclosing URL or response",async()=>{
    const url="https://host.example/PRIVATE_PATH?token=PRIVATE_QUERY";
    guardedFetchMock.mockResolvedValueOnce(new Response("PRIVATE_RESPONSE",{status:429}));
    await expect(execute({
      runId:"run-safe",agent:{id:"agent-safe",companyId:"company-safe",
        name:"Agent",adapterType:"http",adapterConfig:{}},
      runtime:{sessionId:null,sessionParams:null,sessionDisplayId:null,taskKey:null},
      config:{url},context:{},onLog:async()=>{},
    })).rejects.toThrow("HTTP adapter request rejected with status 429");
  });

describe("HTTP adapter streaming response resource ownership", () => {
  const run = () => execute({
    runId: "synthetic-http-run",
    agent: {
      id: "synthetic-http-agent", companyId: "synthetic-company",
      name: "Synthetic HTTP", adapterType: "http" as const, adapterConfig: {},
    },
    runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
    config: { url: "https://public.example/PRIVATE_PATH?token=PRIVATE_QUERY" },
    context: {}, onLog: async () => {},
  });

  it("cancels unread successful response body without buffering an infinite stream", async () => {
    let cancelled = 0;
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull() { pulled += 1; /* no chunks, remains open until cancelled */ },
      cancel() { cancelled += 1; },
    });
    guardedFetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await run();
    expect(result.exitCode).toBe(0);
    expect(cancelled).toBe(1);
    expect(pulled).toBeLessThanOrEqual(1);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_PATH|PRIVATE_QUERY/);
  });

  it("cancels unread rejected status body before propagating safe numeric status", async () => {
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({
      cancel() { cancelled++; },
    });
    guardedFetchMock.mockResolvedValueOnce(new Response(body, { status: 429 }));
    await expect(run()).rejects.toThrow("HTTP adapter request rejected with status 429");
    expect(cancelled).toBe(1);
  });

  it("never waits for an untrusted response cancellation that stays pending", async () => {
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled++;
        return new Promise<void>(() => { /* remote stream never settles */ });
      },
    });
    guardedFetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const winner = await Promise.race([
      run().then(result => result.exitCode),
      new Promise<string>(resolve => setTimeout(() => resolve("blocked_on_cancel"), 300)),
    ]);
    expect(winner).toBe(0);
    expect(cancelled).toBe(1);
  });

  it("does not turn a valid response into failure if its unusable body rejects cancellation", async () => {
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({
      cancel() { cancelled++; return Promise.reject(new Error("PRIVATE_CANCEL_DIAGNOSTIC")); },
    });
    guardedFetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));
    const result = await run();
    expect(result.exitCode).toBe(0);
    expect(cancelled).toBe(1);
  });
});
