-- Where a study session's target came from.
--
-- NOT the feature. The instrument.
--
-- Measured on the real account 2026-09-29: nine sessions, two finished. Both
-- of the two had a target the app had written from one of the student's own
-- records; all seven abandonments had either no target or one the student
-- free-typed ("اذاكر اليكتشير" — "I study the lecture", which has no condition
-- under which it is done).
--
-- Two observations. patterns.ts sets MIN_OBSERVATIONS = 4 and refuses to call
-- anything below that a pattern, and it is right to. So this column is not
-- here because the question is answered — it is here because the question is
-- currently UNANSWERABLE. Nothing records the distinction, and it can only be
-- reconstructed by parsing the shape of a label across two languages, which is
-- guesswork dressed as data.
--
-- Recorded at the moment a session starts, it is a fact. In a month it is
-- enough observations to confirm the design decision in follow-through.ts or
-- to kill it. Either outcome is worth more than the feature would have been.
--
-- Deliberately NOT a Postgres enum: adding a value to an enum in a migration
-- is a lock and a redeploy, and the list of places a session can be started
-- from is the thing most likely to grow. The check constraint is enforced,
-- readable in psql, and altered without a table rewrite.

BEGIN;

ALTER TABLE "FocusSession"
  ADD COLUMN IF NOT EXISTS "targetKind" TEXT,
  ADD COLUMN IF NOT EXISTS "targetRefId" TEXT;

ALTER TABLE "FocusSession"
  DROP CONSTRAINT IF EXISTS "FocusSession_targetKind_check";

ALTER TABLE "FocusSession"
  ADD CONSTRAINT "FocusSession_targetKind_check"
  CHECK ("targetKind" IS NULL OR "targetKind" IN
         ('TASK', 'CARD', 'GAP', 'LECTURE_SECTION', 'FREE', 'NONE'));

-- Nullable, and left null on the nine rows that already exist. Backfilling
-- them by guessing from their labels would put invented data into the only
-- table that can answer the question — the same mistake as a fixture with
-- estimated numbers in it. Null means "we were not recording yet", which is
-- true, and any analysis can exclude it honestly.
COMMENT ON COLUMN "FocusSession"."targetKind" IS
  'Where the session target came from. Null = recorded before this column existed; never backfilled by inference.';

-- A reference is required for the four record-backed kinds and forbidden for
-- the other two. This is the one rule follow-through.ts enforces in code, and
-- enforcing it here too is what stops a label that reads specific with nothing
-- behind it from ever reaching the resume offer.
ALTER TABLE "FocusSession"
  DROP CONSTRAINT IF EXISTS "FocusSession_targetRef_check";

ALTER TABLE "FocusSession"
  ADD CONSTRAINT "FocusSession_targetRef_check"
  CHECK (
    "targetKind" IS NULL
    OR ("targetKind" IN ('FREE', 'NONE') AND "targetRefId" IS NULL)
    OR ("targetKind" NOT IN ('FREE', 'NONE') AND "targetRefId" IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS "FocusSession_targetKind_idx" ON "FocusSession"("targetKind");

COMMIT;

-- ROLLBACK:
--   ALTER TABLE "FocusSession"
--     DROP CONSTRAINT IF EXISTS "FocusSession_targetRef_check",
--     DROP CONSTRAINT IF EXISTS "FocusSession_targetKind_check",
--     DROP COLUMN IF EXISTS "targetRefId",
--     DROP COLUMN IF EXISTS "targetKind";
