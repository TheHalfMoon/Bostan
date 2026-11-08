import { models as anthropic } from "@bostan/adapter-claude-local";
import { models as openai } from "@bostan/adapter-codex-local";
import { models as google } from "@bostan/adapter-gemini-local";
import { models as xai } from "@bostan/adapter-grok-local";
import type { AiConnectionMetadata } from "@bostan/shared";

/** Catalogs follow the saved API connection, never the host CLI's credentials or environment. */
export function fastResponseCatalogModels(connection: Pick<AiConnectionMetadata, "provider" | "routing">) {
  if (connection.routing) return connection.routing.models ?? [];
  return { anthropic, openai, google, xai, openrouter: [], github: [] }[connection.provider];
}
