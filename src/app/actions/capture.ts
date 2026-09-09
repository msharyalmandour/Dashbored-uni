"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId, verifySubject } from "@/lib/authz";
import { createDocument } from "@/app/actions/documents";
import { analyzeCapture, parseStoredAnalysis } from "@/lib/ai/analyze-capture";
import { downloadDocumentFileAsUser } from "@/lib/document-storage";
import { getAccessToken } from "@/lib/supabase/server";
import { getAiStatus } from "@/lib/ai/provider";
import { parseOrThrow, id as idSchema, longText } from "@/lib/validation";
import { describeFile } from "@/lib/capture-kinds";
import { LOW_CONFIDENCE } from "@/lib/ai/types";
import type { DocumentCategory } from "@prisma/client";

/**
 * "Drop anything." The two entry points below are deliberately the whole
 * public surface of capture: one for text, one for files. Neither asks the
 * student to classify, choose a subject, or name anything — that is the point.
 * Deciding what a thing is happens afterwards, in review, and only ever with
 * the student's confirmation.
 */

/**
 * Records a typed or pasted thought and hands back the row immediately.
 *
 * Analysis is *not* awaited here. Capture must feel instant, and an API call
 * to a model takes seconds; the client kicks off `requestAnalysis` right after
 * and watches the row move through its states.
 */
export async function captureText(text: string) {
  const userId = await requireUserId();
  const content = parseOrThrow(longText, text, "note");

  const capture = await prisma.captureItem.create({
    data: { userId, kind: "TEXT", text: content, status: "PENDING" },
    select: { id: true },
  });

  revalidatePath("/inbox");
  return capture;
}

/**
 * Records dropped files.
 *
 * Each file goes through the existing document path — same storage, same
 * validation, same extraction pipeline — and the capture row points at the
 * Document rather than copying it. A screenshot pasted from the clipboard
 * arrives here as an image/png File and needs no special case.
 *
 * Category is IMAGE or OTHER at this stage on purpose: what the file *is* is
 * exactly the question capture refuses to ask up front. Filing it under
 * LECTURE happens when the proposal is confirmed.
 */
export async function captureFiles(formData: FormData) {
  const userId = await requireUserId();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("No files provided.");

  const created: { id: string }[] = [];

  for (const file of files) {
    // Category is the file's shape, not a decision about what it is for —
    // that is exactly the question Drop Anything refuses to ask up front.
    const { category: kind } = describeFile(file.name, file.type);
    const category: DocumentCategory = kind === "IMAGE" ? "IMAGE" : "OTHER";
    const document = await createDocument({ file, category });

    const capture = await prisma.captureItem.create({
      data: { userId, kind: "FILE", documentId: document.id, status: "PENDING" },
      select: { id: true },
    });
    created.push(capture);
  }

  revalidatePath("/inbox");
  return created;
}

/**
 * Runs (or re-runs) analysis for one capture the caller owns.
 *
 * Called from the client immediately after a drop, and again from the retry
 * button. `analyzeCapture` records its own outcome and never throws, so this
 * returns the resulting status rather than succeeding or failing.
 */
export async function requestAnalysis(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const owned = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Not found: Capture");

  // Scoped to this user's own token, so Storage RLS still authorizes the
  // read. The service-role downloader belongs to the cron and must never be
  // used on a request path.
  const accessToken = await getAccessToken();
  await analyzeCapture(parsedId, (path) => downloadDocumentFileAsUser(path, accessToken));

  const after = await prisma.captureItem.findUnique({
    where: { id: parsedId },
    select: { status: true, analysis: true, analyzedBy: true, error: true },
  });

  revalidatePath("/inbox");
  return {
    status: after?.status ?? "FAILED",
    analysis: parseStoredAnalysis(after?.analysis),
    analyzedBy: after?.analyzedBy ?? null,
    error: after?.error ?? null,
  };
}

/** Whether an AI provider is configured, for the inbox to report plainly. */
export async function getAiAvailability() {
  await requireUserId();
  return getAiStatus();
}

export type OrganizeDecision = {
  captureId: string;
  /** Always the student's choice, whether or not it matches the proposal. */
  subjectId: string | null;
  /** What to create. NONE files the item without creating anything. */
  destination: "NONE" | "KNOWLEDGE_GAP" | "TASK";
  title: string;
  notes?: string;
  /** Required when destination is TASK — Task.deadline is not nullable. */
  deadline?: string;
};

/**
 * The confirmation step: turns a reviewed proposal into real records.
 *
 * Everything written here comes from `decision` — the student's edited,
 * accepted answer — never from the stored proposal directly. That is the line
 * this whole design is built around: a model may suggest, only a person may
 * file.
 */
export async function organizeCapture(decision: OrganizeDecision) {
  const userId = await requireUserId();
  const captureId = parseOrThrow(idSchema, decision.captureId, "capture id");
  const title = parseOrThrow(longText, decision.title, "title").slice(0, 200);

  const capture = await prisma.captureItem.findFirst({
    where: { id: captureId, userId },
    select: { id: true, documentId: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  if (decision.subjectId) await verifySubject(userId, decision.subjectId);

  // Only a knowledge gap actually requires a subject — KnowledgeGap.subjectId
  // is non-nullable in the schema. A task's subjectId is nullable on purpose:
  // "my exam is Thursday" with no course context is still a real deadline,
  // and refusing to create it until a course is chosen would mean the one
  // piece of content with the clearest signal — an actual date — is the one
  // thing this flow couldn't act on without help.
  if (decision.destination === "KNOWLEDGE_GAP" && !decision.subjectId) {
    throw new Error("Choose a subject before filing this.");
  }

  if (decision.destination === "KNOWLEDGE_GAP" && decision.subjectId) {
    await prisma.knowledgeGap.create({
      data: {
        subjectId: decision.subjectId,
        title,
        description: decision.notes || null,
        source: "READING",
      },
    });
  }

  if (decision.destination === "TASK") {
    if (!decision.deadline) throw new Error("A task needs a deadline.");
    const deadline = new Date(decision.deadline);
    if (Number.isNaN(deadline.getTime())) throw new Error("That deadline is not a valid date.");

    await prisma.task.create({
      data: {
        userId,
        subjectId: decision.subjectId,
        title,
        description: decision.notes || null,
        deadline,
      },
    });
  }

  // Filing the capture under a subject files the underlying file too, so the
  // document stops being loose and shows up in that subject's materials.
  if (capture.documentId && decision.subjectId) {
    await prisma.document.updateMany({
      where: { id: capture.documentId, userId },
      data: { subjectId: decision.subjectId },
    });
  }

  await prisma.captureItem.update({
    where: { id: capture.id },
    data: { status: "ORGANIZED", organizedAt: new Date(), error: null },
  });

  revalidatePath("/inbox");
  revalidatePath("/");
  if (decision.destination === "TASK") revalidatePath("/tasks");
  if (decision.destination === "KNOWLEDGE_GAP") revalidatePath("/knowledge-gaps");
}

/**
 * The one-tap "Looks good".
 *
 * The decision is rebuilt here from the analysis already stored on the row,
 * rather than accepted from the client. The client could otherwise post any
 * subject id it liked under the guise of confirming a proposal, and the point
 * of validating the model's answer server-side would be lost on the very step
 * that writes to the student's records.
 *
 * The mapping is deliberately conservative. A stated date becomes a task only
 * when the content actually carried one; a question or a stated
 * misunderstanding becomes a knowledge gap, which is what those are; anything
 * else is simply filed. Nothing here invents a destination to look clever.
 */
export async function acceptProposal(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const capture = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true, analysis: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  const analysis = parseStoredAnalysis(capture.analysis);
  if (!analysis) throw new Error("There is no analysis to accept.");

  const event = analysis.detectedEvent;
  const hasUsableDate = !!event?.date && !Number.isNaN(new Date(event.date).getTime());

  // A real date is the strongest signal a capture can carry, and it does not
  // need a matched course to be worth acting on: "my exam is Thursday" with
  // zero course context is still a real deadline. A knowledge gap is the
  // opposite case — the schema requires a subject for one, so that path stays
  // gated on a match.
  let destination: OrganizeDecision["destination"] = "NONE";
  if (hasUsableDate) {
    destination = "TASK";
  } else if (analysis.subjectId && (analysis.contentType === "QUESTION" || analysis.contentType === "MISTAKE")) {
    destination = "KNOWLEDGE_GAP";
  }

  await organizeCapture({
    captureId: capture.id,
    subjectId: analysis.subjectId,
    destination,
    title: destination === "TASK" && event ? event.title : analysis.title,
    notes: analysis.summary || undefined,
    deadline: hasUsableDate ? event!.date! : undefined,
  });

  return {
    destination,
    title: destination === "TASK" && event ? event.title : analysis.title,
    deadline: hasUsableDate ? event!.date! : null,
  };
}

/**
 * The semester a course has to belong to, creating one if the student has none.
 *
 * `Subject.semesterId` is required, so on day one there is nothing to attach a
 * new course to. Rather than making the student fill in a semester form before
 * their first drop can do anything, this creates a plain container they can
 * rename later. The dates are a conventional term length, and are the one
 * assumption here — they are not presented to the student as fact.
 */
async function ensureSemester(userId: string): Promise<string> {
  const existing = await prisma.semester.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 4);

  const created = await prisma.semester.create({
    data: { userId, name: "Current semester", startDate: now, endDate: end },
    select: { id: true },
  });
  return created.id;
}

/**
 * Creates the course the analysis proposed, and files the capture into it.
 *
 * This is the fix for the product's worst moment. A new student has no
 * subjects, so the model could only ever answer `subjectId: null`, so every
 * first drop resolved to "just file it" — the one interaction that had to feel
 * like magic instead produced a saved file and silence.
 *
 * The name is taken from the *stored* analysis rather than from the client, on
 * the same principle as `acceptProposal`: the student is confirming something
 * the system proposed, so the client may say "yes", not "yes, to this other
 * thing I made up".
 */
export async function acceptProposedSubject(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const capture = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true, analysis: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  const analysis = parseStoredAnalysis(capture.analysis);
  const proposedName = analysis?.proposedSubjectName?.trim();
  if (!analysis || !proposedName) throw new Error("There is no course to create.");

  // Guard against creating a second copy of a course the student already has,
  // which is possible if they created it by hand between the analysis and now.
  const duplicate = await prisma.subject.findFirst({
    where: { userId, name: { equals: proposedName, mode: "insensitive" } },
    select: { id: true },
  });

  const subjectId =
    duplicate?.id ??
    (
      await prisma.subject.create({
        data: { userId, semesterId: await ensureSemester(userId), name: proposedName },
        select: { id: true },
      })
    ).id;

  // Re-file the capture against the course that now exists, reusing the same
  // conservative mapping the one-tap accept uses.
  const event = analysis.detectedEvent;
  const hasUsableDate = !!event?.date && !Number.isNaN(new Date(event.date).getTime());

  let destination: OrganizeDecision["destination"] = "NONE";
  if (hasUsableDate) destination = "TASK";
  else if (analysis.contentType === "QUESTION" || analysis.contentType === "MISTAKE") {
    destination = "KNOWLEDGE_GAP";
  }

  await organizeCapture({
    captureId: capture.id,
    subjectId,
    destination,
    title: destination === "TASK" && event ? event.title : analysis.title,
    notes: analysis.summary || undefined,
    deadline: hasUsableDate ? event!.date! : undefined,
  });

  revalidatePath("/academics");
  return { subjectId, subjectName: proposedName, destination };
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

/**
 * Turns a confirmed timetable into the student's actual week.
 *
 * This is the moment the product is supposed to be built around: one photo of
 * a schedule, and courses and a week exist. Everything here is created only
 * after the student has seen the rows and said yes — the read is the AI's,
 * the decision is theirs.
 *
 * Two kinds of row are written, because the app needs both to reason about
 * time: a TimeCommitment carries the *recurring* shape of a normal week
 * (which is what available-time is computed from), and a ScheduleEvent
 * carries the *next dated occurrence* so the week has something to show.
 *
 * Rows whose day or time did not survive validation are skipped and counted,
 * never repaired by guessing — an invented lecture time would silently
 * corrupt every free-time figure derived from it.
 */
export async function acceptDetectedTimetable(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const capture = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true, analysis: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  const analysis = parseStoredAnalysis(capture.analysis);
  const entries = analysis?.detectedTimetable?.entries ?? [];
  if (entries.length === 0) throw new Error("There is no timetable to add.");

  const semesterId = await ensureSemester(userId);

  // A timetable is a statement about the whole week, not an addition to it, so
  // importing one replaces whatever a previous import claimed. Without this,
  // the ordinary act of re-dropping a corrected schedule — or dropping the
  // same photo twice, which is exactly what someone does when the first
  // attempt appeared to do nothing — leaves two of every lecture and doubles
  // the busy hours every free-time calculation is derived from.
  //
  // The boundary is `sourceCaptureId`: only rows this app imported are
  // cleared. Anything the student entered by hand has no source capture and
  // is never touched by an import, no matter how confident the read.
  //
  // Past occurrences are deliberately spared. The recurring commitments carry
  // no history worth keeping and are rebuilt wholesale, but a dated event that
  // has already happened is a record of a class that took place, and a new
  // photo of next term's timetable is not a reason to erase it.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.timeCommitment.deleteMany({
      where: { userId, sourceCaptureId: { not: null } },
    }),
    prisma.scheduleEvent.deleteMany({
      where: { userId, source: "TIMETABLE_IMPORT", startsAt: { gte: startOfToday } },
    }),
  ]);

  // Course names repeat across a timetable (a lecture and its lab), so each
  // distinct name is resolved to one course rather than created per row.
  const existing = await prisma.subject.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s.id]));

  let coursesCreated = 0;
  let eventsCreated = 0;
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

    const key = entry.courseName.trim().toLowerCase();
    let subjectId = byName.get(key);
    if (!subjectId) {
      const created = await prisma.subject.create({
        data: { userId, semesterId, name: entry.courseName.trim() },
        select: { id: true },
      });
      subjectId = created.id;
      byName.set(key, subjectId);
      coursesCreated += 1;
    }

    await prisma.timeCommitment.create({
      data: {
        userId,
        kind: entry.kind === "CLINICAL" ? "CLINICAL" : "UNIVERSITY",
        label: entry.courseName.trim(),
        weekday: entry.weekday,
        startMinute,
        endMinute,
        subjectId,
        sourceCaptureId: capture.id,
      },
    });

    const day = nextDateForWeekday(now, entry.weekday);
    const startsAt = new Date(day);
    startsAt.setMinutes(startMinute);
    const endsAt = new Date(day);
    endsAt.setMinutes(endMinute);

    await prisma.scheduleEvent.create({
      data: {
        userId,
        title: entry.courseName.trim(),
        type: entry.kind === "CLINICAL" ? "CLINICAL" : "LECTURE",
        startsAt,
        endsAt,
        location: entry.location,
        source: "TIMETABLE_IMPORT",
        sourceCaptureId: capture.id,
        subjectId,
      },
    });
    eventsCreated += 1;
  }

  await prisma.captureItem.update({
    where: { id: capture.id },
    data: { status: "ORGANIZED", organizedAt: new Date(), error: null },
  });

  revalidatePath("/inbox");
  revalidatePath("/academics");
  revalidatePath("/time");
  revalidatePath("/calendar");
  revalidatePath("/");

  return { coursesCreated, eventsCreated, skipped };
}

/**
 * What the agent decided, so the panel can show a result rather than a form.
 *
 * Every EXECUTED variant here corresponds to a real write that already
 * happened — this is a report, not an intention. FAILED means the analysis
 * genuinely understood the content but the database write itself did not go
 * through (a constraint, a lost connection); the caller must never render
 * that as success. ASK_SUBJECT is the one case this schema can name as
 * genuinely ambiguous — everything else either has enough signal to act on
 * or has none, and "none" still executes, as filing.
 */
export type AutoExecuteResult =
  | { status: "EXECUTED"; kind: "TIMETABLE"; coursesCreated: number; eventsCreated: number; skipped: number }
  | { status: "EXECUTED"; kind: "TASK"; title: string; deadline: string }
  | { status: "EXECUTED"; kind: "KNOWLEDGE_GAP"; title: string }
  | { status: "EXECUTED"; kind: "FILED" }
  | { status: "ASK_SUBJECT"; subjectName: string }
  | { status: "FAILED"; message: string }
  | { status: "NOT_UNDERSTOOD" };

/**
 * The agent's DECIDE + EXECUTE steps in one call.
 *
 * Everything this function does, it does through the same functions above —
 * `acceptDetectedTimetable`, `acceptProposedSubject`, `acceptProposal` — never
 * by writing to the database directly. The model's structured analysis
 * decides *which* of those to run and nothing else; the actual writes stay in
 * the one place each of them was already reviewed and tested. That is the
 * boundary the whole design rests on: the model proposes a classification,
 * real application code turns it into rows.
 *
 * The ordering encodes the only ambiguity policy this schema can support
 * honestly:
 *   1. A read timetable is the flagship, unambiguous case — many rows, but a
 *      single clear kind of thing. Confidence-gated: an AI that is not sure
 *      this is really a timetable should not write a dozen calendar rows.
 *   2. A proposed course name is the one signal this schema was built to
 *      flag as "ask, don't guess" — creating a course is the one write here
 *      that adds a whole new object to the student's structure rather than
 *      filing into what already exists.
 *   3. Below the confidence line, the only honest action left is filing —
 *      writing a task or a gap under a guess the model itself was not sure
 *      of would be worse than doing nothing.
 *   4. Otherwise: whatever the content itself carries. A real date becomes a
 *      task, a question or a flagged mistake becomes something to revisit,
 *      anything else is simply filed. No destination is invented to look
 *      capable — see `acceptProposal`'s own mapping.
 */
export async function autoExecuteCapture(captureId: string): Promise<AutoExecuteResult> {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const capture = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true, analysis: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  const analysis = parseStoredAnalysis(capture.analysis);
  if (!analysis) return { status: "NOT_UNDERSTOOD" };

  const entries = analysis.detectedTimetable?.entries ?? [];
  if (entries.length > 0 && analysis.confidence >= LOW_CONFIDENCE) {
    try {
      const r = await acceptDetectedTimetable(captureId);
      return { status: "EXECUTED", kind: "TIMETABLE", ...r };
    } catch (err) {
      return { status: "FAILED", message: err instanceof Error ? err.message : "Could not save the timetable." };
    }
  }

  if (analysis.proposedSubjectName) {
    return { status: "ASK_SUBJECT", subjectName: analysis.proposedSubjectName };
  }

  if (analysis.confidence < LOW_CONFIDENCE) {
    try {
      await organizeCapture({ captureId, subjectId: analysis.subjectId, destination: "NONE", title: analysis.title });
      return { status: "EXECUTED", kind: "FILED" };
    } catch (err) {
      return { status: "FAILED", message: err instanceof Error ? err.message : "Could not save that." };
    }
  }

  try {
    const result = await acceptProposal(captureId);
    if (result.destination === "TASK") {
      return { status: "EXECUTED", kind: "TASK", title: result.title, deadline: result.deadline! };
    }
    if (result.destination === "KNOWLEDGE_GAP") {
      return { status: "EXECUTED", kind: "KNOWLEDGE_GAP", title: result.title };
    }
    return { status: "EXECUTED", kind: "FILED" };
  } catch (err) {
    return { status: "FAILED", message: err instanceof Error ? err.message : "Could not save that." };
  }
}

/**
 * "No, just save it" — the other half of the one question this flow asks.
 *
 * Declining to create the course does not mean discarding the capture: the
 * content is still filed, exactly as `organizeCapture`'s NONE destination
 * always has, just without a new course invented for it.
 */
export async function declineProposedSubject(captureId: string): Promise<AutoExecuteResult> {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const capture = await prisma.captureItem.findFirst({
    where: { id: parsedId, userId },
    select: { id: true, analysis: true },
  });
  if (!capture) throw new Error("Not found: Capture");

  const analysis = parseStoredAnalysis(capture.analysis);
  if (!analysis) return { status: "NOT_UNDERSTOOD" };

  try {
    await organizeCapture({ captureId, subjectId: analysis.subjectId, destination: "NONE", title: analysis.title });
    return { status: "EXECUTED", kind: "FILED" };
  } catch (err) {
    return { status: "FAILED", message: err instanceof Error ? err.message : "Could not save that." };
  }
}

/**
 * Removes a capture from the inbox.
 *
 * The Document is deliberately left alone: deleting an inbox entry means "I
 * have dealt with this", not "destroy the file I uploaded". Files are removed
 * from wherever they were filed, by the existing delete path.
 */
export async function discardCapture(captureId: string) {
  const userId = await requireUserId();
  const parsedId = parseOrThrow(idSchema, captureId, "capture id");

  const { count } = await prisma.captureItem.deleteMany({ where: { id: parsedId, userId } });
  if (count === 0) throw new Error("Not found: Capture");

  revalidatePath("/inbox");
}
