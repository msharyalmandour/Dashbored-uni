-- Proves that importing a timetable replaces the previous import and nothing
-- else. Run against the real database (Supabase SQL editor, psql, or the
-- Supabase MCP `execute_sql`) — it ends in ROLLBACK, so it writes nothing.
--
-- Why this exists as SQL rather than as a test next to the code: the change it
-- checks is a DELETE, and the only thing worth being sure of is which rows the
-- predicate reaches. That is a question about the database, and the honest way
-- to answer it is to put rows in a real one and see which survive.
--
-- Replace the user id below with a real one before running.
--   \set uid 'cmt...'

BEGIN;

-- The world just before a second import: one block the student typed
-- themselves, two rows a previous import wrote, one imported class that has
-- already happened, and one dated event from somewhere else entirely.
INSERT INTO "TimeCommitment"
  (id,"userId",kind,label,weekday,"startMinute","endMinute","sourceCaptureId","createdAt","updatedAt")
VALUES
  ('vfy_tc_hand', :'uid', 'SLEEP',      'Sleep (typed by hand)', NULL, 1380, 420, NULL,          now(), now()),
  ('vfy_tc_imp1', :'uid', 'UNIVERSITY', 'Old import A',             0,  480, 600, 'vfy_cap_old', now(), now()),
  ('vfy_tc_imp2', :'uid', 'UNIVERSITY', 'Old import B',             2,  660, 780, 'vfy_cap_old', now(), now());

INSERT INTO "ScheduleEvent"
  (id,"userId",title,type,"startsAt","endsAt",source,"sourceCaptureId","createdAt","updatedAt")
VALUES
  ('vfy_se_future',  :'uid', 'Imported upcoming class',             'LECTURE',
   now() + interval '2 days', now() + interval '2 days 2 hours', 'TIMETABLE_IMPORT', 'vfy_cap_old', now(), now()),
  ('vfy_se_past',    :'uid', 'Imported class that already happened','LECTURE',
   now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 'TIMETABLE_IMPORT', 'vfy_cap_old', now(), now()),
  ('vfy_se_student', :'uid', 'Event the student created',           'LECTURE',
   now() + interval '3 days', now() + interval '3 days 1 hour', 'STUDENT', NULL, now(), now());

-- The two predicates `acceptDetectedTimetable` runs before re-importing.
DELETE FROM "TimeCommitment"
 WHERE "userId" = :'uid' AND "sourceCaptureId" IS NOT NULL;

DELETE FROM "ScheduleEvent"
 WHERE "userId" = :'uid'
   AND source = 'TIMETABLE_IMPORT'
   AND "startsAt" >= date_trunc('day', now());

-- Expected survivors, and only these three:
--   vfy_tc_hand     the student's own block is never touched by an import
--   vfy_se_past     a class that already happened stays on the record
--   vfy_se_student  an event from another source is not an import's business
SELECT id, coalesce(label, title) AS name FROM (
  SELECT id, label, NULL::text AS title FROM "TimeCommitment" WHERE id LIKE 'vfy_%'
  UNION ALL
  SELECT id, NULL, title FROM "ScheduleEvent" WHERE id LIKE 'vfy_%'
) survivors ORDER BY id;

ROLLBACK;
