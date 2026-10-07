-- ONE FIELD THE ORB CHANGED, AND WHAT IT WAS BEFORE.
--
-- WHY. Undo is what makes the agent safe to hand to someone; undo.ts opens by
-- saying so and it is right. But undo works by deleting rows that carry the
-- drop's `sourceCaptureId`, so it can only ever take back a CREATION.
--
-- On 2026-10-07 the owner asked for the orb to do everything the site can do.
-- Measured that day against src/app/actions: 86 server actions, 22 orb tools,
-- 54 the orb could not reach — and 41 of those 54 are CHANGES to rows that
-- already exist (postpone this, close that, mark this finished, grade this
-- card). Not one of them is reversible by deleting anything.
--
-- So an editing orb without this table can silently and permanently rewrite a
-- student's own records, which breaks the promise the whole feature rests on.
-- The rule this table enforces is absolute: the orb may not change a field it
-- has not first recorded the old value of.
--
-- WHY TEXT COLUMNS. A log that needs a typed column per field falls behind the
-- first time a tool touches a new kind of field, and a stale audit trail is
-- worse than no audit trail because it is trusted. Text round-trips every
-- scalar this app stores — a date as ISO 8601, an enum as its name, a number
-- as digits — and the reverter parses by the field it is restoring, which it
-- knows at the point of restoring it.
--
-- WHY NO FOREIGN KEY to the row it describes. A change log with a per-table FK
-- cannot record a change to a row that is later deleted, which is exactly when
-- the log matters most. `model` and `recordId` are validated by the single
-- function that writes them, not by the database.
--
-- NULL IS A VALUE in `before` and `after`. It means the field was, or became,
-- null — never "unknown". Nothing writes a change whose previous value it
-- could not read.

BEGIN;

CREATE TABLE IF NOT EXISTS "OrbChange" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "captureId"  TEXT NOT NULL,
  "model"      TEXT NOT NULL,
  "recordId"   TEXT NOT NULL,
  "field"      TEXT NOT NULL,
  "before"     TEXT,
  "after"      TEXT,
  "revertedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrbChange_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "OrbChange" IS
  'One field the orb changed on an existing row, with its previous value, so a request can be undone the way a drop can. See prisma/migrations/manual/20261007_orb_change.sql.';

-- Cascade: a deleted account's change log is not evidence about anybody.
ALTER TABLE "OrbChange"
  DROP CONSTRAINT IF EXISTS "OrbChange_userId_fkey";
ALTER TABLE "OrbChange"
  ADD CONSTRAINT "OrbChange_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- By owner, for the undo path; by capture, which is how a whole run is
-- reverted; by row, which is how one field's history is read.
CREATE INDEX IF NOT EXISTS "OrbChange_userId_idx"           ON "OrbChange"("userId");
CREATE INDEX IF NOT EXISTS "OrbChange_captureId_idx"        ON "OrbChange"("captureId");
CREATE INDEX IF NOT EXISTS "OrbChange_model_recordId_idx"   ON "OrbChange"("model", "recordId");

-- An empty model, recordId or field makes a row that cannot be reverted and
-- cannot be read — a silent hole in the one trail that has to be complete.
ALTER TABLE "OrbChange"
  DROP CONSTRAINT IF EXISTS "OrbChange_target_present";
ALTER TABLE "OrbChange"
  ADD CONSTRAINT "OrbChange_target_present"
  CHECK (length("model") > 0 AND length("recordId") > 0 AND length("field") > 0);

-- A change that changed nothing is not a change. Recording one would make a
-- revert a no-op the student was told about, and inflate the count of what a
-- run did. `IS DISTINCT FROM` so that null-to-null is caught as well.
ALTER TABLE "OrbChange"
  DROP CONSTRAINT IF EXISTS "OrbChange_actually_changed";
ALTER TABLE "OrbChange"
  ADD CONSTRAINT "OrbChange_actually_changed"
  CHECK ("before" IS DISTINCT FROM "after");

-- RLS, matching every other table in this schema: the app connects as one
-- role and the student is established per request by
-- private.current_app_user_id(), NOT auth.uid().
ALTER TABLE "OrbChange" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orbchange_owner_all" ON "OrbChange";
CREATE POLICY "orbchange_owner_all" ON "OrbChange"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

COMMIT;
