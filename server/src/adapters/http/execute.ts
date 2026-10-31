import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";
import { guardedHttpAdapterFetch } from "./remote-fetch.js";
import { safeHttpAgentMethod, safeHttpAgentInvocationFailure } from "./safe-diagnostics.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;
  const url = asString(config.url, "");
  if (!url) throw new Error("HTTP adapter missing url");

  const method = asString(config.method, "POST");
  const timeoutMs = asNumber(config.timeoutMs, 0);
  const headers = parseObject(config.headers) as Record<string, string>;
  const payloadTemplate = parseObject(config.payloadTemplate);
  const body = {
    ...payloadTemplate,
    agentId: agent.id,
    runId,
    context,
    connectionInstructions: context.connectionInstructions ?? null,
    ...(ctx.runtimeTools ? { paperclipRuntimeTools: ctx.runtimeTools } : {}),
  };

  const diagnosticMethod = safeHttpAgentMethod(method);
  let rejectedStatus: number | null = null;
  // Freeze the first run-stop origin. Late transport completions and late
  // operator signals must not change a deadline into success/cancel, or a
  // user cancellation into a timeout.
  let abortOrigin: "owner" | "deadline" | null = null;
  const controller = new AbortController();
  const deadlineResult = (): AdapterExecutionResult => ({
    exitCode: null,
    signal: null,
    timedOut: true,
    errorMessage: `HTTP ${diagnosticMethod} request timed out after ${timeoutMs}ms`,
    errorCode: "timeout",
  });
  // The heartbeat owns ctx.signal. A cancelled run must not leave an HTTP
  // adapter request running just because timeoutMs was not configured.
  // Never pass the caller's possibly secret-bearing AbortSignal.reason to
  // the network layer or persisted diagnostics.
  const onRunAbort = () => {
    if (!controller.signal.aborted) {
      abortOrigin = "owner";
      controller.abort();
    }
  };
  if (ctx.signal?.aborted) onRunAbort();
  else ctx.signal?.addEventListener("abort", onRunAbort, { once: true });
  const timer = timeoutMs > 0 ? setTimeout(() => {
    // First abort wins: a cancellation followed by a later deadline must
    // never turn a user-initiated stop into a timeout/billing diagnosis.
    if (!controller.signal.aborted) {
      abortOrigin = "deadline";
      controller.abort();
    }
  }, timeoutMs) : null;

  try {
    if (controller.signal.aborted) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorCode: "cancelled",
        errorMessage: "HTTP adapter run cancelled before dispatch",
        executionRecovery: { kind: "bootstrap", providerWorkStarted: false },
      };
    }
    // HTTP adapters have no child-process spawn event. Signal immediately
    // before starting the remote request so dispatch gates can release without
    // waiting for the endpoint to respond.
    ctx.onDispatch?.();
    // The dispatch observer may synchronously cancel the owner. Do not
    // initiate a network effect after that cancellation. Dispatch has
    // already been reported, so do not assert the stronger pre-dispatch
    // no-provider-work accounting proof in this case.
    if (abortOrigin === "deadline") return deadlineResult();
    if (abortOrigin === "owner") {
      return {
        exitCode: 1, signal: null, timedOut: false,
        errorCode: "cancelled", errorMessage: "HTTP adapter run cancelled",
      };
    }
    const transport = guardedHttpAdapterFetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // An injected transport can ignore AbortSignal indefinitely. Complete
    // owner cancellation and configured deadlines without trusting it to
    // settle. Promise.race observes late rejections; best-effort cancel any
    // late response body so it cannot keep a streaming connection alive.
    let abortedWhilePending = false;
    let detachPendingAbort = () => {};
    const stopped = new Promise<never>((_resolve, reject) => {
      const onAbort = () => {
        abortedWhilePending = true;
        reject(new Error("HTTP adapter transport aborted"));
      };
      detachPendingAbort = () => controller.signal.removeEventListener("abort", onAbort);
      if (controller.signal.aborted) onAbort();
      else controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    void transport.then((lateResponse) => {
      if (abortedWhilePending) {
        try {
          void lateResponse.body?.cancel().catch(() => {});
        } catch {
          // Never expose remote stream cleanup failures.
        }
      }
    }, () => {
      // Promise.race also observes late rejection. Do not leak transport data.
    });
    let res: Response;
    try {
      res = await Promise.race([transport, stopped]);
    } finally {
      detachPendingAbort();
    }

    // The HTTP agent treats the remote HTTP status as the acknowledgement;
    // it does not consume or persist response bytes. Without cancellation a
    // peer can leave an unread, potentially endless stream/socket alive long
    // after the run returned. Do not await cancellation, since a broken peer
    // may never settle its body stream; suppress only cancellation errors.
    try {
      void res.body?.cancel().catch(() => {});
    } catch {
      // A hostile/mocked response object must not change the HTTP verdict.
    }

    // A mock, custom transport or peer may resolve just as the run is
    // cancelled. Do not accept even a 2xx after the owner signalled stop.
    if (abortOrigin === "deadline") return deadlineResult();
    if (abortOrigin === "owner") {
      return {
        exitCode: 1, signal: null, timedOut: false,
        errorCode: "cancelled", errorMessage: "HTTP adapter run cancelled",
      };
    }

    if (!res.ok) {
      rejectedStatus = res.status;
      throw new Error("HTTP adapter request rejected");
    }

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `HTTP ${diagnosticMethod} request completed`,
    };
  } catch (err) {
    // No diagnostic data from a late provider error may supersede the
    // already-recorded stop reason, even if the provider reports TypeError
    // instead of AbortError or resolves a 2xx after abort.
    if (abortOrigin === "deadline") return deadlineResult();
    if (abortOrigin === "owner") {
      return {
        exitCode: 1, signal: null, timedOut: false,
        errorCode: "cancelled", errorMessage: "HTTP adapter run cancelled",
      };
    }
    if (rejectedStatus !== null) {
      throw new Error("HTTP adapter request rejected with status " + rejectedStatus);
    }
    throw safeHttpAgentInvocationFailure(err);
  } finally {
    if (timer) clearTimeout(timer);
    ctx.signal?.removeEventListener("abort", onRunAbort);
  }
}
