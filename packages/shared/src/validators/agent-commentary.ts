import { z } from "zod";

/** Same ceiling as an ordinary issue document; brevity is guidance, not a quota. */
export const AGENT_COMMENTARY_MAX_LENGTH = 524_288;
export const AGENT_COMMENTARY_KINDS = ["complaint", "suggestion"] as const;

export const agentCommentaryToolInputSchema = z.object({
  body: z.string()
    // Keep the limit in UTF-16 code units, matching String.length and the API's
    // established document-size contract across Zod versions.
    .refine((body) => body.length <= AGENT_COMMENTARY_MAX_LENGTH, `Feedback must be at most ${AGENT_COMMENTARY_MAX_LENGTH} characters`)
    .refine((body) => body.trim().length > 0, "Feedback must not be empty"),
  idempotencyKey: z.string().trim().min(1).max(240),
}).strict();

export const submitAgentCommentarySchema = agentCommentaryToolInputSchema.extend({
  kind: z.enum(AGENT_COMMENTARY_KINDS),
}).strict();

export type AgentCommentaryKind = typeof AGENT_COMMENTARY_KINDS[number];
export type SubmitAgentCommentary = z.infer<typeof submitAgentCommentarySchema>;
export type AgentCommentaryAcknowledgement = {
  id: string;
  kind: AgentCommentaryKind;
  createdAt: string;
  replayed: boolean;
};

export const agentCommentaryQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  kind: z.enum(AGENT_COMMENTARY_KINDS).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export type AgentCommentaryQuery = z.infer<typeof agentCommentaryQuerySchema>;
export interface AgentCommentaryEntry {
  id: string;
  kind: AgentCommentaryKind;
  preview: string;
  createdAt: string;
  agent: { id: string; name: string; icon: string | null };
  runId: string;
  task: { id: string; identifier: string | null; title: string } | null;
}
export interface AgentCommentaryDetail extends AgentCommentaryEntry {
  body: string;
}
export interface AgentCommentaryPage {
  items: AgentCommentaryEntry[];
  total: number;
  limit: number;
  offset: number;
}
