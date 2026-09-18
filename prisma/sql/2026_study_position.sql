-- University OS — where the student actually is in a document
--
-- NOT YET APPLIED. Written to be applied with the same guarded, re-runnable
-- shape as the migrations before it.
--
-- WHY THIS EXISTS
--
-- The product is supposed to say "you stopped at slide 18" and carry on from
-- slide 19. It cannot: there is no field anywhere in this schema that records
-- where a student got to. Searched for lastPage, position, progress, resume —
-- nothing. Every time a deck is opened it opens at page one, which is the one
-- behaviour the target architecture calls out as wrong.
--
-- WHY A TABLE AND NOT TWO COLUMNS ON LectureSlide
--
-- Because that mistake has already cost this app an outage. Prisma builds its
-- column list from schema.prisma rather than from the query, so a new column on
-- an existing model makes EVERY default query on that model ask Postgres for
-- it — and against a database where the migration has not run, every route
-- touching the model fails. That is what happened when Task.estimatedMinutes
-- shipped ahead of its migration.
--
-- A new table's blast radius is only the code that reads it. If this migration
-- has not run, Studio is empty; the lecture, the slides and the pen are
-- untouched.
--
-- WHY IT IS NOT A LOG
--
-- StudentEvent is an append-only record of what happened, and stays that way.
-- This is the opposite: one mutable row per document per student, holding only
-- where they are. Position is a fact about the present, not history — and
-- writing a row every time a page turns would put thousands of rows a week in
-- a log whose value is that it is readable.

BEGIN;

-- Table ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StudyPosition" (
  "id"     TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  -- The document. A deck is the unit a student resumes, not a lecture: a
  -- lecture can carry several, and "continue" has to mean the one they were
  -- actually reading.
  "slideId" TEXT NOT NULL,

  -- Where they stopped, and the furthest they have been. Both, because they
  -- answer different questions: "carry on from here" is the first, "how much
  -- of this have you seen" is the second, and a student who flicks back to
  -- check something must not lose their progress by doing so.
  "lastPage"    INTEGER NOT NULL DEFAULT 1,
  "furthestPage" INTEGER NOT NULL DEFAULT 1,

  -- What "recent" is ordered by.
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Set when the student reaches the last page. Nullable rather than a
  -- boolean: the date is worth having, and "never" is the absence of one.
  "completedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudyPosition_pkey" PRIMARY KEY ("id")
);

-- Foreign keys --------------------------------------------------------------
-- A foreign key takes a SHARE ROW EXCLUSIVE lock on the referenced table, and
-- this database has idle_in_transaction_session_timeout = 0, so an abandoned
-- app session holds its locks forever. Fail fast rather than queue ahead of
-- every subsequent read of LectureSlide.
SET LOCAL lock_timeout = '15s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudyPosition_userId_fkey') THEN
    ALTER TABLE "StudyPosition" ADD CONSTRAINT "StudyPosition_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- CASCADE, unlike StudentEvent's SET NULL: a position in a deck that no
  -- longer exists is not a record of anything, it is a dangling pointer.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudyPosition_slideId_fkey') THEN
    ALTER TABLE "StudyPosition" ADD CONSTRAINT "StudyPosition_slideId_fkey"
      FOREIGN KEY ("slideId") REFERENCES "LectureSlide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Indexes -------------------------------------------------------------------
-- One row per student per document, enforced rather than assumed: the writer
-- upserts on this key, so a race between two tabs resolves in the database
-- instead of quietly creating a second position.
CREATE UNIQUE INDEX IF NOT EXISTS "StudyPosition_userId_slideId_key"
  ON "StudyPosition"("userId", "slideId");

-- "What was I reading?" — the only query Studio Home makes.
CREATE INDEX IF NOT EXISTS "StudyPosition_userId_lastViewedAt_idx"
  ON "StudyPosition"("userId", "lastViewedAt" DESC);

-- Postgres does not index foreign keys automatically, and ON DELETE CASCADE
-- has to find the children when a deck is removed.
CREATE INDEX IF NOT EXISTS "StudyPosition_slideId_idx" ON "StudyPosition"("slideId");

-- Row Level Security --------------------------------------------------------
-- The same pattern every user-owned table here uses: the private helper, not a
-- subquery through "User".
ALTER TABLE "StudyPosition" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studyposition_owner_select" ON "StudyPosition";
CREATE POLICY "studyposition_owner_select" ON "StudyPosition"
  FOR SELECT USING ("userId" = private.current_app_user_id());

DROP POLICY IF EXISTS "studyposition_owner_insert" ON "StudyPosition";
CREATE POLICY "studyposition_owner_insert" ON "StudyPosition"
  FOR INSERT WITH CHECK ("userId" = private.current_app_user_id());

-- UPDATE is allowed here, unlike StudentEvent: a position is meant to move.
-- USING and WITH CHECK both, so a row cannot be updated into somebody else's.
DROP POLICY IF EXISTS "studyposition_owner_update" ON "StudyPosition";
CREATE POLICY "studyposition_owner_update" ON "StudyPosition"
  FOR UPDATE USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

DROP POLICY IF EXISTS "studyposition_owner_delete" ON "StudyPosition";
CREATE POLICY "studyposition_owner_delete" ON "StudyPosition"
  FOR DELETE USING ("userId" = private.current_app_user_id());

COMMIT;
