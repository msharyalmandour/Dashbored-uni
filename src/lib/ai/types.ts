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
 * Under this, the proposal is presented as a question ("which subject is
 * this?") instead of a suggestion to accept. The threshold lives here rather
 * than in the UI so the server and the client agree on what "unsure" means.
 */
export const LOW_CONFIDENCE = 0.6;

/** What the provider is given. Only real content — never a placeholder. */
export interface CaptureAnalysisInput {
  /** Extracted document text, or the typed note. Always the user's own words. */
  content: string;
  /** Where the content came from, so the provider can weight it. */
  source: "TEXT" | "FILE";
  /** Original filename for FILE captures — often the strongest single signal. */
  fileName?: string;
  /** The user's real subjects. The provider may only choose from these. */
  subjects: { id: string; name: string; code: string | null }[];
  /** Existing topic names, so the provider reuses the user's vocabulary. */
  knownTopics: string[];
  /** ISO date. Without it "the exam is next Tuesday" cannot resolve to a date. */
  today: string;
  /**
   * The picture itself, when the capture is an image the model can decode.
   *
   * This is what makes a screenshot of a timetable, a photo of a whiteboard or
   * a page of handwriting genuinely readable rather than a file with a name.
   * Absent for everything else — including image formats the model cannot
   * decode, where claiming to have looked would be false.
   */
  image?: { mediaType: string; base64: string };
}

/**
 * The integration boundary. One method, one job.
 *
 * A provider is a real call to a real model. There is no built-in fallback
 * implementation that fabricates an answer — when nothing is configured,
 * `getAiProvider()` returns null and the capture is recorded as UNPROCESSED,
 * which the UI reports honestly.
 */
export interface AiProvider {
  /** Recorded on the capture as `analyzedBy`, so a proposal is always traceable. */
  id: string;
  analyzeCapture(input: CaptureAnalysisInput): Promise<CaptureAnalysis>;
}

/** What the settings screen and the inbox need to know about AI availability. */
export interface AiStatus {
  configured: boolean;
  /** e.g. "anthropic:claude-sonnet-5". Null when nothing is configured. */
  providerId: string | null;
  /** The env var that would turn this on. Shown to the operator, not the student. */
  requiredEnvVar: string;
}
