import { describe, expect, it } from "vitest";
import { safeCredentialUiError, type CredentialErrorAction } from "./credential-ui-error-privacy";

const actions: CredentialErrorAction[] = [
  "gatewayLoad", "gatewayCreate", "gatewayTokenCreate", "gatewayTokenRevoke", "clipboard",
  "configImport", "configConnect", "configFinish", "oauthStart",
  "connectionCatalog", "connectionCreate", "connectionProbe", "connectionActivate", "connectionHealth",
  "appLoad", "appHealth", "appReconnect", "appCredential",
];
describe("Bostan credential UI error privacy", () => {
  it.each(actions)("%s refuses provider tokens, state, passwords and signed URLs", (action) => {
    const marker = "PRIVATE_BOSTAN_TOKEN_DO_NOT_SHOW";
    for (const payload of [
      new Error("authorization_code=" + marker),
      new Error("https://bad.example/redirect?state=" + marker),
      new Error("Bearer " + marker),
      { message: marker, data: { client_secret: marker } },
      marker,
      null,
    ]) {
      const text = safeCredentialUiError(payload, action);
      expect(text).not.toContain(marker);
      expect(text).not.toContain("https://bad.example");
      expect(text).not.toContain("authorization_code");
      expect(text.length).toBeGreaterThan(15);
    }
  });
});
