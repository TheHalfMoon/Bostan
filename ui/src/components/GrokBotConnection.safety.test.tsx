// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { grokBotApi } from "@/api/grokBot";
import { GrokBotConnection } from "./GrokBotConnection";

vi.mock("@/api/grokBot", () => ({
  grokBotApi: { connection: vi.fn() },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: {
    queries: { retry: false },
  } });
  vi.mocked(grokBotApi.connection).mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});

it("renders a safe error when Grok connection API rejects with a webhook credential", async () => {
  vi.mocked(grokBotApi.connection).mockRejectedValueOnce(
    new Error("Grok hook https://grok.example/connect?key=private-webhook-secret"),
  );
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <GrokBotConnection companyId="company-test" agentId="agent-test" />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await vi.waitFor(() => {
      expect(host.querySelector('[role="alert"]')?.textContent)
        .toContain("couldn't complete the Grok Bot connection operation");
    }, { timeout: 3000 });
  });
  expect(grokBotApi.connection).toHaveBeenCalled();
  const message = host.querySelector('[role="alert"]')?.textContent;
  expect(message).toContain("couldn't complete the Grok Bot connection operation");
  expect(message).not.toMatch(/private-webhook-secret|grok\.example|key=/);
});
