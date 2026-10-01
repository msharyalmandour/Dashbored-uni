import { PrismaClient } from "@prisma/client";
import { planLinks, type LectureWithText, type TopicRow } from "../src/lib/concept-link";

/**
 * Link every concept to the lecture that teaches it.
 *
 * DRY RUN BY DEFAULT. Pass --write to commit, which is the only way this
 * touches a row. The reason is not caution for its own sake: the links this
 * writes become the inputs to Topic.masteryLevel and to every academic
 * question the agent will be able to answer, so a wrong one does not stay a
 * wrong row — it becomes a wrong answer about what the student knows.
 *
 *   npx tsx scripts/link-concepts.ts            # show the plan
 *   npx tsx scripts/link-concepts.ts --write    # apply it
 *
 * Idempotent: a second run over unchanged data writes nothing new, and a link
 * whose `source` is STUDENT is never touched, because a person placed it and
 * arithmetic does not get to overrule a person.
 */

const WRITE = process.argv.includes("--write");
const prisma = new PrismaClient();

async function main() {
  const lectures = await prisma.lecture.findMany({
    select: {
      id: true,
      title: true,
      subjectId: true,
      documents: {
        where: { processingStatus: "COMPLETED", extractedText: { not: null } },
        select: { extractedText: true },
      },
    },
  });

  const withText: LectureWithText[] = lectures.map((l) => ({
    id: l.id,
    title: l.title,
    subjectId: l.subjectId,
    text: l.documents.map((d) => d.extractedText ?? "").join(" "),
  }));

  const topics: TopicRow[] = await prisma.topic.findMany({
    select: { id: true, name: true, subjectId: true },
  });

  const readable = withText.filter((l) => l.text.trim().length > 0);
  console.log(
    `${lectures.length} lectures, ${readable.length} with readable text, ${topics.length} concepts\n`
  );
  if (readable.length < 2) {
    console.log("Fewer than two lectures carry text: rarity cannot be measured. Nothing to do.");
    return;
  }

  const plan = planLinks(withText, topics);

  console.log(`PROPOSED LINKS (${plan.links.length})`);
  for (const link of plan.links) {
    const margin = link.runnerUp > 0 ? `  (next best ${link.runnerUp.toFixed(2)})` : "";
    console.log(
      `  ${link.score.toFixed(2).padStart(6)}  ${link.topicName.slice(0, 46).padEnd(46)} -> ${link.lectureTitle.slice(0, 30)}${margin}`
    );
  }

  console.log(`\nUNPLACED (${plan.unplaced.length}) — left alone, not guessed at`);
  for (const u of plan.unplaced) {
    console.log(`  ${u.best.toFixed(2).padStart(6)}  ${u.topicName.slice(0, 46).padEnd(46)} ${u.reason}`);
  }

  if (!WRITE) {
    console.log(`\nDry run. Nothing written. Pass --write to apply these ${plan.links.length} links.`);
    return;
  }

  /* Existing links are read first so a STUDENT link is never overwritten and
     so a re-run reports honestly what it changed rather than what it attempted. */
  const existing = await prisma.lectureTopic.findMany({
    select: { lectureId: true, topicId: true, source: true },
  });
  const protectedKeys = new Set(
    existing.filter((e) => e.source === "STUDENT").map((e) => `${e.lectureId}:${e.topicId}`)
  );
  const alreadyKeys = new Set(existing.map((e) => `${e.lectureId}:${e.topicId}`));

  const toWrite = plan.links.filter((l) => !protectedKeys.has(`${l.lectureId}:${l.topicId}`));
  const fresh = toWrite.filter((l) => !alreadyKeys.has(`${l.lectureId}:${l.topicId}`));

  for (const link of toWrite) {
    await prisma.lectureTopic.upsert({
      where: { lectureId_topicId: { lectureId: link.lectureId, topicId: link.topicId } },
      create: {
        lectureId: link.lectureId,
        topicId: link.topicId,
        source: "TEXT",
        score: link.score,
      },
      /* The score is refreshed because the corpus grows: the same link made
         against more lectures is a different measurement, and keeping the old
         number would misreport how it was decided. `source` is not touched. */
      update: { score: link.score },
    });
  }

  console.log(
    `\nWrote ${fresh.length} new links, refreshed ${toWrite.length - fresh.length}, ` +
      `left ${protectedKeys.size} student-made links untouched.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
