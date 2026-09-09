-- University OS — Time Intelligence
--
-- Applied out-of-band against Supabase, matching how every schema change
-- since the initial migration has been handled in this project (the tracked
-- prisma/migrations/ folder is stale SQLite-era output and is not the source
-- of truth for the live Postgres database).
--
-- APPLIED to the university-os project (tlkebxkjghzytdbulzwj) on 2026-09-09,
-- in five tracked migrations (time_intelligence_01..05). Kept here as the
-- readable record of the change. Safe to re-run: every statement is guarded.
--
-- Note for anyone re-running the ALTER TABLE statements: they need an
-- ACCESS EXCLUSIVE lock, and the first attempt was blocked for ten minutes by
-- app connections sitting `idle in transaction`. This database has
-- `idle_in_transaction_session_timeout = 0`, so such sessions never clear on
-- their own, and pg_cancel_backend does not touch them (there is no running
-- statement to cancel — they wait on ClientRead). pg_terminate_backend is
-- what clears them. Set a `lock_timeout` so a blocked ALTER fails fast
-- instead of queueing ahead of every other query on the table.
--
-- What this adds, and why each piece has to exist before any "you have N
-- hours left today" number can be honest:
--
--   * TimeCommitment — the hours a student is genuinely already spoken for.
--     Lecture.date and ClinicalTraining.date are bare timestamps with no
--     duration, so before this table there was nothing in the database that
--     could say how long a student is actually in a building. Available time
--     computed without it would have been invented.
--
--   * Task.estimatedMinutes — how long a task really takes. Nullable, so an
--     un-estimated task stays *unknown* instead of being averaged into a
--     plan that looks complete and is not.
--
--   * ClinicalTraining.durationMinutes — same reasoning for shifts.

BEGIN;

-- CommitmentKind ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommitmentKind') THEN
    CREATE TYPE "CommitmentKind" AS ENUM (
      'SLEEP', 'UNIVERSITY', 'CLINICAL', 'COMMUTE', 'MEALS', 'WORK', 'PERSONAL'
    );
  END IF;
END$$;

-- TimeCommitment ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TimeCommitment" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "kind"            "CommitmentKind" NOT NULL,
  "label"           TEXT,
  -- 0 = Sunday … 6 = Saturday, matching JavaScript's Date.getDay().
  -- NULL means every day, which is what sleep and meals actually are.
  "weekday"         INTEGER,
  -- Minutes from local midnight, 0-1439. endMinute <= startMinute means the
  -- block crosses midnight (23:00 -> 07:00 sleep), which the engine splits.
  "startMinute"     INTEGER NOT NULL,
  "endMinute"       INTEGER NOT NULL,
  "sourceCaptureId" TEXT,
  "subjectId"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimeCommitment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimeCommitment_weekday_check"
    CHECK ("weekday" IS NULL OR ("weekday" >= 0 AND "weekday" <= 6)),
  CONSTRAINT "TimeCommitment_startMinute_check"
    CHECK ("startMinute" >= 0 AND "startMinute" <= 1439),
  CONSTRAINT "TimeCommitment_endMinute_check"
    CHECK ("endMinute" >= 0 AND "endMinute" <= 1439)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimeCommitment_userId_fkey'
  ) THEN
    ALTER TABLE "TimeCommitment"
      ADD CONSTRAINT "TimeCommitment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimeCommitment_subjectId_fkey'
  ) THEN
    ALTER TABLE "TimeCommitment"
      ADD CONSTRAINT "TimeCommitment_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "TimeCommitment_userId_idx"
  ON "TimeCommitment"("userId");
CREATE INDEX IF NOT EXISTS "TimeCommitment_userId_weekday_idx"
  ON "TimeCommitment"("userId", "weekday");

-- Workload estimates --------------------------------------------------------
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;

ALTER TABLE "ClinicalTraining"
  ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;

-- Row Level Security --------------------------------------------------------
-- Matches the pattern every other user-owned table here already uses: the
-- `private.current_app_user_id()` helper, not a subquery through "User".
-- (An earlier draft of this file used the subquery form. It would have worked,
-- but it was inconsistent with the rest of the database and did a per-row
-- lookup where the existing tables do a function call.)
ALTER TABLE "TimeCommitment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timecommitment_owner_all" ON "TimeCommitment";
CREATE POLICY "timecommitment_owner_all" ON "TimeCommitment"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

COMMIT;
