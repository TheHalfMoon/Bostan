/**
 * The project's own outbound client identity, not the identity of any
 * third-party package or compatibility protocol.
 *
 * Bostan must not advertise an unrelated upstream product via HTTP headers.
 * Callers' explicitly configured User-Agent header always takes priority.
 */
export const BOSTAN_USER_AGENT = "Bostan/1.0";
export const BOSTAN_CHAT_ATTACHMENTS_USER_AGENT = "Bostan/ChatAttachments";
export const BOSTAN_GITHUB_COMMIT_USER_AGENT = "Bostan/CommitResolver";
export const BOSTAN_GITHUB_OBJECT_USER_AGENT = "Bostan/ExternalObjectResolver";
