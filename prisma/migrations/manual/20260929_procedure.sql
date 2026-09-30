-- A procedure and its steps, for a performed exam.
--
-- WHAT THIS REPLACES, and why it is a replacement rather than an addition.
-- `ClinicalTraining` has been in the schema since the first week and holds
-- ZERO rows after twenty-four days of real use, while being one of the five
-- top-level destinations in the sidebar. Its columns say why: hospital,
-- department, supervisor, skillsPracticed, whatILearned, whatIDidNotUnderstand,
-- questionsToAsk, reflection, nextAction. That is a reflective journal asking a
-- nursing student for five essays at the end of an eight-hour shift. The form
-- cost more than it returned, so it was never filled in once.
--
-- An OSPE is not a journal. An examiner says "insert a nasogastric tube" and
-- marks the steps performed and omitted. So the unit is a procedure and its
-- ordered steps, and the fact worth keeping is WHICH STEP was missed.
--
-- `ClinicalTraining` is left exactly where it is by this migration. It is
-- empty, so nothing is at stake in dropping it, and nothing is gained either;
-- dropping a table is the one step that cannot be undone by editing code, and
-- it is not needed to make any of this work.
--
-- A MISSED STEP IS A `Mistake`, not a new kind of row. That model already has
-- `frequency`, `whatIShouldReview`, a link to the knowledge gap, and
-- `mistake-patterns.ts` already finds what a student keeps getting wrong. All
-- of it was built and then starved, because the only way to create a Mistake
-- was a form nobody filled in either. Pointing it at a procedure step is what
-- finally gives it something to read.

BEGIN;

CREATE TABLE IF NOT EXISTS "Procedure" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL,
  "subjectId"        TEXT,
  "name"             TEXT NOT NULL,
  -- Where the checklist came from. A procedure built from the student's own
  -- faculty PDF is worth more than one a model wrote from memory, and this is
  -- what lets the interface say which it is instead of presenting both alike.
  "sourceDocumentId" TEXT,
  -- The same stamp every agent write carries, so a procedure created by a drop
  -- is undone by the same path as everything else that drop created.
  "sourceCaptureId"  TEXT,
  -- Null means never practised, which is a different fact from practised long
  -- ago and is ordered differently — see practiceOrder in src/lib/ospe.ts.
  "lastPracticedAt"  TIMESTAMP,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT "Procedure_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE,
  -- SET NULL, not CASCADE. A procedure checklist is the student's own work and
  -- outlives the course it was filed under; losing the filing is an
  -- inconvenience, losing the checklist is losing the thing they built.
  CONSTRAINT "Procedure_subjectId_fkey" FOREIGN KEY ("subjectId")
    REFERENCES "Subject"("id") ON DELETE SET NULL,
  CONSTRAINT "Procedure_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId")
    REFERENCES "Document"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Procedure_userId_idx" ON "Procedure"("userId");
CREATE INDEX IF NOT EXISTS "Procedure_subjectId_idx" ON "Procedure"("subjectId");
CREATE INDEX IF NOT EXISTS "Procedure_sourceCaptureId_idx" ON "Procedure"("sourceCaptureId");

CREATE TABLE IF NOT EXISTS "ProcedureStep" (
  "id"          TEXT PRIMARY KEY,
  "procedureId" TEXT NOT NULL,
  -- Named `position` rather than `order`, which is a reserved word and would
  -- need quoting in every hand-written query from here on.
  "position"    INTEGER NOT NULL,
  "text"        TEXT NOT NULL,
  -- A step whose omission fails the station on its own. Set by the student
  -- from their own faculty's checklist and never inferred: which steps are
  -- critical is a marking convention that differs between schools, and
  -- guessing it would be the app inventing the rule it then judges them by.
  "critical"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),

  -- CASCADE here and only here: a step has no meaning apart from its
  -- procedure, so deleting the procedure and leaving the steps would leave
  -- rows nothing can reach. This is the relationship CASCADE is for, unlike
  -- the two above.
  CONSTRAINT "ProcedureStep_procedureId_fkey" FOREIGN KEY ("procedureId")
    REFERENCES "Procedure"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProcedureStep_procedureId_position_idx"
  ON "ProcedureStep"("procedureId", "position");

-- Two steps of one procedure cannot share a position. Without this the order
-- shown is whatever the planner returns, and for a procedure the order IS the
-- content — step 5 before step 4 is a different and sometimes unsafe act.
CREATE UNIQUE INDEX IF NOT EXISTS "ProcedureStep_procedureId_position_key"
  ON "ProcedureStep"("procedureId", "position");

ALTER TABLE "Mistake"
  ADD COLUMN IF NOT EXISTS "procedureStepId" TEXT;

-- SET NULL: an attempt outlives an edited checklist. If a step is removed, the
-- record that the student missed something stays — with `whyIGotItWrong` still
-- readable — rather than the history quietly shrinking whenever a checklist is
-- tidied. src/lib/ospe.ts already ignores missed ids it does not recognise,
-- so a null here scores exactly as it should.
ALTER TABLE "Mistake"
  DROP CONSTRAINT IF EXISTS "Mistake_procedureStepId_fkey";

ALTER TABLE "Mistake"
  ADD CONSTRAINT "Mistake_procedureStepId_fkey" FOREIGN KEY ("procedureStepId")
    REFERENCES "ProcedureStep"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Mistake_procedureStepId_idx" ON "Mistake"("procedureStepId");

COMMENT ON COLUMN "Mistake"."procedureStepId" IS
  'The checklist step this miss was on. Null for a mistake that was not made during a procedure.';

-- RLS, copying the shape every other table here uses. Read from pg_policies
-- rather than written from memory: these tables are reached through
-- private.current_app_user_id(), NOT auth.uid().
ALTER TABLE "Procedure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcedureStep" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "procedure_owner_all" ON "Procedure";
CREATE POLICY "procedure_owner_all" ON "Procedure"
  FOR ALL
  USING ("userId" = private.current_app_user_id())
  WITH CHECK ("userId" = private.current_app_user_id());

-- A step is owned through its procedure: it carries no userId of its own, and
-- adding one would be a second copy of the same fact that can disagree with
-- the first.
DROP POLICY IF EXISTS "procedurestep_owner_all" ON "ProcedureStep";
CREATE POLICY "procedurestep_owner_all" ON "ProcedureStep"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Procedure" p
    WHERE p."id" = "ProcedureStep"."procedureId"
      AND p."userId" = private.current_app_user_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Procedure" p
    WHERE p."id" = "ProcedureStep"."procedureId"
      AND p."userId" = private.current_app_user_id()
  ));

COMMIT;

-- ROLLBACK:
--   ALTER TABLE "Mistake"
--     DROP CONSTRAINT IF EXISTS "Mistake_procedureStepId_fkey",
--     DROP COLUMN IF EXISTS "procedureStepId";
--   DROP TABLE IF EXISTS "ProcedureStep";
--   DROP TABLE IF EXISTS "Procedure";
