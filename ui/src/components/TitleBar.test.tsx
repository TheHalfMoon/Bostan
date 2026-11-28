// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleBar } from "./TitleBar";
import { OPEN_COMMAND_PALETTE_EVENT } from "../lib/command-palette-events";

const mockInboxBadge = vi.hoisted(() => ({ inbox: 0, failedRuns: 0 }));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));
vi.mock("../hooks/useInboxBadge", () => ({ useInboxBadge: () => mockInboxBadge }));
vi.mock("./CompanySwitcher", () => ({
  CompanySwitcher: ({ variant }: { variant?: string }) => <div data-testid="company-switcher" data-variant={variant} />,
}));
vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Switch to dark mode" />,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("TitleBar", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockInboxBadge.inbox = 0;
    mockInboxBadge.failedRuns = 0;
  });

  afterEach(() => {
    container.remove();
  });

  function render() {
    const root = createRoot(container);
    act(() => {
      root.render(<TitleBar />);
    });
    return root;
  }

  it("shows the brand, company switcher, search and theme toggle", () => {
    const root = render();
    expect(container.querySelector('a[aria-label="Bostan home"]')?.getAttribute("href")).toBe("/command-center");
    expect(container.querySelector('[data-testid="company-switcher"]')?.getAttribute("data-variant")).toBe("titlebar");
    expect(container.textContent).toContain("Search or run a command");
    expect(container.querySelector('button[aria-label="Switch to dark mode"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it("opens the command palette from the search button", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);
    const root = render();
    const search = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Search or run a command"),
    );
    act(() => search?.click());
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);
    act(() => root.unmount());
  });

  it("labels the inbox with the real unread count", () => {
    mockInboxBadge.inbox = 4;
    const root = render();
    expect(container.querySelector('a[href="/inbox"]')?.getAttribute("aria-label")).toBe("Inbox, 4 unread");
    act(() => root.unmount());
  });
});
