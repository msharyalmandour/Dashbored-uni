# STRATEGY

Two files, two clocks. **This one changes rarely** — who the product is for,
what it competes on, and how we decide. [ROADMAP.md](ROADMAP.md) changes
weekly and holds only what is in flight.

Decided **2026-10-06**, after the owner said he was lost and we stopped to ask
why.

---

## 1. WHO

**Health-professions students. Nursing first, because that is where the users
are.**

Widened by the owner on 2026-10-07 — "مو طلاب التمريض كمان كل طلاب الصحه بشكل
عام" — and the widening is sound rather than dilution: the OSCE/OSPE is a
health-professions exam format, not a nursing one. Medicine, pharmacy, dentistry
and nursing all sit stations and are all marked on steps performed in order. The
wedge does not shrink when the market grows; it is the same wedge.

But sequence is not scope. **The first ten users are his own nursing cohort,
because they exist and have said they will try it.** Generalising to pharmacy
or medicine before one nursing cohort is retained is exactly the scatter he
named as his binding constraint, and it is how this project got 41,120 lines
and nine empty tables.

### Why he is building it, in his own answer

Three motives at once, and they do not conflict:

1. **A company.** Students paying, or a faculty buying.
2. **He needs it to graduate.** OSPE in 68 days, a deadline in days, 12.4
   clinical hours a week recorded nowhere.
3. **Health students are badly served and nobody has fixed it.**

### What success is, decided

**Other students paying and coming back.** Not his own grades, not a portfolio
piece. That makes two things load-bearing immediately: what one model-built
study app costs, and whether day one works for someone who did not build the
app.

### His binding constraint, in his own words

**"ما أعرف أختار وأشتت."** Not money. Not time. Deciding.

This is the single most important fact about how we work, and it is why
[RULES.md](RULES.md) opens with "one recommendation, never a menu" rather than
with an engineering practice.

---

## 2. THE FACT WE BUILD AROUND

**User zero studies every day. He does not study here.**

The first version of this file said "user zero stopped using it" and ranked
everything under that. The number was right and the cause was wrong, and the
correction came from looking at what he has actually been opening:

| | last touched |
|---|---|
| **ARF & ARDS Review** (his own lecture study app) | **2026-10-07** |
| **Mechanical Ventilation Review** (same) | **2026-10-07** |
| University OS — Home (the mockup) | 2026-09-30 |
| last completed study session in this app's database | **2026-09-15** |

He built those two apps himself, from his own lecture PDFs, with a documented
template he reuses (`lecture-study-app`). Each one carries ~20 lessons, ~30
quiz items drawn only from starred / "مهم" / past-exam annotations, flashcards,
8–10 clinical cases, matching and ordering sets, a brain-dump checklist, a
last-minute cheat sheet, an AI tutor, a virtual patient, and every item linked
to the slide image it came from.

So the abandonment in our event log is not a motivation problem and it is not
a design problem. **It is a scope problem: the deep studying already has a
home, and it is not this app.** Three weeks of our work went into rebuilding,
worse, things that were already finished next door.

---

## 3. THE TWO HALVES

His own behaviour has already split the product. We did not choose this; we
measured it.

| **ONE LECTURE, DEEPLY** | **EVERYTHING AROUND IT** |
|---|---|
| lessons · quiz from starred and past-exam items · flashcards · cases · cheat sheet · AI tutor · virtual patient · slide images | which lecture is next · what is due · when the exam is · the timetable · the clinical shift · the OSPE · the files · the calendar |
| **the per-lecture study app** | **University OS** |
| works, used today | abandoned 15 Sept |

**University OS is not the study tool. It is the world the study tools live
in.** That sentence is the strategy, and everything the owner asked for on
2026-10-07 lands on one side or the other without anything being cut:

| he asked for | where it goes |
|---|---|
| due dates | OS |
| the slides | OS holds the PDF; the study app shows the slides |
| the AI orb — "ask me and I do it" | OS, and its flagship act becomes: **drop a lecture → it builds that lecture's study app** |
| strong exam preparation, and a summary | **already built** — `QUIZ`, `EXQ`, `drawSheet()`. The OS links to it and never rebuilds it |
| a progress percentage | OS — and the study apps already keep per-lecture progress in their `db`, so the OS reads it rather than inventing one |
| a calendar from exam and university schedules | OS. The data exists — 11 timetable blocks and 15 dated tasks — and has never shared a calendar screen |

### The brand, stated precisely

The orb is the brand; the owner is right and the first version of this file
underweighted it. But the brand is not "ask a question, get an answer" — that
is a commodity chatbot. The brand is:

> **Drop a lecture. Get its whole world back.**

He has done that twice by hand with Claude. The product is that act, made
repeatable and attached to a semester.

### 3.1 The cohort is the unit, not the student

Decided **2026-10-07**, forced by the owner's instruction that nothing in the
site is the student's manual work, and by the arithmetic above.

If every write goes through a model, then the model's cost is the product's
cost, and the only figure that makes it survivable is **how many students a
single build serves.** So the data model has to answer "which cohort is this
lecture's?" before it answers anything else:

- A lecture belongs to a **course**, and a course to many students.
- The **first** drop of a lecture pays for the build. Every drop after it
  returns the app that exists — the same act for the student, no spend.
- A student's own work on that app — position, confidence, answers, notes —
  stays theirs. The lecture is shared; the studying is not.

This is also why the app is not a single-player tool with login attached. The
thing being built is the one artifact a cohort shares: their semester.

### What we therefore do not build

Not out of modesty — out of arithmetic. We do not rebuild inside the OS
anything the study app already does well: lesson text, quiz generation,
flashcard drilling, cheat sheets, the tutor. Every week spent there is a week
spent competing with something of his own that already works and that he opened
today.

We also do not compete with Anki, Quizlet, Todoist or Notion on their own
ground. The connective tissue stays — a nursing student will not carry five
apps for one semester — but it is never where a week goes and never what we
say the product is.

### The question that was open, now measured

A per-lecture study app is a large model run: read every slide, render and
*look at* contact sheets, then generate twenty lessons, thirty quiz items,
cases and a virtual patient. **What does one lecture cost, and what can a
student be charged?** Measured on 2026-10-07 against the finished Mechanical
Ventilation app (323,855 characters, 139,494 of them generated data) and its
51-page source:

> **14.79 SAR per lecture** with prompt caching engineered in. **126 SAR**
> without it — the same build, done naively, is nine times the price.

Per student that figure means nothing until you say how many students share it,
and that is the whole finding:

| 40 lectures, one semester | per student |
|---|---|
| 1 | 592 SAR |
| 10 | 59 SAR |
| **30 — his cohort** | **20 SAR** |
| 100 | 6 SAR |

**A lecture is built once and opened by a cohort.** That single fact is what
makes an AI-only product affordable, and it is a structural requirement rather
than an optimisation: see §3.1. The credit in §8 is still the product's power
supply, but it is now a known monthly number instead of an unknown.

---

## 4. THE HOLE THAT BLOCKS BEING A PRODUCT

**Day one does not work for anyone but him, and it barely worked for him.**

Measured: every piece of knowledge in his account — 42 flashcards, 11 gaps, 46
topics — carries a creation date of **11 September**, the one day the agent ran
before its credit ran out. Only `Document` and `Lecture` kept growing, and
those are the only two tables reachable without a model.

A new nursing student arrives with no timetable, no documents, no courses, and
meets 18 routes of nothing.

### What the 11 September outage actually proved

Rewritten **2026-10-07**, because the first version of this section drew the
wrong conclusion from the right evidence and the owner's instruction forced the
correction.

It said the lesson was "every table needs a hand path", and read as though the
remedy were a form. It is not, and a form was never what the evidence asked
for. **The student's side stays AI-only.** What the outage proved is narrower
and harder:

> **A failure with no diagnosis is a failure nothing can recover from.**

Corrected 2026-10-07 after measuring instead of asserting. The queue already
exists and it already worked: `CaptureItem` holds all 17 drops — 9 FAILED, 5
ORGANIZED, 2 UNPROCESSED, 1 NEEDS_REVIEW, spanning 11 September to 2 October.
Nothing was lost. The earlier sentence here claimed otherwise and was wrong.

What is missing is one level finer, and it is the project's own rule about
STARVED versus BLOCKED applied to its own enum. `processing-queue.ts` sweeps
`PENDING` and `UNPROCESSED` and **deliberately excludes `FAILED`**, with a
sound reason written beside it: retrying a genuinely bad file once a day is
worse than leaving it. Correct — except "the credit ran out" and "this PDF is
corrupt" are both `FAILED`, so nine drops that would succeed today will never
be tried again.

And beneath that, each write is a typed function the orb calls rather than
something only a model can produce, because a function can be tested and a
freeform generation cannot. The failure mode that outage hid is the second one:
a write that succeeds with the wrong shape and is never noticed.

For a personal tool losing a drop is an inconvenience. **For a product it is
fatal** — and it is the one thing standing between his classmates and a usable
day one.

---

## 5. THE WEEKLY PROTOCOL

One cycle, one week, in this order. It is short on purpose: the last system
had 182 rows and evaporated.

```
1. MEASURE     npm run state
               Nothing is decided from memory. The clock first.

2. GATE        Does day one work for someone who did not build this?
               NO  → that is the week's work. Nothing else ships.
               YES → go to 3. See RULES.md, THE GATE.

3. PROPOSE     I bring ONE recommendation, not a menu — what, the figure
               behind it, the cost, and what it deletes. He approves or
               refuses. Nothing is built before that. See RULES.md 1–2.

4. BUILD       Measure before inferring. Mutation-test every new rule.
               Push each piece as it finishes — never hold a batch.

5. SHIP        Merge to main the day it is done.
               Vercel deploys production from main. A branch is not shipped.

6. CLOSE       Update ROADMAP.md: move the item, record what the figure
               says now. If it did not move, say so and why.
```

### The gate is the whole protocol

Step 2 is the one that fixes being lost, and it is the one that will be
tempting to skip. The rule exists because of the measurement in §2: three
weeks of building happened after user zero's last completed session, and none
of it was informed by use.

A week that produces a merged feature and no use is a week we learned nothing.
A week that produces no code and an answer to "why did I not open it" is a
week we learned the only thing that matters.

---

## 6. HOW WE DECIDE

These are not principles, they are the five things that demonstrably worked in
the first week — each one caught something real.

1. **Measure before building.** It deleted a health score that substituted 70
   and 80 for missing data, found an agent dead for twenty days, and found two
   tabs that were empty for all six courses.

2. **Mutation-test every rule.** Break the rule on purpose and watch the test
   fail. A test that passes when the rule is broken is a test of nothing. This
   caught the critical-step rule and the course-code strip.

3. **Push every piece when it is finished.** The container reset twice in one
   session and took five commits with it. They came back because they were
   pushed. Nothing that is not in git exists.

4. **Record what we decided against, with the reason.** Otherwise the same
   argument runs every week. See the bottom of ROADMAP.md.

5. **Separate STARVED from STALE from BLOCKED.** Zero rows is not one
   diagnosis. Zero clinical records against 12.4 hours is starved. Eleven gaps
   that never moved is stale. Twelve failed drops is blocked and no code fixes
   it. This project nearly deleted two working features on the wrong reading.

### And one rule about me

When a decision needs the owner, ask one question, not ten. He was handed ten
proposals once and answered "do them all" — because choosing between ten was
the work he wanted removed, not the work he wanted done.

---

## 7. WHAT THIS IS NOT

- **Not a rewrite.** Decided today: redo the thinking, not the code. The
  codebase holds measured, tested work that would cost months to re-earn — the
  OSPE scorer, the safety and RLS layer, the position tracking, 42 verify
  scripts. Being lost was never the code's fault.
- **Not a bigger plan.** The 182-row task list was the symptom. Caps, not rows.
- **Not an AI product.** The agent is one input among several, and the measured
  cost of making it the only input was twenty silent days. Every capability
  must work without it, degraded but honest.
- **Not a scoring engine.** No health number, no completion percent, no
  weighted composite. One was deleted for being fiction and it is not coming
  back under another name.

---

## 8. NOT OURS TO FIX IN CODE

**Anthropic credit.** 12 failed drops, the last one days ago — user zero is
still trying. It is the highest-leverage item in the whole project and no
amount of our work touches it.
