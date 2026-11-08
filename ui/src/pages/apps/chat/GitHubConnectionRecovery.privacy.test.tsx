// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatEndpoint } from "@/api/chatEndpoints";
import { GitHubAppRecovery, GitHubConnectionRecoveryNotice } from "./GitHubConnectionRecovery";

vi.mock("@/lib/router", () => ({
  Link: ({to, children}: {to:string; children:ReactNode}) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/SetupWizard", () => ({
  SetupWizardFooter: ({children}: {children:ReactNode}) => <div>{children}</div>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({children}: {children:ReactNode}) => <span>{children}</span>,
  TooltipTrigger: ({children}: {children:ReactNode}) => <span>{children}</span>,
  TooltipContent: ({children}: {children:ReactNode}) => <span>{children}</span>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const endpoint = (overrides: Partial<ChatEndpoint> = {}) => ({
  id: "synthetic-github-endpoint",
  provider: "github", status: "attention", botLabel: "QA App",
  botExternalId: "12345",
  ...overrides,
}) as ChatEndpoint;
let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe("Bostan GitHub recovery never echoes private keys or provider errors", () => {
  it.each(["attention", "revoked"] as const)(
    "hides untrusted GitHub webhook token in %s notice and uses Bostan branding",
    (status) => {
      const marker = "PRIVATE_GITHUB_WEBHOOK_SECRET_DO_NOT_RENDER";
      const html = renderToStaticMarkup(<GitHubConnectionRecoveryNotice endpoint={endpoint({
        status,
        lastError: "Bearer " + marker,
        healthMessage: "https://bad.invalid/oauth?token=" + marker,
      })} />);
      expect(html).toContain("GitHub connection needs attention.");
      expect(html).toContain("saved in Bostan");
      expect(html).not.toContain(marker);
      expect(html).not.toContain("bad.invalid");
      expect(html).not.toContain("saved in Paperclip");
    },
  );

  it("renders a safe static error after rejected reconnect with a private signing key in its exception", async () => {
    const marker = "PRIVATE_GITHUB_APP_SIGNING_KEY_DO_NOT_RENDER";
    const onConnect = vi.fn().mockRejectedValue(new Error(
      "key -----BEGIN PRIVATE KEY-----" + marker,
    ));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<GitHubAppRecovery
      endpoint={endpoint()} reconnect onConnect={onConnect} onExit={() => {}}
    />));
    expect(container.textContent).toContain("Bostan will check the App");
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Reconnect saved App"]');
    expect(button?.disabled).toBe(false);
    await act(async () => { button!.click(); await Promise.resolve(); });
    expect(onConnect).toHaveBeenCalledWith(undefined);
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("Could not verify this GitHub App.");
    expect(container.textContent).not.toContain(marker);
    expect(container.textContent).not.toContain("BEGIN PRIVATE KEY");
  });
});
