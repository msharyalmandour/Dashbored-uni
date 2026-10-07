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

Re-ranked **2026-10-07**, twice in one day. First after the interview in
[STRATEGY.md](STRATEGY.md) §1; then again when the owner gave a standing
instruction that changes what the first item *is*:

> **"مابغا يكون اي شيء يدوي الطالب يسويه ابغا كلو خلال ai."**

Nothing in the site is the student's manual work. That does not move the gate —
day one still has to work for a stranger — it changes what passing it means:
the orb writes, the student drops. Measured before agreeing: day one through
the orb is **0.49 SAR per student, once**, so the directive costs essentially
nothing on this half. See [RULES.md](RULES.md) § WHAT IT COSTS.

Ranked by one question: what stands between a classmate and paying?

### 1. Day one, through the orb
The gate in [RULES.md](RULES.md), and it outranks every feature. A classmate
drops the course syllabus and photographs the timetable; the orb writes the
course, its lectures, its deadlines and the week. No field is put in front of
them at any point.

Measured: all 42 flashcards, 11 gaps and 46 topics were created on 11
September, the one day the agent ran before its credit went. Only `Document`
and `Lecture` kept growing — the two tables reachable without a model. A
classmate signs up today and meets 18 routes of nothing.

- *Justified by:* 9 of 27 tables empty, every one of them agent-only input
- *Done when:* a fresh account reaches a non-empty home having dropped a
  syllabus and a timetable photo and typed nothing, **and a drop attempted
  while the model is unreachable is queued rather than lost** — the failure
  that cost this account twelve drops
- *Costs:* 0.49 SAR per student, once, measured
- *Why it is first:* the users exist now. They did not before

### 2. One lecture → its whole study app, built once for the cohort
The brand act, and the owner has performed it twice by hand: ARF & ARDS, and
Mechanical Ventilation, both opened 2026-10-07. The `lecture-study-app`
template documents every step. What does not exist is doing it from inside the
OS, from a PDF already in the student's course.

Measured 2026-10-07 from the finished app itself — 323,855 characters, of which
139,494 are the generated data blocks:

| | |
|---|---|
| one lecture, caching engineered in | **14.79 SAR** |
| the same build, naively | **126 SAR** |
| 40 lectures a semester, shared across his 30-student cohort | **20 SAR per student** |
| the same, one student alone | **592 SAR** |

That spread is the whole design constraint, and it is why this item says *for
the cohort*: the first drop of a lecture pays for the build and every drop
after it returns the app that already exists. See [STRATEGY.md](STRATEGY.md)
§3.1.

- *Justified by:* the two study apps are what he actually opens; the OS is not
- *Done when:* one lecture in the OS has a study app built from its own PDF,
  linked from its course page, **a second account dropping the same lecture
  gets it without a second build**, and the real spend replaces the 14.79 SAR
  estimate with a measurement
- *His decision, not mine:* whether to fund the credit — now against a known
  monthly number rather than an unknown

### 3. The clinical shift, in three questions
Still the only thing neither a study app nor any competitor covers, and it
generalises to every health discipline that does placements. 12.4 scheduled
hours a week, `ClinicalTraining` at 0 rows, and five of eleven assignments are
reflections about shifts with no record.

Under the no-manual-work rule this is three questions **spoken or answered in
one line each**, not a shift form.

- *Justified by:* `ClinicalTraining` = 0 against 12.4h/week
- *Done when:* one shift recorded without a form, and one gap created from
  "what did you not understand"

## NEXT (max 5)

| # | What | The figure behind it |
|---|---|---|
| 1 | The calendar, from data that already exists | 11 timetable blocks and 15 dated tasks, stored, never on one screen together. `/calendar` is a redirect because `lib/calendar.ts` had no caller — not because the need was wrong |
| 2 | Cohort sharing in the schema — a lecture's app belongs to the course, not the account | Measured: a build is 14.79 SAR. One student alone pays 592 SAR a semester for 40 of them; thirty sharing pay 20 SAR each. No price covers the first number |
| 3 | Competitor and pricing scan, written down | Claimed nowhere in STRATEGY.md because it has not been done in a form worth betting on. Who serves the clinical half, and at what price |
| 4 | Daily cap of 7 cards, ordered by exam proximity | 27 of 42 never shown; the 24-card course has no exam for 68 days, the 18-card one has a midterm |
| 5 | One course, two halves — join 410↔411, 431↔432 in the view | NURP 431: 24 cards, 0 deadlines. NURP 432: 11 deadlines, 0 material |

---

## DONE (and what the figure says now)

- **What one study-app build costs** — measured 2026-10-07 from the finished
  Mechanical Ventilation app and its 51-page source, without spending a riyal
  of credit: 14.79 SAR per lecture cached, 126 SAR naive, 20 SAR per student
  per semester across a 30-student cohort. Moved out of NEXT; the number it
  produced re-ranked NOW item 2.

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

- **Forms for the student to fill.** His instruction on 2026-10-07, and the
  measurement agrees with it: day one through the orb is 0.49 SAR per student.
  The thing the 11 September outage actually argued for was a **queue** so a
  failed drop is kept — not a field. See [STRATEGY.md](STRATEGY.md) §4.

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
