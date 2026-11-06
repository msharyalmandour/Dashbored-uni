/**
 * Where a group project actually is, which is not where its percentage says.
 *
 * A Task carries `completionPercentage`, a number somebody typed. Milestones
 * carry what is actually finished. When both exist they disagree sooner or
 * later — a student ticks off two of five steps and never goes back to move
 * the slider — and a screen showing both is a screen showing two answers to
 * one question.
 *
 * THE MILESTONES WIN WHEN THERE ARE ANY. They are the record of events; the
 * percentage is the record of an intention. When there are none the
 * percentage is all there is, and it is used, and the screen does not pretend
 * to a precision it has not got.
 */

export interface Milestone {
  id: string;
  orderIndex: number;
  title: string;
  doneAt: Date | null;
}

export interface ProjectProgress {
  /** 0–100. */
  percent: number;
  /** Which number it came from, so the screen can word itself honestly. */
  from: "milestones" | "typed";
  done: number;
  total: number;
}

export function projectProgress(
  milestones: Milestone[],
  typedPercent: number
): ProjectProgress {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  if (milestones.length === 0) {
    return { percent: clamp(typedPercent), from: "typed", done: 0, total: 0 };
  }
  const done = milestones.filter((m) => m.doneAt !== null).length;
  /* No division by zero reachable here — the length is checked above — but
     the order of these two returns is the whole guard. */
  return {
    percent: clamp((done / milestones.length) * 100),
    from: "milestones",
    done,
    total: milestones.length,
  };
}

/**
 * The step he is on: the FIRST one not finished, in the project's own order.
 *
 * NOT "the one after the last finished". Groups tick steps out of order all
 * the time — someone does step 3 because they had the data — and taking the
 * highest finished index would say he is on step 4 while step 2 is still
 * open. The first gap is the honest answer, and it is also the one worth
 * pointing at.
 *
 * Null when every step is done, which the screen says as finished rather than
 * as a sixth step that does not exist.
 */
export function currentMilestone(milestones: Milestone[]): Milestone | null {
  const ordered = [...milestones].sort((a, b) => a.orderIndex - b.orderIndex);
  return ordered.find((m) => m.doneAt === null) ?? null;
}

/**
 * The 1-based position of that step, for "المرحلة 2 من 5".
 *
 * Counted in the project's own order, not in array order, because the rows
 * come back in whatever order the query left them.
 */
export function currentStage(milestones: Milestone[]): number | null {
  const ordered = [...milestones].sort((a, b) => a.orderIndex - b.orderIndex);
  const i = ordered.findIndex((m) => m.doneAt === null);
  return i === -1 ? null : i + 1;
}

/** Everything finished. False for an empty project, which is not finished. */
export function isFinished(milestones: Milestone[]): boolean {
  return milestones.length > 0 && milestones.every((m) => m.doneAt !== null);
}
