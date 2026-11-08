/**
 * Adapter/model/login errors may include OAuth codes, login tokens, signed
 * URLs and provider request payloads. Never echo server exception.message.
 * Only fixed Bostan copy is visible or forwarded to parent feedback cards.
 */
const ADAPTER_ERROR_COPY = {
  upgrade: "Could not upgrade this agent. Retry or contact the instance operator.",
  test: "Environment test failed. Check the adapter connection and retry.",
  models: "Could not load adapter models. Retry or enter the model manually.",
  login: "Could not start sign-in. Retry or check the adapter connection.",
  cancel: "Could not cancel sign-in. Retry or contact the instance operator.",
  session: "Could not check the active sign-in session. Retry.",
  browserCode: "Could not submit the authorization code. Retry.",
} as const;

export type AdapterErrorAction = keyof typeof ADAPTER_ERROR_COPY;
export function safeAdapterRequestError(_error: unknown, action: AdapterErrorAction): string {
  return ADAPTER_ERROR_COPY[action];
}
