// @vitest-environment jsdom

import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySwitcher } from "./CompanySwitcher";

const companyContext = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));

vi.mock("../context/CompanyContext", () => ({ useCompany: () => companyContext.value }));
vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const companies = [
  { id: "company-1", name: "First Company", status: "active" },
  { id: "company-2", name: "Second Company", status: "active" },
  { id: "company-archived", name: "Archived Company", status: "archived" },
];

describe("CompanySwitcher", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    companyContext.value = null;
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  function render(initialSelectedId = "company-1", availableCompanies = companies) {
    function Harness() {
      const [selectedId, setSelectedId] = useState(initialSelectedId);
      const selectedCompany = availableCompanies.find((company) => company.id === selectedId) ?? null;
      companyContext.value = {
        companies: availableCompanies,
        selectedCompany,
        setSelectedCompanyId: setSelectedId,
        companyListUnavailable: false,
        retryCompanies: vi.fn(),
      };
      return <CompanySwitcher />;
    }

    root = createRoot(container);
    act(() => root.render(<Harness />));
  }

  function openMenu() {
    const trigger = container.querySelector("button");
    expect(trigger).not.toBeNull();
    act(() => {
      trigger!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, ctrlKey: false }));
    });
  }

  it("announces the active organization in the menu and updates after switching", () => {
    render();
    openMenu();

    const radio = (name: string) =>
      Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find((item) =>
        item.textContent?.includes(name),
      );
    expect(radio("First Company")?.getAttribute("aria-checked")).toBe("true");
    expect(radio("Second Company")?.getAttribute("aria-checked")).toBe("false");

    act(() => radio("Second Company")?.click());
    openMenu();

    expect(radio("First Company")?.getAttribute("aria-checked")).toBe("false");
    expect(radio("Second Company")?.getAttribute("aria-checked")).toBe("true");
  });

  it("keeps an archived current organization announced without making it selectable", () => {
    render("company-archived", [companies[2]]);
    openMenu();

    const archivedRadio = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')).find(
      (item) => item.textContent?.includes("Archived Company"),
    );
    expect(archivedRadio?.getAttribute("aria-checked")).toBe("true");
    expect(archivedRadio?.getAttribute("aria-disabled")).toBe("true");
    expect(archivedRadio?.getAttribute("aria-label")).toBe("Archived Company, archived");
    expect(document.body.textContent).toContain("No active organizations");
  });
});
