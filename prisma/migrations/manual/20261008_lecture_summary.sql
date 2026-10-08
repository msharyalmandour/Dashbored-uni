-- A LECTURE IN THREE LINES, A CHAIN, AND WHAT YOU MUST KNOW.
--
-- WHY. The owner asked on 2026-10-08 for a lecture to produce a summary with
-- a diagram. Measured in his account: 19 documents carry real extracted text
-- across 277 pages, and none of it reaches a screen as anything a student can
-- read in a minute.
--
-- The validity rules and the drawing both live in src/lib/summary.ts, not
-- here. What the database enforces is the floor: the parts of a summary that
-- make no sense absent or empty.
--
-- WHY `chain` IS AN ARRAY AND `points` IS A TABLE, which is not an
-- inconsistency. A chain step is nothing but an ordered label; there is no
-- second column it could grow, and a child table for it means three joins to
-- read a drawing. A point has a heading AND a body, both required, and a row
-- is the only shape where "required" is enforced instead of hoped for.
--
-- AN EMPTY CHAIN IS A REAL ANSWER, not a missing one. A lecture that lists
-- drug classes is not a sequence, and an invented arrow between two of them
-- is a claim the lecture never made. Nothing is drawn then, and that is
-- correct.

BEGIN;

CREATE TABLE IF NOT EXISTS "LectureSummary" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "lectureId"        TEXT NOT NULL,
  "idea"             TEXT NOT NULL,
  "chain"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceDocumentId" TEXT,
  "sourceCaptureId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LectureSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SummaryPoint" (
  "id"        TEXT NOT NULL,
  "summaryId" TEXT NOT NULL,
  "position"  INTEGER NOT NULL,
  "heading"   TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  CONSTRAINT "SummaryPoint_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "LectureSummary" IS
  'One lecture summarised: the idea, an ordered cause-to-effect chain (empty when the lecture is not a sequence), and its key points. Rules and drawing in src/lib/summary.ts.';

-- One summary per lecture. A re-read replaces it rather than stacking a second
-- opinion beside the first, which is the state a student cannot resolve.
CREATE UNIQUE INDEX IF NOT EXISTS "LectureSummary_lectureId_key"
  ON "LectureSummary"("lectureId");

ALTER TABLE "LectureSummary" DROP CONSTRAINT IF EXISTS "LectureSummary_userId_fkey";
ALTER TABLE "LectureSummary" ADD CONSTRAINT "LectureSummary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LectureSummary" DROP CONSTRAINT IF EXISTS "LectureSummary_lectureId_fkey";
ALTER TABLE "LectureSummary" ADD CONSTRAINT "LectureSummary_lectureId_fkey"
  FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not cascade: deleting the file does not make the summary untrue.
-- What is lost is the pages you could go and check it against.
ALTER TABLE "LectureSummary" DROP CONSTRAINT IF EXISTS "LectureSummary_sourceDocumentId_fkey";
ALTER TABLE "LectureSummary" ADD CONSTRAINT "LectureSummary_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SummaryPoint" DROP CONSTRAINT IF EXISTS "SummaryPoint_summaryId_fkey";
ALTER TABLE "SummaryPoint" ADD CONSTRAINT "SummaryPoint_summaryId_fkey"
  FOREIGN KEY ("summaryId") REFERENCES "LectureSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "LectureSummary_userId_idx"          ON "LectureSummary"("userId");
CREATE INDEX IF NOT EXISTS "LectureSummary_sourceCaptureId_idx" ON "LectureSummary"("sourceCaptureId");
CREATE INDEX IF NOT EXISTS "SummaryPoint_summaryId_idx"         ON "SummaryPoint"("summaryId");

-- One point per position, so a rewrite cannot leave two rows fighting over
-- third place.
CREATE UNIQUE INDEX IF NOT EXISTS "SummaryPoint_summaryId_position_key"
  ON "SummaryPoint"("summaryId", "position");

-- A summary with no idea is not a summary.
ALTER TABLE "LectureSummary" DROP CONSTRAINT IF EXISTS "LectureSummary_idea_present";
ALTER TABLE "LectureSummary" ADD CONSTRAINT "LectureSummary_idea_present"
  CHECK (length(btrim("idea")) > 0);

-- A one-step chain is refused in src/lib/summary.ts for a reason a reader can
-- see — one box teaches nothing — and refused here too so no other writer can
-- bypass it. Zero is allowed and common; one never is.
ALTER TABLE "LectureSummary" DROP CONSTRAINT IF EXISTS "LectureSummary_chain_shape";
ALTER TABLE "LectureSummary" ADD CONSTRAINT "LectureSummary_chain_shape"
  CHECK (array_length("chain", 1) IS NULL OR array_length("chain", 1) BETWEEN 2 AND 7);

-- A heading that promises something with no body under it is the exact bullet
-- a nullable column would have allowed.
ALTER TABLE "SummaryPoint" DROP CONSTRAINT IF EXISTS "SummaryPoint_both_present";
ALTER TABLE "SummaryPoint" ADD CONSTRAINT "SummaryPoint_both_present"
  CHECK (length(btrim("heading")) > 0 AND length(btrim("body")) > 0);

ALTER TABLE "SummaryPoint" DROP CONSTRAINT IF EXISTS "SummaryPoint_position_sane";
ALTER TABLE "SummaryPoint" ADD CONSTRAINT "SummaryPoint_position_sane"
  CHECK ("position" >= 0 AND "position" < 7);

ALTER TABLE "LectureSummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SummaryPoint"   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecturesummary_owner_all" ON "LectureSummary";
CREATE POLICY "lecturesummary_owner_all" ON "LectureSummary"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

-- A point is owned through its summary, the way a lecture is owned through its
-- course everywhere else in this schema.
DROP POLICY IF EXISTS "summarypoint_owner_all" ON "SummaryPoint";
CREATE POLICY "summarypoint_owner_all" ON "SummaryPoint"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "LectureSummary" s
    WHERE s.id = "SummaryPoint"."summaryId"
      AND s."userId" = private.current_app_user_id()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "LectureSummary" s
    WHERE s.id = "SummaryPoint"."summaryId"
      AND s."userId" = private.current_app_user_id()));

COMMIT;
