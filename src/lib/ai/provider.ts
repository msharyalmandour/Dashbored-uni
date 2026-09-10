import type { AiStatus } from "./types";

const API_KEY_ENV = "ANTHROPIC_API_KEY";
const MODEL_ENV = "AI_MODEL";

/**
 * The default model, repeated here rather than imported from the agent so that
 * asking "is this configured, and as what" costs nothing and pulls in nothing.
 * This module is read during page render; the agent is a server-only module
 * that opens network connections.
 */
const DEFAULT_MODEL = "claude-opus-5";

/**
 * Whether the agent can run at all, for the interface to say plainly.
 *
 * Returns no secret — only whether a key exists and which model it selects.
 * A missing key is a first-class, expected answer rather than an error to work
 * around: every caller handles it by saying so, because the alternative (a
 * stub that returns a plausible classification) would put fiction into a
 * student's academic records. There is deliberately no such stub anywhere.
 */
export function getAiStatus(): AiStatus {
  const configured = !!process.env[API_KEY_ENV];
  const model = process.env[MODEL_ENV]?.trim() || DEFAULT_MODEL;

  return {
    configured,
    providerId: configured ? `anthropic:${model}` : null,
    requiredEnvVar: API_KEY_ENV,
  };
}
