import { prisma } from "../../src/lib/prisma";
import { runProcessingPipeline } from "../../src/lib/processors";
import { downloadDocumentFileAsService, isServiceStorageConfigured } from "../../src/lib/document-storage";

/**
 * NOTE: the primary deployment target is now Vercel — see
 * src/app/api/cron/process-documents/route.ts, which runs the identical
 * pipeline via Vercel Cron. This file is kept only as the background job
 * for a Netlify deployment (a rollback path), not deleted outright. Do
 * not run both against the same database at once — they'd double-claim
 * from the same queue.
 *
 * The background job for the file-intelligence pipeline. University OS's
 * app code otherwise runs entirely as synchronous Next.js Server Actions
 * — there's no existing queue/worker infrastructure, and text extraction
 * (PDF parsing today, OCR/AI/embeddings later) is exactly the kind of
 * work that must NOT happen inside a user's upload request.
 *
 * Why a Netlify Scheduled Function, not a third-party queue (Inngest,
 * Trigger.dev, QStash, …): those are all reasonable choices in general,
 * but every one of them needs a new vendor account, API keys, and a
 * webhook signing setup — none of which can be provisioned from here,
 * and "do not introduce infrastructure that cannot run reliably in the
 * current deployment environment" ruled them out for this pass. A
 * Scheduled Function is first-party to the same Netlify site this app
 * already deploys to, needs zero new accounts or dependencies, and the
 * queue itself is just `Document.processingStatus = 'QUEUED'` — no
 * separate message broker to run or misconfigure. The trade-off is
 * latency (documents wait for the next tick, not truly instant), which
 * is the right trade for "don't block the upload request" anyway.
 *
 * Runs outside any user's session, so it cannot use the per-user-token
 * Storage client the rest of the app uses — it downloads files with the
 * Supabase service role key instead (see document-storage.ts). That key
 * is not available to this sandbox; until it's added as a Netlify env
 * var (Supabase dashboard → Project Settings → API → service_role →
 * Netlify env var SUPABASE_SERVICE_ROLE_KEY, secret), this function
 * deliberately leaves queued documents untouched rather than marking
 * real files FAILED for a configuration gap that isn't their fault.
 */
async function processDocumentsQueue() {
  if (!isServiceStorageConfigured()) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "SUPABASE_SERVICE_ROLE_KEY is not configured" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  const queued = await prisma.document.findMany({
    where: { processingStatus: "QUEUED" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const { id } of queued) {
    await runProcessingPipeline(id, downloadDocumentFileAsService);
  }

  return new Response(JSON.stringify({ queuedFound: queued.length }), {
    headers: { "content-type": "application/json" },
  });
}

export default processDocumentsQueue;

export const config = {
  // Every 10 minutes. A personal-scale queue doesn't need tighter
  // latency than that, and it keeps function invocations cheap.
  schedule: "*/10 * * * *",
};
