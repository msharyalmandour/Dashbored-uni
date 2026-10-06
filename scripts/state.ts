/**
 * THE STATE OF THE APP — the one command that answers "what do we do next?".
 *
 * WHY THIS EXISTS. On 2026-10-06 the project had a 182-row task list, fifteen
 * of them pending, several contradicting work already finished — and then the
 * container restarted and the whole list evaporated, twice in one session.
 * Anything that is not in git does not exist, and a list nobody can rank is
 * not a plan, it is the reason you cannot tell what matters.
 *
 * So priority is not remembered here, it is MEASURED. Every line below is a
 * live query against the student's own database, printed with the one
 * consequence it has for what to build. The order is deliberate: the clock
 * first, because a deadline is the only thing on this list that cannot be
 * rescheduled by us.
 *
 * What it refuses to do: score anything. There is no health number, no percent
 * complete, no weighted composite — this project deleted one of those for
 * being fiction (see the commit "Delete the academic-health score, not just
 * its card"). Every figure here is a count of real rows, and where there is
 * nothing to count it says so rather than substituting a default.
 *
 * Run: npm run state
 */

import { PrismaClient } from "@prisma/client";

/* `.env` is gitignored, and this container has been reset twice mid-session —
   so a missing URL is a normal state, not a bug, and it gets a sentence rather
   than a stack trace. tsx does not load .env on its own the way `next` does. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

if (!process.env.DATABASE_URL) {
  console.error(
    "\nNo DATABASE_URL.\n\n" +
      "This reads the live database, so it needs the connection string in\n" +
      ".env.local or .env — see .env.example for the names. It is gitignored,\n" +
      "so a fresh container starts without it.\n\n" +
      "Everything else still works: `npm run build`, the 42 verify scripts and\n" +
      "the typecheck are all offline.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

/** Whole days from now, rounded up, never negative. Same rule as exam-readiness.ts. */
function daysFromNow(date: Date, now: Date): number {
  const ms = date.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

function heading(text: string) {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

/**
 * One measured line: the figure, what it is, and what it means for the build.
 *
 * `soWhat` is only printed when the figure is actually a call to do something.
 * A line that always carries advice is a line nobody reads — the same reason
 * the home page's exam band is absent until a page a day stops being enough.
 */
function line(figure: string | number, what: string, soWhat?: string) {
  const f = String(figure).padStart(6);
  console.log(`${f}  ${what}${soWhat ? `\n        → ${soWhat}` : ""}`);
}

async function main() {
  const now = new Date();
  console.log(`State of the app — ${now.toISOString().slice(0, 10)}`);

  /* ── THE CLOCK ───────────────────────────────────────────────────────────
     First because it is the only section we cannot reprioritise. */
  heading("THE CLOCK");

  const openTasks = await prisma.task.findMany({
    where: { status: { not: "COMPLETED" }, deadline: { gte: now } },
    select: { title: true, type: true, deadline: true, subject: { select: { name: true } } },
    orderBy: { deadline: "asc" },
    take: 4,
  });

  if (openTasks.length === 0) {
    line(0, "nothing open and dated ahead");
  } else {
    for (const t of openTasks) {
      const days = daysFromNow(t.deadline, now);
      line(
        days,
        `days — ${t.title.slice(0, 58)}${t.title.length > 58 ? "…" : ""}`,
        // A week is the line where a deadline stops being a plan and starts
        // being this week's work.
        days <= 7 ? "inside a week: anything we build should serve this first" : undefined
      );
    }
  }

  /* A performed exam is its own category: nothing in the written-exam
     machinery prepares for it, which is why it is counted separately. */
  const ospe = await prisma.task.findMany({
    where: { status: { not: "COMPLETED" }, deadline: { gte: now }, title: { contains: "OSPE" } },
    select: { deadline: true },
    orderBy: { deadline: "asc" },
    take: 1,
  });
  const procedures = await prisma.procedure.count();
  if (ospe.length > 0) {
    line(
      daysFromNow(ospe[0].deadline, now),
      `days to the first OSPE — ${procedures} procedures recorded`,
      procedures === 0
        ? "a performed exam with no checklist to practise against"
        : undefined
    );
  }

  /* ── WHAT IS BLOCKED ────────────────────────────────────────────────────
     Things no amount of our work fixes. They go second so they are never
     mistaken for build items. */
  heading("WHAT IS BLOCKED (not ours to fix in code)");

  const [lastOrganised, failedDrops, latestFailure] = await Promise.all([
    prisma.captureItem.findFirst({
      where: { status: "ORGANIZED" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.captureItem.count({ where: { error: { not: null } } }),
    prisma.captureItem.findFirst({
      where: { error: { not: null } },
      select: { createdAt: true, error: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const silentDays = lastOrganised ? daysFromNow(now, lastOrganised.createdAt) : null;
  line(
    failedDrops,
    `failed drops${lastOrganised ? `, last success ${lastOrganised.createdAt.toISOString().slice(0, 10)}` : ""}`,
    failedDrops > 0 && latestFailure
      ? `still failing as of ${latestFailure.createdAt.toISOString().slice(0, 10)}: ${String(latestFailure.error).slice(0, 70)}`
      : undefined
  );
  if (silentDays !== null && silentDays > 1) {
    line(silentDays, "days since the agent last produced anything");
  }

  /* ── WHAT IS STARVED ────────────────────────────────────────────────────
     Empty tables, with the reason. The distinction that matters: a table is
     starved when its only input is broken, and dead when nobody wants it. The
     two look identical in a row count and need opposite responses — this
     project nearly deleted Problem and Mistake on the wrong reading. */
  heading("WHAT IS STARVED (empty, but wanted)");

  const [clinical, videos, problems, mistakes, reviewItems] = await Promise.all([
    prisma.clinicalTraining.count(),
    prisma.video.count(),
    prisma.problem.count(),
    prisma.mistake.count(),
    prisma.reviewItem.count(),
  ]);

  /* The clinical hours are the measurement that makes the zero mean something:
     without them, "0 clinical records" could just be a student with no
     placement. TIMETABLE_KINDS in today-classes.ts treats CLINICAL as real
     scheduled time, and this is the same rows. */
  const clinicalBlocks = await prisma.timeCommitment.findMany({
    where: { kind: "CLINICAL" },
    select: { startMinute: true, endMinute: true },
  });
  const clinicalHours =
    clinicalBlocks.reduce((sum, b) => sum + (b.endMinute - b.startMinute), 0) / 60;

  line(
    clinical,
    `clinical records, against ${clinicalHours.toFixed(1)}h of clinical blocks a week`,
    clinical === 0 && clinicalHours > 0
      ? "the largest block in the week, and nothing records it"
      : undefined
  );
  line(videos, "saved clips");
  line(reviewItems, "review items (flashcards are counted separately)");
  line(problems, "practice questions");
  line(mistakes, "recorded mistakes");

  /* ── WHAT IS STALE ──────────────────────────────────────────────────────
     Rows that exist and are not moving. Different problem from empty: the
     material is there and something about the interface or the loop is not
     landing. */
  heading("WHAT IS STALE (there, not moving)");

  const [cards, unseenCards, gaps, stuckGaps, unfiled, abandoned, completed] =
    await Promise.all([
      prisma.flashcard.count(),
      prisma.flashcard.count({ where: { reviewCount: 0 } }),
      prisma.knowledgeGap.count(),
      prisma.knowledgeGap.count({ where: { status: "NOT_UNDERSTOOD" } }),
      prisma.document.count({ where: { lectureId: null, processingStatus: "COMPLETED" } }),
      prisma.studentEvent.count({ where: { type: "SESSION_ABANDONED" } }),
      prisma.studentEvent.count({ where: { type: "SESSION_COMPLETED" } }),
    ]);

  line(
    `${unseenCards}/${cards}`,
    "cards never shown once",
    unseenCards > cards / 2 ? "more than half the pile has never been opened" : undefined
  );
  line(
    `${stuckGaps}/${gaps}`,
    "gaps still in the first state",
    stuckGaps === gaps && gaps > 0 ? "not one has ever moved" : undefined
  );
  line(unfiled, "documents read but filed under no lecture");
  line(
    `${abandoned}/${abandoned + completed}`,
    "study sessions abandoned",
    // Four is the floor every engine in this codebase uses before it will say
    // anything from a sample. See MIN_OBSERVATIONS in patterns.ts.
    completed < 4
      ? `only ${completed} completed — below the 4 this project requires before inferring anything`
      : undefined
  );

  /* ── SHIPPED OR NOT ────────────────────────────────────────────────────
     The last question, and the easiest one to get wrong: work that is written
     and not merged is work the student cannot see. This project has already
     claimed fixes were live when they were only on a branch. */
  heading("SHIPPED");
  console.log("        (run `git rev-list --left-right --count origin/main...HEAD`)");
  console.log("        Vercel deploys production from main. A branch is not shipped.");

  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
