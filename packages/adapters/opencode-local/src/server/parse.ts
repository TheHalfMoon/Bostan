import { asString, parseJson, parseObject } from "@bostan/adapter-utils/server-utils";
import { createStringCompactor } from "@bostan/adapter-utils/usage-checkpoint";

const STEP_LIMIT_MESSAGE = "OpenCode reached the configured maximum agent steps before completing its turn.";

/** Retain only bounded protocol text while observing the uncapped transport.
 * Accounting deliberately strips tool state and cannot establish turn outcome. */
export function createOpenCodeTurnObserver() {
  const compact = createStringCompactor();
  let remainder = "", finishReason = "";
  let limitRefused = false, observed = false, invalid = false;
  function record(line: string) {
    if (line.length > 1024 * 1024) throw new Error("OpenCode completion record exceeds its observation bound");
    const event = parseJson(line);
    if (!event) return;
    const type = asString(event.type, "");
    if (type === "step_start") { limitRefused = false; finishReason = ""; observed = false; }
    if (type === "step_finish") { finishReason = asString(parseObject(event.part).reason, ""); observed = true; }
    if (type === "tool_use") {
      const state = parseObject(parseObject(event.part).state);
      if (state.status === "error" && state.error === "Tools are disabled after the maximum agent steps") limitRefused = true;
    }
  }
  return {
    write(chunk: string) {
      if (invalid) return;
      try {
        const lines = (remainder + compact(chunk)).split("\n");
        remainder = lines.pop() ?? "";
        if (remainder.length > 1024 * 1024) throw new Error();
        for (const line of lines) record(line);
      } catch { invalid = true; remainder = ""; }
    },
    finish() {
      if (invalid) throw new Error("OpenCode completion observation failed; turn outcome is unverified");
      if (remainder) { record(remainder); remainder = ""; }
      return { observed, stepLimitExceeded: limitRefused && finishReason === "tool-calls" };
    },
  };
}

function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = parseObject(value);
  const message = asString(rec.message, "").trim();
  if (message) return message;
  const data = parseObject(rec.data);
  const nestedMessage = asString(data.message, "").trim();
  if (nestedMessage) return nestedMessage;
  const name = asString(rec.name, "").trim();
  if (name) return name;
  const code = asString(rec.code, "").trim();
  if (code) return code;
  try {
    return JSON.stringify(rec);
  } catch {
    return "";
  }
}

export function parseOpenCodeJsonl(stdout: string) {
  return createOpenCodeJsonlParser()(stdout);
}

/** Consume complete JSONL records once, retaining protocol accounting state. */
export function createOpenCodeJsonlParser() {
  let sessionId: string | null = null;
  const messages: string[] = [];
  const errors: string[] = [];
  const toolErrors: string[] = [];
  let stepLimitRefused = false;
  let lastFinishReason = "";
  const usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  };
  let costUsd: number | null = null;
  let missingCost = false;
  let usageReported = false;
  let missingUsage = false;

  return (stdout: string) => {
    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const event = parseJson(line);
      if (!event) continue;

      const currentSessionId = asString(event.sessionID, "").trim();
      if (currentSessionId) sessionId = currentSessionId;

      const type = asString(event.type, "");

      if (type === "step_start") {
        stepLimitRefused = false;
        lastFinishReason = "";
        continue;
      }

      if (type === "text") {
        const part = parseObject(event.part);
        const text = asString(part.text, "").trim();
        if (text) messages.push(text);
        continue;
      }

      if (type === "step_finish") {
        const part = parseObject(event.part);
        lastFinishReason = asString(part.reason, "");
        const tokens = parseObject(part.tokens);
        const cache = parseObject(tokens.cache);
        const counts = [tokens.input, tokens.output, cache.read === undefined ? 0 : cache.read, cache.write === undefined ? 0 : cache.write, tokens.reasoning === undefined ? 0 : tokens.reasoning];
        if (counts.every(value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) {
          const [input, output, cached, written, reasoning] = counts as number[];
          const next = { inputTokens: usage.inputTokens + input + written,
            outputTokens: usage.outputTokens + output + reasoning, cachedInputTokens: usage.cachedInputTokens + cached };
          if (Object.values(next).every(Number.isSafeInteger)) { Object.assign(usage, next); usageReported = true; }
          else missingUsage = true;
        } else missingUsage = true;
        if (typeof part.cost === "number" && Number.isFinite(part.cost) && part.cost >= 0) costUsd = (costUsd ?? 0) + part.cost;
        else missingCost = true;
        continue;
      }

      if (type === "tool_use") {
        const part = parseObject(event.part);
        const state = parseObject(part.state);
        if (asString(state.status, "") === "error") {
          const text = asString(state.error, "").trim();
          if (text) toolErrors.push(text);
          if (text === "Tools are disabled after the maximum agent steps") stepLimitRefused = true;
        }
        continue;
      }

      if (type === "error") {
        const text = errorText(event.error ?? event.message).trim();
        if (text) errors.push(text);
        continue;
      }
    }

    const stepLimitExceeded = errors.length === 0 && stepLimitRefused && lastFinishReason === "tool-calls";
    return {
      sessionId,
      summary: messages.join("\n\n").trim(),
      usage: { ...usage },
      usageReported,
      usageComplete: usageReported && !missingUsage,
      costUsd: missingCost ? null : costUsd,
      errorMessage: errors.length > 0 ? errors.join("\n") : stepLimitExceeded
        ? STEP_LIMIT_MESSAGE : null,
      errorCode: stepLimitExceeded ? "opencode_step_limit_exceeded" : null,
      toolErrors,
    };
  };
}

export function isOpenCodeUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return /unknown\s+session|session\b.*\bnot\s+found|resource\s+not\s+found:.*[\\/]session[\\/].*\.json|notfounderror|no session/i.test(
    haystack,
  );
}
