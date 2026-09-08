import { createAnthropicProvider } from "./anthropic-provider";
import type { AiProvider, AiStatus } from "./types";

const API_KEY_ENV = "ANTHROPIC_API_KEY";
const MODEL_ENV = "AI_MODEL";

/**
 * Resolves the configured provider, or null when none is.
 *
 * Null is a first-class, expected answer — not an error state to be worked
 * around. Every caller must handle it by recording that no analysis happened,
 * because the alternative (a stub that returns a made-up classification) would
 * put fiction into the student's academic records. There is deliberately no
 * such stub anywhere in this module.
 *
 * Adding a second provider is one more branch here; nothing that calls
 * `getAiProvider()` changes.
 */
export function getAiProvider(): AiProvider | null {
  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) return null;

  const model = process.env[MODEL_ENV];
  return createAnthropicProvider(apiKey, model || undefined);
}

/**
 * Whether analysis is available, for the UI to report plainly. Returns no
 * secret — only whether a key exists and which model it selects.
 */
export function getAiStatus(): AiStatus {
  const provider = getAiProvider();
  return {
    configured: provider !== null,
    providerId: provider?.id ?? null,
    requiredEnvVar: API_KEY_ENV,
  };
}
