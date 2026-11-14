// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const mockToggleTheme = vi.hoisted(() => vi.fn());
const mockTheme = vi.hoisted(() => ({ value: "dark" as "dark" | "light" }));
const mockSetPreference = vi.hoisted(() => vi.fn());

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: mockTheme.value,
    preference: "system",
    setPreference: mockSetPreference,
    toggleTheme: mockToggleTheme,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ThemeToggle", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockTheme.value = "dark";
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders an icon button by default with the 'switch to light' label when current theme is dark", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggle />);
    });
    await flushReact();

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("aria-label")).toBe("Switch to light mode");
    expect(button?.getAttribute("title")).toBe("Switch to light mode");

    await act(async () => {
      button?.click();
    });
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("renders a menu-action row when variant='menu-action' and includes the description text", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggle variant="menu-action" />);
    });
    await flushReact();

    expect(container.textContent).toContain("Switch to light mode");
    expect(container.textContent).toContain("Toggle the app appearance.");

    await act(async () => root.unmount());
  });

  it("renders the compact profile-menu row without secondary copy", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggle variant="compact-menu-action" />);
    });
    await flushReact();

    const button = container.querySelector("button");
    expect(button?.classList).toContain("h-(--profile-popover-row-height)");
    expect(button?.classList).toContain("gap-(--profile-popover-row-gap)");
    expect(button?.querySelector("span")?.classList).toContain("size-5");
    expect(container.textContent).toContain("Switch to light mode");
    expect(container.textContent).not.toContain("Toggle the app appearance.");

    await act(async () => root.unmount());
  });

  it("calls onAfterToggle after toggling (used by SidebarAccountMenu to close the popover)", async () => {
    const onAfterToggle = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggle variant="menu-action" onAfterToggle={onAfterToggle} />);
    });
    await flushReact();

    const button = container.querySelector("button");
    await act(async () => {
      button?.click();
    });

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    expect(onAfterToggle).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("flips label and icon when current theme is light", async () => {
    mockTheme.value = "light";
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggle />);
    });
    await flushReact();

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Switch to dark mode");

    await act(async () => root.unmount());
  });

  it("renders a Light / Dark / System radio group for the preference variant", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ThemeToggle variant="preference" />);
    });
    await flushReact();
    const radios = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual(["Light", "Dark", "System"]);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
    const group = container.querySelector('[role="radiogroup"]');
    const labelId = group?.getAttribute("aria-labelledby");
    expect(labelId && document.getElementById(labelId)?.textContent).toBe("Appearance");

    await act(async () => {
      radios[1]?.click();
    });
    expect(mockSetPreference).toHaveBeenCalledWith("dark");
    act(() => root.unmount());
  });
});
