// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BostanCloudOAuthHandoffPage, ManagedOAuthHandoffState } from "./BostanCloudOAuthHandoff";
import { prepareOAuthNavigation } from "@/lib/oauthHandoff";

vi.mock("@/lib/oauthHandoff", () => ({
  readPendingCloudHandoff: vi.fn(() => ({
    authorizationUrl: "https://idp.example/start",
    target: "test",
  })),
  prepareOAuthNavigation: vi.fn(),
  clearPendingCloudHandoff: vi.fn(),
}));
vi.mock("@/lib/browserNavigation", () => ({ navigateTopLevel: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.mocked(prepareOAuthNavigation).mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("does not show a caller-controlled OAuth URL or authorization code", async () => {
  await act(async () => {
    root.render(<ManagedOAuthHandoffState
      phase="error"
      error="https://idp.example/callback?code=secret-oauth-code&state=secret-state"
      onRetry={() => {}} onCancel={() => {}} />);
  });
  expect(host.textContent).toContain("Bostan couldn't prepare secure sign-in");
  expect(host.textContent).not.toMatch(/secret-oauth-code|secret-state|idp\.example/);
  expect(host.textContent).toContain("Return to Bostan");
});

it("sanitizes real callback failures rather than reflecting provider exception messages", async () => {
  vi.mocked(prepareOAuthNavigation).mockRejectedValueOnce(
    new Error("OAuth error: access_token=secret-token, state=secret-csrf"),
  );
  await act(async () => {
    root.render(<BostanCloudOAuthHandoffPage />);
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  expect(host.textContent).toContain("Sign-in couldn’t continue");
  expect(host.textContent).toContain("Bostan couldn't prepare secure sign-in");
  expect(host.textContent).not.toMatch(/secret-token|secret-csrf|access_token/);
});
