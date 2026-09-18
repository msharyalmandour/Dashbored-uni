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

/* ================================================================ subject = */

export async function subjectConsequences(subjectId: string): Promise<Consequence[]> {
  const userId = await requireUserId();
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  if (!subject) return [];

  const [lectures, slides, resources, topics, flashcards, problems, mistakes, gaps] = await Promise.all([
    prisma.lecture.count({ where: { subjectId } }),
    prisma.lectureSlide.count({ where: { lecture: { subjectId } } }),
    prisma.lectureResource.count({ where: { lecture: { subjectId } } }),
    prisma.topic.count({ where: { subjectId } }),
    prisma.flashcard.count({ where: { subjectId } }),
    prisma.problem.count({ where: { subjectId } }),
    prisma.mistake.count({ where: { subjectId } }),
    prisma.knowledgeGap.count({ where: { subjectId } }),
  ]);
  return consequencesOf({ lectures, slides, resources, topics, flashcards, problems, mistakes, gaps });
}

export async function deleteSubject(subjectId: string) {
  const userId = await requireUserId();
  const slides = await prisma.lectureSlide.findMany({
    where: { lecture: { subject: { id: subjectId, userId } } },
    select: { fileUrl: true },
  });

  const { count } = await prisma.subject.deleteMany({ where: { id: subjectId, userId } });
  assertMutated(count, "Course");
  await removeFiles(slides.map((s) => s.fileUrl));

  revalidatePath("/academics");
  revalidatePath("/");
}

/* =============================================================== semester = */

export async function semesterConsequences(semesterId: string): Promise<Consequence[]> {
  const userId = await requireUserId();
  const semester = await prisma.semester.findFirst({ where: { id: semesterId, userId }, select: { id: true } });
  if (!semester) return [];

  const where = { subject: { semesterId } };
  const [subjects, lectures, slides, flashcards, problems] = await Promise.all([
    prisma.subject.count({ where: { semesterId } }),
    prisma.lecture.count({ where }),
    prisma.lectureSlide.count({ where: { lecture: { subject: { semesterId } } } }),
    prisma.flashcard.count({ where }),
    prisma.problem.count({ where }),
  ]);
  /* Courses get their own line. They spent a while borrowing `topics`' slot,
     which made the dialog say "6 topics" about six whole courses — a wrong noun
     in the one place where being wrong costs a term's work. */
  return consequencesOf({ subjects, lectures, slides, flashcards, problems });
}

export async function deleteSemester(semesterId: string) {
  const userId = await requireUserId();
  const slides = await prisma.lectureSlide.findMany({
    where: { lecture: { subject: { semesterId, userId } } },
    select: { fileUrl: true },
  });

  const { count } = await prisma.semester.deleteMany({ where: { id: semesterId, userId } });
  assertMutated(count, "Semester");
  await removeFiles(slides.map((s) => s.fileUrl));

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

  const [slides, resources, annotations] = await Promise.all([
    prisma.lectureSlide.count({ where: { lectureId } }),
    prisma.lectureResource.count({ where: { lectureId } }),
    prisma.slideAnnotation.count({ where: { slide: { lectureId } } }),
  ]);
  /* Flashcards, problems and mistakes are deliberately absent: they survive a
     lecture's deletion, and naming them here would be a warning about something
     that is not going to happen — which is how a student learns that the
     warnings are decoration. */
  return consequencesOf({ slides, resources, annotations });
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
    select: { id: true, subjectId: true, slides: { select: { fileUrl: true } } },
  });
  if (!lecture) throw new Error("Not found: Lecture");

  const { count } = await prisma.lecture.deleteMany({
    where: { id: lectureId, subject: { userId } },
  });
  assertMutated(count, "Lecture");
  await removeFiles(lecture.slides.map((s) => s.fileUrl));

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
