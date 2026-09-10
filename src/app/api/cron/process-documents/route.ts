import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runProcessingPipeline } from "@/lib/processors";
import { downloadDocumentFileAsService, isServiceStorageConfigured } from "@/lib/document-storage";
import { organizeWithAgent } from "@/lib/ai/agent/organize";
import { VISION_MIME_TYPES } from "@/lib/capture-kinds";
import { reconcileAllStaleSessions } from "@/lib/focus-reconcile";

/**
 * The Vercel-native replacement for netlify/functions/process-documents.mts
 * (kept in the repo for now — see the migration report). Vercel Cron has
 * no separate "scheduled function" file convention like Netlify's; it
 * just makes an HTTP request to a normal route on a schedule (declared in
 * vercel.json). Everything about the pipeline itself — the Document
 * lifecycle, the processor registry, PDF extraction, the OCR extension
 * point — is unchanged; only this execution/trigger layer is new.
 *
 * Explicitly Node.js (pdfjs-dist's Node build needs real Node APIs and
 * must never end up on the Edge runtime), and a longer-than-default
 * maxDuration since this can process several PDFs per invocation.
 *
 * Schedule note: Vercel's Hobby plan only allows cron jobs to run once
 * per day (a platform limit discovered when actually deploying, not a
 * design choice — the original 10-minute schedule was rejected at
 * deploy time). vercel.json now runs this once daily; BATCH_SIZE is
 * raised accordingly so a day's worth of uploads can clear in one run.
 * On a Pro plan (or a different execution layer later), both the
 * schedule and batch size are one-line changes — nothing else in the
 * pipeline depends on the interval.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 20;

/**
 * How much of this invocation's 60 seconds the agent pass may spend, and how
 * much of that any single item may take.
 *
 * Text extraction runs first and is fast; what is left is shared between the
 * captures behind it. Reserving the balance means the route always returns a
 * real answer instead of being killed with its work half recorded — and an
 * item that does not fit is not lost, only later.
 */
const AGENT_PASS_BUDGET_MS = 40_000;
const PER_CAPTURE_BUDGET_MS = 18_000;

/**
 * Atomically claims up to `limit` QUEUED documents by flipping them to
 * PROCESSING inside one query — `FOR UPDATE SKIP LOCKED` is the standard
 * Postgres job-queue pattern, and it's what actually satisfies "avoid
 * processing the same document twice simultaneously" if this route is
 * ever invoked concurrently (a manual trigger during a scheduled run,
 * Vercel retrying a slow request, etc.). A plain SELECT-then-UPDATE would
 * leave a race window between the two; this doesn't.
 */
async function claimQueuedDocuments(limit: number) {
  return prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Document"
    SET "processingStatus" = 'PROCESSING', "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "Document"
      WHERE "processingStatus" = 'QUEUED'
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id;
  `;
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically
  // when CRON_SECRET is set as a project env var — this is Vercel's own
  // documented mechanism for authenticating cron-triggered requests, so
  // this endpoint can't be triggered by an arbitrary caller. No Supabase
  // key is ever involved in this check.
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Runs before the storage check, and unconditionally: closing out sessions
  // a student walked away from needs no Supabase key and no AI provider, and
  // it is the one piece of upkeep that would otherwise never happen for
  // someone who stopped opening the app. Leaving those sessions ACTIVE is
  // what makes a bad fortnight look like a fortnight where nothing went
  // wrong — see focus-reconcile.ts.
  const reconciled = await reconcileAllStaleSessions();

  if (!isServiceStorageConfigured()) {
    return NextResponse.json({
      skipped: true,
      reason: "SUPABASE_SERVICE_ROLE_KEY is not configured",
      reconciled,
    });
  }

  const claimed = await claimQueuedDocuments(BATCH_SIZE);

  // Each document is processed independently — Promise.allSettled means
  // one failure never stops the rest, and runProcessingPipeline itself
  // never throws (a processor failure is recorded as FAILED, not an
  // exception), so this is really just running them concurrently.
  const results = await Promise.allSettled(
    claimed.map(({ id }) => runProcessingPipeline(id, downloadDocumentFileAsService))
  );
  const unexpectedErrors = results.filter((r) => r.status === "rejected").length;

  // A file dropped into the inbox cannot be classified until its text has been
  // extracted, which is what just happened above. Analysing those captures
  // here — in the same pass, right after the text appears — is what stops a
  // dropped PDF from sitting unread until someone opens the inbox and presses
  // a button. Skipped entirely when no provider is configured, since there is
  // then nothing to run.
  const analyzed = await analyzePendingCaptures();

  return NextResponse.json({ claimed: claimed.length, unexpectedErrors, analyzed, reconciled });
}

/**
 * Picks up captures whose file has finished processing but which have not been
 * looked at yet. UNPROCESSED is included on purpose: that is the state a
 * capture is left in when its document was still being read, and it becomes
 * workable the moment extraction completes.
 *
 * These run through the same agent as an interactive drop, deliberately. A
 * file that happens to be picked up by the nightly pass would otherwise be
 * organised by different rules than the identical file dropped by hand, and
 * the student would have no way of knowing which had happened to theirs.
 */
async function analyzePendingCaptures(): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) return 0;

  const pending = await prisma.captureItem.findMany({
    where: {
      status: { in: ["PENDING", "UNPROCESSED"] },
      // An image is analysed from the picture itself, so it is ready as soon
      // as it is stored; everything else has to wait for text extraction.
      OR: [
        { document: { processingStatus: "COMPLETED" } },
        { document: { mimeType: { in: [...VISION_MIME_TYPES] } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  // Sequential rather than concurrent: each run is a multi-step conversation
  // with the model that writes as it goes, and firing a batch of them at once
  // would multiply both the provider's rate limit and the database connections
  // held open, for a job with all night to finish.
  //
  // The two budgets are the point here. This route's own ceiling is 60s, so a
  // run allowed the interactive 95s could be killed by the platform half way
  // through writing — leaving rows created and nothing recorded about them.
  // Each run gets a slice that fits, and the loop stops while there is still
  // time to return, leaving the rest for tomorrow's pass or for whenever the
  // student next opens the item.
  const deadline = Date.now() + AGENT_PASS_BUDGET_MS;
  let organized = 0;

  for (const { id } of pending) {
    const remaining = deadline - Date.now();
    if (remaining < PER_CAPTURE_BUDGET_MS) break;

    await organizeWithAgent(id, downloadDocumentFileAsService, {
      timeBudgetMs: PER_CAPTURE_BUDGET_MS,
    }).catch(() => null);
    organized += 1;
  }

  return organized;
}
