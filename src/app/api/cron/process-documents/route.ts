import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runProcessingPipeline } from "@/lib/processors";
import { downloadDocumentFileAsService, isServiceStorageConfigured } from "@/lib/document-storage";

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

  if (!isServiceStorageConfigured()) {
    return NextResponse.json({ skipped: true, reason: "SUPABASE_SERVICE_ROLE_KEY is not configured" });
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

  return NextResponse.json({ claimed: claimed.length, unexpectedErrors });
}
