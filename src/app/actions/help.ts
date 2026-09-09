"use server";

import { z } from "zod";
import { requireUserId } from "@/lib/authz";
import { computeRecommendations } from "@/lib/priority-engine";
import { chooseForStatedReality, type StatedEnergy } from "@/lib/decision-engine";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { parseOrThrow } from "@/lib/validation";

/**
 * "I don't know what to do."
 *
 * The single most important thing the product was missing: a stressed student
 * had fifteen destinations and no way to ask for help. This asks at most two
 * questions — how long have you got, and how do you feel — and answers with
 * one action.
 *
 * Neither answer is stored. They describe this minute, not the student, and
 * keeping them would turn a passing "I'm tired" into a lasting fact about
 * someone. When there is a real behaviour record to learn from, that is a
 * different feature with its own consent.
 */
const helpSchema = z.object({
  /** Minutes the student says they have. Null means they did not say. */
  minutes: z.number().int().min(5).max(600).nullable(),
  energy: z.enum(["LOW", "NORMAL", "HIGH"]).nullable(),
});

export async function askWhatToDo(input: { minutes: number | null; energy: StatedEnergy | null }) {
  const userId = await requireUserId();
  const { minutes, energy } = parseOrThrow(helpSchema, input, "request");

  const dict = getDictionary(await getLocale());

  // Deliberately reuses the existing ranking rather than scoring anything
  // new — this decides which of its answers to say, nothing more.
  const ranked = await computeRecommendations(userId, 8, dict);
  const action = chooseForStatedReality(ranked, minutes, energy);

  if (!action) return null;

  return {
    title: action.recommendation.title,
    reason: action.recommendation.reason,
    minutes: action.recommendation.estimatedMinutes,
    href: action.recommendation.href,
    subjectName: action.recommendation.subjectName ?? null,
    basis: action.basis,
    alternatives: action.alternatives,
  };
}

export type HelpAnswer = Awaited<ReturnType<typeof askWhatToDo>>;
