"use server";

import { z } from "zod";
import { requireUserId } from "@/lib/authz";
import { computeRecommendations } from "@/lib/priority-engine";
import { chooseForStatedReality, type StatedEnergy } from "@/lib/decision-engine";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { parseOrThrow } from "@/lib/validation";
import { recordEvent } from "@/lib/student-events";

/**
 * "I don't know what to do."
 *
 * The single most important thing the product was missing: a stressed student
 * had fifteen destinations and no way to ask for help. This asks at most two
 * questions — how long have you got, and how do you feel — and answers with
 * one action.
 *
 * The answers describe this minute, not the student. They are now recorded as
 * timestamped events — "low energy was chosen at 21:40 on Tuesday" — because
 * an answer paired with what actually happened next is how the system learns
 * that light review tends to work at times like that. What is still refused
 * is the thing this comment originally guarded against: nowhere does a
 * passing "I'm tired" become a lasting property of the person. There is no
 * energy field on User, and every reading is recomputed from recent events,
 * so it decays as behaviour changes.
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

  const now = new Date();
  await recordEvent(userId, {
    type: "HELP_USED",
    occurredAt: now,
    context: {
      hour: now.getHours(),
      ...(minutes !== null ? { statedMinutes: minutes } : {}),
    },
  });
  if (energy) {
    await recordEvent(userId, {
      type: "ENERGY_SELECTED",
      occurredAt: now,
      context: { energy, hour: now.getHours() },
    });
  }

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
