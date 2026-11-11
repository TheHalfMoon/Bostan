import { describe, expect, it } from "vitest";
import { createOpenCodeJsonlParser, createOpenCodeTurnObserver, parseOpenCodeJsonl, isOpenCodeUnknownSessionError } from "./parse.js";

describe("parseOpenCodeJsonl", () => {
  it("parses assistant text, usage, cost, and errors", () => {
    const stdout = [
      JSON.stringify({
        type: "text",
        sessionID: "session_123",
        part: { text: "Hello from OpenCode" },
      }),
      JSON.stringify({
        type: "step_finish",
        sessionID: "session_123",
        part: {
          reason: "done",
          cost: 0.0025,
          tokens: {
            input: 120,
            output: 40,
            reasoning: 10,
            cache: { read: 20, write: 0 },
          },
        },
      }),
      JSON.stringify({
        type: "error",
        sessionID: "session_123",
        error: { message: "model unavailable" },
      }),
    ].join("\n");

    const parsed = parseOpenCodeJsonl(stdout);
    expect(parsed.sessionId).toBe("session_123");
    expect(parsed.summary).toBe("Hello from OpenCode");
    expect(parsed.usage).toEqual({
      inputTokens: 120,
      cachedInputTokens: 20,
      outputTokens: 50,
    });
    expect(parsed.costUsd).toBeCloseTo(0.0025, 6);
    expect(parsed.errorMessage).toContain("model unavailable");
    expect(parsed.toolErrors).toEqual([]);
  });

  it("keeps failed tool calls separate from fatal run errors", () => {
    const stdout = [
      JSON.stringify({
        type: "tool_use",
        sessionID: "session_123",
        part: {
          state: {
            status: "error",
            error: "File not found: e2b-adapter-result.txt",
          },
        },
      }),
      JSON.stringify({
        type: "text",
        sessionID: "session_123",
        part: { text: "Recovered and completed the task" },
      }),
    ].join("\n");

    const parsed = parseOpenCodeJsonl(stdout);
    expect(parsed.sessionId).toBe("session_123");
    expect(parsed.summary).toBe("Recovered and completed the task");
    expect(parsed.errorMessage).toBeNull();
    expect(parsed.toolErrors).toEqual(["File not found: e2b-adapter-result.txt"]);
  });

  it("reports a terminal maximum-step refusal even when the CLI exits cleanly", () => {
    const stdout = [
      { type: "text", part: { text: "I will use a tool next." } },
      { type: "tool_use", part: { state: { status: "error", error: "Tools are disabled after the maximum agent steps" } } },
      { type: "step_finish", part: { reason: "tool-calls", cost: 0, tokens: { input: 12, output: 8 } } },
    ].map(row => JSON.stringify(row)).join("\n");
    expect(parseOpenCodeJsonl(stdout)).toMatchObject({
      errorCode: "opencode_step_limit_exceeded",
      errorMessage: "OpenCode reached the configured maximum agent steps before completing its turn.",
      usage: { inputTokens: 12, outputTokens: 8, cachedInputTokens: 0 },
    });
  });

  it("keeps a later completed turn successful after a step-limit tool refusal", () => {
    const consume = createOpenCodeJsonlParser();
    consume(JSON.stringify({ type: "tool_use", part: { state: { status: "error", error: "Tools are disabled after the maximum agent steps" } } }));
    consume(JSON.stringify({ type: "step_finish", part: { reason: "tool-calls" } }));
    expect(consume([
      { type: "step_start" },
      { type: "text", part: { text: "Completed without tools." } },
      { type: "step_finish", part: { reason: "stop" } },
    ].map(row => JSON.stringify(row)).join("\n"))).toMatchObject({ errorCode: null, errorMessage: null });
  });

  it("detects unknown session errors", () => {
    expect(isOpenCodeUnknownSessionError("Session not found: s_123", "")).toBe(true);
    expect(isOpenCodeUnknownSessionError("", "unknown session id")).toBe(true);
    expect(isOpenCodeUnknownSessionError("all good", "")).toBe(false);
  });
});

describe("OpenCode price availability", () => {
  it("distinguishes missing cost from reported zero and counts cache writes", () => {
    const event = { type: "step_finish", part: { tokens: { input: 10, output: 3, cache: { read: 100, write: 20 } } } };
    expect(parseOpenCodeJsonl(JSON.stringify(event))).toMatchObject({ costUsd: null, usage: { inputTokens: 30, cachedInputTokens: 100, outputTokens: 3 } });
    expect(parseOpenCodeJsonl(JSON.stringify({ ...event, part: { ...event.part, cost: 0 } })).costUsd).toBe(0);
    expect(parseOpenCodeJsonl([event, { ...event, part: { ...event.part, cost: 1 } }].map((row) => JSON.stringify(row)).join("\n")).costUsd).toBeNull();
  });
});

describe("OpenCode uncapped turn observation", () => {
  it("observes a split terminal refusal after a large content record without retaining its text", () => {
    const observer = createOpenCodeTurnObserver();
    const rows = [
      { type: "text", part: { text: "synthetic-content-".repeat(100000) } },
      { type: "tool_use", part: { state: { status: "error", error: "Tools are disabled after the maximum agent steps" } } },
      { type: "step_finish", part: { reason: "tool-calls" } },
    ].map(row => JSON.stringify(row)).join("\n");
    const split = rows.indexOf("maximum") + 3;
    observer.write(rows.slice(0, split)); observer.write(rows.slice(split));
    expect(observer.finish()).toEqual({ observed: true, stepLimitExceeded: true });
  });

  it("does not preserve an earlier refusal after a subsequent completed turn", () => {
    const observer = createOpenCodeTurnObserver();
    observer.write([
      { type: "tool_use", part: { state: { status: "error", error: "Tools are disabled after the maximum agent steps" } } },
      { type: "step_finish", part: { reason: "tool-calls" } },
      { type: "step_start" },
      { type: "step_finish", part: { reason: "stop" } },
    ].map(row => JSON.stringify(row)).join("\n"));
    expect(observer.finish()).toEqual({ observed: true, stepLimitExceeded: false });
  });

  it("fails closed when a structural record exceeds its observation bound", () => {
    const observer = createOpenCodeTurnObserver();
    observer.write(" ".repeat(1024 * 1024 + 1));
    expect(() => observer.finish()).toThrow("OpenCode completion observation failed; turn outcome is unverified");
  });
});

describe("OpenCode reported usage completeness", () => {
  it.each([undefined, {}, { input: 1 }, { input: -1, output: 2 }, { input: 1, output: 0.5 }, { input: 1, output: 2, cache: { read: -1 } }, { input: 1, output: 2, cache: { read: null } }, { input: 1, output: 2, reasoning: null }])("preserves unknown usage for incomplete counters %j", tokens => {
    expect(parseOpenCodeJsonl(JSON.stringify({ type: "step_finish", part: { tokens } }))).toMatchObject({ usageReported: false, usageComplete: false, costUsd: null });
  });
  it("accepts explicit zeros but keeps a later missing step incomplete", () => {
    const line = JSON.stringify({ type: "step_finish", part: { tokens: { input: 0, output: 0 } } });
    expect(parseOpenCodeJsonl(line)).toMatchObject({ usageReported: true, usageComplete: true, usage: { inputTokens: 0, outputTokens: 0 }, costUsd: null });
    expect(parseOpenCodeJsonl(line + '\n' + JSON.stringify({ type: "step_finish" }))).toMatchObject({ usageReported: true, usageComplete: false });
  });
});
