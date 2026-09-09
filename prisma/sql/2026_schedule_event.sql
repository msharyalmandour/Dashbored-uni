-- University OS — Schedule Events (Time Intelligence, STEP 1)
--
-- APPLIED to the university-os project (tlkebxkjghzytdbulzwj) on 2026-09-09,
-- in four tracked migrations (schedule_event_01..04). Kept here as the
-- readable record. Safe to re-run: every statement is guarded.
--
-- WHY A NEW TABLE AND NOT NEW COLUMNS
--
-- Adding a column to an existing model is the dangerous shape of change in
-- this codebase: Prisma builds its column list from schema.prisma, not from
-- the query, so the moment a column exists in the schema every default query
-- on that model asks Postgres for it. Against a database that has not been
-- migrated yet, that breaks every route touching the model — which is exactly
-- what happened when Task.estimatedMinutes shipped ahead of its migration.
--
-- A new table has no such blast radius: only code that queries it can fail.
-- So the time foundation is added as its own table, and Lecture and
-- ClinicalTraining are left completely untouched.
--
-- WHAT IT IS FOR
--
-- Lecture.date and ClinicalTraining.date are bare timestamps with no duration,
-- so nothing in the database could say how long a student is actually
-- committed for. TimeCommitment covers the recurring shape of a week; this
-- covers the specific dated occurrences that land in it. Available time needs
-- both.

BEGIN;

-- Enums ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScheduleEventType') THEN
    CREATE TYPE "ScheduleEventType" AS ENUM (
      'LECTURE', 'CLINICAL', 'EXAM', 'QUIZ', 'ASSIGNMENT',
      'DEADLINE', 'STUDY_SESSION', 'PERSONAL', 'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScheduleEventSource') THEN
    CREATE TYPE "ScheduleEventSource" AS ENUM (
      'STUDENT', 'TIMETABLE_IMPORT', 'LECTURE_RECORD', 'CLINICAL_RECORD', 'RECURRENCE'
    );
  END IF;
END$$;

-- Table ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScheduleEvent" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "type"            "ScheduleEventType" NOT NULL,
  -- endsAt is nullable on purpose: a deadline is an instant, not a span, and
  -- consumes no calendar time. Storing endsAt = startsAt would invent a
  -- zero-length block instead of saying "this has no duration" — so the check
  -- below rejects that too, not just backwards spans.
  --
  -- Duration is derived from the pair and never stored. Two stored copies of
  -- the same fact disagree the first time someone edits one of them.
  "startsAt"        TIMESTAMP(3) NOT NULL,
  "endsAt"          TIMESTAMP(3),
  "location"        TEXT,
  "source"          "ScheduleEventSource" NOT NULL DEFAULT 'STUDENT',
  "sourceCaptureId" TEXT,
  "subjectId"       TEXT,
  "lectureId"       TEXT,
  "clinicalId"      TEXT,
  "taskId"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleEvent_span_check"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt")
);

-- Foreign keys and indexes --------------------------------------------------
-- Adding a foreign key takes a SHARE ROW EXCLUSIVE lock on the *referenced*
-- table. This database has idle_in_transaction_session_timeout = 0, so an
-- abandoned app session holds its locks forever and will block this. Set a
-- lock_timeout so a blocked statement fails fast rather than queueing ahead of
-- every subsequent read on Task or Lecture. If it does block: cancel this
-- statement first, then clear the blockers with pg_terminate_backend —
-- pg_cancel_backend does nothing to a session that is idle in transaction,
-- because there is no running statement to cancel.
SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEvent_userId_fkey') THEN
    ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEvent_subjectId_fkey') THEN
    ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEvent_lectureId_fkey') THEN
    ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_lectureId_fkey"
      FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEvent_clinicalId_fkey') THEN
    ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_clinicalId_fkey"
      FOREIGN KEY ("clinicalId") REFERENCES "ClinicalTraining"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEvent_taskId_fkey') THEN
    ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- The workhorse: "everything for this student inside this window".
CREATE INDEX IF NOT EXISTS "ScheduleEvent_userId_startsAt_idx" ON "ScheduleEvent"("userId", "startsAt");
-- Postgres does not index foreign keys automatically, and ON DELETE SET NULL
-- has to locate the children when a parent row is removed.
CREATE INDEX IF NOT EXISTS "ScheduleEvent_subjectId_idx"  ON "ScheduleEvent"("subjectId");
CREATE INDEX IF NOT EXISTS "ScheduleEvent_lectureId_idx"  ON "ScheduleEvent"("lectureId");
CREATE INDEX IF NOT EXISTS "ScheduleEvent_clinicalId_idx" ON "ScheduleEvent"("clinicalId");
CREATE INDEX IF NOT EXISTS "ScheduleEvent_taskId_idx"     ON "ScheduleEvent"("taskId");

-- Row Level Security --------------------------------------------------------
-- The pattern every user-owned table here uses: the private helper, not a
-- subquery through "User".
ALTER TABLE "ScheduleEvent" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduleevent_owner_all" ON "ScheduleEvent";
CREATE POLICY "scheduleevent_owner_all" ON "ScheduleEvent"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

COMMIT;
