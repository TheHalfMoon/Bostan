// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConnection } from "@paperclipai/shared";
import { AddConnectionDialog, CatalogDialog } from "./connection-dialogs";

const api = vi.hoisted(() => ({
  listCatalog: vi.fn(), listApplications: vi.fn(), listStdioTemplates: vi.fn(),
  createConnection: vi.fn(), checkConnectionHealth: vi.fn(), refreshCatalog: vi.fn(),
  updateConnection: vi.fn(),
}));
const listSecrets = vi.hoisted(() => vi.fn());
const pushToast = vi.hoisted(() => vi.fn());

vi.mock("@/api/tools", () => ({ toolsApi: api }));
vi.mock("@/api/secrets", () => ({ secretsApi: { list: listSecrets } }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ pushToast }) }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: {children: ReactNode}) => <div>{children}</div>,
  DialogContent: ({ children }: {children: ReactNode}) => <div>{children}</div>,
  DialogTitle: ({ children }: {children: ReactNode}) => <h3>{children}</h3>,
  DialogHeader: ({ children }: {children: ReactNode}) => <div>{children}</div>,
  DialogFooter: ({ children }: {children: ReactNode}) => <div>{children}</div>,
  DialogDescription: ({ children }: {children: ReactNode}) => <p>{children}</p>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void>;
  flushSync(() => { result = callback(); });
  await result!;
}
async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => { await Promise.resolve(); await new Promise(r => setTimeout(r, 0)); });
  }
}
function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function makeConnection() {
  return {
    id: "connection-1", name: "Bostan test", healthStatus: "error",
    healthMessage: "https://provider.invalid/?token=PRIVATE_HEALTH_MESSAGE",
    lastError: "Bearer PRIVATE_LAST_ERROR",
  } as unknown as ToolConnection;
}
describe("MCP connection diagnostics never echo provider credential payloads", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    listSecrets.mockResolvedValue([]);
    api.listApplications.mockResolvedValue({ applications: [] });
    api.listStdioTemplates.mockResolvedValue({ templates: [] });
  });
  afterEach(() => {
    if (root) flushSync(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });
  async function render(node: ReactNode) {
    root = createRoot(container);
    const client = new QueryClient({ defaultOptions: {
      queries: { retry: false }, mutations: { retry: false },
    } });
    await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
    await settle();
  }
  it("does not expose failed catalog authentication details", async () => {
    api.listCatalog.mockRejectedValue(new Error("Bearer PRIVATE_CATALOG_TOKEN"));
    await render(<CatalogDialog connection={makeConnection()} onClose={() => {}} />);
    expect(container.textContent).toContain("Could not load the tool catalog.");
    expect(container.textContent).not.toContain("PRIVATE_CATALOG_TOKEN");
  });
  it("sanitizes provider healthMessage and lastError after a successful health probe", async () => {
    const conn = makeConnection();
    api.createConnection.mockResolvedValue(conn);
    api.checkConnectionHealth.mockResolvedValue({ connection: conn });
    api.refreshCatalog.mockResolvedValue({ connection: conn, discoveredCount: 1, quarantinedCount: 0 });
    await render(<AddConnectionDialog companyId="company-1" defaultApplicationId="app-1" onClose={() => {}} />);
    const name = container.querySelector("#conn-name") as HTMLInputElement;
    const url = container.querySelector("#conn-url") as HTMLInputElement;
    expect(name).toBeTruthy();
    expect(url).toBeTruthy();
    await act(async () => { setInput(name, "Synthetic"); setInput(url, "http://127.0.0.1:6000/mcp"); });
    await settle();
    const submit = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "Create & probe",
    ) as HTMLButtonElement;
    expect(submit?.disabled).toBe(false);
    await act(async () => submit.click());
    await settle();
    expect(api.createConnection).toHaveBeenCalled();
    expect(api.checkConnectionHealth).toHaveBeenCalledWith("connection-1");
    expect(container.textContent).toContain("The connection reported a problem.");
    expect(container.textContent).not.toContain("PRIVATE_HEALTH_MESSAGE");
    expect(container.textContent).not.toContain("PRIVATE_LAST_ERROR");
    expect(container.textContent).not.toContain("provider.invalid");
  });
  it("does not echo rejected connection creation failures into toasts", async () => {
    api.createConnection.mockRejectedValue(new Error("Bearer PRIVATE_CREATE_CONNECTION"));
    await render(<AddConnectionDialog companyId="company-1" defaultApplicationId="app-1" onClose={() => {}} />);
    await act(async () => {
      setInput(container.querySelector("#conn-name")!, "Synthetic");
      setInput(container.querySelector("#conn-url")!, "http://127.0.0.1:6000/mcp");
    });
    await settle();
    const submit = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent?.trim() === "Create & probe",
    )!;
    await act(async () => (submit as HTMLButtonElement).click());
    await settle();
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Could not create connection",
      body: "Could not create this connection. Check the endpoint and credential references.",
      tone: "error",
    }));
    expect(JSON.stringify(pushToast.mock.calls)).not.toContain("PRIVATE_CREATE_CONNECTION");
  });
});
