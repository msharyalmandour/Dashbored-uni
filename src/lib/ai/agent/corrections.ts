import { prisma } from "@/lib/prisma";

/**
 * What this student has already told the agent it got wrong.
 *
 * Corrections are the most useful thing a student ever says to a system like
 * this, and they were being thrown away. Undoing a drop is not vague
 * dissatisfaction — it is a precise statement, about a specific drop, that none
 * of what was written belonged in their records. Binning an item the agent could
 * not handle is a weaker but equally real one: you failed at this and I stopped
 * trying. Neither was recorded, so the same mistake was available to be made
 * again forever, on the same student, with the same confidence.
 *
 * This is deliberately a summary read at run time from the event log, not a
 * stored profile. The distinction is the same one the behaviour log already
 * makes: facts are written down, conclusions are recomputed. A student who
 * undid three timetable imports in September and none since has changed, and a
 * profile would still be telling the agent about September.
 *
 * Two rules keep it honest:
 *
 *   - **Recent only.** A correction from last term is about a different course
 *     load and often a different mistake.
 *   - **Bounded.** A few lines. This shares the system prompt with the rules
 *     that make the agent safe, and a long history of grievances competing with
 *     those rules is worse than no history at all.
 */

/** How far back a correction still says something about what to do now. */
const WINDOW_DAYS = 60;

/** At most this many, newest first. Enough to show a pattern, short enough to read. */
const MAX_CORRECTIONS = 4;

interface CorrectionContext {
  undone?: Record<string, number>;
  note?: string;
}

/**
 * A short account of recent corrections, or null when there are none.
 *
 * Null rather than an empty string, so the caller can leave the section out
 * entirely: a heading followed by "(none)" spends the model's attention telling
 * it nothing.
 */
export async function summarizeCorrections(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await prisma.studentEvent.findMany({
    where: {
      userId,
      type: { in: ["DROP_UNDONE", "AGENT_ROW_DELETED"] },
      occurredAt: { gte: since },
    },
    select: { type: true, occurredAt: true, context: true },
    orderBy: { occurredAt: "desc" },
    take: MAX_CORRECTIONS,
  });

  if (events.length === 0) return null;

  const lines = events.map((event) => {
    const context = (event.context ?? {}) as CorrectionContext;
    const day = event.occurredAt.toISOString().slice(0, 10);

    if (event.type === "DROP_UNDONE") {
      const what = Object.entries(context.undone ?? {})
        .filter(([key]) => key !== "coursesKept")
        .map(([kind, count]) => `${count} ${kind}`)
        .join(", ");
      const said = context.note ? ` The run had said: "${context.note}"` : "";
      return `- ${day}: they took back everything one drop wrote${what ? ` (${what})` : ""}.${said}`;
    }

    return `- ${day}: they binned an item rather than let it be organised${
      context.note ? ` — it had reported: "${context.note}"` : ""
    }.`;
  });

  return lines.join("\n");
}
