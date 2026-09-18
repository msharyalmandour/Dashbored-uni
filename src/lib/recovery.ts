import type { Recommendation } from "@/lib/priority-engine";
import { chooseForStatedReality, type StatedEnergy } from "@/lib/decision-engine";
import type { WorkloadSummary, WorkItem } from "@/lib/time-intelligence";

/**
 * Save My Day.
 *
 * Every planner works when the plan is followed. This is the part that works
 * when it was not — when the morning went, the session did not happen, and
 * the honest state of things is "most of today is gone".
 *
 * The rule the whole file follows is that reality outranks the plan. Nothing
 * here tries to salvage the original schedule, and nothing counts what was
 * missed. The only question is what the best move is from where the student
 * actually is, which is a different question with a different answer.
 *
 * It is deterministic on purpose. Which deadline is closest, what fits in
 * forty minutes and what does not, whether the week's work still fits — all
 * of that is arithmetic over real rows, and a language model asked to do it
 * would sooner or later invent a date. Explaining the result is a job for
 * words; deciding it is not.
 */

export type RescueMode =
  /** There is real time left and something worth spending it on. */
  | "CAN_STILL_WORK"
  /** Very little time or energy. One small thing, chosen to protect the most. */
  | "PROTECT_ONE_THING"
  /** Genuinely nothing is pressing. Saying so is a real answer. */
  | "NOTHING_PRESSING";

/** Below this, the day is not going to be rescued — it is going to be triaged. */
const TRIAGE_MINUTES = 20;

export interface AtRiskItem {
  id: string;
  title: string;
  deadline: Date;
  /** Null when nobody has said how long it takes. Reported as unknown. */
  estimatedMinutes: number | null;
}

export interface RescuePlan {
  mode: RescueMode;
  /** What the student said they have. Their word beats the stored timetable. */
  minutesAvailable: number | null;
  /** The one thing worth protecting with the time that is left. */
  primary: Recommendation | null;
  /** Only when the primary genuinely leaves room for it. Never padding. */
  secondary: Recommendation | null;
  rest: {
    status: "SAFE" | "NEEDS_DECISION" | "UNKNOWN";
    /** Minutes of known work beyond what the week can hold. Zero unless over. */
    deficitMinutes: number;
    atRisk: AtRiskItem[];
    /** Outstanding work nobody has sized, so the verdict cannot be complete. */
    unestimatedCount: number;
  };
}

/**
 * What is left over after the main thing, if anything honestly is.
 *
 * A second suggestion is only offered when the remaining minutes actually fit
 * it. Filling the gap with "and also review some flashcards" regardless would
 * be the padding this product is supposed to refuse.
 */
function pickSecondary(
  ranked: Recommendation[],
  primary: Recommendation | null,
  minutesAvailable: number | null
): Recommendation | null {
  if (!primary || minutesAvailable === null) return null;

  const leftover = minutesAvailable - primary.estimatedMinutes;
  if (leftover < 5) return null;

  return ranked.find((r) => r.id !== primary.id && r.estimatedMinutes <= leftover) ?? null;
}

/**
 * What happens to everything else.
 *
 * The student is told this whether or not it is good news, because "your
 * other work is still fine" is exactly as useful as the warning, and a
 * rescue that only ever surfaces problems trains people to dread opening it.
 *
 * UNKNOWN is a real verdict: when outstanding work has no estimates, whether
 * it fits is genuinely not knowable, and saying "safe" would be a guess
 * dressed as reassurance.
 */
function assessRest(
  workload: WorkloadSummary,
  weekStudyMinutes: number,
  capacityKnown: boolean
): RescuePlan["rest"] {
  const unestimatedCount = workload.unestimated.length;

  const atRisk: AtRiskItem[] = workload.items
    .filter((item) => item.completionPercentage < 100)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      deadline: item.deadline,
      estimatedMinutes: item.estimatedMinutes,
    }));

  if (!capacityKnown || (workload.knownMinutes === 0 && unestimatedCount > 0)) {
    return { status: "UNKNOWN", deficitMinutes: 0, atRisk, unestimatedCount };
  }

  const deficit = workload.knownMinutes - weekStudyMinutes;
  if (deficit > 0) {
    return { status: "NEEDS_DECISION", deficitMinutes: deficit, atRisk, unestimatedCount };
  }

  return { status: "SAFE", deficitMinutes: 0, atRisk: [], unestimatedCount };
}

export interface RescueInput {
  ranked: Recommendation[];
  /** Minutes the student says are left today. Null when they did not say. */
  statedMinutes: number | null;
  energy: StatedEnergy | null;
  workload: WorkloadSummary;
  /** Realistic study minutes across the days the workload window covers. */
  weekStudyMinutes: number;
  /** False when the student has told the system nothing about their week. */
  capacityKnown: boolean;
}

/**
 * Builds the rescue plan.
 *
 * Note what this deliberately does not do: it never says the day failed, it
 * never counts what was skipped, and in the worst case it does not pretend
 * the rest can still be finished. When there are twenty minutes and a
 * mountain of work, the honest and more useful move is to protect one thing
 * and say plainly that the rest is not happening today.
 */
export function buildRescuePlan(input: RescueInput): RescuePlan {
  const { ranked, statedMinutes, energy, workload, weekStudyMinutes, capacityKnown } = input;

  const rest = assessRest(workload, weekStudyMinutes, capacityKnown);

  if (ranked.length === 0) {
    return { mode: "NOTHING_PRESSING", minutesAvailable: statedMinutes, primary: null, secondary: null, rest };
  }

  // The same chooser the rest of the app uses, so a rescue and an ordinary
  // recommendation cannot disagree about what matters — this only differs in
  // what it says around the answer.
  const action = chooseForStatedReality(ranked, statedMinutes, energy);
  const primary = action?.recommendation ?? null;

  // Triage rather than rescue: too little time, or too little energy for the
  // time there is, to do more than protect one thing.
  const triage =
    statedMinutes !== null &&
    (statedMinutes < TRIAGE_MINUTES || (energy === "LOW" && statedMinutes < 30));

  if (triage) {
    return { mode: "PROTECT_ONE_THING", minutesAvailable: statedMinutes, primary, secondary: null, rest };
  }

  return {
    mode: "CAN_STILL_WORK",
    minutesAvailable: statedMinutes,
    primary,
    secondary: pickSecondary(ranked, primary, statedMinutes),
    rest,
  };
}

/** Re-exported so callers building a workload do not need two imports. */
export type { WorkItem };
