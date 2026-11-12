import { describe, expect, it } from "vitest";
import { describeToolInput, summarizeToolInput, shouldHideNiceModeStderr } from "./transcriptPresentation";

describe("resume diagnostic identity compatibility", () => {
  it.each(["bostan", "paperclip"])("hides only the benign %s resume notice", (brand) => {
    expect(shouldHideNiceModeStderr(`  [${brand}] Skipping saved session resume for task X`)).toBe(true);
    expect(shouldHideNiceModeStderr(`[${brand}] Real provider failure`)).toBe(false);
    expect(shouldHideNiceModeStderr(`[${brand}-other] Skipping saved session resume`)).toBe(false);
  });
});

describe("summarizeToolInput", () => {
  it("prefers human descriptions over raw commands when both exist", () => {
    expect(
      summarizeToolInput("command_execution", {
        description: "Inspect the issue chat thread layout classes",
        command: "zsh -lc 'sed -n \"1,220p\" ui/src/components/IssueChatThread.tsx'",
      }),
    ).toBe("Inspect the issue chat thread layout classes");
  });
});

describe("describeToolInput", () => {
  it("keeps command tools description-first in the detail view", () => {
    expect(
      describeToolInput("command_execution", {
        description: "Inspect the issue chat thread layout classes",
        command: "zsh -lc 'sed -n \"1,220p\" ui/src/components/IssueChatThread.tsx'",
        cwd: "/workspace/paperclip",
      }),
    ).toEqual([
      { label: "Intent", value: "Inspect the issue chat thread layout classes", tone: "default" },
      { label: "Directory", value: "/workspace/paperclip", tone: "default" },
    ]);
  });

  it("surfaces concise structured details for file tools", () => {
    expect(
      describeToolInput("read_file", {
        path: "ui/src/lib/issue-chat-messages.ts",
      }),
    ).toEqual([
      { label: "Path", value: "ui/src/lib/issue-chat-messages.ts", tone: "default" },
    ]);
  });
});
