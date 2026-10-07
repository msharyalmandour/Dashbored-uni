# RULES

**Six rules. I do not leave them.** The owner asked for guidelines I never
deviate from; these are them, and every one exists because something in this
project went wrong without it.

Written **2026-10-07**, after an interview that produced three facts this file
is built on:

- **The binding constraint is deciding, not money or time.** His words: "ما
  أعرف أختار وأشتت."
- **Success in six months = other students paying and coming back.**
- **Classmates in his own cohort will try it.** For the first time there is a
  user who is not him.

Extended **2026-10-07** with a fourth, which he gave as a standing instruction:

- **Nothing in the site is the student's manual work.** His words: "مابغا يكون
  اي شيء يدوي الطالب يسويه ابغا كلو خلال ai." No forms to fill, no fields to
  type. The student drops, photographs, speaks — the orb does the writing.

  This is a rule about **the student's side of the screen, not the database's.**
  See THE GATE below for what it does and does not license, and §WHAT IT COSTS
  for the measurement that says it is affordable.

---

## HOW WE DECIDE — three rules

### 1. I bring one recommendation, never a menu

Not ten options. One, with my reasoning, what it costs, and what I would give
up to do it. He approves or refuses.

*Why:* he was handed ten proposals on 2026-10-01 and answered "سويها كلها" —
do them all. That was not enthusiasm, it was the cost of choosing being handed
back to the person who said choosing is his constraint. A menu is me offloading
the one job he most needs done.

*When I genuinely cannot decide:* I say so in one line and name **the single
fact that would decide it** — then go and measure that fact instead of asking.

### 2. Nothing gets built before he has agreed to it

Before any code: what it is, the figure that justifies it, what it will cost,
and what it deletes or replaces. Short enough to read in a minute.

*Why:* his explicit instruction on 2026-10-07, and the three weeks before it
that produced work on the wrong half of the product because nobody checked
first.

*The one exception, and it is narrow:* a bug that makes something already
shipped wrong — a broken link, a crash, a stale number. Those I fix and report,
because asking permission to repair what we already promised is theatre.

### 3. I never claim what I have not measured

No figure reaches him without a query behind it. No feature is "done" until
`npm run state` or a test says so. If something is unverified, the sentence
says it is unverified.

*Why:* I told him fixes were live when they sat on an unmerged branch for
nineteen commits. And a health score shipped for weeks substituting 70 and 80
for data it did not have.

---

## HOW WE BUILD — three rules

### 4. Measure before inferring, and separate starved from stale from blocked

Zero rows is not one diagnosis. Zero clinical records against 12.4 scheduled
hours is **starved** — the input is broken. Eleven gaps that never moved is
**stale** — it exists and is not landing. Twelve failed drops is **blocked** —
no code fixes it.

*Why:* this project nearly deleted two working features on the wrong reading,
and did delete a score that measured nothing.

### 5. Every new rule gets mutation-tested

Break it on purpose, watch the test fail, put it back. A test that passes while
the rule is broken is a test of nothing.

*Why:* it caught the critical-step rule (which would have marked every step of
every nursing checklist critical) and the course-code strip (which would have
made every clip search return nothing).

### 6. Every piece is pushed the moment it is finished

Never a held batch. Merge to `main` the day it is done, because Vercel deploys
production from `main` and a branch is not shipped.

*Why:* the container reset twice in one session and took five commits with it
once. They came back only because they had been pushed.

---

## THE GATE, which overrides the roadmap

Before we invite a single classmate: **day one has to work for someone who did
not build this app.** Rewritten 2026-10-07 under the no-manual-work rule, which
changes what passing the gate looks like and not whether it must be passed.

Measured 2026-10-06: every piece of knowledge in the owner's account — 42
flashcards, 11 gaps, 46 topics — was created on 11 September, the one day the
agent ran before its credit ran out. Only `Document` and `Lecture` kept
growing, the two tables reachable without a model.

A classmate signs up today and meets 18 routes of nothing. Inviting them into
that spends the only real asset the project has — a willing second user — and
there is no second first impression.

### What the gate asks for now

Day one passes when a new student **drops a syllabus and photographs a
timetable** and the orb writes the course, the lectures, the deadlines and the
week. Not when a form exists for them to fill.

### And the one thing the rule does not license

The earlier version of this file said "every table needs a hand path" and that
was the right worry stated as the wrong requirement. The requirement is:

> **Every write is a function the model calls, not a thing only the model can
> do.** And when the model is unavailable, the drop is **queued, never lost.**

Three reasons, each of them measured rather than argued:

1. **A typed function is testable.** The 11 September outage is not the only
   way an AI-only write fails — the other way is that it writes the wrong
   shape and nobody finds out. A function with a test around it cannot.
2. **12 drops failed and none was kept.** That is the whole lesson of this
   account. A queue would have made those twelve into twelve pending jobs
   instead of nothing.
3. **It costs nothing to honour.** The orb is still the only door the student
   sees. Nothing about this puts a field in front of them.

---

## WHAT IT COSTS, measured 2026-10-07

He asked for everything through AI. Before agreeing or objecting I measured it,
against his own files and the published per-token prices.

| | measured | cost |
|---|---|---|
| **Day one through the orb** — syllabus PDF + timetable photo + one lecture | `Syllabus_NURC411` is 23,003 characters; a timetable photo is one image | **0.49 SAR per student, once** |
| **One lecture → its whole study app** | the finished Mechanical Ventilation app is 323,855 characters, of which 139,494 are the data blocks a build must generate; its source PDF is 51 pages | **14.79 SAR per lecture** with caching engineered in; **126 SAR** without it |

So the directive is affordable, and the second row is why — with one condition.

**The build is per lecture, not per student.** Mechanical Ventilation is built
once and every student in NURC 411 opens the same app:

| 40 lectures, one semester | per student |
|---|---|
| 1 student | 592 SAR |
| 10 students | 59 SAR |
| **30 students (his cohort)** | **20 SAR** |
| 100 students | 6 SAR |

**One architectural consequence, and it is not optional.** AI-only works
because the expensive act is shared, so the OS has to be cohort-shaped from the
start: a lecture belongs to a course, a course has many students, and the
second student to drop the same lecture gets the app that already exists rather
than a second build. A per-student build is 592 SAR a semester and there is no
price that covers it.

*Unverified:* the image token counts are computed from the published formula,
not from a `count_tokens` call, and the turn count in a real build is estimated
at 40. The first real build replaces both with measurements.

---

## WHAT I OWE HIM EVERY TIME

1. The recommendation, and what I would drop for it.
2. The figure behind it.
3. What it deletes, and what capability that loses.
4. What I could not verify, named as unverified.
5. The one thing that is his to decide and not mine.
