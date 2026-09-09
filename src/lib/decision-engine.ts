import { prisma } from "@/lib/prisma";
import { computeRecommendations, type Recommendation } from "@/lib/priority-engine";
import {
  remainingCapacityToday,
  summariseWorkload,
  detectCollision,
  type CommitmentRow,
  type Collision,
  type DayCapacity,
} from "@/lib/time-intelligence";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The Decision Engine.
 *
 * The priority engine already answers "what matters most?" — a ranked list
 * where every entry explains itself. That list is genuinely useful and stays.
 * What it cannot do is answer the question a stuck student actually asks,
 * which is not "what are my twelve priorities" but "what do I do right now".
 *
 * Two things turn the first answer into the second:
 *
 *   1. Reduction. One action, not twelve. A ranked list of everything that
 *      matters is still the student's decision to make; making that decision
 *      is the work this is supposed to remove.
 *
 *   2. Time. The top-ranked action is the wrong answer at 22:40 if it needs
 *      ninety minutes. Fitting the recommendation to the time that is
 *      genuinely left is what stops the advice being theoretical.
 *
 * Nothing new is scored here. The signals are the same real ones the priority
 * engine already computes; this decides which of them to actually say.
 */

/** Why this particular action was chosen — shown, never hidden as magic. */
export type ChoiceBasis =
  /** The highest-priority thing, and it fits the time left. */
  | "TOP_PRIORITY_FITS"
  /** Something smaller was chosen because the top item does not fit today. */
  | "SCALED_TO_TIME"
  /** Time is not known yet, so this is priority order alone. */
  | "TIME_UNKNOWN"
  /** Nothing is left in the day; this is offered for tomorrow. */
  | "DAY_IS_FULL";

export interface NextBestAction {
  recommendation: Recommendation;
  basis: ChoiceBasis;
  /** How many other candidates were considered, for an honest "or something else". */
  alternatives: number;
}

export interface DecisionContext {
  action: NextBestAction | null;
  /** Everything ranked, for the student who wants to see past the one answer. */
  ranked: Recommendation[];
  capacity: DayCapacity;
  collision: Collision;
  /** True when the student has recorded no commitments, so time is unknowable. */
  needsTimeSetup: boolean;
}

/**
 * Rows the time engine needs. Narrow select — this sits on the dashboard's
 * critical path, and the engine only ever reads these five fields.
 */
async function loadCommitments(userId: string): Promise<CommitmentRow[]> {
  return prisma.timeCommitment.findMany({
    where: { userId },
    select: {
      id: true,
      kind: true,
      label: true,
      weekday: true,
      startMinute: true,
      endMinute: true,
    },
  });
}

/**
 * Picks the one thing to do now.
 *
 * The rule is: the highest-priority action that fits in the study time
 * genuinely left today. When the best item does not fit, this deliberately
 * drops to a smaller one rather than recommending something the student
 * cannot start — and says that is what it did, because silently demoting the
 * most important work would be its own kind of dishonesty.
 */
export function chooseNextAction(
  ranked: Recommendation[],
  capacity: DayCapacity
): NextBestAction | null {
  if (ranked.length === 0) return null;

  const alternatives = ranked.length - 1;
  const top = ranked[0];

  // Nothing recorded about the week: rank order is the best answer available,
  // and the UI asks for the missing information rather than pretending.
  if (capacity.unknown) {
    return { recommendation: top, basis: "TIME_UNKNOWN", alternatives };
  }

  if (capacity.studyMinutes <= 0) {
    return { recommendation: top, basis: "DAY_IS_FULL", alternatives };
  }

  if (top.estimatedMinutes <= capacity.studyMinutes) {
    return { recommendation: top, basis: "TOP_PRIORITY_FITS", alternatives };
  }

  // The most important thing does not fit. Take the highest-ranked one that
  // does; the list is already sorted, so the first match is the best match.
  const fits = ranked.find((r) => r.estimatedMinutes <= capacity.studyMinutes);
  if (fits) return { recommendation: fits, basis: "SCALED_TO_TIME", alternatives };

  // Nothing fits at all — the smallest is the least-bad honest suggestion.
  const smallest = [...ranked].sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)[0];
  return { recommendation: smallest, basis: "SCALED_TO_TIME", alternatives };
}

/**
 * Everything the "what should I do now" surface needs, in one pass.
 *
 * The three reads are independent, so they go out together rather than in
 * sequence — this is on the dashboard's critical path.
 */
export async function getDecisionContext(
  userId: string,
  dict: Dictionary,
  now = new Date()
): Promise<DecisionContext> {
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const [ranked, commitments, tasks] = await Promise.all([
    computeRecommendations(userId, 8, dict),
    loadCommitments(userId),
    prisma.task.findMany({
      where: { userId, status: { not: "COMPLETED" }, deadline: { lte: endOfWeek } },
      select: {
        id: true,
        title: true,
        deadline: true,
        estimatedMinutes: true,
        completionPercentage: true,
      },
    }),
  ]);

  const capacity = remainingCapacityToday(commitments, now);
  const workload = summariseWorkload(tasks, endOfWeek);
  const collision = detectCollision(capacity, workload);

  return {
    action: chooseNextAction(ranked, capacity),
    ranked,
    capacity,
    collision,
    needsTimeSetup: commitments.length === 0,
  };
}
