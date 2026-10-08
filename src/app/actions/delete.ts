"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertMutated, requireUserId } from "@/lib/authz";
import { getAccessToken } from "@/lib/supabase/server";
import { deleteDocumentFile } from "@/lib/document-storage";
import { consequencesOf, filesToRemove, type Consequence } from "@/lib/deletion";

/**
 * Deleting things, and telling the truth about it first.
 *
 * Seventeen kinds of thing could be created here and five could be deleted, so
 * anything the agent filed wrongly from a drop was permanent. That is the bug
 * this file closes.
 *
 * Every deletion comes in two halves. `...Consequences` reads the real counts
 * out of the database so the confirmation can say "five lectures and thirty
 * flashcards" instead of "are you sure?" — a question nobody can answer,
 * because the thing they need to know is exactly what the dialog omitted. The
 * delete itself then runs, ownership-scoped, in the shape every other action
 * here uses.
 *
 * WHAT CASCADES AND WHAT DOES NOT is a property of the schema, not a choice
 * made here, and the counts follow it rather than guessing:
 *
 *   - A subject takes its topics, lectures, gaps, flashcards, problems and
 *     mistakes with it. Everything under a course belongs to the course.
 *   - A lecture takes its slides and resources, and RELEASES its flashcards,
 *     problems and mistakes — they have their own link to the subject and
 *     survive. A flashcard is knowledge the student built; deleting the lecture
 *     it came from is not a reason to take it away.
 *
 * FILES ARE NOT ROWS. `ON DELETE CASCADE` tidies the database and knows nothing
 * about the PDF in object storage, so every path is collected BEFORE the rows
 * go — afterwards there is nothing left to ask — and removed after they have.
 * Storage failures do not roll the deletion back: the student asked for the
 * thing to be gone, and an orphaned file is a smaller problem than a course
 * that refuses to die.
 *
 * AND `Document` IS NEITHER. Its foreign keys are SET NULL, so a document
 * survives the lecture it was dropped into — which sounds protective and was,
 * in fact, the worst of the three outcomes. The lecture's slide rows and the
 * document row point at THE SAME object in storage, so deleting the lecture
 * removed the bytes and left the document row behind describing a file that no
 * longer existed. Measured on the real account: eight such rows, from two
 * deleted lectures, which the nightly cron re-tried and re-failed for
 * thirteen days, reporting to the student that his file had failed to
 * process — a file he had deliberately deleted a week earlier.
 *
 * So the documents in scope are read, deleted WITH the thing they hang off,
 * and their paths are removed alongside the slides'. Anything the student
 * would notice has to be named first, so they are counted in the
 * confirmation too.
 */

async function removeFiles(paths: (string | null | undefined)[]) {
  const wanted = filesToRemove(paths);
  if (wanted.length === 0) return;
  const accessToken = await getAccessToken();
  await Promise.all(
    wanted.map((p) =>
      deleteDocumentFile(p, accessToken).catch((e) => {
        // Logged, not thrown. See the note above.
        console.error("Storage cleanup failed for", p, e);
      })
    )
  );
}

/**
 * Every document that hangs off a course, however it was dropped.
 *
 * Two ways in, and both have to be named. The agent attaches a drop to a
 * lecture when it can tell which one, and to the course when it cannot — so a
 * `lectureId` filter alone would miss exactly the documents a student dropped
 * without saying where they went, which is most of them.
 *
 * `userId` is repeated even though the subject already scopes it: this predicate
 * is also used AFTER the course row is gone, when the subject clause no longer
 * proves anything.
 */
function documentsUnderSubject(subjectId: string, userId: string) {
  return {
    userId,
    OR: [{ subjectId }, { lecture: { subjectId } }],
  };
}

function documentsUnderSemester(semesterId: string, userId: string) {
  return {
    userId,
    OR: [{ subject: { semesterId } }, { lecture: { subject: { semesterId } } }],
  };
}

/**
 * The document rows, by id AND by owner.
 *
 * By id because the cascade has already run by the time this is called:
 * `Document.subjectId` and `Document.lectureId` are SET NULL, so the row still
 * exists but no longer answers to any of the filters that found it. The ids
 * from the read before the delete are the only handle left.
 *
 * And by owner, even though those ids came out of an ownership-scoped read.
 * The rule every delete in this file follows is that the WHERE names who is
 * asking, so that a later edit which moves, reorders or short-circuits the
 * read cannot quietly turn a scoped delete into an unscoped one — a list of
 * ids arriving from somewhere else would otherwise delete whoever's rows they
 * are. scripts/verify-deletion.ts reads this file to enforce it, and caught
 * this function without it.
 */
async function deleteDocumentRows(userId: string, documents: { id: string }[]) {
  if (documents.length === 0) return;
  await prisma.document.deleteMany({
    where: { userId, id: { in: documents.map((d) => d.id) } },
  });
}

/* ================================================================ subject = */

export async function subjectConsequences(subjectId: string): Promise<Consequence[]> {
  const userId = await requireUserId();
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  if (!subject) return [];

  const [lectures, slides, resources, topics, flashcards, problems, mistakes, gaps, documents] =
    await Promise.all([
      prisma.lecture.count({ where: { subjectId } }),
      prisma.lectureSlide.count({ where: { lecture: { subjectId } } }),
      prisma.lectureResource.count({ where: { lecture: { subjectId } } }),
      prisma.topic.count({ where: { subjectId } }),
      prisma.flashcard.count({ where: { subjectId } }),
      prisma.problem.count({ where: { subjectId } }),
      prisma.mistake.count({ where: { subjectId } }),
      prisma.knowledgeGap.count({ where: { subjectId } }),
      prisma.document.count({ where: documentsUnderSubject(subjectId, userId) }),
    ]);
  return consequencesOf({
    lectures, slides, resources, topics, flashcards, problems, mistakes, gaps, documents,
  });
}

export async function deleteSubject(subjectId: string) {
  const userId = await requireUserId();
  const [slides, documents] = await Promise.all([
    prisma.lectureSlide.findMany({
      where: { lecture: { subject: { id: subjectId, userId } } },
      select: { fileUrl: true },
    }),
    prisma.document.findMany({
      where: documentsUnderSubject(subjectId, userId),
      select: { id: true, storagePath: true },
    }),
  ]);

  const { count } = await prisma.subject.deleteMany({ where: { id: subjectId, userId } });
  assertMutated(count, "Course");
  /* After the course, because a document's own subjectId is SET NULL by the
     cascade and the `where` above would no longer find it. By id, which the
     read already has. */
  await deleteDocumentRows(userId, documents);
  await removeFiles([...slides.map((s) => s.fileUrl), ...documents.map((d) => d.storagePath)]);

  revalidatePath("/academics");
  revalidatePath("/");
}

/* =============================================================== semester = */

export async function semesterConsequences(semesterId: string): Promise<Consequence[]> {
  const userId = await requireUserId();
  const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId }, select: { id: true } });
  if (!semester) return [];

  const where = { subject: { semesterId } };
  const [subjects, lectures, slides, flashcards, problems, documents] = await Promise.all([
    prisma.subject.count({ where: { semesterId } }),
    prisma.lecture.count({ where }),
    prisma.lectureSlide.count({ where: { lecture: { subject: { semesterId } } } }),
    prisma.flashcard.count({ where }),
    prisma.problem.count({ where }),
    prisma.document.count({ where: documentsUnderSemester(semesterId, userId) }),
  ]);
  /* Courses get their own line. They spent a while borrowing `topics`' slot,
     which made the dialog say "6 topics" about six whole courses — a wrong noun
     in the one place where being wrong costs a term's work. */
  return consequencesOf({ subjects, lectures, slides, flashcards, problems, documents });
}

export async function deleteSemester(semesterId: string) {
  const userId = await requireUserId();
  const [slides, documents] = await Promise.all([
    prisma.lectureSlide.findMany({
      where: { lecture: { subject: { semesterId, userId } } },
      select: { fileUrl: true },
    }),
    prisma.document.findMany({
      where: documentsUnderSemester(semesterId, userId),
      select: { id: true, storagePath: true },
    }),
  ]);

  const { count } = await prisma.semester.deleteMany({ where: { id: semesterId, userId } });
  assertMutated(count, "Semester");
  await deleteDocumentRows(userId, documents);
  await removeFiles([...slides.map((s) => s.fileUrl), ...documents.map((d) => d.storagePath)]);

  revalidatePath("/academics");
  revalidatePath("/");
}

/* ================================================================ lecture = */

export async function lectureConsequences(lectureId: string): Promise<Consequence[]> {
  const userId = await requireUserId();
  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, subject: { userId } },
    select: { id: true },
  });
  if (!lecture) return [];

  const [slides, resources, annotations, documents] = await Promise.all([
    prisma.lectureSlide.count({ where: { lectureId } }),
    prisma.lectureResource.count({ where: { lectureId } }),
    prisma.slideAnnotation.count({ where: { slide: { lectureId } } }),
    prisma.document.count({ where: { lectureId, userId } }),
  ]);
  /* Flashcards, problems and mistakes are deliberately absent: they survive a
     lecture's deletion, and naming them here would be a warning about something
     that is not going to happen — which is how a student learns that the
     warnings are decoration. */
  return consequencesOf({ slides, resources, annotations, documents });
}

export async function deleteLecture(lectureId: string) {
  const userId = await requireUserId();
  /* The read is for the file paths and the course to revalidate — not for
     permission. The delete carries its own ownership clause rather than
     trusting this lookup, so the two cannot drift apart: a later edit that
     moves, reorders or short-circuits the read cannot silently turn the delete
     into one that works on anybody's lecture. Every delete in this file names
     the owner in its own WHERE, and scripts/verify-deletion.ts reads the file
     to make sure of it. */
  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, subject: { userId } },
    select: {
      id: true,
      subjectId: true,
      slides: { select: { fileUrl: true } },
      /* The documents dropped into this lecture. Read here and not inferred
         from the slides: a document and the slide made from it point at the
         same object in storage, so removing only the slide's path deleted the
         bytes and left the document row describing a file that was gone. Eight
         of those existed on the real account. */
      documents: { select: { id: true, storagePath: true } },
    },
  });
  if (!lecture) throw new Error("Not found: Lecture");

  const { count } = await prisma.lecture.deleteMany({
    where: { id: lectureId, subject: { userId } },
  });
  assertMutated(count, "Lecture");
  await deleteDocumentRows(userId, lecture.documents);
  await removeFiles([
    ...lecture.slides.map((s) => s.fileUrl),
    ...lecture.documents.map((d) => d.storagePath),
  ]);

  revalidatePath(`/subjects/${lecture.subjectId}`);
  revalidatePath("/academics");
  revalidatePath("/studio");
  revalidatePath("/");
}

/* ============================================ the leaves: one row, no tail = */
/* Each of these owns nothing, so there is nothing to count and nothing to warn
   about beyond the thing itself. They are here rather than scattered through
   their feature files so that "can this be deleted?" has one answer in one
   place — the absence of exactly that was the bug. */

export async function deleteTopic(topicId: string, subjectId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.topic.deleteMany({ where: { id: topicId, subject: { userId } } });
  assertMutated(count, "Topic");
  revalidatePath(`/subjects/${subjectId}`);
}

/**
 * Clear a course's grade weights, all of them.
 *
 * WHY THERE IS NO "DELETE ONE COMPONENT". A set of weights is only meaningful
 * whole: the rule in `src/lib/grades.ts` is that the top level sums to 100 and
 * each group sums to the row above it. Remove Clinical Evaluation's 30% on its
 * own and NURC 411 is priced at 70% — not wrong about one row, wrong about the
 * course, and silently so.
 *
 * So the unit of deletion is the unit of writing: `set_grade_weights` replaces
 * a course's whole table, and this empties it. A student who thinks one row is
 * wrong re-reads the syllabus; that is one action, not a repair.
 *
 * Children go with their parents through the cascade on `parentId`, so
 * emptying by subject is complete by construction.
 */
export async function deleteGradeWeights(subjectId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.gradeComponent.deleteMany({
    where: { subjectId, subject: { userId } },
  });
  assertMutated(count, "GradeComponent");
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/");
}

/**
 * Remove a lecture's summary.
 *
 * The whole summary, because that is the unit it was written in: the idea, the
 * chain and the points were read together out of one lecture, and a student
 * who thinks one point is wrong does not want five-sevenths of a summary —
 * they want it read again. Points go with it through the cascade.
 *
 * Takes the lecture rather than the summary's own id, because that is what the
 * page the student is looking at knows.
 */
export async function deleteLectureSummary(lectureId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.lectureSummary.deleteMany({
    where: { lectureId, lecture: { subject: { userId } } },
  });
  assertMutated(count, "LectureSummary");
  revalidatePath(`/lectures/${lectureId}`);
}

export async function deleteTask(taskId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.task.deleteMany({ where: { id: taskId, userId } });
  assertMutated(count, "Task");
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteFlashcard(flashcardId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.flashcard.deleteMany({ where: { id: flashcardId, userId } });
  assertMutated(count, "Flashcard");
  revalidatePath("/flashcards");
  revalidatePath("/review");
}

export async function deleteProblem(problemId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.problem.deleteMany({ where: { id: problemId, userId } });
  assertMutated(count, "Problem");
  revalidatePath("/problems");
}

export async function deleteMistake(mistakeId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.mistake.deleteMany({ where: { id: mistakeId, userId } });
  assertMutated(count, "Mistake");
  revalidatePath("/mistakes");
}

export async function deleteKnowledgeGap(gapId: string) {
  const userId = await requireUserId();
  /* Scoped through the subject: a gap has no userId of its own — it belongs to
     a course, which belongs to the student. Getting this wrong would be an
     ownership hole rather than a type error, so it is worth naming. */
  const { count } = await prisma.knowledgeGap.deleteMany({
    where: { id: gapId, subject: { userId } },
  });
  assertMutated(count, "Knowledge gap");
  revalidatePath("/knowledge-gaps");
  revalidatePath("/");
}

export async function deleteClinicalEntry(entryId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.clinicalTraining.deleteMany({ where: { id: entryId, userId } });
  assertMutated(count, "Clinical entry");
  revalidatePath("/clinical");
  revalidatePath("/");
}

export async function deleteVideo(videoId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.video.deleteMany({ where: { id: videoId, userId } });
  assertMutated(count, "Video");
  revalidatePath("/videos");
}

export async function deleteLectureResource(resourceId: string, lectureId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.lectureResource.deleteMany({
    where: { id: resourceId, lecture: { subject: { userId } } },
  });
  assertMutated(count, "Resource");
  revalidatePath(`/lectures/${lectureId}`);
}

/* ========================================================== the last three =
 *
 * Seventeen kinds of thing could be created here; the twelve above closed most
 * of that. Auditing what was left found three more, and one of them matters
 * more than any of the twelve.
 *
 *   ScheduleEvent   a class in the week. Created ONLY by the agent reading a
 *                   screenshot of a timetable, and deleted ONLY by wiping every
 *                   event and re-importing. So one class read wrongly off a
 *                   photograph — wrong day, wrong hour, a class that is not
 *                   theirs — could not be removed. The student's only recourse
 *                   was to re-import the whole timetable, which is a strange
 *                   thing to have to do about one Tuesday.
 *
 *   FocusSession    a study session. A session left open and closed later by
 *                   the reconciler records hours nobody studied, and that
 *                   number is in the analytics the student reads about
 *                   themselves.
 *
 *   SlideAnnotation every pen mark on one slide, in one row. The eraser edits
 *                   strokes; nothing cleared the page.
 *
 * None needs a consequences pass. Each is one row, nothing cascades from it,
 * and a dialog that asks "are you sure?" about deleting one class is the kind
 * of friction that gets clicked through without reading.
 */

export async function deleteScheduleEvent(eventId: string) {
  const userId = await requireUserId();
  /* Scoped on userId, which this table has of its own.
  
     I first scoped it through `subject: { userId }`, which type-checks and reads
     reasonably and would have missed exactly the classes worth deleting.
     `subjectId` is nullable and severs to null when a course is deleted — the
     schema says so on purpose, so that "deleting a lecture must not silently
     erase the record that time was spent". Every one of those survivors has no
     subject, so a subject-scoped delete could never reach them: the orphan left
     behind by a deleted course would have been permanent. */
  const { count } = await prisma.scheduleEvent.deleteMany({
    where: { id: eventId, userId },
  });
  assertMutated(count, "Class");
  // Every screen that draws the week, since a class appears on all of them.
  revalidatePath("/time");
  revalidatePath("/calendar");
  revalidatePath("/today");
  revalidatePath("/");
}

export async function deleteFocusSession(sessionId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.focusSession.deleteMany({ where: { id: sessionId, userId } });
  assertMutated(count, "Session");
  revalidatePath("/focus");
  revalidatePath("/analytics");
  revalidatePath("/");
}

/**
 * Clears every pen mark on one slide.
 *
 * The marks for a slide live in a single row, so this is a delete and not an
 * edit — and it is the one deletion here that destroys something the student
 * made by hand rather than something a model filed for them. The interface
 * asks before calling it.
 */
export async function clearSlideAnnotations(slideId: string, lectureId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.slideAnnotation.deleteMany({
    where: { slide: { lecture: { subject: { userId } } }, slideId },
  });
  // Not assertMutated: a slide with no marks on it is already in the state
  // being asked for, and telling the student "not found" would be a lie.
  revalidatePath(`/lectures/${lectureId}/slides/${slideId}`);
  revalidatePath(`/lectures/${lectureId}`);
  return { cleared: count };
}

/**
 * What goes with a procedure, counted before it goes.
 *
 * This function exists because of a specific failure, and naming it is the
 * point. A course was deleted from this account with a hand-written list of
 * its dependants — lectures, documents, resources, sessions, cards, tasks —
 * and the list had six of the seven. The seventh was `KnowledgeGap`, whose
 * foreign key is ON DELETE CASCADE, and one of the student's gaps went with
 * the course silently and unrecoverably. `subjectConsequences` already
 * existed and already counted gaps; it was bypassed.
 *
 * So the rule is not "remember the dependants". The rule is that every
 * deletable thing has a function like this one, read from the database, and
 * the interface calls it before asking.
 */
export async function procedureConsequences(procedureId: string): Promise<Consequence[]> {
  const userId = await requireUserId();
  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, userId },
    select: { id: true },
  });
  if (!procedure) return [];

  const steps = await prisma.procedureStep.count({ where: { procedureId } });
  /* Deliberately NOT counted as a loss: the mistakes recorded against these
     steps survive. `Mistake.procedureStepId` is ON DELETE SET NULL, so the
     record that the student missed something — and `whyIGotItWrong` with it —
     outlives the checklist. Reporting them here would tell the student they
     are about to lose a history they are in fact keeping. */
  return consequencesOf({ steps });
}

/**
 * Deletes one procedure and its checklist.
 *
 * The steps go: `ON DELETE CASCADE`, because a step has no meaning apart from
 * its procedure. The misses stay: `SET NULL`, because "I have missed patient
 * identification three times" is a fact about the student, not about the
 * document the checklist came from.
 */
export async function deleteProcedure(procedureId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.procedure.deleteMany({ where: { id: procedureId, userId } });
  assertMutated(count, "Procedure");
  revalidatePath("/clinical");
  revalidatePath("/");
}

/**
 * Deletes one step of a checklist.
 *
 * Individually deletable, and that is a decision rather than completeness for
 * its own sake: these steps are read off a PDF by a model, so a duplicated or
 * hallucinated step is a thing that will happen, and the student is the only
 * one who can see it. Without this they would have to delete the whole
 * checklist and re-drop the file to fix one line.
 *
 * Ownership is proved through the procedure, which is where it lives — the
 * step carries no userId of its own, and giving it one would be a second copy
 * of the same fact that can disagree with the first.
 *
 * The positions of the remaining steps are deliberately NOT renumbered. They
 * are what the document says, and closing the gap would silently renumber
 * every step after it — so a student who has learned "step 7 is the one I
 * forget" would find step 7 is now something else.
 */
export async function deleteProcedureStep(stepId: string, procedureId: string) {
  const userId = await requireUserId();
  const { count } = await prisma.procedureStep.deleteMany({
    where: { id: stepId, procedure: { id: procedureId, userId } },
  });
  assertMutated(count, "Step");
  revalidatePath(`/clinical/${procedureId}`);
}
