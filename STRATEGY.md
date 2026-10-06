# STRATEGY

Two files, two clocks. **This one changes rarely** — who the product is for,
what it competes on, and how we decide. [ROADMAP.md](ROADMAP.md) changes
weekly and holds only what is in flight.

Decided **2026-10-06**, after the owner said he was lost and we stopped to ask
why.

---

## 1. WHO

**A product for nursing students. The owner is user zero, not the only user.**

That was ambiguous until today and the ambiguity was expensive: every
measurement in this project has been taken from one account — his — and
decisions were made as if that account were the market. It is not. It is the
first data point.

---

## 2. THE FACT WE BUILD AROUND

**User zero stopped using it.**

Measured 2026-10-06 on the live database:

| | |
|---|---|
| study sessions | **8 abandoned, 2 completed** |
| last completed session | **15 September** — three weeks ago |
| flashcards never shown once | **27 of 42** |
| knowledge gaps that ever moved | **0 of 11** |
| clinical records | **0**, against 12.4 scheduled hours a week |
| the app | 18 routes, 27 tables (9 empty), 67 engines, 41,120 lines |

This is the whole diagnosis of being lost, and it is structural, not personal.
There is no feedback loop: every decision in this project has come from me
querying his database and arguing a case, not from him using the thing and
wanting more. Argument has no stopping condition. Use does.

**So the first job is not a feature. It is to make user zero a user.**

---

## 3. WHAT WE COMPETE ON

The argument here is structural and does not need a market report: a feature
that every student needs is a feature that mature free tools already do
better, and a feature that only a clinical student needs is one nobody has
built well.

### We compete here — nursing is genuinely different

1. **The performed exam (OSPE/OSCE).** You are marked on steps performed in
   order at a station, where one omitted critical step fails you regardless of
   the rest. No general study tool models this. Measured: 2 on his calendar,
   one worth **40% of a course**, 68 days out. The engine is already built and
   tested — `ospe.ts` scores a station, `practiceOrder` ranks what to drill —
   and it has **0 rows**, because until two days ago the only way in was an
   agent with no credit.

2. **The clinical shift.** 12.4 hours a week, the largest single block in his
   timetable, and the least recoverable: a lecture can be re-read, a shift
   cannot. Five of his eleven assignments are reflection papers or checklists
   about shifts he has no record of.

3. **Theory and clinical as one course.** His courses come in pairs — NURC 410
   theory / NURC 411 clinical, NURP 431 / NURP 432. Measured: the theory half
   holds all 42 cards and 11 gaps and almost no deadlines; the clinical half
   holds 11 of 15 deadlines and no material at all. One course in a student's
   head, two rows in every tool.

### We do not compete here — this is commodity

Spaced repetition, flashcards, task lists, a pomodoro timer, note-taking.
Anki, Quizlet, Todoist and Notion are free, mature, and better at these than
we will be. A large share of those 41,120 lines is spent competing with free.

**That does not mean delete them** — they are the connective tissue, and a
nursing student will not keep two apps for one semester. It means: they are
never where we spend a week, and they are never what we say the product is.

### The open question, to be answered and written down

Who else is building for the clinical half, and what do they charge? I have
not done that scan in a form worth betting on, and nothing in this file should
be read as if I had. It belongs in NEXT, not in a claim.

---

## 4. THE HOLE THAT BLOCKS BEING A PRODUCT

**Day one does not work for anyone but him, and it barely worked for him.**

Measured: every piece of knowledge in his account — 42 flashcards, 11 gaps, 46
topics — carries a creation date of **11 September**, the one day the agent ran
before its credit ran out. Only `Document` and `Lecture` kept growing, and
those are the only two tables with a path that does not go through a model.

A new nursing student arrives with no timetable, no documents, no courses, and
meets 18 routes of nothing. The single way in was an AI agent, which costs
money per student and stops the day the billing does.

For a personal tool that is an inconvenience. **For a product it is fatal.**
So "every table has a hand path" is not tidiness, it is viability — and it is
why pasting a checklist and searching clips without a model were the right two
things to build first.

---

## 5. THE WEEKLY PROTOCOL

One cycle, one week, in this order. It is short on purpose: the last system
had 182 rows and evaporated.

```
1. MEASURE     npm run state
               Nothing is decided from memory. The clock first.

2. GATE        Did user zero use it this week?
               YES → go to 3.
               NO  → the week's work is finding out why. Not a feature.

3. PICK ONE    From ROADMAP.md NOW. One item, not three.
               It must name the figure that justifies it and the
               figure that will prove it done.

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
