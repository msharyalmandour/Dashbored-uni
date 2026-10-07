# ROADMAP

**What is in flight. Nothing else.** Now holds at most 3, Next at most 5.
Every item names the figure that justifies it and the figure that will prove it
done. An item with neither is an opinion, and opinions go in chat.

Why a file and not a task list: this project had a 182-row list, fifteen of
them pending and several contradicting finished work, and on 2026-10-06 the
container restarted and it evaporated — twice in one session. Nothing that is
not in git exists.

How we decide what is next: **`npm run state`**, then the gate in
[STRATEGY.md](STRATEGY.md) §5. Not from memory.

Rewritten **2026-10-06**, when "who is this for" was answered: a product for
nursing students, owner as user zero. The previous version assumed one user and
ranked accordingly.

---

## NOW (max 3)

Re-ranked **2026-10-07**, after measuring that user zero studies daily in his
own per-lecture study apps and not here. The previous NOW opened with "make
user zero a user", which was built on the wrong cause. See
[STRATEGY.md](STRATEGY.md) §2–3.

### 1. Drop a lecture → it builds that lecture's study app
The brand act, and the owner has already performed it twice by hand with
Claude: ARF & ARDS, and Mechanical Ventilation. The `lecture-study-app`
template documents every step. What does not exist is the one that matters for
a product — **doing it from inside the OS, from a PDF already in the student's
course.**

The 13 documents sitting in his account with real extracted text and no
lecture are the input, already uploaded.

- *Justified by:* two study apps opened 2026-10-07; last completed session in
  this app 2026-09-15. The studying happens next door
- *Done when:* one lecture in the OS has a study app built from its own PDF
  and linked from its course page
- *Unanswered, and it gates the pricing:* what one build costs in model spend.
  Measure it on the first one

### 2. The calendar he asked for, from data that already exists
11 timetable blocks and 15 dated tasks are stored and have never shared a
calendar screen. This is the same shape as the exam band: three facts in the
database, none of them ever on one page together.

`/calendar` is currently a redirect — it was emptied because `lib/calendar.ts`
had no caller, not because the need was wrong.

- *Justified by:* 11 `TimeCommitment` + 15 `Task` rows, zero calendar views
- *Done when:* one screen shows the week's classes, the clinical blocks and
  every exam and deadline, from real rows

### 3. The clinical shift, in three questions
Unchanged, and still the thing no study app and no competitor covers: 12.4
scheduled hours a week, the largest and least recoverable block, and
`ClinicalTraining` holds 0 rows. Five of eleven assignments are reflections or
checklists about shifts with no record.

- *Justified by:* `ClinicalTraining` = 0 against 12.4h/week
- *Done when:* one shift recorded without opening a form, and one gap created
  from "what did you not understand"

## NEXT (max 5)

| # | What | The figure behind it |
|---|---|---|
| 1 | A hand path for every remaining agent-only table | Day one is fatal for a product: all 42 cards, 11 gaps and 46 topics were created on 11 Sept, the one day the agent ran. Only Document and Lecture have a hand path |
| 2 | What one study-app build costs, measured | The brand act is a large model run — read every slide, look at contact sheets, generate 20 lessons and 30 quiz items. Unit economics are unanswered and gate any price |
| 3 | Competitor and pricing scan, written down | Claimed nowhere in STRATEGY.md because it has not been done in a form worth betting on. Who serves the clinical half, and at what price |
| 4 | Daily cap of 7 cards, ordered by exam proximity | 27 of 42 never shown; the 24-card course has no exam for 68 days, the 18-card one has a midterm |
| 5 | One course, two halves — join 410↔411, 431↔432 in the view | NURP 431: 24 cards, 0 deadlines. NURP 432: 11 deadlines, 0 material |

---

## DONE (and what the figure says now)

- **Ship what was built** — `main` was 6 commits behind; merged 2026-10-06 at
  `0b41d2e`, fast-forward, no migration. Production deploys from `main`.
- **Paste a checklist** — the hand path the OSPE engine never had.
- **Clip search without the agent** — `Video` had 0 rows and an agent-only
  input; the search goes straight to YouTube with no model in the path.
- **Eight tabs to three on the course page** — 6 courses × 8 tabs = 48
  destinations with content in 9.
- **One visual language** — three languages became one; `OSSection` deleted
  with zero callers left.

---

## DECIDED AGAINST (so it stays decided)

- **A big task table.** 182 rows, ~15 pending, evaporated with the container.
  Caps, not rows.
- **The academic-health score.** A weighted average that substituted 70 and 80
  wherever an axis had no data, so an empty account scored 74 out of nothing.
- **The inbox.** 11 rows, 11 of them errors — a fault log named a workspace.
- **Per-lecture self-assessment, difficulty stars, completion percent.** `null`,
  `3` and `0` on all seven lectures after 26 days.
- **The priority badge on tasks.** All 15 are `MEDIUM`, the default, beside an
  urgency label computed from a real deadline.
- **The five-column gap board.** 11 of 11 in column one; four headings reading
  "0" stacked above it on a phone.
- **Deleting `Problem` and `Mistake`.** Zero rows read as disuse; it measured
  an agent outage. Starved is not dead.
- **A rewrite.** The thinking was redone on 2026-10-06; the code was not the
  problem.
- **Rebuilding the study app inside the OS.** Lessons, quiz generation,
  flashcard drilling, cheat sheets and the tutor already exist in the owner's
  own per-lecture apps, which he opened on 2026-10-07. The OS links to them.
  Three weeks were spent rebuilding these worse before anyone checked.

---

## NOT OURS TO FIX IN CODE

**Anthropic credit.** 12 failed drops, the last one days ago — user zero is
still trying. Highest leverage in the project, untouched by any work of ours.
