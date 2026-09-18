-- University OS — Personal Student Intelligence, foundation
--
-- APPLIED to the university-os project (tlkebxkjghzytdbulzwj) on 2026-09-09,
-- in three tracked migrations (student_event_01..03). Kept here as the
-- readable record. Safe to re-run: every statement is guarded.
--
-- WHY TWO NEW TABLES AND ZERO NEW COLUMNS
--
-- Prisma builds its column list from schema.prisma, not from the query, so a
-- new column on an existing model makes every default query on that model ask
-- Postgres for it. Against an unmigrated database that breaks every route
-- touching the model — which is exactly what happened when
-- Task.estimatedMinutes shipped ahead of its migration and took the app down.
--
-- A new table has no such blast radius. So this layer adds no column to Task,
-- FocusSession or User: the task a session was for, the moment a task was
-- completed, and how far a deadline moved all live in the event's context.
--
-- WHY A LOG AND NOT A PROFILE
--
-- Patterns ("mornings usually go better", "this assignment keeps getting
-- moved") are recomputed from these rows whenever they are needed and are
-- never stored. A stored conclusion outlives the behaviour that produced it,
-- so a student who changes would stay labelled by who they were a month ago.
-- There is deliberately nowhere in this schema to write a trait.

BEGIN;

-- Enum ----------------------------------------------------------------------
-- Every member names an action, not a trait. No PROCRASTINATED, no
-- UNMOTIVATED, no BAD_DAY: those are readings of a person rather than records
-- of an event, and a system that stores a reading eventually shows it back to
-- the student as a fact about who they are.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentEventType') THEN
    CREATE TYPE "StudentEventType" AS ENUM (
      'SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_ABANDONED',
      'TASK_COMPLETED', 'TASK_POSTPONED',
      'ENERGY_SELECTED', 'STUDENT_STUCK', 'RECOVERY_USED', 'HELP_USED',
      'SUGGESTION_ACCEPTED', 'SUGGESTION_DECLINED'
    );
  END IF;
END$$;

-- Tables --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StudentEvent" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "type"           "StudentEventType" NOT NULL,
  "occurredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taskId"         TEXT,
  "focusSessionId" TEXT,
  "subjectId"      TEXT,
  -- The few numbers that make the event readable later: planned and actual
  -- minutes, the energy chosen, how far a deadline moved. Small and specific
  -- on purpose — not a place to accumulate whatever happened to be in scope.
  "context"        JSONB,
  CONSTRAINT "StudentEvent_pkey" PRIMARY KEY ("id")
);

-- Key/value rather than a widening row of boolean columns, because
-- preferences are exactly the kind of thing that gets added one at a time,
-- and each addition would otherwise be a column on an existing model.
CREATE TABLE IF NOT EXISTS "StudentPreference" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "value"     JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentPreference_pkey" PRIMARY KEY ("id")
);

-- Foreign keys and indexes --------------------------------------------------
-- Adding a foreign key takes a SHARE ROW EXCLUSIVE lock on the *referenced*
-- table. This database has idle_in_transaction_session_timeout = 0, so an
-- abandoned app session holds its locks forever and will block this. The
-- lock_timeout makes a blocked statement fail fast rather than queueing ahead
-- of every subsequent read on Task or FocusSession. If it does block: cancel
-- this statement first, then clear the blockers with pg_terminate_backend —
-- pg_cancel_backend does nothing to a session that is idle in transaction,
-- because there is no running statement to cancel.
SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvent_userId_fkey') THEN
    ALTER TABLE "StudentEvent" ADD CONSTRAINT "StudentEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- SET NULL, not CASCADE: deleting a task must not erase the record that
  -- time was spent on it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvent_taskId_fkey') THEN
    ALTER TABLE "StudentEvent" ADD CONSTRAINT "StudentEvent_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvent_focusSessionId_fkey') THEN
    ALTER TABLE "StudentEvent" ADD CONSTRAINT "StudentEvent_focusSessionId_fkey"
      FOREIGN KEY ("focusSessionId") REFERENCES "FocusSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvent_subjectId_fkey') THEN
    ALTER TABLE "StudentEvent" ADD CONSTRAINT "StudentEvent_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentPreference_userId_fkey') THEN
    ALTER TABLE "StudentPreference" ADD CONSTRAINT "StudentPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Every pattern query is "this student's events, in this window", and several
-- are "…of this type". Both shapes get an index; the rest exist because
-- Postgres does not index foreign keys automatically and ON DELETE SET NULL
-- has to locate the children when a parent row is removed.
CREATE INDEX IF NOT EXISTS "StudentEvent_userId_occurredAt_idx"
  ON "StudentEvent"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StudentEvent_userId_type_occurredAt_idx"
  ON "StudentEvent"("userId", "type", "occurredAt");
CREATE INDEX IF NOT EXISTS "StudentEvent_taskId_idx"         ON "StudentEvent"("taskId");
CREATE INDEX IF NOT EXISTS "StudentEvent_focusSessionId_idx" ON "StudentEvent"("focusSessionId");
CREATE INDEX IF NOT EXISTS "StudentEvent_subjectId_idx"      ON "StudentEvent"("subjectId");

CREATE UNIQUE INDEX IF NOT EXISTS "StudentPreference_userId_key_key"
  ON "StudentPreference"("userId", "key");

-- Row Level Security --------------------------------------------------------
-- The pattern every user-owned table here uses: the private helper, not a
-- subquery through "User".
ALTER TABLE "StudentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentPreference" ENABLE ROW LEVEL SECURITY;

-- Append-only, enforced rather than merely intended. A record of what happened
-- is only trustworthy if it cannot be rewritten after the fact, so there is
-- deliberately no UPDATE policy: without one, UPDATE is denied outright.
DROP POLICY IF EXISTS "studentevent_owner_select" ON "StudentEvent";
CREATE POLICY "studentevent_owner_select" ON "StudentEvent"
  FOR SELECT USING ("userId" = private.current_app_user_id());

DROP POLICY IF EXISTS "studentevent_owner_insert" ON "StudentEvent";
CREATE POLICY "studentevent_owner_insert" ON "StudentEvent"
  FOR INSERT WITH CHECK ("userId" = private.current_app_user_id());

-- Deletion stays allowed: the student must be able to erase their own
-- history. Immutable is not the same as inescapable.
DROP POLICY IF EXISTS "studentevent_owner_delete" ON "StudentEvent";
CREATE POLICY "studentevent_owner_delete" ON "StudentEvent"
  FOR DELETE USING ("userId" = private.current_app_user_id());

DROP POLICY IF EXISTS "studentpreference_owner_all" ON "StudentPreference";
CREATE POLICY "studentpreference_owner_all" ON "StudentPreference"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

COMMIT;
