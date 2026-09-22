import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySubject } from "@/lib/authz";
import { readAnnotationNote } from "@/lib/annotation-reader";
import { downloadDocumentFileAsService } from "@/lib/document-storage";
import { normalizeArabicText } from "@/lib/pdf-text";
import { annotatableType } from "@/lib/annotatable";
import type { AgentAction } from "./types";

/**
 * Everything a tool is allowed to know about who it is acting for.
 *
 * `userId` is in here rather than in any tool's arguments, and that placement
 * is the security boundary of this whole design. The model composes tool
 * arguments; if it could name a user, a wrong or adversarial argument would
 * write into someone else's account. It cannot, because the identity is bound
 * server-side before the model is ever asked anything, and every executor
 * reads it from here.
 *
 * The same reasoning applies one level down to subject ids, which the model
 * *does* supply: each is re-checked against this user with `verifySubject`
 * before it reaches a write. A model that invents an id, or repeats one it saw
 * elsewhere, gets an error back rather than a write.
 */
export interface AgentContext {
  userId: string;
  captureId: string;
  /** Resolved lazily: most runs never create a course, so most never need one. */
  semesterId?: string;
  /**
   * Whether a timetable large enough to be the student's whole week waits for
   * them to confirm it.
   *
   * On for a student's own drop, off when the write has already been confirmed —
   * that call is the confirmation, and holding it again would be a loop with no
   * exit.
   */
  holdBigTimetables?: boolean;
}

/** What an executor hands back to the loop. */
export type ToolOutcome = {
  /** Returned to the model as the tool result, so it can decide what to do next. */
  result: string;
  /** Present only when a row was actually written. This is what the student is shown. */
  action?: AgentAction;
  /** True when the agent has answered the student instead of acting. Ends the run. */
  question?: string;
  /** True when the agent has declared itself finished. Ends the run. */
  finished?: boolean;
};

const MAX_TIMETABLE_ENTRIES = 60;
const MAX_FLASHCARDS = 20;

/**
 * The semester a course has to belong to, created on demand.
 *
 * Kept here rather than imported from the capture actions because a tool must
 * not depend on a Server Action module — those carry the `"use server"`
 * boundary and everything exported from them becomes a callable endpoint.
 */
async function ensureSemester(ctx: AgentContext): Promise<string> {
  if (ctx.semesterId) return ctx.semesterId;

  const existing = await prisma.semester.findFirst({
    where: { userId: ctx.userId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (existing) {
    ctx.semesterId = existing.id;
    return existing.id;
  }

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 4);
  const created = await prisma.semester.create({
    data: { userId: ctx.userId, name: "Current semester", startDate: now, endDate: end },
    select: { id: true },
  });
  ctx.semesterId = created.id;
  return created.id;
}

/**
 * Resolves a subject id the model supplied, and returns its name.
 *
 * Returning the name is not a convenience — it is what lets the action log say
 * "a knowledge gap in Pharmacology" using the course's real name from the
 * database rather than whatever the model believed the course was called.
 */
async function resolveSubject(ctx: AgentContext, subjectId: string): Promise<{ id: string; name: string }> {
  await verifySubject(ctx.userId, subjectId);
  const subject = await prisma.subject.findUniqueOrThrow({
    where: { id: subjectId },
    select: { id: true, name: true },
  });
  return subject;
}

/** "09:30" → 570. Null for anything that is not a real time of day. */
function minuteOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** The next date on or after `from` that falls on `weekday` (0 = Sunday). */
function nextDateForWeekday(from: Date, weekday: number): Date {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return date;
}

/** A date the student's records can hold, or null. Never a guess. */
function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// --- Argument schemas ---------------------------------------------------
//
// These are what actually decide whether a write happens. The JSON Schema
// published to the model describes the shape it should aim at; these check the
// things a shape cannot — that "13:70" is not a time, that a deadline parses
// to a real date, that a title is not empty. Nothing reaches a database write
// without passing through one of them.

const searchCoursesArgs = z.object({ query: z.string().min(1).max(200) });

const whatsThereArgs = z.object({
  subjectId: z.string().min(1).max(60).nullable().optional(),
  query: z.string().max(200).nullable().optional(),
});

const createCourseArgs = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).nullable().optional(),
});

/**
 * Exported so a held proposal is re-validated by the very schema that accepted
 * it from the model, rather than by a second description of the same shape kept
 * in step by hand.
 */
export const timetableEntriesSchema = z.lazy(() => importTimetableArgs.shape.entries);

const timetableEntry = z.object({
  courseName: z.string().min(1).max(120),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().max(120).nullable().optional(),
  kind: z.enum(["LECTURE", "LAB", "CLINICAL", "OTHER"]),
});

const importTimetableArgs = z.object({
  entries: z.array(timetableEntry).min(1).max(MAX_TIMETABLE_ENTRIES),
});

const createTaskArgs = z.object({
  title: z.string().min(1).max(200),
  deadline: z.string().min(1),
  type: z.enum(["ASSIGNMENT", "PROJECT", "EXAM", "QUIZ", "PRESENTATION", "READING", "OTHER"]),
  subjectId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  estimatedMinutes: z.number().int().min(5).max(2400).nullable().optional(),
});

const createGapArgs = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  source: z.enum(["LECTURE", "CLINICAL_TRAINING", "VIDEO", "PROBLEM_SOLVING", "READING", "OTHER"]),
});

const openInReaderArgs = z.object({
  lectureId: z.string().min(1),
  title: z.string().max(200).nullable().optional(),
});

const attachResourceArgs = z.object({
  lectureId: z.string().min(1),
  title: z.string().min(1).max(200),
  type: z.enum(["PDF", "POWERPOINT", "VIDEO", "LINK", "NOTE"]),
  url: z.string().max(2000).nullable().optional(),
});

const createProblemArgs = z.object({
  subjectId: z.string().min(1),
  lectureId: z.string().nullable().optional(),
  problems: z
    .array(
      z.object({
        question: z.string().min(1).max(2000),
        correctAnswer: z.string().min(1).max(2000),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable().optional(),
      })
    )
    .min(1)
    .max(30),
});

const addVideoArgs = z.object({
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(2000),
  subjectId: z.string().nullable().optional(),
  lectureId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const logClinicalArgs = z.object({
  date: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  hospital: z.string().max(200).nullable().optional(),
  department: z.string().max(200).nullable().optional(),
  casesSeen: z.number().int().min(0).max(500).nullable().optional(),
  skillsPracticed: z.string().max(2000).nullable().optional(),
  whatILearned: z.string().max(4000).nullable().optional(),
  whatIDidNotUnderstand: z.string().max(4000).nullable().optional(),
});

const readMyMaterialArgs = z.object({
  lectureId: z.string().min(1),
});

const fixItArgs = z.object({
  what: z.enum(["course", "lecture"]),
  id: z.string().min(1),
  newTitle: z.string().max(200).nullable().optional(),
  moveToSubjectId: z.string().nullable().optional(),
  moveToTopicId: z.string().nullable().optional(),
});

const createLectureArgs = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1).max(200),
  date: z.string().nullable().optional(),
  lecturer: z.string().max(120).nullable().optional(),
  quickNotes: z.string().max(4000).nullable().optional(),
  // Nullable as well as optional: nothing constrains the model's output any
  // more, so a field it has nothing to say about arrives as null about as
  // often as it is left out, and rejecting one of those spellings would fail
  // the whole call over a lecture that simply taught no new topics.
  topics: z.array(z.string().min(1).max(120)).max(20).nullable().optional(),
  /* Which of the course's topics this lecture belongs under. Before this the
     agent created topics and never attached a lecture to one, so every lecture
     it filed sat outside the topic tree the rest of the app organises by. */
  topicId: z.string().nullable().optional(),
});

const createFlashcardsArgs = z.object({
  subjectId: z.string().min(1),
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(500),
        back: z.string().min(1).max(2000),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
      })
    )
    .min(1)
    .max(MAX_FLASHCARDS),
});

const logMistakeArgs = z.object({
  subjectId: z.string().min(1),
  mistakeType: z.enum([
    "KNOWLEDGE_GAP",
    "MISUNDERSTANDING",
    "MEMORY_ERROR",
    "CARELESS_MISTAKE",
    "QUESTION_MISINTERPRETATION",
  ]),
  whyIGotItWrong: z.string().max(2000).nullable().optional(),
  correctConcept: z.string().max(2000).nullable().optional(),
  whatIShouldReview: z.string().max(2000).nullable().optional(),
});

const fileItArgs = z.object({
  title: z.string().min(1).max(200),
  subjectId: z.string().nullable().optional(),
});

const askStudentArgs = z.object({ question: z.string().min(1).max(300) });

const finishArgs = z.object({ summary: z.string().min(1).max(600) });

// --- Tool definitions ---------------------------------------------------

/**
 * A value the model may send as null when the content does not supply it.
 *
 * Written as `anyOf` rather than the more obvious `type: ["string", "null"]`,
 * which is correct JSON Schema and is not what this API accepts.
 */
function nullable(type: "string" | "integer" | "number" | "boolean", description?: string) {
  return {
    anyOf: [{ type }, { type: "null" }],
    ...(description ? { description } : {}),
  };
}

/**
 * Why these tools are not declared `strict: true`.
 *
 * Strict mode compiles every tool's schema into a decoder that constrains what
 * the model can emit, guaranteeing the arguments validate. It was the obvious
 * thing to reach for, and it cost two deploys to find out that eleven tools —
 * 41 properties, six enums, a nested array of objects — exceed what that
 * compiler will accept. The API's answer is a flat "Schema is too complex.",
 * which is a limit on the tool surface, not on any one schema, so there is no
 * single field to shrink.
 *
 * Dropping it costs nothing real, because strict was never the thing deciding
 * whether a write happened. Every executor parses its arguments with Zod
 * first, and Zod checks what a JSON Schema cannot: that "13:70" is not a time,
 * that a deadline parses to a date, that a subject id belongs to this student.
 * An argument that fails goes back to the model as an error it can act on —
 * the same path a rejected course id already takes, and one the tests cover.
 * So the guarantee strict offered was a weaker duplicate of a check that has
 * to exist regardless.
 *
 * `additionalProperties: false` and `required` stay. Unenforced now, they are
 * still the clearest way to tell the model what a well-formed call looks like.
 */

/**
 * The published surface, in the order the model reads it.
 *
 * Reading tools come first so that looking before writing is the path of least
 * resistance rather than an instruction that has to be enforced. Every schema
 * sets `additionalProperties: false` and lists every property in `required`,
 * which is what `strict: true` needs in order to guarantee the arguments
 * validate — with the nullable-union types doing the work that optional
 * properties would otherwise do.
 *
 * The descriptions are written for the model, and they are the real behaviour
 * specification of this feature: what a tool is *for*, and when not to reach
 * for it. A rule that lives only in the system prompt competes with everything
 * else in the prompt; a rule attached to the tool is read at the moment the
 * model is deciding whether to call that tool.
 */
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_courses",
    description:
      "Search the student's existing courses by name or code. Use this before creating a course, and whenever content mentions a course, so that an existing course is reused instead of duplicated. Matching is loose: search a distinctive word rather than the full title, and search again with a different word before concluding a course does not exist. A student writing in Arabic may have created the same course in English, or the other way round — try both when you can.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A distinctive word from the course name, or its code." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "whats_already_there",
    description:
      "Read what the student already has: their tasks and deadlines, the lectures they have recorded for a course, and the knowledge gaps they are already tracking. Call this before creating a task, a lecture or a gap, because the student may already have it and a second copy is worse than none — they then have to work out which of the two is real. It is also how you know where a lecture belongs in a sequence: if they have lectures 1 to 6 for a course, the slides you are reading are probably lecture 7, and numbering it 1 puts it at the start of their course. Pass a subjectId to see one course, a query to search titles across everything, or neither for what is coming up soon.",
    input_schema: {
      type: "object",
      properties: {
        subjectId: nullable("string", "A course id to look inside, or null for the whole account."),
        query: nullable("string", "A distinctive word to match against titles, or null."),
      },
      additionalProperties: false,
    },
  },
  {
    name: "read_my_marks",
    description:
      "Read what the student has drawn on a lecture's slides with their own pen and highlighter, inside this app. This is the single most valuable signal there is about what matters to THEM: a highlight means they singled something out, a pen stroke means they were working on it. Call this before making flashcards, questions or a summary for a lecture the student has been reading, so that what you make is about what they actually marked rather than about whatever the deck happened to say first. What comes back is the student's attention and nothing more — a mark is never evidence that the marked text is correct, complete, or important to anyone but them, and you must not present it as a fact of the lecture. Returns nothing at all when they have not marked that lecture, which is not an error.",
    input_schema: {
      type: "object",
      properties: {
        lectureId: { type: "string", description: "The lecture whose slides to read the student's marks from." },
      },
      required: ["lectureId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_course",
    description:
      "Create a course the student does not have yet. Only call this after search_courses has come back empty for that course. Use the course's name exactly as the dropped content writes it — this name becomes the real course in the student's account and they will see it everywhere. Never invent a course from a file name alone.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The course name, spelled as the content spells it." },
        code: nullable("string", "The course code if the content states one, else null."),
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "import_timetable",
    description:
      "Turn a university timetable into the student's actual week: this creates any missing courses, the recurring weekly commitments, and the next dated occurrence of each class. Call it ONCE with every class you can read, not once per class. Importing replaces any previous timetable import, so a re-drop corrects the week instead of duplicating it — this never touches anything the student entered by hand. Omit any row whose day or time you cannot actually read; a guessed lecture time becomes a real commitment and corrupts every calculation about their free time.",
    input_schema: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          description: "Every class you could read from the timetable.",
          items: {
            type: "object",
            properties: {
              courseName: { type: "string" },
              weekday: { type: "integer", description: "0 = Sunday, 1 = Monday … 6 = Saturday." },
              startTime: { type: "string", description: '24-hour "HH:MM".' },
              endTime: { type: "string", description: '24-hour "HH:MM".' },
              location: nullable("string", "Room or building, or null."),
              kind: { type: "string", enum: ["LECTURE", "LAB", "CLINICAL", "OTHER"] },
            },
            required: ["courseName", "weekday", "startTime", "endTime", "kind"],
            additionalProperties: false,
          },
        },
      },
      required: ["entries"],
      additionalProperties: false,
    },
  },
  {
    name: "create_task",
    description:
      "Before this, call whats_already_there — a duplicate deadline is worse than a missing one, because the student then has to work out which of the two is real. Record something the student has to do by a date — an assignment, an exam, a deadline. Only call this when the content actually states a date; never infer one. A task with no course attached is fine and often correct: 'my exam is Thursday' is a real deadline even with no course context. Set estimatedMinutes only when the content gives you a real basis for it.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        deadline: { type: "string", description: 'The stated date, as "YYYY-MM-DD".' },
        type: {
          type: "string",
          enum: ["ASSIGNMENT", "PROJECT", "EXAM", "QUIZ", "PRESENTATION", "READING", "OTHER"],
        },
        subjectId: nullable("string", "An id from search_courses, or null."),
        notes: nullable("string"),
        estimatedMinutes: nullable("integer"),
      },
      required: ["title", "deadline", "type"],
      additionalProperties: false,
    },
  },
  {
    name: "create_knowledge_gap",
    description:
      "Check whats_already_there first — the student may already be tracking this, and a second copy splits their attention between two entries for one thing. Record something the student does not understand yet, so it comes back to them later. Two things belong here: a question they asked, and a concept the content itself signals as difficult or foundational. Write the title as the thing to understand ('How beta blockers lower blood pressure'), not as a description of the file. Requires a course. Create one gap per distinct concept; do not bundle several into one.",
    input_schema: {
      type: "object",
      properties: {
        subjectId: { type: "string", description: "An id from search_courses or create_course." },
        title: { type: "string" },
        description: nullable("string"),
        difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
        source: {
          type: "string",
          enum: ["LECTURE", "CLINICAL_TRAINING", "VIDEO", "PROBLEM_SOLVING", "READING", "OTHER"],
        },
      },
      required: ["subjectId", "title", "difficulty", "source"],
      additionalProperties: false,
    },
  },
  {
    name: "create_lecture",
    description:
      "Call whats_already_there for this course first: the lecture number places this in a sequence, and a student who already has lectures 1 to 6 needs this one numbered 7, not 1. Record dropped teaching material as a lecture in a course, and attach the dropped file to it. Use this for slides, lecture notes, a recorded session's notes — material that teaches something. Put what it actually covers in quickNotes, in the content's own language, so the student can tell lectures apart without opening them. `topics` are the concepts it teaches; they become the course's topic list.",
    input_schema: {
      type: "object",
      properties: {
        subjectId: { type: "string" },
        title: { type: "string" },
        date: nullable("string", '"YYYY-MM-DD" if the content states one, else null.'),
        lecturer: nullable("string"),
        quickNotes: nullable("string", "What this lecture actually covers."),
        topics: { type: "array", items: { type: "string" }, description: "Concepts taught. May be empty." },
        topicId: nullable("string", "An existing topic id from whats_already_there, when this lecture belongs under one."),
      },
      required: ["subjectId", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "open_in_reader",
    description:
      "Make the dropped file readable. Call this straight after create_lecture when the drop was a PDF or an image of teaching material: it puts the file in the reading room, where the student can actually open it, zoom it, and write on it with a pen — and where anything they mark becomes something you can read back later with read_my_marks. Filing a lecture without this records that the file exists and leaves the student unable to open it. Only PDFs and images can be drawn on; anything else stays filed and is not lost.",
    input_schema: {
      type: "object",
      properties: {
        lectureId: { type: "string", description: "The id create_lecture returned." },
        title: nullable("string", "Defaults to the lecture's own title."),
      },
      required: ["lectureId"],
      additionalProperties: false,
    },
  },
  {
    name: "attach_resource",
    description:
      "Record something that belongs to a lecture the student already has, without creating a second lecture. Use this for a reading list, a link the content points at, a past paper that goes with a session. If the drop is itself the teaching material, use create_lecture instead — this is for the things around it.",
    input_schema: {
      type: "object",
      properties: {
        lectureId: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["PDF", "POWERPOINT", "VIDEO", "LINK", "NOTE"] },
        url: nullable("string", "Where it lives, if the content gives a link."),
      },
      required: ["lectureId", "title", "type"],
      additionalProperties: false,
    },
  },
  {
    name: "create_problems",
    description:
      "Record practice questions the content actually contains — a problem set, a past paper, tutorial questions, a worked example. Every question and answer must come from the content in front of you; never write questions from your own knowledge of the subject, because the student will practise these believing they came from their own material. If the content has no questions in it, do not call this.",
    input_schema: {
      type: "object",
      properties: {
        subjectId: { type: "string" },
        lectureId: nullable("string", "When these questions belong to one lecture."),
        problems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              correctAnswer: { type: "string", description: "Only what the content states. Do not supply one it does not." },
              difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
            },
            required: ["question", "correctAnswer"],
            additionalProperties: false,
          },
        },
      },
      required: ["subjectId", "problems"],
      additionalProperties: false,
    },
  },
  {
    name: "add_video",
    description:
      "Record a recorded lecture or a video the content points at, so it lands in the student's video library instead of being lost in a filed document. Use it when the drop is a link to a video, or when the material names one the student is meant to watch.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        url: { type: "string" },
        subjectId: nullable("string"),
        lectureId: nullable("string"),
        notes: nullable("string", "Why this is worth watching, in the content's own terms."),
      },
      required: ["title", "url"],
      additionalProperties: false,
    },
  },
  {
    name: "log_clinical",
    description:
      "Record a clinical shift or placement the drop describes — a logbook page, a photographed shift record, notes from a ward round. Only fields the content actually states; a shift whose length is not written down must be left null rather than guessed, because an invented duration is counted as real time in everything this app says about the student's week.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: '"YYYY-MM-DD".' },
        durationMinutes: nullable("integer", "Only if the content says how long."),
        hospital: nullable("string"),
        department: nullable("string"),
        casesSeen: nullable("integer"),
        skillsPracticed: nullable("string"),
        whatILearned: nullable("string"),
        whatIDidNotUnderstand: nullable("string"),
      },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    name: "read_my_material",
    description:
      "Read the text of a lecture the student already has. Use it before filing something that may continue, duplicate or correct earlier material — it is the difference between filing a second copy of last week's lecture and recognising it as the same one. Returns nothing if that lecture has no readable file yet.",
    input_schema: {
      type: "object",
      properties: {
        lectureId: { type: "string" },
      },
      required: ["lectureId"],
      additionalProperties: false,
    },
  },
  {
    name: "fix_it",
    description:
      "Correct something you got wrong earlier in this same drop: a course or lecture you named badly, or a lecture you put under the wrong course or topic. Use it instead of creating a second, better row — a duplicate is worse than a wrong name, because the student then has to work out which one is real. It will refuse to touch anything this drop did not create; the student's own records are not yours to rename.",
    input_schema: {
      type: "object",
      properties: {
        what: { type: "string", enum: ["course", "lecture"] },
        id: { type: "string" },
        newTitle: nullable("string"),
        moveToSubjectId: nullable("string", "Lectures only."),
        moveToTopicId: nullable("string", "Lectures only."),
      },
      required: ["what", "id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_flashcards",
    description:
      "Create review cards from material the student will need to recall. Only make cards from facts the content actually contains — never from your own knowledge of the subject, however correct it is, because the student will review these believing they came from their own material. A good card asks one thing and has one answer. If the content does not support real cards, do not make any.",
    input_schema: {
      type: "object",
      properties: {
        subjectId: { type: "string" },
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              front: { type: "string", description: "The question or prompt." },
              back: { type: "string", description: "The answer, from the content." },
              difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
            },
            required: ["front", "back", "difficulty"],
            additionalProperties: false,
          },
        },
      },
      required: ["subjectId", "cards"],
      additionalProperties: false,
    },
  },
  {
    name: "log_mistake",
    description:
      "Record a specific thing the student got wrong — a marked answer, a corrected exam question, a note saying they misunderstood something. Only when the content shows an actual mistake of theirs. Do not use it for a topic they merely find hard; that is a knowledge gap.",
    input_schema: {
      type: "object",
      properties: {
        subjectId: { type: "string" },
        mistakeType: {
          type: "string",
          enum: [
            "KNOWLEDGE_GAP",
            "MISUNDERSTANDING",
            "MEMORY_ERROR",
            "CARELESS_MISTAKE",
            "QUESTION_MISINTERPRETATION",
          ],
        },
        whyIGotItWrong: nullable("string"),
        correctConcept: nullable("string"),
        whatIShouldReview: nullable("string"),
      },
      required: ["subjectId", "mistakeType"],
      additionalProperties: false,
    },
  },
  {
    name: "file_it",
    description:
      "Keep the item under a course without creating anything else. The right answer when the content is worth having but carries no date, no question and nothing to learn — a syllabus, an announcement, a personal note. Filing something is a real outcome, not a failure to classify.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "A short name for the item, in its own language." },
        subjectId: nullable("string"),
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_student",
    description:
      "Ask the student one short question, and stop. Use this only when you genuinely cannot proceed without their answer and a wrong guess would create something real and wrong in their account. Ask about their intent, never about something you could read for yourself. One question, answerable in a few words. Anything you can decide, decide.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "In the same language as the dropped content." },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description:
      "End the run and tell the student what you did, in one or two sentences, in the same language as the content they dropped. Describe only what your tool calls actually did. Call this exactly once, as your last action.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "What you did, in the student's language." },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
];

// --- Executors ----------------------------------------------------------

/**
 * What the student marked, in their own hand, on one lecture.
 *
 * The lecture id comes from the model, so it is checked rather than trusted:
 * `readAnnotationNote` scopes its query by the student as well as the lecture,
 * and a lecture belonging to somebody else simply has no marks as far as this
 * is concerned. There is no ownership error to report because there is no
 * distinction to leak — "you have not marked that lecture" is the same answer
 * for a lecture that is not theirs and one they have not drawn on.
 *
 * Read-only, so no action is logged and nothing is written. An empty result is
 * a normal outcome, said plainly, so the agent moves on instead of retrying.
 */
async function readMyMarks(ctx: AgentContext, rawInput: unknown): Promise<ToolOutcome> {
  const parsed = z.object({ lectureId: z.string().min(1).max(40) }).safeParse(rawInput);
  if (!parsed.success) return { result: "read_my_marks needs a lectureId." };

  const note = await readAnnotationNote(ctx.userId, parsed.data.lectureId, downloadDocumentFileAsService);
  if (!note) {
    return {
      result:
        "The student has not marked anything on that lecture's slides. Work from the lecture itself.",
    };
  }
  return { result: note };
}


/**
 * Runs one tool call.
 *
 * Every failure returns a message to the model rather than throwing, because
 * a tool that fails is information the agent can act on — it can search again,
 * pick a different course, or give up honestly — while an exception ends the
 * run and loses whatever it had already done correctly. The one thing that
 * never happens on a failure is an entry in the action log.
 */
export async function executeTool(
  ctx: AgentContext,
  name: string,
  rawInput: unknown
): Promise<ToolOutcome> {
  switch (name) {
    case "search_courses":
      return searchCourses(ctx, rawInput);
    case "whats_already_there":
      return whatsAlreadyThere(ctx, rawInput);
    case "read_my_marks":
      return readMyMarks(ctx, rawInput);
    case "create_course":
      return createCourse(ctx, rawInput);
    case "import_timetable":
      return importTimetable(ctx, rawInput);
    case "create_task":
      return createTask(ctx, rawInput);
    case "create_knowledge_gap":
      return createKnowledgeGap(ctx, rawInput);
    case "create_lecture":
      return createLecture(ctx, rawInput);
    case "create_flashcards":
      return createFlashcards(ctx, rawInput);
    case "open_in_reader":
      return openInReader(ctx, rawInput);
    case "attach_resource":
      return attachResource(ctx, rawInput);
    case "create_problems":
      return createProblems(ctx, rawInput);
    case "add_video":
      return addVideo(ctx, rawInput);
    case "log_clinical":
      return logClinical(ctx, rawInput);
    case "read_my_material":
      return readMyMaterial(ctx, rawInput);
    case "fix_it":
      return fixIt(ctx, rawInput);
    case "log_mistake":
      return logMistake(ctx, rawInput);
    case "file_it":
      return fileIt(ctx, rawInput);
    case "ask_student": {
      const args = askStudentArgs.safeParse(rawInput);
      if (!args.success) return { result: "A question is required." };
      return { result: "Asked the student. Stopping here.", question: args.data.question };
    }
    case "finish": {
      const args = finishArgs.safeParse(rawInput);
      if (!args.success) return { result: "A summary is required." };
      return { result: args.data.summary, finished: true };
    }
    default:
      return { result: `There is no tool called ${name}.` };
  }
}

async function searchCourses(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = searchCoursesArgs.safeParse(raw);
  if (!args.success) return { result: "query is required." };

  /* The model searches with the words the student used, and the student's
     words are typed letters. Course names can carry presentation forms too —
     a name the agent itself filed from a PDF title. Normalising the query is
     the cheap half of making both sides meet; see normalizeArabicText. */
  const q = normalizeArabicText(args.data.query.trim());
  const matches = await prisma.subject.findMany({
    where: {
      userId: ctx.userId,
      status: { not: "ARCHIVED" },
      OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
    },
    select: { id: true, name: true, code: true },
    take: 10,
    orderBy: { name: "asc" },
  });

  if (matches.length === 0) {
    // Naming the alternative matters: without it a single empty search reads
    // as proof the course does not exist, and the next call creates a
    // duplicate of a course the student already has under another spelling.
    return {
      result: `No course matches "${q}". Try another distinctive word, or the other language, before creating a new course.`,
    };
  }

  return {
    result: matches
      .map((s) => `id: ${s.id} | name: ${s.name}${s.code ? ` | code: ${s.code}` : ""}`)
      .join("\n"),
  };
}

/**
 * What the student already has, so the agent stops writing things twice.
 *
 * Until this existed the agent knew the student's course list and five recent
 * summaries — nothing about their actual records. So it could not tell that a
 * deadline it was about to create was already there under a slightly different
 * title, and it could not tell that the slides it was reading were the seventh
 * lecture of a course rather than the first. Both mistakes are quiet: the
 * student finds a duplicate deadline weeks later, or a course whose lectures
 * are numbered in the wrong order.
 *
 * Everything is filtered by `ctx.userId`, which never comes from the model.
 * Tasks join through their own userId; lectures and gaps have none of their own
 * and are reached through the course, so the course's ownership is what is
 * checked.
 */
async function whatsAlreadyThere(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = whatsThereArgs.safeParse(raw);
  if (!args.success) return { result: "subjectId and query are both optional, but must be strings when given." };

  const q = normalizeArabicText(args.data.query?.trim() ?? "") || null;

  // A course id from the model is a claim about ownership until this passes.
  let subject: { id: string; name: string } | null = null;
  if (args.data.subjectId) {
    subject = await prisma.subject.findFirst({
      where: { id: args.data.subjectId, userId: ctx.userId },
      select: { id: true, name: true },
    });
    if (!subject) return { result: "That course id does not belong to this student. Use whats_already_there with no subjectId, or search_courses." };
  }

  const titleMatch = q ? { contains: q, mode: "insensitive" as const } : undefined;
  const courseScope = subject ? { subjectId: subject.id } : {};

  const [tasks, lectures, gaps, classes] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: ctx.userId,
        status: { not: "COMPLETED" },
        ...courseScope,
        ...(titleMatch ? { title: titleMatch } : {}),
      },
      select: { title: true, deadline: true, type: true, subject: { select: { name: true } } },
      orderBy: { deadline: "asc" },
      take: 15,
    }),
    prisma.lecture.findMany({
      where: {
        subject: { userId: ctx.userId },
        ...courseScope,
        ...(titleMatch ? { title: titleMatch } : {}),
      },
      select: { title: true, lectureNumber: true, date: true, subject: { select: { name: true } } },
      // Descending, so a course with forty lectures still shows the latest —
      // which is the number the next one follows from.
      orderBy: { lectureNumber: "desc" },
      take: 12,
    }),
    prisma.knowledgeGap.findMany({
      where: {
        subject: { userId: ctx.userId },
        status: { not: "MASTERED" },
        ...courseScope,
        ...(titleMatch ? { title: titleMatch } : {}),
      },
      select: { title: true, subject: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    // Only when looking at the whole account: the week's shape is context for
    // deciding when something is due, and it is noise inside one course.
    subject
      ? Promise.resolve([])
      : prisma.scheduleEvent.findMany({
          // The two types the timetable importer writes. There is no CLASS
          // type — a class is a LECTURE or a CLINICAL, and asking for one that
          // does not exist would silently return an empty week.
          where: {
            userId: ctx.userId,
            type: { in: ["LECTURE", "CLINICAL"] },
            startsAt: { gte: new Date() },
          },
          select: { title: true, startsAt: true },
          orderBy: { startsAt: "asc" },
          take: 10,
        }),
  ]);

  const day = (d: Date) => d.toISOString().slice(0, 10);
  const lines: string[] = [];

  if (subject) lines.push(`Inside course: ${subject.name}`);
  if (q) lines.push(`Titles matching "${q}":`);

  lines.push(
    tasks.length > 0
      ? `TASKS AND DEADLINES:\n${tasks
          .map((t) => `- ${t.title} | due ${day(t.deadline)} | ${t.type}${t.subject ? ` | ${t.subject.name}` : ""}`)
          .join("\n")}`
      : "TASKS AND DEADLINES: none."
  );

  lines.push(
    lectures.length > 0
      ? `LECTURES ALREADY RECORDED (highest number first — the next one follows it):\n${lectures
          .map((l) => `- ${l.lectureNumber}. ${l.title} | ${day(l.date)} | ${l.subject.name}`)
          .join("\n")}`
      : "LECTURES ALREADY RECORDED: none."
  );

  lines.push(
    gaps.length > 0
      ? `THINGS THEY ALREADY SAID THEY DO NOT UNDERSTAND:\n${gaps
          .map((g) => `- ${g.title} | ${g.subject.name}`)
          .join("\n")}`
      : "THINGS THEY ALREADY SAID THEY DO NOT UNDERSTAND: none."
  );

  if (classes.length > 0) {
    lines.push(
      `THEIR NEXT CLASSES:\n${classes
        .map((c) => `- ${c.title} | ${c.startsAt.toISOString().slice(0, 16).replace("T", " ")}`)
        .join("\n")}`
    );
  }

  return { result: lines.join("\n\n") };
}

async function createCourse(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = createCourseArgs.safeParse(raw);
  if (!args.success) return { result: "A course name is required." };

  const name = args.data.name.trim();

  // Belt and braces against the duplicate this tool exists to avoid: the model
  // may have skipped the search, or the student may have created the course by
  // hand since. An exact-name match is returned as a success, because from the
  // agent's point of view the course now exists either way.
  const existing = await prisma.subject.findFirst({
    where: { userId: ctx.userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) {
    return { result: `That course already exists — id: ${existing.id} | name: ${existing.name}` };
  }

  const created = await prisma.subject.create({
    data: {
      userId: ctx.userId,
      semesterId: await ensureSemester(ctx),
      name,
      code: args.data.code?.trim() || null,
      // Stamped with the drop that made it, so "undo this drop" is one
      // predicate per table rather than a log that has to be complete to be
      // trusted. Anything the student writes themselves leaves this null and is
      // therefore untouchable by undo.
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, name: true },
  });

  return {
    result: `Created — id: ${created.id} | name: ${created.name}`,
    action: { kind: "COURSE", id: created.id, name: created.name },
  };
}

/**
 * How many classes make an import worth stopping for.
 *
 * Below this it is a correction or an addition — one or two rows, visible in the
 * calendar immediately, undoable on their own. At or above it, one photograph is
 * about to become the student's whole week, and every calculation this app makes
 * about their time will rest on it.
 */
const HOLD_TIMETABLE_AT = 4;

/**
 * Reads a timetable and either writes it or holds it for confirmation.
 *
 * Holding is not a form. The student is shown the week that was read and asked
 * one question — is this right? — which is the opposite of being asked to enter
 * it. And it is only this tool: it is the one call that turns a single photo into
 * dozens of rows, the one that replaces what a previous import claimed, and the
 * one whose mistakes propagate into every judgement about how much free time
 * they have. Holding everything would rebuild the filing work this feature
 * exists to remove.
 */
async function importTimetable(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = importTimetableArgs.safeParse(raw);
  if (!args.success) return { result: "entries must be a non-empty list of readable classes." };

  if (ctx.holdBigTimetables && args.data.entries.length >= HOLD_TIMETABLE_AT) {
    await prisma.captureItem.update({
      where: { id: ctx.captureId },
      data: { pendingWrites: { kind: "TIMETABLE", entries: args.data.entries } as Prisma.InputJsonValue },
    });

    // No action is reported, because none happened. The whole design rests on
    // the action log describing only rows that exist, and a held proposal is
    // precisely a row that does not.
    return {
      result: `Held ${args.data.entries.length} classes for the student to confirm before they go into their week. Do not call import_timetable again for this item, and say in your summary that the week is waiting for them to check.`,
    };
  }

  return applyTimetable(ctx, args.data.entries);
}

/** The write itself, shared by the immediate path and the confirmed one. */
export async function applyTimetable(
  ctx: AgentContext,
  entries: z.infer<typeof importTimetableArgs>["entries"]
): Promise<ToolOutcome> {
  const semesterId = await ensureSemester(ctx);

  // A timetable states the whole week, so importing one replaces what a
  // previous import claimed rather than adding to it. Only rows carrying a
  // source capture are cleared — anything hand-entered is never touched — and
  // occurrences that have already happened are kept, since a new photo of next
  // term's timetable is not a reason to erase a class that took place.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [removedCommitments, removedEvents] = await prisma.$transaction([
    prisma.timeCommitment.deleteMany({ where: { userId: ctx.userId, sourceCaptureId: { not: null } } }),
    prisma.scheduleEvent.deleteMany({
      where: { userId: ctx.userId, source: "TIMETABLE_IMPORT", startsAt: { gte: startOfToday } },
    }),
  ]);

  const existing = await prisma.subject.findMany({
    where: { userId: ctx.userId },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s.id]));

  let coursesCreated = 0;
  let classesAdded = 0;
  let skipped = 0;
  const now = new Date();

  for (const entry of entries) {
    const startMinute = minuteOfDay(entry.startTime);
    const endMinute = minuteOfDay(entry.endTime);

    // A block that does not move forward in time is not a class.
    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      skipped += 1;
      continue;
    }

    const courseName = entry.courseName.trim();
    const key = courseName.toLowerCase();
    let subjectId = byName.get(key);
    if (!subjectId) {
      const created = await prisma.subject.create({
        data: { userId: ctx.userId, semesterId, name: courseName, sourceCaptureId: ctx.captureId },
        select: { id: true },
      });
      subjectId = created.id;
      byName.set(key, subjectId);
      coursesCreated += 1;
    }

    await prisma.timeCommitment.create({
      data: {
        userId: ctx.userId,
        kind: entry.kind === "CLINICAL" ? "CLINICAL" : "UNIVERSITY",
        label: courseName,
        weekday: entry.weekday,
        startMinute,
        endMinute,
        subjectId,
        sourceCaptureId: ctx.captureId,
      },
    });

    const day = nextDateForWeekday(now, entry.weekday);
    const startsAt = new Date(day);
    startsAt.setMinutes(startMinute);
    const endsAt = new Date(day);
    endsAt.setMinutes(endMinute);

    await prisma.scheduleEvent.create({
      data: {
        userId: ctx.userId,
        title: courseName,
        type: entry.kind === "CLINICAL" ? "CLINICAL" : "LECTURE",
        startsAt,
        endsAt,
        location: entry.location ?? null,
        source: "TIMETABLE_IMPORT",
        sourceCaptureId: ctx.captureId,
        subjectId,
      },
    });
    classesAdded += 1;
  }

  if (classesAdded === 0) {
    return { result: "None of those rows had a readable day and time, so nothing was added." };
  }

  return {
    result: `Added ${classesAdded} classes across ${byName.size} courses (${coursesCreated} newly created, ${skipped} unreadable rows skipped).`,
    action: {
      kind: "TIMETABLE",
      coursesCreated,
      classesAdded,
      skipped,
      replaced: removedCommitments.count + removedEvents.count,
    },
  };
}

async function createTask(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = createTaskArgs.safeParse(raw);
  if (!args.success) return { result: "A task needs a title, a deadline and a type." };

  const deadline = parseDate(args.data.deadline);
  if (!deadline) return { result: `"${args.data.deadline}" is not a date I can store. Use YYYY-MM-DD.` };

  let subject: { id: string; name: string } | null = null;
  if (args.data.subjectId) {
    try {
      subject = await resolveSubject(ctx, args.data.subjectId);
    } catch {
      return { result: "That course id is not one of this student's courses. Use search_courses." };
    }
  }

  // The same assignment photographed twice is the ordinary case, not an edge
  // case — a blurry first attempt, or a re-drop after nothing appeared to
  // happen. Matching on title and day rather than on the whole row is what
  // catches it, since the second read is rarely character-identical.
  const dayStart = new Date(deadline);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const duplicate = await prisma.task.findFirst({
    where: {
      userId: ctx.userId,
      title: { equals: args.data.title.trim(), mode: "insensitive" },
      deadline: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { result: "That task already exists with the same deadline — nothing added." };
  }

  const created = await prisma.task.create({
    data: {
      userId: ctx.userId,
      subjectId: subject?.id ?? null,
      title: args.data.title.trim(),
      description: args.data.notes?.trim() || null,
      type: args.data.type,
      deadline,
      estimatedMinutes: args.data.estimatedMinutes ?? null,
      // Stamped with the drop that made it, so "undo this drop" is one
      // predicate per table rather than a log that has to be complete to be
      // trusted. Anything the student writes themselves leaves this null and is
      // therefore untouchable by undo.
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, title: true },
  });

  return {
    result: `Created task ${created.id}.`,
    action: {
      kind: "TASK",
      id: created.id,
      title: created.title,
      deadline: deadline.toISOString(),
      subjectName: subject?.name ?? null,
    },
  };
}

async function createKnowledgeGap(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = createGapArgs.safeParse(raw);
  if (!args.success) return { result: "A knowledge gap needs a course, a title, a difficulty and a source." };

  let subject: { id: string; name: string };
  try {
    subject = await resolveSubject(ctx, args.data.subjectId);
  } catch {
    return { result: "That course id is not one of this student's courses. Use search_courses." };
  }

  const title = args.data.title.trim();

  // An unresolved gap the student already has is the same gap. Re-creating it
  // would inflate the count on a page whose whole purpose is to show how much
  // is genuinely outstanding.
  const duplicate = await prisma.knowledgeGap.findFirst({
    where: {
      subjectId: subject.id,
      title: { equals: title, mode: "insensitive" },
      status: { not: "MASTERED" },
    },
    select: { id: true },
  });
  if (duplicate) return { result: "That gap is already open for this course — nothing added." };

  const created = await prisma.knowledgeGap.create({
    data: {
      subjectId: subject.id,
      title,
      description: args.data.description?.trim() || null,
      difficulty: args.data.difficulty,
      source: args.data.source,
      // Stamped with the drop that made it, so "undo this drop" is one
      // predicate per table rather than a log that has to be complete to be
      // trusted. Anything the student writes themselves leaves this null and is
      // therefore untouchable by undo.
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, title: true },
  });

  return {
    result: `Created knowledge gap ${created.id}.`,
    action: { kind: "GAP", id: created.id, title: created.title, subjectName: subject.name },
  };
}

async function createLecture(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = createLectureArgs.safeParse(raw);
  if (!args.success) return { result: "A lecture needs a course and a title." };

  let subject: { id: string; name: string };
  try {
    subject = await resolveSubject(ctx, args.data.subjectId);
  } catch {
    return { result: "That course id is not one of this student's courses. Use search_courses." };
  }

  // Lectures are numbered per course, and the number is the student's own
  // sequence — so it is counted from what they have, never asked of the model.
  const existingCount = await prisma.lecture.count({ where: { subjectId: subject.id } });

  /* Which topic this lecture sits under, verified against THIS course.
     Before this the agent created topics and attached a lecture to none of
     them, so every lecture it filed sat outside the tree the rest of the app
     organises by — right table, wrong place. A topic id belonging to another
     course is dropped rather than failing the call: an unfiled lecture is
     recoverable, a lecture filed under someone else's heading is confusing in
     a way nobody goes looking for. */
  let topicId: string | null = null;
  if (args.data.topicId) {
    const topic = await prisma.topic.findFirst({
      where: { id: args.data.topicId, subjectId: subject.id, subject: { userId: ctx.userId } },
      select: { id: true },
    });
    topicId = topic?.id ?? null;
  }

  const created = await prisma.lecture.create({
    data: {
      subjectId: subject.id,
      topicId,
      title: args.data.title.trim(),
      lectureNumber: existingCount + 1,
      date: (args.data.date ? parseDate(args.data.date) : null) ?? new Date(),
      lecturer: args.data.lecturer?.trim() || null,
      quickNotes: args.data.quickNotes?.trim() || null,
      // Stamped with the drop that made it, so "undo this drop" is one
      // predicate per table rather than a log that has to be complete to be
      // trusted. Anything the student writes themselves leaves this null and is
      // therefore untouchable by undo.
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, title: true },
  });

  // Topics are the course's vocabulary, so they are reused across lectures
  // rather than duplicated per lecture.
  for (const name of args.data.topics ?? []) {
    const topicName = name.trim();
    if (!topicName) continue;
    const existing = await prisma.topic.findFirst({
      where: { subjectId: subject.id, name: { equals: topicName, mode: "insensitive" } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.topic.create({ data: { subjectId: subject.id, name: topicName } });
    }
  }

  // The dropped file becomes this lecture's material, which is the point of
  // recording it as a lecture at all.
  const capture = await prisma.captureItem.findFirst({
    where: { id: ctx.captureId, userId: ctx.userId },
    select: { documentId: true },
  });
  if (capture?.documentId) {
    await prisma.document.updateMany({
      where: { id: capture.documentId, userId: ctx.userId },
      data: { subjectId: subject.id, lectureId: created.id },
    });
  }

  return {
    result: `Created lecture ${created.id}.`,
    action: { kind: "LECTURE", id: created.id, title: created.title, subjectName: subject.name },
  };
}

/**
 * The course, or null — a course id from the model is a claim about ownership
 * until this passes. `verifySubject` throws and returns nothing, so the tools
 * that need the row itself look it up the way whats_already_there does.
 */
async function ownedSubject(userId: string, subjectId: string) {
  return prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true, name: true } });
}

/**
 * The dropped file becomes something the student can open and write on.
 *
 * Until this existed the agent could file a lecture perfectly — right course,
 * right number, file linked — and the student still could not read it, because
 * the reading room draws from LectureSlide and nothing the agent could do
 * created one. Measured on the live database at the time: 34 lectures, 3 of
 * them openable.
 *
 * Reuses the row the drop already made rather than re-uploading: the file is
 * in Storage and `Document` points at it, so this is one insert.
 */
async function openInReader(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = openInReaderArgs.safeParse(raw);
  if (!args.success) return { result: "A lectureId is required." };

  const lecture = await prisma.lecture.findFirst({
    where: { id: args.data.lectureId, subject: { userId: ctx.userId } },
    select: { id: true, title: true },
  });
  if (!lecture) return { result: "That lecture id is not one of this student's lectures." };

  const capture = await prisma.captureItem.findFirst({
    where: { id: ctx.captureId, userId: ctx.userId },
    select: { documentId: true },
  });
  const document = capture?.documentId
    ? await prisma.document.findFirst({
        where: { id: capture.documentId, userId: ctx.userId },
        select: { id: true, storagePath: true, mimeType: true, originalName: true, pageCount: true },
      })
    : null;
  if (!document) return { result: "This drop has no file to open — nothing to do." };

  /* The same rule the student's own upload path uses, from one module, so the
     two cannot drift into one accepting a file the viewer cannot draw. */
  const fileType = annotatableType(document.mimeType, document.originalName);
  if (!fileType) {
    return {
      result:
        "This file is not one the reader can draw — it stays filed and readable as text, but cannot be marked with the pen.",
    };
  }

  const existing = await prisma.lectureSlide.findFirst({
    where: { lectureId: lecture.id, documentId: document.id },
    select: { id: true },
  });
  if (existing) return { result: `That file is already open in the reader (${existing.id}).` };

  const created = await prisma.lectureSlide.create({
    data: {
      lectureId: lecture.id,
      documentId: document.id,
      title: args.data.title?.trim() || lecture.title,
      fileUrl: document.storagePath,
      fileType,
      /* One, not the real count. The viewer writes the true number the first
         time the deck is opened (setSlidePageCount); counting here would mean
         downloading and parsing the file a second time. */
      pageCount: document.pageCount ?? 1,
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, title: true },
  });

  return {
    result: `Opened in the reader as ${created.id}. The student can now read and mark it.`,
    action: { kind: "READABLE", id: created.id, title: created.title, lectureTitle: lecture.title },
  };
}

/** Something that belongs beside a lecture, without inventing a second lecture. */
async function attachResource(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = attachResourceArgs.safeParse(raw);
  if (!args.success) return { result: "A lectureId, a title and a type are required." };

  const lecture = await prisma.lecture.findFirst({
    where: { id: args.data.lectureId, subject: { userId: ctx.userId } },
    select: { id: true, title: true },
  });
  if (!lecture) return { result: "That lecture id is not one of this student's lectures." };

  const created = await prisma.lectureResource.create({
    data: {
      lectureId: lecture.id,
      type: args.data.type,
      title: args.data.title.trim(),
      url: args.data.url?.trim() || null,
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, title: true },
  });

  return {
    result: `Attached ${created.id} to that lecture.`,
    action: { kind: "RESOURCE", id: created.id, title: created.title, lectureTitle: lecture.title },
  };
}

/** Practice questions the content actually contains. */
async function createProblems(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = createProblemArgs.safeParse(raw);
  if (!args.success) return { result: "A course and at least one question are required." };

  const subject = await ownedSubject(ctx.userId, args.data.subjectId);
  if (!subject) return { result: "That course id is not one of this student's courses. Use search_courses." };

  /* A lecture id is a claim about where this belongs, and an unverified one
     would quietly file a student's questions under someone else's lecture.
     Wrong ids drop the link rather than failing the call — the questions are
     still worth having. */
  let lectureId: string | null = null;
  if (args.data.lectureId) {
    const lecture = await prisma.lecture.findFirst({
      where: { id: args.data.lectureId, subjectId: subject.id, subject: { userId: ctx.userId } },
      select: { id: true },
    });
    lectureId = lecture?.id ?? null;
  }

  const rows = args.data.problems.map((problem) => ({
    userId: ctx.userId,
    subjectId: subject.id,
    lectureId,
    question: problem.question.trim(),
    correctAnswer: problem.correctAnswer.trim(),
    difficulty: problem.difficulty ?? ("MEDIUM" as const),
    sourceCaptureId: ctx.captureId,
  }));

  await prisma.problem.createMany({ data: rows });

  return {
    result: `Created ${rows.length} practice question(s).`,
    action: { kind: "PROBLEMS", count: rows.length, subjectName: subject.name },
  };
}

/** A recorded lecture or a video the material points at. */
async function addVideo(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = addVideoArgs.safeParse(raw);
  if (!args.success) return { result: "A title and a url are required." };

  let subjectId: string | null = null;
  if (args.data.subjectId) {
    const subject = await ownedSubject(ctx.userId, args.data.subjectId);
    subjectId = subject?.id ?? null;
  }

  let lectureId: string | null = null;
  if (args.data.lectureId) {
    const lecture = await prisma.lecture.findFirst({
      where: { id: args.data.lectureId, subject: { userId: ctx.userId } },
      select: { id: true, subjectId: true },
    });
    lectureId = lecture?.id ?? null;
    // A lecture settles which course this is for, whatever the model said.
    if (lecture) subjectId = lecture.subjectId;
  }

  const url = args.data.url.trim();
  const platform = /youtube\.com|youtu\.be/i.test(url)
    ? ("YOUTUBE" as const)
    : /vimeo\.com/i.test(url)
      ? ("VIMEO" as const)
      : ("OTHER" as const);

  const created = await prisma.video.create({
    data: {
      userId: ctx.userId,
      subjectId,
      lectureId,
      title: args.data.title.trim(),
      url,
      platform,
      notes: args.data.notes?.trim() || null,
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, title: true },
  });

  return {
    result: `Added video ${created.id} to the library.`,
    action: { kind: "VIDEO", id: created.id, title: created.title },
  };
}

/** A clinical shift, recorded only as far as the content actually states it. */
async function logClinical(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = logClinicalArgs.safeParse(raw);
  if (!args.success) return { result: "A date is required." };

  const date = parseDate(args.data.date);
  if (!date) return { result: "That date could not be read. Use YYYY-MM-DD." };

  const created = await prisma.clinicalTraining.create({
    data: {
      userId: ctx.userId,
      date,
      /* Null, never zero, when the content does not say. A shift recorded as
         zero minutes is counted as a day that cost the student no time, and
         every judgement this app makes about their week is built on that
         number. */
      durationMinutes: args.data.durationMinutes ?? null,
      hospital: args.data.hospital?.trim() || null,
      department: args.data.department?.trim() || null,
      casesSeen: args.data.casesSeen ?? 0,
      skillsPracticed: args.data.skillsPracticed?.trim() || null,
      whatILearned: args.data.whatILearned?.trim() || null,
      whatIDidNotUnderstand: args.data.whatIDidNotUnderstand?.trim() || null,
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true, date: true },
  });

  return {
    result: `Logged the clinical session on ${created.date.toISOString().slice(0, 10)}.`,
    action: { kind: "CLINICAL", id: created.id, date: created.date.toISOString().slice(0, 10) },
  };
}

/**
 * Reading back what the student already has.
 *
 * Every run used to start blind: the agent could see the titles of earlier
 * lectures and never a word of their contents, so it had no way to notice that
 * the file in front of it continues, duplicates or corrects one of them.
 *
 * Truncated, and the number is a judgement rather than a limit of the format:
 * a whole second lecture in the context would double the cost of every
 * remaining step of this run, and the question being asked — is this the same
 * material? — is answered by the opening far more often than by the end.
 */
const MATERIAL_EXCERPT_CHARS = 4000;

async function readMyMaterial(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = readMyMaterialArgs.safeParse(raw);
  if (!args.success) return { result: "A lectureId is required." };

  const lecture = await prisma.lecture.findFirst({
    where: { id: args.data.lectureId, subject: { userId: ctx.userId } },
    select: { id: true, title: true },
  });
  if (!lecture) return { result: "That lecture id is not one of this student's lectures." };

  const document = await prisma.document.findFirst({
    where: { lectureId: lecture.id, userId: ctx.userId, extractedText: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { extractedText: true },
  });

  const text = document?.extractedText?.trim();
  if (!text) return { result: `"${lecture.title}" has no readable text stored yet.` };

  const excerpt = text.length > MATERIAL_EXCERPT_CHARS ? `${text.slice(0, MATERIAL_EXCERPT_CHARS)}…` : text;
  return { result: `"${lecture.title}" begins:\n\n${excerpt}` };
}

/**
 * Correcting this run's own work.
 *
 * The agent could only ever add. A course it named badly or a lecture it put
 * under the wrong heading could not be fixed, only duplicated — and a
 * duplicate is worse than a wrong name, because the student then has to work
 * out which of the two is the real one.
 *
 * Scoped to `sourceCaptureId` and not merely to the student, which is the
 * whole safety of it: this can touch what this drop created and nothing else.
 * A model that confidently renames the student's own course is a model that
 * gets taken away from them.
 */
async function fixIt(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = fixItArgs.safeParse(raw);
  if (!args.success) return { result: "Say what to fix and which id." };

  const title = args.data.newTitle?.trim() || null;

  if (args.data.what === "course") {
    if (!title) return { result: "A course can only be renamed here. Give newTitle." };
    const { count } = await prisma.subject.updateMany({
      where: { id: args.data.id, userId: ctx.userId, sourceCaptureId: ctx.captureId },
      data: { name: title },
    });
    return count === 0
      ? { result: "That course was not created by this drop, so it is not yours to rename." }
      : { result: `Renamed the course to "${title}".` };
  }

  const owned = await prisma.lecture.findFirst({
    where: { id: args.data.id, sourceCaptureId: ctx.captureId, subject: { userId: ctx.userId } },
    select: { id: true, subjectId: true },
  });
  if (!owned) return { result: "That lecture was not created by this drop, so it is not yours to change." };

  const data: { title?: string; subjectId?: string; topicId?: string } = {};
  if (title) data.title = title;

  let subjectId = owned.subjectId;
  if (args.data.moveToSubjectId) {
    const subject = await ownedSubject(ctx.userId, args.data.moveToSubjectId);
    if (!subject) return { result: "That course id is not one of this student's courses." };
    data.subjectId = subject.id;
    subjectId = subject.id;
  }

  if (args.data.moveToTopicId) {
    /* Checked against the course the lecture will be in after this call, not
       the one it is in now — moving both at once must not leave a lecture
       pointing at a topic belonging to the course it just left. */
    const topic = await prisma.topic.findFirst({
      where: { id: args.data.moveToTopicId, subjectId, subject: { userId: ctx.userId } },
      select: { id: true },
    });
    if (!topic) return { result: "That topic does not belong to the course this lecture is in." };
    data.topicId = topic.id;
  }

  if (Object.keys(data).length === 0) return { result: "Nothing to change." };

  await prisma.lecture.update({ where: { id: owned.id }, data });
  return { result: "Fixed it." };
}

async function createFlashcards(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = createFlashcardsArgs.safeParse(raw);
  if (!args.success) return { result: "Flashcards need a course and at least one card." };

  let subject: { id: string; name: string };
  try {
    subject = await resolveSubject(ctx, args.data.subjectId);
  } catch {
    return { result: "That course id is not one of this student's courses. Use search_courses." };
  }

  const created = await prisma.flashcard.createMany({
    data: args.data.cards.map((card) => ({
      userId: ctx.userId,
      subjectId: subject.id,
      front: card.front.trim(),
      back: card.back.trim(),
      difficulty: card.difficulty,
      sourceCaptureId: ctx.captureId,
    })),
  });

  if (created.count === 0) return { result: "No cards were created." };

  return {
    result: `Created ${created.count} flashcards.`,
    action: { kind: "FLASHCARDS", count: created.count, subjectName: subject.name },
  };
}

async function logMistake(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = logMistakeArgs.safeParse(raw);
  if (!args.success) return { result: "A mistake needs a course and a mistake type." };

  let subject: { id: string; name: string };
  try {
    subject = await resolveSubject(ctx, args.data.subjectId);
  } catch {
    return { result: "That course id is not one of this student's courses. Use search_courses." };
  }

  const created = await prisma.mistake.create({
    data: {
      userId: ctx.userId,
      subjectId: subject.id,
      mistakeType: args.data.mistakeType,
      whyIGotItWrong: args.data.whyIGotItWrong?.trim() || null,
      correctConcept: args.data.correctConcept?.trim() || null,
      whatIShouldReview: args.data.whatIShouldReview?.trim() || null,
      // Stamped with the drop that made it, so "undo this drop" is one
      // predicate per table rather than a log that has to be complete to be
      // trusted. Anything the student writes themselves leaves this null and is
      // therefore untouchable by undo.
      sourceCaptureId: ctx.captureId,
    },
    select: { id: true },
  });

  return {
    result: `Logged mistake ${created.id}.`,
    action: { kind: "MISTAKE", id: created.id, subjectName: subject.name },
  };
}

async function fileIt(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = fileItArgs.safeParse(raw);
  if (!args.success) return { result: "A title is required." };

  let subject: { id: string; name: string } | null = null;
  if (args.data.subjectId) {
    try {
      subject = await resolveSubject(ctx, args.data.subjectId);
    } catch {
      return { result: "That course id is not one of this student's courses. Use search_courses." };
    }
  }

  if (subject) {
    const capture = await prisma.captureItem.findFirst({
      where: { id: ctx.captureId, userId: ctx.userId },
      select: { documentId: true },
    });
    if (capture?.documentId) {
      await prisma.document.updateMany({
        where: { id: capture.documentId, userId: ctx.userId },
        data: { subjectId: subject.id },
      });
    }
  }

  return {
    result: subject ? `Filed under ${subject.name}.` : "Filed.",
    action: { kind: "FILED", title: args.data.title.trim(), subjectName: subject?.name ?? null },
  };
}
