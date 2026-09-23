-- University OS — the five tables the agent could not reach, made undoable
--
-- WHY THIS EXISTS
--
-- "Undo this drop" works by one predicate per table: delete the rows whose
-- sourceCaptureId is this capture, and only those, so a student's own work is
-- structurally untouchable by undo. Eight tables carry that column today, and
-- undo clears exactly those eight.
--
-- The agent is about to be able to write five more — the readable slide deck a
-- dropped lecture becomes, a problem set, a video, a clinical shift, a file
-- attached to a lecture. Without this column on each of them, every one of
-- those rows would survive an undo, and the button would be telling the
-- student something untrue. That is the one failure this design exists to
-- prevent, so the column comes first and the tools come after.
--
-- ORDER MATTERS, AND GETTING IT WRONG TAKES THE SITE DOWN
--
-- Prisma builds its column list from schema.prisma, not from the query. A new
-- column on an existing model makes EVERY default query on that model ask
-- Postgres for it — so against a database where this has not run, every route
-- touching Problem, Video, ClinicalTraining, LectureResource or LectureSlide
-- fails. This file is therefore applied to the database BEFORE schema.prisma
-- names the field, never the other way round. The same mistake has already
-- cost this app an outage once, with Task.estimatedMinutes.
--
-- SHAPE
--
-- Matched to the eight that already exist, checked against the live database:
-- plain nullable text, no foreign key. No FK on purpose — a capture row may be
-- cleared away long after the rows it created, and a dangling reference must
-- not cascade into a student's records or block the cleanup.
--
-- Additive, nullable, and re-runnable. Nothing is rewritten, nothing is
-- dropped, existing rows keep a NULL and are therefore invisible to undo,
-- which is exactly right: the agent did not create them.

ALTER TABLE "Problem"          ADD COLUMN IF NOT EXISTS "sourceCaptureId" TEXT;
ALTER TABLE "Video"            ADD COLUMN IF NOT EXISTS "sourceCaptureId" TEXT;
ALTER TABLE "ClinicalTraining" ADD COLUMN IF NOT EXISTS "sourceCaptureId" TEXT;
ALTER TABLE "LectureResource"  ADD COLUMN IF NOT EXISTS "sourceCaptureId" TEXT;
ALTER TABLE "LectureSlide"     ADD COLUMN IF NOT EXISTS "sourceCaptureId" TEXT;

-- Undo queries every one of these by capture id, so each gets the index the
-- eight existing tables have. Partial, because the overwhelming majority of
-- rows are the student's own and carry NULL: indexing those would be paying
-- for a value undo never looks up.
CREATE INDEX IF NOT EXISTS "Problem_sourceCaptureId_idx"
  ON "Problem" ("sourceCaptureId") WHERE "sourceCaptureId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Video_sourceCaptureId_idx"
  ON "Video" ("sourceCaptureId") WHERE "sourceCaptureId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ClinicalTraining_sourceCaptureId_idx"
  ON "ClinicalTraining" ("sourceCaptureId") WHERE "sourceCaptureId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "LectureResource_sourceCaptureId_idx"
  ON "LectureResource" ("sourceCaptureId") WHERE "sourceCaptureId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "LectureSlide_sourceCaptureId_idx"
  ON "LectureSlide" ("sourceCaptureId") WHERE "sourceCaptureId" IS NOT NULL;
