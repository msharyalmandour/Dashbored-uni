import { z } from "zod";

/**
 * What a dropped item turns out to be. Deliberately small and closed: every
 * value here maps onto something this app already models, so a classification
 * can always be acted on. Anything the provider is unsure of becomes UNKNOWN
 * rather than a plausible-sounding guess.
 */
export const CAPTURE_CONTENT_TYPES = [
  "LECTURE_MATERIAL",
  "QUESTION",
  "TASK",
  "MISTAKE",
  "REFERENCE",
  "PERSONAL_NOTE",
  "UNKNOWN",
] as const;

export type CaptureContentType = (typeof CAPTURE_CONTENT_TYPES)[number];

/**
 * The modules a capture can be filed into. These are route/feature names that
 * already exist — nothing here is aspirational.
 */
export const CAPTURE_DESTINATIONS = [
  "LECTURE",
  "KNOWLEDGE_GAP",
  "FLASHCARD",
  "TASK",
  "MISTAKE",
  "PROBLEM",
  "NONE",
] as const;

export type CaptureDestination = (typeof CAPTURE_DESTINATIONS)[number];

/**
 * The shape a provider must return, enforced at runtime rather than trusted.
 *
 * A language model returns text; this schema is the boundary that decides
 * whether that text is usable. Anything that does not parse is a provider
 * failure recorded on the capture — never a partially-believed result, and
 * never a silently invented one.
 */
export const captureAnalysisSchema = z.object({
  contentType: z.enum(CAPTURE_CONTENT_TYPES),

  /** A short human title for the item, in the language the content is written in. */
  title: z.string().trim().min(1).max(200),

  /** One or two sentences describing what the item actually contains. */
  summary: z.string().trim().max(1000),

  /**
   * The id of one of the user's *existing* subjects, or null. The orchestrator
   * rejects any id that is not in the list it supplied, so a provider cannot
   * attach a capture to a subject that does not exist or is not the user's.
   */
  subjectId: z.string().max(40).nullable(),

  /**
   * A course the content clearly belongs to that the student does not have yet.
   *
   * This exists because of a genuine cold start: on day one a student has no
   * subjects at all, so `subjectId` could only ever be null, every drop filed
   * as "nothing to do", and the first — most important — use of the product
   * produced a saved file and nothing else. The model naming the course it can
   * see lets the app offer to create it, which is what turns filing into
   * setting the student's world up.
   *
   * Null unless the content genuinely names a course. Never set alongside a
   * matched `subjectId`: an existing course always wins over inventing one.
   */
  proposedSubjectName: z.string().trim().max(120).nullable(),

  /** Free-text topic labels found in the content. Not created until confirmed. */
  topics: z.array(z.string().trim().min(1).max(120)).max(12),

  /**
   * The substance the student is being told the system found. Empty is a
   * legitimate answer for a passing thought — the card then simply does not
   * show a concepts row, rather than padding it out.
   */
  keyConcepts: z.array(z.string().trim().min(1).max(160)).max(12),

  /**
   * Concepts the content itself signals as hard — dense, foundational, or
   * flagged in the material. These become the "may need extra attention"
   * line, and they are the ones worth turning into knowledge gaps.
   */
  demandingConcepts: z.array(z.string().trim().min(1).max(160)).max(6),

  /**
   * A date the content actually states — an exam, a due date. Null unless the
   * content genuinely carries one; this drives an offer to create a task, so
   * an invented date would put a fake deadline in someone's calendar.
   */
  detectedEvent: z
    .object({
      kind: z.enum(["EXAM", "ASSIGNMENT", "DEADLINE"]),
      title: z.string().trim().min(1).max(200),
      /** ISO date (YYYY-MM-DD), or null when the content is vague ("next week"). */
      date: z.string().trim().max(40).nullable(),
      /** The words in the content that say so, so the student can check it. */
      evidence: z.string().trim().max(300),
    })
    .nullable(),

  /**
   * A university timetable the content actually is.
   *
   * This is what turns the flagship interaction from filing into
   * transformation: a student drops one photo of their schedule and their
   * courses and week appear. Null for everything that is not a timetable —
   * and a half-read timetable is still worth returning, because the student
   * confirms each row before anything is created.
   *
   * Times are "HH:MM" on a 24-hour clock and weekday is 0=Sunday..6=Saturday,
   * matching Date.getDay(). A row whose day or time could not be read is
   * dropped rather than guessed: an invented lecture time would put a fake
   * commitment in someone's week and corrupt every available-time figure
   * derived from it.
   */
  detectedTimetable: z
    .object({
      entries: z
        .array(
          z.object({
            courseName: z.string().trim().min(1).max(120),
            weekday: z.number().int().min(0).max(6),
            startTime: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
            endTime: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
            location: z.string().trim().max(120).nullable(),
            /** LECTURE, LAB/tutorial and clinical read differently on a timetable. */
            kind: z.enum(["LECTURE", "LAB", "CLINICAL", "OTHER"]),
          })
        )
        .max(60),
    })
    .nullable(),

  suggestedDestinations: z
    .array(
      z.object({
        destination: z.enum(CAPTURE_DESTINATIONS),
        reason: z.string().trim().max(300),
      })
    )
    .max(4),

  /** 0–1. Below `LOW_CONFIDENCE` the UI asks rather than offers a one-tap file. */
  confidence: z.number().min(0).max(1),
});

export type CaptureAnalysis = z.infer<typeof captureAnalysisSchema>;

/**
 * Reads a stored proposal back. Anything that no longer parses becomes null.
 *
 * Nothing writes this shape any more — the agent records what it *did* rather
 * than what it thought, in `agentActions`. It is still read, because rows
 * organised before the agent existed carry one, and dropping the reader would
 * blank the title on everything already in someone's history.
 */
export function parseStoredAnalysis(value: unknown): CaptureAnalysis | null {
  const result = captureAnalysisSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** What the settings screen and the inbox need to know about AI availability. */
export interface AiStatus {
  configured: boolean;
  /** e.g. "anthropic:claude-sonnet-5". Null when nothing is configured. */
  providerId: string | null;
  /** The env var that would turn this on. Shown to the operator, not the student. */
  requiredEnvVar: string;
}
