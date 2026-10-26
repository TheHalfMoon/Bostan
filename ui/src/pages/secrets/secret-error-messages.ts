/**
 * Provider and transport errors can carry credentials, signed URLs and state.
 * No arbitrary exception or server-provided reason may reach secret UI toasts.
 */
export function safeSecretUiError(_error: unknown): string {
  return "The secret operation could not be completed. Retry or contact the instance operator.";
}

export function safeVaultImportRowReason(
  status: string, reason: string | null | undefined,
): string | null {
  if (!reason) return null;
  if (status === "error") return "Import failed. Check the vault permissions and retry.";
  if (status === "skipped") return "Not imported. Check whether this secret already exists.";
  return null;
}
