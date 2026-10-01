-- What a drop cost, recorded instead of logged.
--
-- The agent has been counting spend exactly since spend.ts was written: every
-- response carries a usage block, every one of them was folded into a running
-- total, and that total went to `console.log` and nowhere else. So the numbers
-- were right and unreadable — you cannot sum a console log, you cannot show a
-- student what their day cost, and you cannot put a percentile on a
-- distribution nobody kept.
--
-- This is the instrument, not the feature. budget.ts caps a day at $5 per
-- student and $10 across the deployment, and both of those numbers are
-- currently ARITHMETIC — derived from MAX_STEPS, PASS_CHARS, MAX_PDF_BYTES and
-- the published prices — because there is no measured run to derive them from.
-- With this column there will be, and the constants can be replaced by a
-- figure read off real rows rather than reasoned toward.
--
-- Accumulated, never overwritten. One CaptureItem can be run many times: a
-- twelve-pass textbook is twelve runs against the same row, and the PDF
-- fallback in organize.ts is a second run against it inside one request. The
-- writer uses `increment`, so this column is the total cost of everything ever
-- done to this item.
--
-- Nullable, and the fourteen existing rows are left null. Their cost is not
-- zero — six of them really did call the model — it is UNKNOWN, and writing 0
-- would put a wrong number into the only column that can answer the question.
-- Null means "we were not recording yet", which is true, and any sum can
-- exclude it honestly.

BEGIN;

ALTER TABLE "CaptureItem"
  ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;

COMMENT ON COLUMN "CaptureItem"."costUsd" IS
  'Total USD billed for every agent run against this item, accumulated. Null = ran before this column existed; never backfilled with zero.';

-- Negative is meaningless and would subtract from a day's spend, which is the
-- one direction that lets a budget be evaded. Zero is allowed: a run that was
-- refused before its first model call really did cost nothing.
ALTER TABLE "CaptureItem"
  DROP CONSTRAINT IF EXISTS "CaptureItem_costUsd_check";

ALTER TABLE "CaptureItem"
  ADD CONSTRAINT "CaptureItem_costUsd_check"
  CHECK ("costUsd" IS NULL OR "costUsd" >= 0);

-- The index the budget check actually runs: sum costUsd for one user over the
-- last 24 hours, and for everyone over the last 24 hours. `userId, createdAt`
-- already exists for the inbox; this one carries costUsd in the index itself so
-- the sum never touches the table, and it is partial because a row with no
-- recorded cost contributes nothing to any sum.
CREATE INDEX IF NOT EXISTS "CaptureItem_cost_window_idx"
  ON "CaptureItem" ("createdAt", "userId") INCLUDE ("costUsd")
  WHERE "costUsd" IS NOT NULL;

COMMIT;

-- ROLLBACK:
--   DROP INDEX IF EXISTS "CaptureItem_cost_window_idx";
--   ALTER TABLE "CaptureItem"
--     DROP CONSTRAINT IF EXISTS "CaptureItem_costUsd_check",
--     DROP COLUMN IF EXISTS "costUsd";
