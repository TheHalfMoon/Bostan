// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/command-palette-events";
import { TitleBar } from "./TitleBar";

vi.mock("./SidebarCompanyMenu", () => ({
  SidebarCompanyMenu: ({ placement }: { placement?: string }) => <button type="button">Org menu ({placement})</button>,
}));
vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Switch to dark mode" />,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("TitleBar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the mark, organization switcher, search field and theme toggle", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TitleBar />));

    const header = container.querySelector('[data-testid="app-title-bar"]');
    expect(header?.textContent).toContain("Bostan");
    expect(header?.querySelector('svg path[fill="var(--bostan-slate)"]')).not.toBeNull();
    expect(header?.textContent).toContain("Org menu (titlebar)");
    expect(header?.textContent).toContain("Search or run a command");
    expect(header?.querySelector("kbd")?.textContent).toMatch(/^(Ctrl K|⌘ K)$/);
    expect(header?.querySelector('button[aria-label="Switch to dark mode"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it("opens the command palette from the search field", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TitleBar />));
    const listener = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);

    const search = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Search or run a command"));
    act(() => search?.click());
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, listener);
    act(() => root.unmount());
  });
});
