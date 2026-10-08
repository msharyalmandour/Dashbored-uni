-- WHAT ONE GRADED THING IN A COURSE IS WORTH.
--
-- WHY. Measured on the owner's account 2026-10-07: two of his six courses have
-- a syllabus, both already extracted, and the weights in them reach no screen.
-- NURC 411 prices Clinical Evaluation at 30% and its final — which IS the OSCE
-- and OSPE — at 40%, so seventy per cent of that course is clinical
-- performance, against ClinicalTraining and Procedure both holding 0 rows.
-- NURC 410 shares the course name and is graded completely differently, and
-- the app treats them identically.
--
-- WHY A TABLE AND NOT A COLUMN ON Subject. What a student needs is never the
-- total; it is which part is heaviest. 411 is Clinical Evaluation 30, Problem
-- Solving project 10, Documentation 20 — and Documentation is itself two
-- sheets at 10 each. One number cannot answer "what is worth most", which is
-- the only question anybody asks of a syllabus twice.
--
-- `weight` IS A SHARE OF THE COURSE, not of the parent row. In 411, Clinical
-- Evaluation is 30 and its parent Semester work is 60, and 30 + 10 + 20 = 60,
-- which settles it. Shares-of-parent would make the figure a student actually
-- wants a calculation.
--
-- WHAT MAY BE WRITTEN HERE is decided by src/lib/grades.ts, not by this table:
-- a set of weights is the set that sums to 100, and each group sums to the row
-- above it. Both of his syllabi satisfy it exactly, which is what proves a
-- table was read whole rather than sampled. The constraints below are the
-- floor — per-row sanity the database can enforce — and the sums are checked
-- in the one function that writes.

BEGIN;

CREATE TABLE IF NOT EXISTS "GradeComponent" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "subjectId"        TEXT NOT NULL,
  "parentId"         TEXT,
  "label"            TEXT NOT NULL,
  "weight"           DOUBLE PRECISION NOT NULL,
  "sourceDocumentId" TEXT,
  "sourceCaptureId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradeComponent_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "GradeComponent" IS
  'One graded component of a course and its share OF THE COURSE (not of its parent row), read from the student''s syllabus. Validity rules in src/lib/grades.ts.';

ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_userId_fkey";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_subjectId_fkey";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cascade down the tree: removing "Documentation" removes the two sheets under
-- it, because a child whose parent is gone is a weight belonging to nothing and
-- would silently break the per-group sum.
ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_parentId_fkey";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "GradeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not cascade: a deleted syllabus does not unprice the course. The
-- weight is still true; what is lost is the file you could go and check it in.
ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_sourceDocumentId_fkey";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One row per label per course, so re-reading a syllabus updates rather than
-- doubling the course to 200%.
CREATE UNIQUE INDEX IF NOT EXISTS "GradeComponent_subjectId_label_key"
  ON "GradeComponent"("subjectId", "label");

CREATE INDEX IF NOT EXISTS "GradeComponent_userId_idx"          ON "GradeComponent"("userId");
CREATE INDEX IF NOT EXISTS "GradeComponent_subjectId_idx"       ON "GradeComponent"("subjectId");
CREATE INDEX IF NOT EXISTS "GradeComponent_parentId_idx"        ON "GradeComponent"("parentId");
CREATE INDEX IF NOT EXISTS "GradeComponent_sourceCaptureId_idx" ON "GradeComponent"("sourceCaptureId");

-- A weight outside 0-100 is not a share of anything. Zero is allowed: a
-- syllabus can list an ungraded requirement.
ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_weight_range";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_weight_range"
  CHECK ("weight" >= 0 AND "weight" <= 100);

-- An unlabelled component cannot be shown to anybody.
ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_label_present";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_label_present"
  CHECK (length(btrim("label")) > 0);

-- A row under itself has no depth and would hang any sum that walks upward.
ALTER TABLE "GradeComponent" DROP CONSTRAINT IF EXISTS "GradeComponent_no_self_parent";
ALTER TABLE "GradeComponent" ADD CONSTRAINT "GradeComponent_no_self_parent"
  CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "GradeComponent" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gradecomponent_owner_all" ON "GradeComponent";
CREATE POLICY "gradecomponent_owner_all" ON "GradeComponent"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

COMMIT;
