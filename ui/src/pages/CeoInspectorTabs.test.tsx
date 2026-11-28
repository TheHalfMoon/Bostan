// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CeoInspectorTabs, type CeoInspectorTab } from "./CeoInspectorTabs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CeoInspectorTabs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderTabs(initial: CeoInspectorTab = "approvals") {
    function Harness() {
      const [activeTab, setActiveTab] = useState(initial);
      return <CeoInspectorTabs activeTab={activeTab} onTabChange={setActiveTab} pendingApprovals={2} teamSize={3} />;
    }
    act(() => root.render(<Harness />));
  }

  it("keeps one tab stop and wraps arrow navigation while moving focus and selection", () => {
    renderTabs();
    const tabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const approvals = tabs()[0]!;
    const team = tabs()[1]!;
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1]);

    approvals.focus();
    act(() => approvals.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(team);
    expect(team.getAttribute("aria-selected")).toBe("true");
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, 0]);

    act(() => team.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(approvals);
    expect(approvals.getAttribute("aria-selected")).toBe("true");
  });

  it("supports Home and End and keeps tab-to-panel associations", () => {
    renderTabs("team");
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const team = tabs[1]!;
    const approvals = tabs[0]!;

    act(() => team.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(approvals);
    expect(approvals.getAttribute("aria-controls")).toBe("ceo-panel-approvals");

    act(() => approvals.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(team);
    expect(team.getAttribute("aria-selected")).toBe("true");
  });
});
