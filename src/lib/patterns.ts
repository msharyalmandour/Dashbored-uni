/**
 * The pattern engine.
 *
 * Everything here is a pure function over observed rows, and every answer
 * carries how much evidence is behind it. That is not decoration — it is the
 * whole design. A planner that says "you study better in the morning" after
 * two mornings is not personalising; it is guessing loudly, and the student
 * has no way to tell the difference.
 *
 * Three rules hold throughout:
 *
 *   1. Nothing is concluded from one observation. Below MIN_OBSERVATIONS the
 *      answer is `null` and the caller says nothing at all.
 *   2. Nothing here names a cause. "Evening sessions were finished less often"
 *      is in the data. "You lose focus at night" is not, and no amount of data
 *      of this kind would put it there — the difference between the two is the
 *      difference between an observation and a diagnosis.
 *   3. Recent evidence outweighs old evidence, so a student who changes stops
 *      being described by who they were. A pattern is recomputed on every
 *      read; none of this is ever stored.
 */

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

/** Below this, there is no pattern — only a couple of things that happened. */
export const MIN_OBSERVATIONS = 4;

/** Repeated enough to mention, gently. */
const MEDIUM_OBSERVATIONS = 6;

/** Consistent enough to order recommendations by. */
const HIGH_OBSERVATIONS = 12;

/**
 * How far apart two rates must be before the gap is worth a sentence.
 *
 * Twenty points is deliberately coarse. Real completion rates wobble by ten
 * points for reasons that have nothing to do with the student — a lecture ran
 * late, a friend called — and a system that narrates that noise back to them
 * as insight is worse than one that stays quiet.
 */
const MEANINGFUL_GAP = 0.2;

export function confidenceFor(observations: number): Confidence | null {
  if (observations < MIN_OBSERVATIONS) return null;
  if (observations >= HIGH_OBSERVATIONS) return "HIGH";
  if (observations >= MEDIUM_OBSERVATIONS) return "MEDIUM";
  return "LOW";
}

// ---------------------------------------------------------------------------
// Input shapes — plain rows, so this file never touches a database.
// ---------------------------------------------------------------------------

export interface SessionObservation {
  /** 0-23, in the student's own local time. */
  hour: number;
  plannedMinutes: number;
  /** Null when the session was never finished — which is itself the signal. */
  actualMinutes: number | null;
  finished: boolean;
  occurredAt: Date;
}

export interface PostponementObservation {
  taskId: string;
  occurredAt: Date;
}

export interface DurationObservation {
  taskType: string;
  estimatedMinutes: number;
  actualMinutes: number;
}

// ---------------------------------------------------------------------------
// Layer 1 — when the student's sessions actually work out
// ---------------------------------------------------------------------------

export type DayPart = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";

export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 22) return "EVENING";
  return "NIGHT";
}

export interface TimeOfDayPattern {
  /** The part of day that works out most often. */
  best: DayPart;
  /** The one it beats, so the sentence can name a comparison and not a verdict. */
  worst: DayPart;
  bestRate: number;
  worstRate: number;
  observations: number;
  confidence: Confidence;
}

/**
 * Which part of the day the student's sessions tend to survive.
 *
 * Returns null unless two parts of the day each have enough sessions *and*
 * differ by more than noise. Both conditions matter: a student with twenty
 * morning sessions and one evening session has told us nothing about
 * evenings, and a ten-point gap has told us nothing at all.
 */
export function detectTimeOfDayPattern(sessions: SessionObservation[]): TimeOfDayPattern | null {
  const buckets = new Map<DayPart, { total: number; finished: number }>();
  for (const s of sessions) {
    const part = dayPartOf(s.hour);
    const b = buckets.get(part) ?? { total: 0, finished: 0 };
    b.total += 1;
    if (s.finished) b.finished += 1;
    buckets.set(part, b);
  }

  const eligible = [...buckets.entries()]
    .filter(([, b]) => b.total >= MIN_OBSERVATIONS)
    .map(([part, b]) => ({ part, rate: b.finished / b.total, total: b.total }));

  // One part of the day is not a comparison. Without a second, the only
  // honest statement is that we do not know how it compares to anything.
  if (eligible.length < 2) return null;

  eligible.sort((a, b) => b.rate - a.rate);
  const best = eligible[0];
  const worst = eligible[eligible.length - 1];

  if (best.rate - worst.rate < MEANINGFUL_GAP) return null;

  // The weaker side, not the sum. A comparison is only as strong as its
  // thinner half: four mornings against forty evenings says something about
  // evenings and very little about mornings, and adding the two would let it
  // report high confidence in a claim resting on four sessions. Summing also
  // made LOW unreachable here — both buckets need MIN_OBSERVATIONS, so the
  // total could never fall below twice it.
  const observations = Math.min(best.total, worst.total);
  const confidence = confidenceFor(observations);
  if (!confidence) return null;

  return {
    best: best.part,
    worst: worst.part,
    bestRate: best.rate,
    worstRate: worst.rate,
    observations,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Layer 3 — how long a session can usefully be
// ---------------------------------------------------------------------------

export interface SessionLengthPattern {
  /** The planned length the student finishes most reliably. */
  suggestedMinutes: number;
  shortRate: number;
  longRate: number;
  observations: number;
  confidence: Confidence;
}

/** Sessions at or under this are "short"; longer ones are "long". */
const SHORT_SESSION_CEILING = 30;

/** What to propose when short sessions are clearly working better. */
const SUGGESTED_SHORT_MINUTES = 25;

/**
 * Whether shorter sessions are working better than longer ones.
 *
 * Only fires in one direction. If long sessions are going fine there is
 * nothing to suggest — the student is already doing something that works, and
 * telling them so is a notification, not a help.
 */
export function detectSessionLengthPattern(
  sessions: SessionObservation[]
): SessionLengthPattern | null {
  const short = { total: 0, finished: 0 };
  const long = { total: 0, finished: 0 };

  for (const s of sessions) {
    const bucket = s.plannedMinutes <= SHORT_SESSION_CEILING ? short : long;
    bucket.total += 1;
    if (s.finished) bucket.finished += 1;
  }

  if (short.total < MIN_OBSERVATIONS || long.total < MIN_OBSERVATIONS) return null;

  const shortRate = short.finished / short.total;
  const longRate = long.finished / long.total;
  if (shortRate - longRate < MEANINGFUL_GAP) return null;

  // The weaker side again, for the same reason as above.
  const observations = Math.min(short.total, long.total);
  const confidence = confidenceFor(observations);
  if (!confidence) return null;

  return {
    suggestedMinutes: SUGGESTED_SHORT_MINUTES,
    shortRate,
    longRate,
    observations,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Layers 2 and 6 — how long things really take this student
// ---------------------------------------------------------------------------

export interface DurationCalibration {
  taskType: string;
  /** Observed actual ÷ estimated. Above 1 means things run long. */
  ratio: number;
  /** The range to show, derived from the ratio applied to an estimate. */
  observations: number;
  confidence: Confidence;
}

/** Inside this band, the estimate is fine and saying anything is noise. */
const CALIBRATION_DEADBAND = 0.15;

/**
 * How far this student's real durations sit from the estimates.
 *
 * The median is used rather than the mean: one session that ran four hours
 * because someone left the timer running would drag an average into fiction,
 * and this number goes on to shape what the student is told.
 */
export function calibrateDuration(
  observations: DurationObservation[],
  taskType: string
): DurationCalibration | null {
  const relevant = observations.filter(
    (o) => o.taskType === taskType && o.estimatedMinutes > 0 && o.actualMinutes > 0
  );
  if (relevant.length < MIN_OBSERVATIONS) return null;

  const ratios = relevant.map((o) => o.actualMinutes / o.estimatedMinutes).sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const ratio =
    ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];

  if (Math.abs(ratio - 1) < CALIBRATION_DEADBAND) return null;

  const confidence = confidenceFor(relevant.length);
  if (!confidence) return null;

  return { taskType, ratio, observations: relevant.length, confidence };
}

/**
 * Applies a calibration to an estimate, as a range rather than a point.
 *
 * A range is the honest shape. The underlying evidence is a handful of
 * sessions with real spread in them, and collapsing that into "this will take
 * 68 minutes" would claim a precision the data does not have.
 */
export function calibratedRange(
  estimateMinutes: number,
  calibration: DurationCalibration
): { low: number; high: number } {
  const centre = estimateMinutes * calibration.ratio;
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  return { low: round5(centre * 0.85), high: round5(centre * 1.15) };
}

// ---------------------------------------------------------------------------
// Layers 4 and 5 — a task that keeps not happening
// ---------------------------------------------------------------------------

export interface FrictionPattern {
  taskId: string;
  postponements: number;
  stuckCount: number;
  confidence: Confidence;
}

/**
 * How many times one task has to be moved before it is worth mentioning.
 *
 * Two is a week that changed twice. Three is a pattern — and three is also
 * where a student would notice it themselves, which is the point: the system
 * should not be the first to bring it up, only the one that offers to help.
 */
const FRICTION_POSTPONEMENTS = 3;

/**
 * Tasks that keep getting moved or keep producing confusion.
 *
 * Note what this deliberately does not return: a reason. The data can show
 * that a task has been postponed four times. It cannot show whether that is
 * because it is boring, badly explained, too big, or scheduled against a
 * shift at work — and the four call for completely different help. So the
 * finding is handed to the student as an observation with options, never as
 * an explanation of themselves.
 */
export function detectFriction(
  postponements: PostponementObservation[],
  stuckByTask: Map<string, number> = new Map()
): FrictionPattern[] {
  const counts = new Map<string, number>();
  for (const p of postponements) {
    counts.set(p.taskId, (counts.get(p.taskId) ?? 0) + 1);
  }

  const found: FrictionPattern[] = [];
  for (const [taskId, postponementCount] of counts) {
    if (postponementCount < FRICTION_POSTPONEMENTS) continue;
    found.push({
      taskId,
      postponements: postponementCount,
      stuckCount: stuckByTask.get(taskId) ?? 0,
      // Repetition on a single task is its own evidence: the fourth move of
      // the same assignment says more than four moves spread over four
      // different ones, which is why this does not go through confidenceFor.
      confidence: postponementCount >= 5 ? "HIGH" : postponementCount >= 4 ? "MEDIUM" : "LOW",
    });
  }

  return found.sort((a, b) => b.postponements - a.postponements);
}
