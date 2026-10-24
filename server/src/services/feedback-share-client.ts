import { gzipSync } from "node:zlib";
import type { FeedbackTraceBundle } from "@paperclipai/shared";
import type { Config } from "../config.js";

export const FEEDBACK_UPLOAD_TIMEOUT_MS = 30_000;

function buildFeedbackShareObjectKey(bundle: FeedbackTraceBundle, exportedAt: Date) {
  const year = String(exportedAt.getUTCFullYear());
  const month = String(exportedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(exportedAt.getUTCDate()).padStart(2, "0");
  return `feedback-traces/${bundle.companyId}/${year}/${month}/${day}/${bundle.exportId ?? bundle.traceId}.json`;
}

export interface FeedbackTraceShareClient {
  uploadTraceBundle(bundle: FeedbackTraceBundle, signal?: AbortSignal): Promise<{ objectKey: string }>;
}

export function configuredBostanFeedbackEndpoint(
  config: Pick<Config, "feedbackExportBackendUrl" | "feedbackExportBackendToken">,
): string | null {
  const baseUrl = config.feedbackExportBackendUrl?.trim();
  const token = config.feedbackExportBackendToken?.trim();
  // Do not resolve an inherited donor endpoint, follow redirects, or put trace
  // contents on the wire unless the operator chose a distinct HTTPS backend.
  return (() => {
    if (!baseUrl || !token) return null;
    let parsed: URL;
    try { parsed = new URL(baseUrl); } catch { return null; }
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password
      || parsed.search || parsed.hash || (parsed.port && parsed.port !== "443")) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (hostname === "telemetry.paperclip.ing" || hostname.endsWith(".paperclip.ing")
      || hostname === "paperclip.ing" || hostname === "localhost" || hostname.endsWith(".localhost")
      || hostname === "127.0.0.1" || hostname === "[::1]") return null;
    // Intentionally override any caller-supplied path to use the fixed API.
    return new URL("/feedback-traces", parsed).toString();
  })();
}

export function createFeedbackTraceShareClientFromConfig(
  config: Pick<Config, "feedbackExportBackendUrl" | "feedbackExportBackendToken">,
): FeedbackTraceShareClient {
  const endpoint = configuredBostanFeedbackEndpoint(config);
  const token = config.feedbackExportBackendToken?.trim();

  return {
    async uploadTraceBundle(bundle, shutdownSignal) {
      if (!endpoint) {
        throw new Error("Bostan feedback export is disabled or has an invalid explicitly configured HTTPS destination and token");
      }
      const deadline = AbortSignal.timeout(FEEDBACK_UPLOAD_TIMEOUT_MS);
      const signal = shutdownSignal ? AbortSignal.any([shutdownSignal, deadline]) : deadline;
      signal.throwIfAborted();
      const exportedAt = new Date();
      const objectKey = buildFeedbackShareObjectKey(bundle, exportedAt);
      const requestBody = JSON.stringify({
        objectKey,
        exportedAt: exportedAt.toISOString(),
        bundle,
      });
      const response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          encoding: "gzip+base64+json",
          payload: gzipSync(requestBody).toString("base64"),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail.trim() || `Feedback trace upload failed with HTTP ${response.status}`);
      }

      const payload = await response.json().catch(() => null) as { objectKey?: unknown } | null;
      // A timed-out response body is not a successful upload acknowledgement.
      signal.throwIfAborted();
      return {
        objectKey: typeof payload?.objectKey === "string" && payload.objectKey.trim().length > 0
          ? payload.objectKey
          : objectKey,
      };
    },
  };
}
