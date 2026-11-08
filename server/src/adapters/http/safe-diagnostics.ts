/**
 * Diagnostic text from configured HTTP agent endpoints is not a trusted source.
 * Even operator-defined URLs may contain credentials, signed paths, bearer
 * query parameters, or tenant-identifying hostnames. Never echo those values
 * into run summaries, setup checks, or persisted error messages.
 */
const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const errorCodes = new Set([
  "mcp_remote_url_missing", "mcp_remote_url_invalid",
  "remote_http_private_endpoint", "remote_http_dns_failed",
  "remote_http_rebind_detected",
]);

export function safeHttpAgentMethod(value: string): string {
  const method = value.trim().toUpperCase();
  return methods.has(method) ? method : "custom";
}

export function safeHttpAgentErrorCode(error: unknown): string {
  try {
    if (!error || typeof error !== "object" || !("code" in error)) return "unclassified";
    const code = error.code;
    return typeof code === "string" && errorCodes.has(code) ? code : "unclassified";
  } catch {
    // A provider-owned error may have a throwing getter or Proxy trap.
    return "unclassified";
  }
}

export function safeHttpAgentInvocationFailure(error: unknown): Error {
  const code = safeHttpAgentErrorCode(error);
  // Never preserve external errors as causes: causes and stacks may contain
  // endpoint URLs or credentials and can be serialized by later layers.
  return new Error("HTTP adapter request failed (" + code + ")");
}
