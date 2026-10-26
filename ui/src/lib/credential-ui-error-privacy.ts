/**
 * Credentials, imported MCP configuration and OAuth provider errors may echo
 * bearer tokens, redirect states, codes, signed URLs or private payloads.
 * Do not render any raw server/adapter exception message at these surfaces.
 */
const CREDENTIAL_ERROR_COPY = {
  gatewayLoad: "Could not load the gateways. Try refreshing the page.",
  gatewayCreate: "Gateway could not be created. Check the setup and try again.",
  gatewayTokenCreate: "Gateway token could not be issued. Try again or contact the instance operator.",
  gatewayTokenRevoke: "Gateway token could not be revoked. Try again or contact the instance operator.",
  clipboard: "Clipboard access is unavailable. Please copy manually.",
  configImport: "Could not check the imported configuration. Review its format and try again.",
  configConnect: "Could not connect this imported app. Check its credentials and retry.",
  configFinish: "Could not activate this app. Review its permissions and try again.",
  oauthStart: "Bostan couldn’t start secure sign-in. Try again.",
} as const;

export type CredentialErrorAction = keyof typeof CREDENTIAL_ERROR_COPY;
export function safeCredentialUiError(_untrusted: unknown, action: CredentialErrorAction): string {
  return CREDENTIAL_ERROR_COPY[action];
}
