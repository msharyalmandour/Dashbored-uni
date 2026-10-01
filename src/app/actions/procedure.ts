"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { score, type Step, type StationResult } from "@/lib/ospe";
import { parseChecklist } from "@/lib/checklist";
import { parseOrThrow, shortText, longText } from "@/lib/validation";

/**
 * Recording one run through a procedure.
 *
 * A miss becomes a `Mistake`, which is the whole reason this feature is built
 * on that model rather than a new one: `frequency`, `whatIShouldReview`, the
 * knowledge-gap link and `mistake-patterns.ts` were all written to answer
 * "what do I keep getting wrong" and had nothing to read, because the only way
 * to make a Mistake was a form nobody filled in. Ticking a box on a checklist
 * is a thing a student will actually do after a station.
 */

export type AttemptResult =
  | { ok: true; result: StationResult; missed: number; criticalMissed: number }
  /* Practising needs a course because a Mistake needs one, and this is
     surfaced rather than worked around: silently filing the misses under an
     invented course is the exact failure that put a book in his course list. */
  | { ok: false; reason: "NEEDS_SUBJECT" }
  | { ok: false; reason: "NOT_FOUND" };

export async function recordAttempt(
  procedureId: string,
  missedStepIds: string[]
): Promise<AttemptResult> {
  const userId = await requireUserId();

  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, userId },
    select: {
      id: true,
      subjectId: true,
      steps: { orderBy: { position: "asc" }, select: { id: true, position: true, text: true, critical: true } },
    },
  });
  if (!procedure) return { ok: false, reason: "NOT_FOUND" };
  if (!procedure.subjectId) return { ok: false, reason: "NEEDS_SUBJECT" };

  const steps: Step[] = procedure.steps.map((s) => ({
    id: s.id,
    order: s.position,
    text: s.text,
    critical: s.critical,
  }));

  /* Narrowed to steps that are actually on this checklist. A stale id from a
     tab left open would otherwise create a Mistake against a step the student
     was never shown, and `score` would ignore it — so the two would disagree
     about the same attempt. */
  const onChecklist = new Set(steps.map((s) => s.id));
  const missed = missedStepIds.filter((id) => onChecklist.has(id));

  const result = score(steps, { missedStepIds: missed });

  await prisma.$transaction(async (tx) => {
    for (const stepId of missed) {
      /* One row per step, incremented — not a new row each time. `frequency`
         is the field that says "third time on this step", and that number is
         the whole signal; a pile of separate rows would scatter it and make
         every pattern look like a first offence. */
      const existing = await tx.mistake.findFirst({
        where: { userId, procedureStepId: stepId },
        select: { id: true },
      });

      if (existing) {
        await tx.mistake.update({
          where: { id: existing.id },
          data: { frequency: { increment: 1 }, status: "OPEN" },
        });
      } else {
        const step = steps.find((s) => s.id === stepId)!;
        await tx.mistake.create({
          data: {
            userId,
            subjectId: procedure.subjectId!,
            procedureStepId: stepId,
            /* CARELESS_MISTAKE would be a guess about why it was missed, and
               the student has not been asked. A missed step is a gap in what
               they can do until they say otherwise. */
            mistakeType: "KNOWLEDGE_GAP",
            whyIGotItWrong: null,
            whatIShouldReview: step.text,
          },
        });
      }
    }

    await tx.procedure.update({
      where: { id: procedure.id },
      // Set even on a perfect run: "when did I last do this" is the question
      // practiceOrder asks, and a clean attempt answers it just as well.
      data: { lastPracticedAt: new Date() },
    });
  });

  revalidatePath("/clinical");
  revalidatePath(`/clinical/${procedureId}`);

  return {
    ok: true,
    result,
    missed: missed.length,
    criticalMissed: steps.filter((s) => s.critical && missed.includes(s.id)).length,
  };
}

/**
 * File a procedure under a course.
 *
 * Separate from practising so the student is never made to choose a course in
 * the middle of a station. A procedure sheet frequently names no course, and
 * the agent files it nowhere rather than guessing.
 */
export async function fileProcedure(procedureId: string, subjectId: string): Promise<void> {
  const userId = await requireUserId();

  // Both halves proved to belong to this student before anything is written.
  const [procedure, subject] = await Promise.all([
    prisma.procedure.findFirst({ where: { id: procedureId, userId }, select: { id: true } }),
    prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } }),
  ]);
  if (!procedure || !subject) return;

  await prisma.procedure.update({
    where: { id: procedure.id },
    data: { subjectId: subject.id },
  });

  revalidatePath("/clinical");
  revalidatePath(`/clinical/${procedureId}`);
}

/**
 * Write a procedure the student typed or pasted in themselves.
 *
 * This is the hand path the table never had. `create_procedure` on the agent
 * was the only way to make a Procedure, and the agent has produced nothing
 * since 11 September for want of credit — which is why the whole OSPE
 * machinery above it read an empty table for twenty days. See
 * src/lib/checklist.ts for the measurement and the parsing rules.
 *
 * `subjectId` is accepted here rather than asked for afterwards because the
 * student pasting the sheet already knows which course it belongs to. It is
 * still optional: a sheet that names no course is filed later by the same
 * `fileProcedure` path the agent's output uses, and a procedure with no course
 * is readable and only blocked from recording a miss.
 */
export type HandProcedureResult =
  | { ok: true; procedureId: string; steps: number; critical: number }
  /* Parsed to nothing. Reported rather than written, because a procedure with
     no steps is a row that reaches a screen and says nothing. */
  | { ok: false; reason: "NO_STEPS" };

export async function createProcedureByHand(input: {
  name: string;
  stepsText: string;
  subjectId?: string | null;
}): Promise<HandProcedureResult> {
  const userId = await requireUserId();

  const name = parseOrThrow(shortText, input.name, "name");
  const stepsText = parseOrThrow(longText, input.stepsText, "steps");

  const parsed = parseChecklist(stepsText);
  if (parsed.length === 0) return { ok: false, reason: "NO_STEPS" };

  /* The course is proved to be his before it is stored, and a id that is not
     silently becomes no course rather than an error: the checklist is the
     thing worth keeping, and filing is recoverable. */
  let subjectId: string | null = null;
  if (input.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: input.subjectId, userId },
      select: { id: true },
    });
    subjectId = subject?.id ?? null;
  }

  const procedure = await prisma.procedure.create({
    data: {
      userId,
      name,
      subjectId,
      /* sourceDocumentId stays null, and that is a fact the interface shows:
         a checklist typed from the sheet in front of him is not the same
         provenance as one read out of a file, and `fromDocument` exists so the
         two are not presented alike. */
      steps: {
        create: parsed.map((s, i) => ({
          // Positions are 1-based and assigned here from array order, never
          // from anything in the text: the order came in, it goes out.
          position: i + 1,
          text: s.text,
          critical: s.critical,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/clinical");

  return {
    ok: true,
    procedureId: procedure.id,
    steps: parsed.length,
    critical: parsed.filter((s) => s.critical).length,
  };
}
