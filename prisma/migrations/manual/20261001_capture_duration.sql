-- How long a drop actually took.
--
-- The waiting state says "understanding" and then "organising", with no sense
-- of whether that is five seconds or five minutes. The obvious fix is an
-- estimate — and there is nothing honest to build one from, which is what this
-- column is for.
--
-- `updatedAt - createdAt` looks like it would do and does not: it moves on
-- every later write, so a row re-read by the cron or corrected days later
-- reports a run that took a fortnight. Measured on the real account, the
-- spread of that proxy runs from 14 seconds to 1,700,830 — twenty days — for
-- work that plainly took under a minute. A number that wrong is worse than no
-- number, because an estimate drawn from it would be shown to the student.
--
-- So the duration is recorded directly, next to `costUsd`, which exists for
-- the same reason: the app could not answer "what does this cost" or "how
-- long does this take" about itself, and both answers have to be measured
-- before anything can be promised.
--
-- Nullable on purpose. A row that was never run, refused by the budget, or
-- written before this column existed has no duration, and zero would turn
-- "never measured" into "took no time" — the same distinction `recordCost`
-- draws when it declines to write 0.

ALTER TABLE "CaptureItem" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

COMMENT ON COLUMN "CaptureItem"."durationMs" IS
  'Wall-clock milliseconds the agent run took, written once when it finishes. NULL means never measured, never zero.';
