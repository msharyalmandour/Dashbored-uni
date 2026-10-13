/**
 * Reading a stored simulation back into the shape the rules understand.
 *
 * The database holds it as four tables because that is how a graph with
 * ownership and a unique key per step has to be stored. Everything that
 * REASONS about a simulation — `problemsWith`, `choose`, `bestScore` — takes
 * the plain object in src/lib/simulation.ts, which has no idea Prisma exists
 * and is therefore the thing 24 checks can be run against without a database.
 *
 * This file is the seam between those two, and it is the only place that knows
 * both shapes. It does one thing worth stating:
 *
 * IT VALIDATES ON THE WAY OUT, NOT ONLY ON THE WAY IN. A row written before
 * today's rules existed, a node deleted by hand, a migration that dropped a
 * choice — any of these produce a graph that the writer's checks never saw.
 * So `loadSimulation` returns the problems alongside the content and lets the
 * screen decide, rather than handing a student a broken run and finding out
 * three clicks in.
 */

import { prisma } from "@/lib/prisma";
import {
  problemsWith,
  describeProblem,
  type Meters,
  type Simulation,
} from "@/lib/simulation";

/** What a screen gets: the content, and every reason not to trust it. */
export interface StoredSimulation {
  id: string;
  lectureId: string;
  lectureTitle: string;
  subjectId: string;
  subjectName: string;
  /**
   * The lecture's one deck, when it has exactly one.
   *
   * Two things ride on there being exactly one: a cited slide can be checked
   * against a real page count, and the citation on screen can OPEN that page.
   * With two decks, "slide 10" names no particular document, so both the
   * check and the link are dropped rather than pointed at a guess.
   */
  deck: { id: string; pages: number } | null;
  sim: Simulation;
  /** Empty when the content is sound. Each entry is in the student's words. */
  problems: string[];
  /** This student's best finished run, when they have one. */
  best: { score: number; outOf: number; finishedAt: Date } | null;
}

/**
 * `meters` and `effects` come back as Prisma `Json`, which is `unknown` for
 * all practical purposes. A meter is a string or a number by definition — the
 * ward reads "6/7" and 28 and "😐" — so anything else is dropped rather than
 * rendered, because `[object Object]` on a dial is worse than a missing dial.
 */
function asMeters(value: unknown): Meters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Meters = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" || typeof raw === "number") out[key] = raw;
  }
  return out;
}

/**
 * The lecture's simulation, or null when it has none.
 *
 * Ownership runs the way it runs everywhere here: lecture -> subject ->
 * userId, in the `where` rather than in a check afterwards, so a lecture id
 * belonging to someone else is simply not found.
 */
export async function loadSimulation(
  lectureId: string,
  userId: string
): Promise<StoredSimulation | null> {
  const row = await prisma.simulation.findFirst({
    where: { lectureId, lecture: { subject: { userId } } },
    select: {
      id: true,
      lectureId: true,
      title: true,
      startKey: true,
      meters: true,
      lecture: {
        select: {
          title: true,
          subjectId: true,
          subject: { select: { name: true } },
          /* Used only to decide whether exactly one deck owns the slide
             numbers this simulation cites. See `deck` above. */
          slides: { select: { id: true, pageCount: true }, orderBy: { createdAt: "asc" } },
        },
      },
      nodes: {
        select: {
          key: true,
          situation: true,
          question: true,
          choices: {
            select: {
              text: true,
              nextKey: true,
              score: true,
              why: true,
              slide: true,
              effects: true,
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
      /* Only finished runs, best first. An abandoned run has a score that is
         true of nothing — it is the score of however far they got. */
      runs: {
        where: { userId, finishedAt: { not: null } },
        select: { score: true, outOf: true, finishedAt: true },
        orderBy: [{ score: "desc" }, { finishedAt: "desc" }],
        take: 1,
      },
    },
  });
  if (!row) return null;

  const sim: Simulation = {
    title: row.title,
    start: row.startKey,
    meters: asMeters(row.meters),
    nodes: row.nodes.map((n) => ({
      key: n.key,
      situation: n.situation,
      question: n.question,
      choices: n.choices.map((c) => ({
        text: c.text,
        next: c.nextKey,
        score: c.score,
        why: c.why,
        ...(c.slide === null ? {} : { slide: c.slide }),
        ...(c.effects === null ? {} : { effects: asMeters(c.effects) }),
      })),
    })),
  };

  const only = row.lecture.slides.length === 1 ? row.lecture.slides[0] : null;
  const deck = only ? { id: only.id, pages: only.pageCount } : null;
  const best = row.runs[0];

  return {
    id: row.id,
    lectureId: row.lectureId,
    lectureTitle: row.lecture.title,
    subjectId: row.lecture.subjectId,
    subjectName: row.lecture.subject.name,
    deck,
    sim,
    problems: problemsWith(sim, deck?.pages).map(describeProblem),
    best: best ? { score: best.score, outOf: best.outOf, finishedAt: best.finishedAt! } : null,
  };
}

/** Which lectures have one, for the lectures index and the lecture page. */
export async function lecturesWithSimulation(
  lectureIds: string[],
  userId: string
): Promise<Set<string>> {
  if (lectureIds.length === 0) return new Set();
  const rows = await prisma.simulation.findMany({
    where: { lectureId: { in: lectureIds }, lecture: { subject: { userId } } },
    select: { lectureId: true },
  });
  return new Set(rows.map((r) => r.lectureId));
}
