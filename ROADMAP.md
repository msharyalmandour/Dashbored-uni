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

Re-ranked **2026-10-07** after the interview in [STRATEGY.md](STRATEGY.md) §1.
Three answers moved everything: success is other students paying and returning,
his constraint is deciding rather than money or time, and **classmates in his
cohort will try it** — the first non-him user the project has ever had.

Ranked by one question: what stands between a classmate and paying?

### 1. Day one, for someone who did not build this
The gate in [RULES.md](RULES.md), and it outranks every feature. Measured: all
42 flashcards, 11 gaps and 46 topics were created on 11 September, the one day
the agent ran before its credit went. Only `Document` and `Lecture` kept
growing — the two tables with a hand path. A classmate signs up and meets 18
routes of nothing.

Inviting someone into that spends the only real asset the project has, and
there is no second first impression.

- *Justified by:* 9 of 27 tables empty, every one of them agent-only input
- *Done when:* a fresh account can add a course, a lecture and a timetable, and
  reach a non-empty home — with the agent switched off entirely
- *Why it is first:* the users exist now. They did not before

### 2. Drop a lecture → it builds that lecture's study app
The brand act, and the owner has performed it twice by hand: ARF & ARDS, and
Mechanical Ventilation, both opened 2026-10-07. The `lecture-study-app`
template documents every step. What does not exist is the one thing a product
needs — doing it from inside the OS, from a PDF already in the student's course.

Its first build is also the measurement that settles the price, so it is built
once on one real lecture before it is built for anyone.

- *Justified by:* the two study apps are what he actually opens; the OS is not
- *Done when:* one lecture in the OS has a study app built from its own PDF,
  linked from its course page, **and the model spend for that one build is a
  recorded number**
- *His decision, not mine:* whether to fund the credit, and that decision gets
  a real cost attached to it first rather than an unknown

### 3. The clinical shift, in three questions
Still the only thing neither a study app nor any competitor covers, and it
generalises to every health discipline that does placements. 12.4 scheduled
hours a week, `ClinicalTraining` at 0 rows, and five of eleven assignments are
reflections about shifts with no record.

- *Justified by:* `ClinicalTraining` = 0 against 12.4h/week
- *Done when:* one shift recorded without opening a form, and one gap created
  from "what did you not understand"

## NEXT (max 5)

| # | What | The figure behind it |
|---|---|---|
| 1 | The calendar, from data that already exists | 11 timetable blocks and 15 dated tasks, stored, never on one screen together. `/calendar` is a redirect because `lib/calendar.ts` had no caller — not because the need was wrong |
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
