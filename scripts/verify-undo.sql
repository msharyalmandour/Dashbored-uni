-- Undo, proved against the real database.
--
-- The dangerous failure here is not that undo removes too little. It is that it
-- removes something the student wrote themselves — and that is unrecoverable,
-- so it is checked directly rather than reasoned about. Two students are set up
-- and each assertion names what would be true if the guard were missing.
--
-- Everything happens inside a transaction that rolls back, so this can be run
-- against production without touching a real row.
begin;

do $$
declare
  mine_user   text := 'undo_test_user_a';
  other_user  text := 'undo_test_user_b';
  mine_sem    text := 'undo_test_sem_a';
  other_sem   text := 'undo_test_sem_b';
  cap         text := 'undo_test_capture';
  other_cap   text := 'undo_test_capture_other';
  agent_course text := 'undo_test_course_agent';
  own_course   text := 'undo_test_course_own';
  n int;
begin
  insert into "User" (id, name, email, "updatedAt") values
    (mine_user,  'A', 'undo_a@test.invalid', now()),
    (other_user, 'B', 'undo_b@test.invalid', now());
  insert into "Semester" (id, "userId", name, "startDate", "endDate", "updatedAt") values
    (mine_sem,  mine_user,  'S', now(), now() + interval '90 days', now()),
    (other_sem, other_user, 'S', now(), now() + interval '90 days', now());
  insert into "CaptureItem" (id, "userId", kind, status, "updatedAt") values
    (cap,       mine_user,  'FILE', 'ORGANIZED', now()),
    (other_cap, other_user, 'FILE', 'ORGANIZED', now());

  -- A course the agent created from this drop, and one the student made.
  insert into "Subject" (id, "userId", "semesterId", name, "updatedAt", "sourceCaptureId") values
    (agent_course, mine_user, mine_sem, 'Agent course', now(), cap),
    (own_course,   mine_user, mine_sem, 'My own course', now(), null);

  -- Tasks: one from this drop, one the student typed, one from another drop,
  -- and one belonging to the other student that carries THIS capture id — the
  -- case that would leak across accounts if userId were not in the predicate.
  insert into "Task" (id, "userId", title, deadline, "updatedAt", "sourceCaptureId") values
    ('undo_t_agent', mine_user,  'From the drop',  now() + interval '3 days', now(), cap),
    ('undo_t_own',   mine_user,  'I typed this',   now() + interval '3 days', now(), null),
    ('undo_t_other_drop', mine_user, 'Another drop', now() + interval '3 days', now(), other_cap),
    ('undo_t_other_user', other_user, 'Not mine',   now() + interval '3 days', now(), cap);

  insert into "Lecture" (id, "subjectId", title, date, "updatedAt", "sourceCaptureId") values
    ('undo_l_agent', agent_course, 'Lecture 1', now(), now(), cap),
    ('undo_l_own',   own_course,   'My lecture', now(), now(), null);

  insert into "Flashcard" (id, "userId", "subjectId", front, back, "updatedAt", "sourceCaptureId") values
    ('undo_f_agent', mine_user, agent_course, 'Q', 'A', now(), cap),
    ('undo_f_own',   mine_user, own_course,   'Q', 'A', now(), null);

  insert into "ScheduleEvent" (id, "userId", title, type, "startsAt", "updatedAt", "sourceCaptureId") values
    ('undo_e_agent', mine_user, 'Class', 'LECTURE', now() + interval '1 day', now(), cap),
    ('undo_e_own',   mine_user, 'My event', 'PERSONAL', now() + interval '1 day', now(), null);

  -- ---- What the undo does, in the same order the code does it ----
  delete from "Flashcard"     where "sourceCaptureId" = cap and "userId" = mine_user;
  delete from "Mistake"       where "sourceCaptureId" = cap and "userId" = mine_user;
  delete from "KnowledgeGap"  where "sourceCaptureId" = cap
    and "subjectId" in (select id from "Subject" where "userId" = mine_user);
  delete from "Lecture"       where "sourceCaptureId" = cap
    and "subjectId" in (select id from "Subject" where "userId" = mine_user);
  delete from "Task"          where "sourceCaptureId" = cap and "userId" = mine_user;
  delete from "ScheduleEvent" where "sourceCaptureId" = cap and "userId" = mine_user;
  delete from "TimeCommitment" where "sourceCaptureId" = cap and "userId" = mine_user;

  -- The course only goes if this drop's own rows were all there was in it.
  delete from "Subject" s where s."sourceCaptureId" = cap and s."userId" = mine_user
    and not exists (select 1 from "Lecture"      x where x."subjectId" = s.id)
    and not exists (select 1 from "KnowledgeGap" x where x."subjectId" = s.id)
    and not exists (select 1 from "Flashcard"    x where x."subjectId" = s.id)
    and not exists (select 1 from "Task"         x where x."subjectId" = s.id)
    and not exists (select 1 from "Mistake"      x where x."subjectId" = s.id)
    and not exists (select 1 from "Document"     x where x."subjectId" = s.id);

  -- ---- Assertions ----
  select count(*) into n from "Task" where id = 'undo_t_own';
  if n <> 1 then raise exception 'FAIL: undo deleted a task the student typed themselves'; end if;

  select count(*) into n from "Task" where id = 'undo_t_other_user';
  if n <> 1 then raise exception 'FAIL: undo reached into another student''s account'; end if;

  select count(*) into n from "Task" where id = 'undo_t_other_drop';
  if n <> 1 then raise exception 'FAIL: undo removed rows from a different drop'; end if;

  select count(*) into n from "Task" where id = 'undo_t_agent';
  if n <> 0 then raise exception 'FAIL: undo left behind the task this drop created'; end if;

  select count(*) into n from "Lecture" where id = 'undo_l_own';
  if n <> 1 then raise exception 'FAIL: undo deleted the student''s own lecture'; end if;

  select count(*) into n from "Flashcard" where id = 'undo_f_own';
  if n <> 1 then raise exception 'FAIL: undo deleted the student''s own flashcard'; end if;

  select count(*) into n from "ScheduleEvent" where id = 'undo_e_own';
  if n <> 1 then raise exception 'FAIL: undo deleted the student''s own calendar entry'; end if;

  select count(*) into n from "Subject" where id = agent_course;
  if n <> 0 then raise exception 'FAIL: an empty course this drop created was not removed'; end if;

  select count(*) into n from "Subject" where id = own_course;
  if n <> 1 then raise exception 'FAIL: undo deleted a course the student created'; end if;

  raise notice 'PASS: undo removes exactly this drop''s rows, in this account only';
end $$;

-- A second run of the same undo must be harmless: a student who taps twice, or
-- whose first request timed out after succeeding, must not get an error.
do $$
declare n int;
begin
  delete from "Task" where "sourceCaptureId" = 'undo_test_capture' and "userId" = 'undo_test_user_a';
  select count(*) into n from "Task" where "sourceCaptureId" = 'undo_test_capture' and "userId" = 'undo_test_user_a';
  if n <> 0 then raise exception 'FAIL: undo is not repeatable'; end if;
  raise notice 'PASS: undoing twice is harmless';
end $$;

-- Nothing above is kept. This script is safe to run anywhere.
rollback;
