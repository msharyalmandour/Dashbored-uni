import { prisma } from "@/lib/prisma";
import {
  detectTimeOfDayPattern,
  detectSessionLengthPattern,
  detectFriction,
  calibrateDuration,
  type SessionObservation,
  type PostponementObservation,
  type DurationObservation,
  type TimeOfDayPattern,
  type SessionLengthPattern,
  type FrictionPattern,
} from "@/lib/patterns";

/**
 * Reading the student's own record and asking the pattern engine what, if
 * anything, it says.
 *
 * The window is the important decision here. Only the last eight weeks are
 * read, so a term's worth of old behaviour cannot outvote how someone is
 * studying now — which is exactly the failure mode of a stored profile, and
 * the reason none of this is stored. A student who changed how they work in
 * March stops being described by February.
 *
 * When there is not enough to say, this returns nulls. Every caller renders
 * nothing in that case; none of them fills the space with a guess.
 */

/** How far back behaviour is read. Beyond this, it is no longer who they are. */
const WINDOW_DAYS = 56;

export interface StudentProfile {
  timeOfDay: TimeOfDayPattern | null;
  sessionLength: SessionLengthPattern | null;
  friction: FrictionPattern[];
  /** Rows kept so a specific task type can be calibrated on demand. */
  durations: DurationObservation[];
  /** True when personalisation is switched off — everything above is empty. */
  disabled: boolean;
}

export const EMPTY_PROFILE: StudentProfile = {
  timeOfDay: null,
  sessionLength: null,
  friction: [],
  durations: [],
  disabled: false,
};

/** The preference key that switches the whole layer off. */
export const PERSONALISATION_KEY = "personalisation";

export async function isPersonalisationEnabled(userId: string): Promise<boolean> {
  const row = await prisma.studentPreference.findUnique({
    where: { userId_key: { userId, key: PERSONALISATION_KEY } },
    select: { value: true },
  });
  // On by default, and off only if the student explicitly said so. A missing
  // row means they have never been asked, not that they refused.
  if (!row) return true;
  return (row.value as { enabled?: boolean } | null)?.enabled !== false;
}

export async function readStudentProfile(userId: string, now = new Date()): Promise<StudentProfile> {
  if (!(await isPersonalisationEnabled(userId))) {
    return { ...EMPTY_PROFILE, disabled: true };
  }

  const since = new Date(now.getTime() - WINDOW_DAYS * 86400000);

  const events = await prisma.studentEvent.findMany({
    where: { userId, occurredAt: { gte: since } },
    select: { type: true, occurredAt: true, taskId: true, context: true },
    orderBy: { occurredAt: "desc" },
  });

  const sessions: SessionObservation[] = [];
  const postponements: PostponementObservation[] = [];
  const durations: DurationObservation[] = [];
  const stuckByTask = new Map<string, number>();

  for (const e of events) {
    const ctx = (e.context ?? {}) as {
      hour?: number;
      plannedMinutes?: number;
      actualMinutes?: number;
      movedDays?: number;
      taskType?: string;
    };

    switch (e.type) {
      case "SESSION_COMPLETED":
      case "SESSION_ABANDONED": {
        // A started-but-unresolved session contributes nothing: it is not a
        // success and not yet a failure. SESSION_STARTED is therefore
        // deliberately not counted here — reconcileStaleSessions is what
        // turns a walked-away session into the ABANDONED row that is.
        if (ctx.hour === undefined || ctx.plannedMinutes === undefined) break;
        sessions.push({
          hour: ctx.hour,
          plannedMinutes: ctx.plannedMinutes,
          actualMinutes: ctx.actualMinutes ?? null,
          finished: e.type === "SESSION_COMPLETED",
          occurredAt: e.occurredAt,
        });
        break;
      }
      case "TASK_POSTPONED": {
        if (!e.taskId) break;
        postponements.push({ taskId: e.taskId, occurredAt: e.occurredAt });
        break;
      }
      case "STUDENT_STUCK": {
        if (!e.taskId) break;
        stuckByTask.set(e.taskId, (stuckByTask.get(e.taskId) ?? 0) + 1);
        break;
      }
      default:
        break;
    }
  }

  // Estimate-versus-actual, from the sessions that recorded both. The planned
  // minutes stand in for the estimate because that is what the student agreed
  // to when they started — the number they were actually working against.
  for (const s of sessions) {
    if (s.actualMinutes === null || !s.finished) continue;
    durations.push({
      taskType: "SESSION",
      estimatedMinutes: s.plannedMinutes,
      actualMinutes: s.actualMinutes,
    });
  }

  return {
    timeOfDay: detectTimeOfDayPattern(sessions),
    sessionLength: detectSessionLengthPattern(sessions),
    friction: detectFriction(postponements, stuckByTask),
    durations,
    disabled: false,
  };
}

/** Re-exported so callers need only one import to use a calibration. */
export { calibrateDuration };
