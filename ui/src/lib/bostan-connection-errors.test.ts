import { describe, expect, it } from "vitest";
import {
  safeBostanOAuthError,
  safeBostanGrokConnectionError,
} from "./bostan-connection-errors";

describe("safe public connection errors", () => {
  it("keeps only the audited local OAuth error strings", () => {
    for (const known of [
      "This sign-in expired. Return to Bostan and start the connection again.",
      "This sign-in expired. Start the connection again.",
      "Bostan couldn't refresh this sign-in. Try again to continue.",
      "Bostan couldn't prepare secure sign-in. Try again.",
    ]) {
      expect(safeBostanOAuthError(known)).toBe(known);
    }
  });
  it.each([
    new Error("https://provider.example/callback?code=secret-code&state=sensitive-state"),
    "https://provider.example/callback?code=secret-code&state=sensitive-state",
    "Authorization: Bearer synthetic-secret",
    "Bostan couldn't refresh this sign-in. Try again to continue. secret",
    { toString: () => "private-webhook-key" },
    null,
  ])("does not echo unapproved auth exception details", cause => {
    expect(safeBostanOAuthError(cause))
      .toBe("Bostan couldn't prepare secure sign-in. Try again.");
  });
  it.each([
    new Error("https://grok.example/hook?key=secret"),
    "HTTP 403: confidential service access",
    { message: "sk-or-sensitive-test" },
    null,
  ])("does not display private Grok provider errors", cause => {
    const message = safeBostanGrokConnectionError(cause);
    expect(message).toContain("Grok Bot connection");
    expect(message).not.toMatch(/secret|hook\?|HTTP 403|sk-or-/);
  });
});
