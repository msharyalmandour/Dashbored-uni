-- Proves the boundary that matters most: a subject id the model supplies is
-- checked against the student it is acting for, so a hallucinated or borrowed
-- id cannot write into another account.
--
-- The check itself lives in `resolveSubject` (src/lib/ai/agent/tools.ts), which
-- calls `verifySubject(userId, subjectId)` before every write that takes one.
-- This file exercises the query that check reduces to, against real rows, so
-- the guarantee is demonstrated on the database rather than argued from code.
--
-- Run against the real database. It ends in ROLLBACK and writes nothing.
-- Set two real, different user ids first:
--   \set uid_a 'cmt...'
--   \set uid_b 'cmt...'

BEGIN;

-- Two students, one course each.
INSERT INTO "Semester" (id,"userId",name,"startDate","endDate","createdAt","updatedAt")
VALUES ('vfy_sem_a', :'uid_a', 'A term', now(), now() + interval '120 days', now(), now()),
       ('vfy_sem_b', :'uid_b', 'B term', now(), now() + interval '120 days', now(), now());

INSERT INTO "Subject" (id,"userId","semesterId",name,"createdAt","updatedAt")
VALUES ('vfy_subj_a', :'uid_a', 'vfy_sem_a', 'Student A course', now(), now()),
       ('vfy_subj_b', :'uid_b', 'vfy_sem_b', 'Student B course', now(), now());

-- `verifySubject` is exactly this lookup: the id AND the acting user. A row
-- comes back only when the course really belongs to them.
--
-- Expected, in order:
--   own course      -> 1  (the write proceeds)
--   other's course  -> 0  (the tool returns an error to the model instead)
--   invented id     -> 0  (a hallucinated id writes nothing)
SELECT 'A writing to A''s own course' AS scenario,
       count(*) AS rows_visible,
       CASE WHEN count(*) = 1 THEN 'write allowed' ELSE 'UNEXPECTED' END AS outcome
FROM "Subject" WHERE id = 'vfy_subj_a' AND "userId" = :'uid_a'
UNION ALL
SELECT 'A writing to B''s course',
       count(*),
       CASE WHEN count(*) = 0 THEN 'write refused' ELSE 'SECURITY FAILURE' END
FROM "Subject" WHERE id = 'vfy_subj_b' AND "userId" = :'uid_a'
UNION ALL
SELECT 'A writing to an invented id',
       count(*),
       CASE WHEN count(*) = 0 THEN 'write refused' ELSE 'SECURITY FAILURE' END
FROM "Subject" WHERE id = 'subj_does_not_exist' AND "userId" = :'uid_a';

ROLLBACK;
