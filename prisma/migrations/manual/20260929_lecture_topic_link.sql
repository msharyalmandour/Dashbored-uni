-- A lecture covers many concepts, and a concept appears in many lectures.
--
-- NOT APPLIED. Read this, then decide. It is here because the repair it
-- enables is a write to a real student's records and that is not mine to make.
--
-- WHY, measured on the live database on 2026-09-29:
--
--   Topic                         46 rows, 46 of them empty
--   Lecture                        6 rows,  6 of them with topicId = NULL
--   Flashcard                     42 rows,  0 of them with a topicId
--   Topic.masteryLevel                     uncomputable, for want of inputs
--
-- The cause is not filing. `Topic` is declared as a container — `Topic.lectures`
-- is a list, so one Topic holds many Lectures — and the agent wrote a syllabus's
-- CONCEPT outline into it: "PEEP", "SWOT analysis", "Dead space and shunt".
-- Those are the contents of a lecture, not containers for one. `Lecture.topicId`
-- then asked each lecture to name the single Topic it sits under, and a lecture
-- that covers eleven concepts has no single answer, so the agent stored none.
--
-- The signature is one measurement: match each lecture title against the 46
-- topic names and the counts are 0, 0, 0, 0, 7, 2. Never exactly one. A
-- container relationship gives exactly one, every time.
--
-- The fix is not to re-level the concepts. "Do I know PEEP?" is a real question
-- and `Topic.masteryLevel` is the right place for its answer. The fix is the
-- edge: a single foreign key was modelling a many-to-many relationship.
--
-- WHAT THIS DOES, and what it deliberately does not:
--
--   * adds "LectureTopic", a join table. Purely additive.
--   * leaves `Lecture.topicId` in place and untouched. Every page that reads it
--     keeps working, and nothing in the app has to change on the day this runs.
--     It becomes "the one topic this lecture is mainly about", which is a
--     reasonable thing to keep, and the join table carries coverage.
--   * writes no links. Linking is src/lib/concept-match.ts, which decides from
--     the text of the lectures the student owns, deterministically, with no
--     model call — and refuses when the text cannot say. That runs as a
--     reviewable pass, not inside a migration.
--   * deletes nothing. None of the 46 rows is removed or renamed.
--
-- ROLLBACK is at the bottom and is a single DROP: nothing else changes.

BEGIN;

CREATE TABLE IF NOT EXISTS "LectureTopic" (
    "lectureId" TEXT NOT NULL,
    "topicId"   TEXT NOT NULL,

    -- How the link came to exist, so a wrong one can be traced to the pass
    -- that made it rather than argued about. 'TEXT' is concept-match.ts;
    -- 'STUDENT' is a link made by hand and must never be overwritten by a
    -- later automated pass; 'AGENT' is one the agent asserted from content.
    "source"    TEXT NOT NULL DEFAULT 'TEXT',

    -- The score concept-match.ts gave it, kept so a threshold change can be
    -- evaluated against the links already written instead of guessed at.
    "score"     DOUBLE PRECISION,

    -- Which dropped item produced this, when one did. Same contract as
    -- Lecture.sourceCaptureId: "undo this drop" must never remove a link the
    -- student made themselves, and those carry NULL.
    "sourceCaptureId" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LectureTopic_pkey" PRIMARY KEY ("lectureId", "topicId")
);

-- CASCADE on both sides: a link is meaningless without either end, and the
-- existing Lecture->Subject and Topic->Subject relations already cascade from
-- Subject, so a deleted course takes its links with it rather than leaving
-- rows pointing at nothing.
ALTER TABLE "LectureTopic"
    ADD CONSTRAINT "LectureTopic_lectureId_fkey"
    FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LectureTopic"
    ADD CONSTRAINT "LectureTopic_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- "what does this lecture cover" is the primary key's own prefix and needs no
-- index; "which lectures teach this concept" is the other direction and does.
CREATE INDEX IF NOT EXISTS "LectureTopic_topicId_idx" ON "LectureTopic"("topicId");
CREATE INDEX IF NOT EXISTS "LectureTopic_sourceCaptureId_idx" ON "LectureTopic"("sourceCaptureId");

-- Row level security, in this database's own idiom.
--
-- Copied in shape from `lectureslide_owner_all`, which is the existing policy
-- for the other table hanging off a Lecture. It goes through
-- `private.current_app_user_id()` rather than reaching for `auth.uid()`
-- directly: the first draft of this file did the latter, from memory, and
-- would have been the only table in the schema not using the helper. Checked
-- against pg_policies before applying.
--
-- The Topic side is deliberately not also checked. It would be redundant —
-- concept-match.ts only ever links a Lecture and a Topic that share a Subject,
-- and the Subject is where ownership lives.
ALTER TABLE "LectureTopic" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecturetopic_owner_all" ON "LectureTopic";
CREATE POLICY "lecturetopic_owner_all" ON "LectureTopic"
    USING (
        EXISTS (
            SELECT 1 FROM "Lecture" l
            JOIN "Subject" s ON s.id = l."subjectId"
            WHERE l.id = "LectureTopic"."lectureId"
              AND s."userId" = private.current_app_user_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Lecture" l
            JOIN "Subject" s ON s.id = l."subjectId"
            WHERE l.id = "LectureTopic"."lectureId"
              AND s."userId" = private.current_app_user_id()
        )
    );

COMMIT;

-- Add to prisma/schema.prisma in the same commit that applies this, or the
-- next `prisma generate` will not know the table exists:
--
--   model LectureTopic {
--     lectureId       String
--     topicId         String
--     source          String   @default("TEXT")
--     score           Float?
--     sourceCaptureId String?
--     createdAt       DateTime @default(now())
--
--     lecture Lecture @relation(fields: [lectureId], references: [id], onDelete: Cascade)
--     topic   Topic   @relation(fields: [topicId], references: [id], onDelete: Cascade)
--
--     @@id([lectureId, topicId])
--     @@index([topicId])
--     @@index([sourceCaptureId])
--   }
--
-- and on the two existing models:
--
--   model Lecture { ...  coveredTopics LectureTopic[] }
--   model Topic   { ...  taughtIn      LectureTopic[] }

-- ROLLBACK:
--   DROP TABLE IF EXISTS "LectureTopic";
-- Nothing else is touched, so this leaves the database exactly as it was.
