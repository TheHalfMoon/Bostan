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
  connectionCatalog: "Could not load the tool catalog. Try again.",
  connectionCreate: "Could not create this connection. Check the endpoint and credential references.",
  connectionProbe: "Connection probe failed. Check the endpoint and credential configuration.",
  connectionActivate: "Could not activate this connection. Review its settings and retry.",
  connectionHealth: "The connection reported a problem. Check its settings before activation.",
  appLoad: "Could not load this app connection. Refresh and try again.",
  appHealth: "This app connection needs attention. Check its credentials or reconnect.",
  appReconnect: "Could not reconnect this app. Check its credentials and try again.",
  appCredential: "Credential check failed. Review the key and retry.",
  githubHealth: "GitHub connection needs attention. Reconnect to verify access.",
  githubCredential: "Could not verify this GitHub App. Review its saved credentials and retry.",
  chatHealth: "Provider connection status is available. Check connection settings if needed.",
  chatError: "Chat provider reported an error. Check its connection settings and retry.",
  emailHealth: "Email inbox needs attention. Check its credentials or reconnect.",
  emailAction: "Could not update the email inbox. Check its credentials and try again.",
  emailLoad: "Could not load the email inboxes. Retry loading them.",

  oauthStart: "Bostan couldn’t start secure sign-in. Try again.",
} as const;

export type CredentialErrorAction = keyof typeof CREDENTIAL_ERROR_COPY;
export function safeCredentialUiError(_untrusted: unknown, action: CredentialErrorAction): string {
  return CREDENTIAL_ERROR_COPY[action];
}
