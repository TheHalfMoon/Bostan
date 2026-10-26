/**
 * The OAuth callback and bot pairing UI must not render untrusted upstream
 * exception messages: they can contain signed URLs, auth codes, state,
 * webhook secrets, or provider-generated diagnostic content.
 */
const oauthApprovedErrors = new Set([
  "This sign-in expired. Return to Bostan and start the connection again.",
  "This sign-in expired. Start the connection again.",
  "Bostan couldn't refresh this sign-in. Try again to continue.",
  "Bostan couldn't prepare secure sign-in. Try again.",
]);

export function safeBostanOAuthError(value: unknown): string {
  return typeof value === "string" && oauthApprovedErrors.has(value)
    ? value
    : "Bostan couldn't prepare secure sign-in. Try again.";
}

/** Never echo provider/HTTP exception details on a credential setup surface. */
export function safeBostanGrokConnectionError(_value: unknown): string {
  return "Bostan couldn't complete the Grok Bot connection operation. Check the connection and try again.";
}

// Provider API failures can carry authorization state, signed URLs or user
// credentials. Only a server-validated error *code* may select a known message.
export function safeBostanConnectionOAuthStartError(_cause: unknown, code?: unknown): string {
  return code === "invalid_grant"
    ? "Your authorization expired or was revoked. Reconnect to continue."
    : "Bostan couldn't start secure sign-in. Try again.";
}

export function safeBostanConnectorEnrollmentError(_cause: unknown): string {
  return "Bostan couldn't complete connector enrollment. Check the connection and try again.";
}
