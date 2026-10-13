/**
 * Write an authored simulation into the database.
 *
 * IT VALIDATES FIRST AND REFUSES. The rules in src/lib/simulation.ts exist
 * because this content is generated, and a seed script is the one place where
 * a human is tempted to skip the check because "I wrote this one myself". The
 * check runs anyway: a dead end written by hand is the same dead end.
 *
 * IT IS IDEMPOTENT, by replacing rather than adding. `Simulation` is unique on
 * lectureId, so re-running this against the same lecture deletes the nodes and
 * writes them again inside one transaction. Runs are NOT touched: a student's
 * playthrough survives the content being rewritten, which is what `outOf` on
 * the run is for — it remembers the maximum that was reachable when he played.
 *
 *   npx tsx scripts/seed-simulation.ts <lectureId>
 */

import { PrismaClient } from "@prisma/client";
import { problemsWith, describeProblem } from "../src/lib/simulation";
import { MANAGEMENT_PROCESS } from "../prisma/simulations/management-process";

const prisma = new PrismaClient();

async function main() {
  const lectureId = process.argv[2];
  if (!lectureId) throw new Error("usage: seed-simulation.ts <lectureId>");

  const sim = MANAGEMENT_PROCESS;

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      id: true,
      title: true,
      slides: { select: { title: true, pageCount: true } },
    },
  });
  if (!lecture) throw new Error(`no lecture ${lectureId}`);

  /* Checked against the deck when exactly one owns the lecture — same rule
     the screen uses, so what seeds is what plays. */
  const pages = lecture.slides.length === 1 ? lecture.slides[0].pageCount : undefined;
  const problems = problemsWith(sim, pages);
  if (problems.length > 0) {
    for (const problem of problems) console.error("  ✗", describeProblem(problem));
    throw new Error("the simulation breaks its own rules; nothing was written");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.simulation.findUnique({
      where: { lectureId },
      select: { id: true },
    });
    /* Nodes and choices cascade from the simulation, so deleting the nodes is
       enough — and the simulation row itself is updated rather than replaced
       so the runs hanging off it keep pointing at something. */
    if (existing) {
      await tx.simulationNode.deleteMany({ where: { simulationId: existing.id } });
      await tx.simulation.update({
        where: { id: existing.id },
        data: { title: sim.title, startKey: sim.start, meters: sim.meters },
      });
    }
    const row =
      existing ??
      (await tx.simulation.create({
        data: {
          lectureId,
          title: sim.title,
          startKey: sim.start,
          meters: sim.meters,
        },
        select: { id: true },
      }));

    for (const [position, node] of sim.nodes.entries()) {
      await tx.simulationNode.create({
        data: {
          simulationId: row.id,
          key: node.key,
          situation: node.situation,
          question: node.question,
          position,
          choices: {
            create: node.choices.map((choice, i) => ({
              text: choice.text,
              nextKey: choice.next,
              score: choice.score,
              why: choice.why,
              slide: choice.slide ?? null,
              effects: choice.effects ?? undefined,
              position: i,
            })),
          },
        },
      });
    }
  });

  console.log(`wrote "${sim.title}" (${sim.nodes.length} steps) onto ${lecture.title}`);
  if (pages === undefined) {
    console.log("note: slide citations were NOT checked — this lecture has no single deck.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
