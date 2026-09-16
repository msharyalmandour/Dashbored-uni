-- Three session types a real timetable has and the enum did not.
--
-- A King Abdulaziz nursing timetable carries five kinds of session — Lec,
-- Clinical-Hospital, TUT, Lab, Activity — and only the first two had a value
-- here. The other three arrived as OTHER and drew as the same grey block, so a
-- Wednesday of lecture / activity / lecture / tutorial read as two anonymous
-- rectangles.
--
-- Purely additive: no row is rewritten and no value is removed, so it is safe
-- to run against a live database and safe to run twice.
ALTER TYPE "ScheduleEventType" ADD VALUE IF NOT EXISTS 'TUTORIAL' AFTER 'CLINICAL';
ALTER TYPE "ScheduleEventType" ADD VALUE IF NOT EXISTS 'LAB' AFTER 'TUTORIAL';
ALTER TYPE "ScheduleEventType" ADD VALUE IF NOT EXISTS 'ACTIVITY' AFTER 'LAB';
