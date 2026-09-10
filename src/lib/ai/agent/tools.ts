import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySubject } from "@/lib/authz";
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
// Each is the runtime half of the JSON Schema published to the model. The
// published schema is what the model aims at; this is what actually decides
// whether a write happens, because `strict: true` constrains shape and not
// meaning — "13:70" is a well-formed string and not a time.

const searchCoursesArgs = z.object({ query: z.string().min(1).max(200) });

const createCourseArgs = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).nullable().optional(),
});

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

const createLectureArgs = z.object({
  subjectId: z.string().min(1),
  title: z.string().min(1).max(200),
  date: z.string().nullable().optional(),
  lecturer: z.string().max(120).nullable().optional(),
  quickNotes: z.string().max(4000).nullable().optional(),
  topics: z.array(z.string().min(1).max(120)).max(20).optional(),
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
 * An optional value, written the one way `strict: true` accepts.
 *
 * The obvious spelling — `type: ["string", "null"]` — is valid JSON Schema and
 * is rejected by the strict compiler, which supports `anyOf` and single basic
 * types and nothing in between. Every tool here has optional fields, so
 * getting this wrong failed *every* request with HTTP 400 and no clue as to
 * which of twelve fields was at fault; the whole feature was dead on arrival
 * behind a message that said only "rejected as malformed".
 *
 * It is a function rather than a convention so the wrong spelling cannot come
 * back one field at a time, and `verify-agent.ts` asserts no published schema
 * contains an array-form `type` at all.
 */
function nullable(type: "string" | "integer" | "number" | "boolean", description?: string) {
  return {
    anyOf: [{ type }, { type: "null" }],
    ...(description ? { description } : {}),
  };
}

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
    strict: true,
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
    name: "create_course",
    description:
      "Create a course the student does not have yet. Only call this after search_courses has come back empty for that course. Use the course's name exactly as the dropped content writes it — this name becomes the real course in the student's account and they will see it everywhere. Never invent a course from a file name alone.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The course name, spelled as the content spells it." },
        code: nullable("string", "The course code if the content states one, else null."),
      },
      required: ["name", "code"],
      additionalProperties: false,
    },
  },
  {
    name: "import_timetable",
    description:
      "Turn a university timetable into the student's actual week: this creates any missing courses, the recurring weekly commitments, and the next dated occurrence of each class. Call it ONCE with every class you can read, not once per class. Importing replaces any previous timetable import, so a re-drop corrects the week instead of duplicating it — this never touches anything the student entered by hand. Omit any row whose day or time you cannot actually read; a guessed lecture time becomes a real commitment and corrupts every calculation about their free time.",
    strict: true,
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
            required: ["courseName", "weekday", "startTime", "endTime", "location", "kind"],
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
      "Record something the student has to do by a date — an assignment, an exam, a deadline. Only call this when the content actually states a date; never infer one. A task with no course attached is fine and often correct: 'my exam is Thursday' is a real deadline even with no course context. Set estimatedMinutes only when the content gives you a real basis for it.",
    strict: true,
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
      required: ["title", "deadline", "type", "subjectId", "notes", "estimatedMinutes"],
      additionalProperties: false,
    },
  },
  {
    name: "create_knowledge_gap",
    description:
      "Record something the student does not understand yet, so it comes back to them later. Two things belong here: a question they asked, and a concept the content itself signals as difficult or foundational. Write the title as the thing to understand ('How beta blockers lower blood pressure'), not as a description of the file. Requires a course. Create one gap per distinct concept; do not bundle several into one.",
    strict: true,
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
      required: ["subjectId", "title", "description", "difficulty", "source"],
      additionalProperties: false,
    },
  },
  {
    name: "create_lecture",
    description:
      "Record dropped teaching material as a lecture in a course, and attach the dropped file to it. Use this for slides, lecture notes, a recorded session's notes — material that teaches something. Put what it actually covers in quickNotes, in the content's own language, so the student can tell lectures apart without opening them. `topics` are the concepts it teaches; they become the course's topic list.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        subjectId: { type: "string" },
        title: { type: "string" },
        date: nullable("string", '"YYYY-MM-DD" if the content states one, else null.'),
        lecturer: nullable("string"),
        quickNotes: nullable("string", "What this lecture actually covers."),
        topics: { type: "array", items: { type: "string" }, description: "Concepts taught. May be empty." },
      },
      required: ["subjectId", "title", "date", "lecturer", "quickNotes", "topics"],
      additionalProperties: false,
    },
  },
  {
    name: "create_flashcards",
    description:
      "Create review cards from material the student will need to recall. Only make cards from facts the content actually contains — never from your own knowledge of the subject, however correct it is, because the student will review these believing they came from their own material. A good card asks one thing and has one answer. If the content does not support real cards, do not make any.",
    strict: true,
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
    strict: true,
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
      required: ["subjectId", "mistakeType", "whyIGotItWrong", "correctConcept", "whatIShouldReview"],
      additionalProperties: false,
    },
  },
  {
    name: "file_it",
    description:
      "Keep the item under a course without creating anything else. The right answer when the content is worth having but carries no date, no question and nothing to learn — a syllabus, an announcement, a personal note. Filing something is a real outcome, not a failure to classify.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "A short name for the item, in its own language." },
        subjectId: nullable("string"),
      },
      required: ["title", "subjectId"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_student",
    description:
      "Ask the student one short question, and stop. Use this only when you genuinely cannot proceed without their answer and a wrong guess would create something real and wrong in their account. Ask about their intent, never about something you could read for yourself. One question, answerable in a few words. Anything you can decide, decide.",
    strict: true,
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
    strict: true,
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

  const q = args.data.query.trim();
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
    },
    select: { id: true, name: true },
  });

  return {
    result: `Created — id: ${created.id} | name: ${created.name}`,
    action: { kind: "COURSE", id: created.id, name: created.name },
  };
}

async function importTimetable(ctx: AgentContext, raw: unknown): Promise<ToolOutcome> {
  const args = importTimetableArgs.safeParse(raw);
  if (!args.success) return { result: "entries must be a non-empty list of readable classes." };

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

  for (const entry of args.data.entries) {
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
        data: { userId: ctx.userId, semesterId, name: courseName },
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

  const created = await prisma.lecture.create({
    data: {
      subjectId: subject.id,
      title: args.data.title.trim(),
      lectureNumber: existingCount + 1,
      date: (args.data.date ? parseDate(args.data.date) : null) ?? new Date(),
      lecturer: args.data.lecturer?.trim() || null,
      quickNotes: args.data.quickNotes?.trim() || null,
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
