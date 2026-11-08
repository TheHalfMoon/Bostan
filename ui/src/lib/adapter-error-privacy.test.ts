import { describe, expect, it } from "vitest";
import { safeAdapterRequestError, type AdapterErrorAction } from "./adapter-error-privacy";

describe("adapter configuration exception privacy", () => {
  it("does not reflect raw OAuth tokens, codes or connection URLs for any action", () => {
    const secret = "https://auth.invalid/authorize?code=sk-private-token&state=private";
    const actions: AdapterErrorAction[] = [
      "upgrade", "test", "models", "login", "cancel", "session", "browserCode",
    ];
    for (const action of actions) {
      for (const error of [new Error(secret), { message: secret }, secret, null]) {
        const message = safeAdapterRequestError(error, action);
        expect(message).not.toContain(secret);
        expect(message).not.toContain("sk-private");
        expect(message).toMatch(/Retry|retry/);
      }
    }
  });
});
