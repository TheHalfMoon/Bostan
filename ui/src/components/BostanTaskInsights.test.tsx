// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { BostanTaskInsights, describeTaskCycle } from "./BostanTaskInsights";

vi.mock("../api/client", () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement, queryClient: QueryClient;

const response = (days: 7 | 30 | 90) => ({
  schema: "bostan.task-insights.v1", days, grain: "visible_operational_tasks",
  asOf: "2026-10-25T12:00:00Z", windowStart: "2026-09-25T12:00:00Z",
  current: { visible: 7, open: 3, blocked: 1 },
  flow: { created: 4, completed: 2, measuredCycles: 2, medianCycleHours: 3 },
});

beforeEach(async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(host);
  get.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  host.remove();
});

async function render() {
  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}>
      <BostanTaskInsights companyId="scoped-company" />
    </QueryClientProvider>);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
}

it("renders genuine flow counts without pretending created/completed are a completion rate", async () => {
  get.mockResolvedValue(response(30) as never);
  await render();
  expect(get).toHaveBeenCalledWith(
    "/companies/scoped-company/bostan-analytics/task-insights?days=30",
  );
  expect(host.textContent).toContain("Tasks created in period");
  expect(host.textContent).toContain("Tasks completed in period");
  expect(host.textContent).toContain("3 hours");
  expect(host.textContent).toContain("2 measured tasks");
  expect(host.textContent).toContain("not a completion rate");
});

it("uses exactly selected 7 days and rejects stale or wrong-period data", async () => {
  get.mockImplementation(async (url) => {
    if (String(url).endsWith("days=7")) return response(30) as never;
    return response(30) as never;
  });
  await render();
  const seven = [...host.querySelectorAll("button")].find(
    button => button.textContent?.includes("7 days"),
  );
  expect(seven).toBeDefined();
  await act(async () => { seven!.click(); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
  expect(get).toHaveBeenCalledWith(
    "/companies/scoped-company/bostan-analytics/task-insights?days=7",
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("did not match");
  expect(host.textContent).not.toContain("3 hours");
});

it("does not expose raw private server errors", async () => {
  get.mockRejectedValue(new Error("HTTP 403: private-task-identifier confidential"));
  await render();
  const warning = host.querySelector('[role="alert"]');
  expect(warning?.textContent).toContain("unavailable");
  expect(host.textContent).not.toContain("private-task-identifier");
});

it("uses an honest empty-sample median label", () => {
  expect(describeTaskCycle(null, 0)).toBe("Not enough completed tasks");
  expect(describeTaskCycle(0, 2)).toBe("0 hours");
  expect(describeTaskCycle(-12, 2)).toBe("Unavailable");
});
