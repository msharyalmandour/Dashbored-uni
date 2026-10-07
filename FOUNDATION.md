# THE FOUNDATION, as measured

What the site actually is on **2026-10-07**, counted rather than remembered,
because the owner asked what the base is before building on it.

Every figure here came from the schema, the source tree, or a query against
the live database. Where something is estimated it says so.

---

## WHAT IS ALREADY THERE

This is more than the previous documents implied, and the correction matters:
the base is not thin. It is a nearly complete **organiser** for a semester.

### The vocabulary — 27 tables, 28 enums, 1,428 lines
`User` `Semester` `Subject` `Topic` `Lecture` `LectureResource` `LectureSlide`
`SlideAnnotation` `Document` `KnowledgeGap` `Flashcard` `ReviewItem` `Problem`
`Mistake` `ClinicalTraining` `Video` `Task` `FocusSession` `Procedure`
`ProcedureStep` `CaptureItem` `TimeCommitment` `ScheduleEvent` `StudentEvent`
`StudentPreference` `StudyPosition` `LectureTopic`

Nothing important is unnamed. The semester, the deck, the slide, the student's
position in the deck, the shift, the station, the drop that produced it all.

### The safety layer — complete
Row-level security is **on for all 27 tables**, each with a policy, all
deriving from `private.current_app_user_id()`. Children derive ownership
through their parent rather than repeating it: `Lecture` is reachable only
through `Subject.userId`. This is the part that would cost months to re-earn.

### The write layer — 86 typed server actions in 22 files
Already true, and it is the thing the no-manual-work rule needs: **every write
is a function, not a form.** `academics` (5) `auth` (3) `capture` (9)
`clinical` (1) `delete` (21) `documents` (6) `focus` (3) `help` (1)
`knowledge-gap` (2) `lecture` (8) `procedure` (3) `quick-capture` (1)
`recovery` (1) `review` (3) `search` (1) `slides` (5) `study-position` (3)
`tasks` (3) `time` (4) `video` (3)

### The agent — 22 tools, and they cover what he asked for
`create_course` `create_lecture` `import_timetable` `create_task`
`create_flashcards` `create_knowledge_gap` `create_problems` `create_procedure`
`log_clinical` `log_mistake` `add_video` `attach_resource` `file_it` `fix_it`
`read_my_material` `read_my_marks` `search_courses` `whats_already_there`
`ask_student` `open_in_reader` `asc` `finish`

With a two-phase write — propose, then `confirmPendingWrites` /
`discardPendingWrites` / `undoDrop`. Nothing lands without the student seeing it.

### The money layer — already built, and nobody had looked at it
`budget.ts` and `spend.ts`: a per-run cap of **$3**, a per-student day of **$5**,
a whole-deployment day of **$10**, cache multipliers (write 1.25x, read 0.1x),
`costOf()`, `costWithoutCaching()`, and a `CaptureItem.costUsd` column so the
caps can stop being arithmetic and become percentiles.

**Prompt caching is wired** — `cache_control` on the system prompt and on the
last content block of each turn. So the 14.79 SAR figure in
[RULES.md](RULES.md) is the one that applies, not the 126 SAR one.

### The queue — it worked, and the earlier documents said it did not
`CaptureItem` holds **all 17 drops**: 9 `FAILED`, 5 `ORGANIZED`, 2
`UNPROCESSED`, 1 `NEEDS_REVIEW`, 11 September to 2 October. Nothing was lost.

### Reach — 19 routes, 3 endpoints, 42 verify scripts
Plus a document pipeline that worked throughout the outage: **33 documents, 19
carrying real extracted text across 277 pages**, a cron sweep, and a retry.

---

## THE FOUR HOLES

### 1. The agent is an organiser. The brand act needs a builder.

`run.ts` sets `MAX_STEPS = 8` and the per-run cap is `$3`. Measured against the
owner's own finished app, one lecture→study-app build is about **40 steps and
$4.53** at the configured model.

So the act the whole product is named for — *drop a lecture, get its whole
world back* — **cannot run on this machine.** It would stop a fifth of the way
through and report a spending failure. The 22 tools file things into tables;
none of them produces a 323,855-character artifact.

These are two different machines. Only the filing one was built.

- *Measured:* `MAX_STEPS = 8`, `DEFAULT_RUN_CAP_USD = 3`, build ≈ $4.53
- *Not a bug:* the cap's own comment reasons it out correctly for organising

### 2. There is no cohort. Every table has exactly one owner.

All 27 tables are `userId`-scoped, and ownership starts at `Subject.userId`.
There is nowhere to say *"this lecture belongs to NURC 411, which thirty
students take."*

Which means, today, each student pays for their own build of every lecture:

| 40 lectures, one semester | per student |
|---|---|
| alone, as the schema is now | **592 SAR** |
| shared across a 30-student cohort | **20 SAR** |

This is the only hole that **gets more expensive every week it is left**, since
every new table, policy and query is written against one owner.

### 3. `FAILED` cannot tell starved from broken.

Nine drops are parked. `processing-queue.ts` sweeps `PENDING` and
`UNPROCESSED` and excludes `FAILED` on purpose, with a correct reason beside
it: retrying a genuinely bad file daily is worse than leaving it.

But "the credit ran out" and "this PDF is corrupt" are the same enum value. The
project's own rule — separate STARVED from BLOCKED — is not applied to its own
status column.

### 4. Three empty tables the agent is not to blame for.

| table | rows | what is missing |
|---|---|---|
| `LectureTopic` | **0** | 46 topics and 8 lectures, never joined — though `concept-match.ts` (255 lines) exists to join them |
| `ReviewItem` | **0** | 42 flashcards and no schedule to show them on |
| `StudentPreference` | **0** | nothing in the app knows how this student works |

---

## TWO FREE WINS, found while counting

- **The configured model is `claude-opus-5`** ($5 / $25) while
  `claude-opus-5-5` ($4 / $20) is already in the price table. Same work, 20%
  less. One constant in `run.ts:41`.
- **`claude-sonnet-5-5` is absent from the price table**, so it cannot be
  priced or chosen even where it would do.

---

## HOW THIS CHANGES THE RANKING

[ROADMAP.md](ROADMAP.md) had *day one for a classmate* first, on the reasoning
that the classmates exist now. The owner then said they are not starting yet
and he wants to build the system. That removes the premise, so day one drops
down and the question becomes which part of the base is load-bearing.

Answer: **the cohort (hole 2)**, because it is the only one that rots. Hole 1 is
larger work and costs the same whenever it is done; holes 3 and 4 are small and
local. Hole 2 touches the schema and 27 policies, and everything built before
it has to be revisited after it.
