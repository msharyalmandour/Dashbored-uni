/**
 * Practising a procedure for a performed exam.
 *
 * WHY THIS EXISTS, measured rather than assumed. `ClinicalTraining` has been
 * in the schema since the first week and holds ZERO rows after twenty-four days
 * of real use. Its fields say why: hospital, department, supervisor,
 * skillsPracticed, whatILearned, whatIDidNotUnderstand, questionsToAsk,
 * reflection, nextAction. That is a reflective journal, and it asks a nursing
 * student to write five essays at the end of an eight-hour shift. The form
 * costs more than it returns, so it was never filled in once. The failure is
 * the form's, not the student's.
 *
 * What an OSPE actually is: an examiner says "insert a nasogastric tube", and
 * you are marked on the STEPS you perform and the steps you omit. So the unit
 * is a procedure and its ordered steps, and the thing worth recording is which
 * step you missed — not how the shift made you feel.
 *
 * A missed step is recorded as a `Mistake`, not as a new kind of row. That
 * model already carries `frequency`, `whatIShouldReview`, a link to the
 * knowledge gap, and `mistake-patterns.ts` already finds what a student keeps
 * getting wrong. All of that machinery was built and then starved, because the
 * only way to create a Mistake was a form nobody filled in either. Pointing it
 * at procedure steps is what finally feeds it.
 *
 * Pure: no database, no clock beyond the `now` handed in.
 */

export interface Step {
  id: string;
  order: number;
  text: string;
  /**
   * A step whose omission fails the station on its own.
   *
   * Set by the student from their own faculty's checklist, never inferred.
   * Which steps are critical is a marking convention that differs between
   * schools and between procedures, and guessing it would be the app inventing
   * the rule it then judges them by.
   */
  critical: boolean;
}

export interface Attempt {
  /** Steps omitted or performed wrongly this time. */
  missedStepIds: string[];
}

/**
 * How a station is scored — and why it is not a percentage.
 *
 * THIS IS A DOMAIN RULE, NOT A FINDING. Everything else in this codebase that
 * sets a threshold does so from measured behaviour, and `patterns.ts` refuses
 * to conclude anything below four observations. There are zero recorded
 * procedure attempts, so nothing here could be derived from data. It is not
 * derived from data: it is how performed examinations are marked. An omitted
 * critical step fails the station regardless of the total, which is why
 * eighteen correct steps out of twenty can still be a fail and a percentage is
 * the wrong shape of answer.
 *
 * Saying this out loud matters, because the rule is the whole reason a
 * quiz-shaped competitor cannot help with an OSPE. They score 18/20 = 90%. The
 * examiner scores it FAIL.
 */
export type StationResult = "PASS" | "FAIL_CRITICAL" | "FAIL_INCOMPLETE";

/**
 * The share of non-critical steps that may be missed and still pass.
 *
 * A convention, and a soft one — real checklists vary, so this is the default
 * a student can be shown and argue with, not a truth. It sits here as one
 * named constant rather than being spread through the scoring so that changing
 * it is a single edit with a single test.
 */
export const MINOR_MISS_ALLOWANCE = 0.2;

export function score(steps: Step[], attempt: Attempt): StationResult {
  /* A procedure with no steps cannot be failed. This is not a pass worth
     celebrating — it means nobody has entered the checklist yet — but the
     alternative is reporting a fail for a procedure that asked nothing, which
     would be a lie about the student's performance. The caller decides whether
     an empty checklist is worth showing at all. */
  if (steps.length === 0) return "PASS";

  const missed = new Set(attempt.missedStepIds);

  /* Checked first and on its own, because it is not a matter of degree. One
     missed critical step ends the question; counting it toward a proportion
     would let a long checklist dilute it away, which is exactly the arithmetic
     a percentage does and the reason this function does not return one. */
  const missedCritical = steps.some((s) => s.critical && missed.has(s.id));
  if (missedCritical) return "FAIL_CRITICAL";

  const minor = steps.filter((s) => !s.critical);
  if (minor.length === 0) return "PASS";

  const minorMissed = minor.filter((s) => missed.has(s.id)).length;
  /* Strictly greater: missing exactly the allowance is still a pass. A
     boundary has to fall on one side and this is the side that does not fail
     a student on a rounding decision they cannot see. */
  return minorMissed / minor.length > MINOR_MISS_ALLOWANCE ? "FAIL_INCOMPLETE" : "PASS";
}

export interface ProcedureRow {
  id: string;
  name: string;
  stepCount: number;
  /** Null means never practised — which is different from practised long ago. */
  lastPracticedAt: Date | null;
  /** How many times a critical step of this procedure has been missed. */
  criticalMisses: number;
}

/**
 * Which procedure to practise next.
 *
 * Deliberately a total ordering with no scoring function and no tuned weights.
 * There are no recorded attempts to tune against, and a weighted score built
 * on nothing would look like a measurement and be a guess with decimals.
 * Instead, three rules a student can check against their own list:
 *
 *   1. Never practised comes before ever practised. "I have not done this at
 *      all" is a different kind of fact from "I did it a while ago", and no
 *      amount of elapsed time should let a procedure they have rehearsed twice
 *      overtake one they have never opened.
 *   2. Then longest since practised.
 *   3. Critical misses break ties between equally stale procedures.
 *
 * RULES 2 AND 3 WERE THE OTHER WAY ROUND and the test caught it. Ranking by
 * critical misses first put a procedure practised YESTERDAY, with five misses
 * behind it, above one untouched for a month. That is wrong for a reason that
 * has nothing to do with tuning: you cannot usefully rehearse the same
 * physical procedure twice in a day, so the misses were being allowed to
 * recommend an hour that could not pay off.
 *
 * The fix is the ordering, not a decay curve. There are zero recorded attempts
 * to fit a curve to, and a weighting function over no data is a guess with
 * decimals on it. Recency needs no constant, and the rule states in one
 * sentence: the one you have not done in longest, and where two are equally
 * stale, the one you keep failing.
 *
 * What this gives up, said plainly: a procedure missed five times two days ago
 * loses to a clean one from three days ago. That is a real cost, and it is the
 * right trade only until there are attempts to measure. When there are, this
 * ordering is the first thing to re-examine.
 *
 * A procedure with no steps is excluded rather than ranked last: it is an
 * empty checklist, so "practise this" is an instruction that cannot be
 * followed. It needs its steps entered, which is a different prompt.
 */
export function practiceOrder(procedures: ProcedureRow[]): ProcedureRow[] {
  /* No `.slice()` before the sort: `.filter` has already produced a new array,
     so the caller's is never touched. The copy was there defensively and was
     dead — mutation testing showed removing it changed nothing, which is the
     definition of code that is not doing anything. The no-mutation test below
     it stays, because it guards the contract rather than this line. */
  return procedures
    .filter((p) => p.stepCount > 0)
    .sort((a, b) => {
      const aNew = a.lastPracticedAt === null;
      const bNew = b.lastPracticedAt === null;
      if (aNew !== bNew) return aNew ? -1 : 1;
      /* Both null is handled above, so reaching here with nulls is impossible;
         the zero keeps the comparator total anyway rather than relying on that
         staying true if the branch above is ever edited. */
      const at = a.lastPracticedAt?.getTime() ?? 0;
      const bt = b.lastPracticedAt?.getTime() ?? 0;
      if (at !== bt) return at - bt;
      return b.criticalMisses - a.criticalMisses;
    });
}

/**
 * The steps to warn about before an attempt starts.
 *
 * Only steps actually missed before, most-missed first, criticals ahead of
 * minors at equal count. A step missed once is included: with the miss count
 * shown beside it, one is a true and useful fact, and suppressing it until
 * some threshold would hide the only data a new procedure has.
 *
 * What this does NOT do is call a repeated miss a pattern. `patterns.ts` sets
 * MIN_OBSERVATIONS = 4 for that word and is right to; this is a list of what
 * happened, ordered, with its counts visible.
 */
export function watchSteps(steps: Step[], missCounts: Map<string, number>, limit = 3): Step[] {
  return steps
    .filter((s) => (missCounts.get(s.id) ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      const am = missCounts.get(a.id) ?? 0;
      const bm = missCounts.get(b.id) ?? 0;
      if (am !== bm) return bm - am;
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return a.order - b.order;
    })
    .slice(0, limit);
}
