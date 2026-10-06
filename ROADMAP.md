# ROADMAP

**One file. Three sections. Hard caps.** Now holds at most 3, Next at most 5.
Nothing enters without a number that justifies it and a number that will prove
it done.

Why a file and not a task list: this project had a 182-row task list, fifteen
of them pending and several contradicting work already finished, and on
2026-10-06 the container restarted and the whole thing evaporated — twice in
one session. Anything that is not in git does not exist.

How to decide what is next: **`npm run state`**. It queries the live database
and prints the figures below with the one consequence each has. We do not
choose from memory.

As of **2026-10-06**.

---

## THE GOAL, in one sentence

An app that knows about **the clinical half of a nursing degree**, and can be
trusted with the student's own material.

That is not a slogan, it is what the measurement says is missing. Half his week
— 12.4 scheduled hours, the largest block in it — is clinical, and the app has
recorded none of it. 40% of one course's grade is a performed exam in 68 days,
and there are zero procedures to practise against. Thirteen documents hold real
extracted text and reach no screen.

Everything below serves that sentence or it does not belong here.

---

## NOW (max 3)

### 1. Ship what is built
Six commits sit on `claude/university-os-design-build-1yo6cw` and `main` has
none of them. Vercel deploys production from `main`, so **everything from the
last two days — the paste-a-checklist path, the clip search, three tabs instead
of eight, one visual language — is invisible on `dashbored-uni.vercel.app`.**

- *Justified by:* `git rev-list --left-right --count origin/main...HEAD` → 6
- *Done when:* that reads 0, and the production deploy is green
- *Blocked on:* nothing. One merge.

### 2. The clinical shift, in three questions
The app knows when the clinical blocks end — Sunday 12:50, Tuesday 16:50, from
`TimeCommitment`. After one, ask three things and stop: what did you see, what
did you do with your hands, what did you not understand. The third writes a gap
with `source: CLINICAL_TRAINING`, which today holds 0 of 11.

The old version of this was a five-field essay form and it held zero rows for
24 days. Nobody writes five essay fields after an eight-hour shift. Three
questions on the bus home is a different bet, and it is tied to something he
already owes: five of his eleven tasks are reflection papers or checklists
about shifts he has no record of.

- *Justified by:* `ClinicalTraining` = 0 against 12.4h/week
- *Done when:* a shift recorded without opening a form, and one gap created
  from the third question

### 3. Fill the OSPE checklists
The machine is already built and tested — `ospe.ts` scores a station, the
practice run records misses, `/clinical` is in the sidebar — and the paste path
shipped yesterday. What is missing is the content: his own faculty sheets,
pasted once.

- *Justified by:* 68 days to the first OSPE, `Procedure` = 0, one exam worth 40%
- *Done when:* at least one procedure with its critical steps marked, and one
  practice run recorded
- *Needs from him:* the sheets, and an answer to whether his OSPE is stations
  he performs at or oral questions — it changes the drill, not the data

---

## NEXT (max 5)

Ranked, and each one names its figure.

| # | What | The number behind it |
|---|---|---|
| 1 | Daily cap of 7 cards, ordered by exam proximity | 27 of 42 cards never shown once; the 24-card course has no exam for 68 days, the 18-card one has a midterm |
| 2 | One course, two halves — join 410↔411 and 431↔432 in the view | NURP 431 has 24 cards and 0 deadlines; NURP 432 has 11 deadlines and 0 material. One course in his head, two rows in the app |
| 3 | Simulation as one object, not four tasks | Pre-reading 14 Nov + reflection 16 Nov, twice. The reflection is impossible without the shift record from Now #2 |
| 4 | Queue the drop instead of failing it | 12 failed drops. The document keeps its text either way, so the loss is only the organising — and nothing retries when credit returns |
| 5 | Measured session length | 8 abandoned against 2 completed. Needs 4 completions before it may say anything, and has 2 |

---

## DECIDED AGAINST (and why, so it stays decided)

- **A big task table.** We had one. 182 rows, ~15 pending, and it evaporated
  with the container. The cure for scatter is a cap, not more rows.
- **The academic-health score.** A weighted average over five axes that
  substituted 70 and 80 wherever an axis had no data, so an empty account
  scored 74 out of nothing. Deleted with its engine.
- **The inbox.** 11 rows, 11 of them errors — a fault log wearing the name of a
  workspace. The successes now surface inside the course they belong to.
- **Per-lecture self-assessment, difficulty stars, completion percent.** `null`,
  `3` and `0` on all seven lectures. Twenty-six days, never touched.
- **The priority badge on tasks.** All 15 are `MEDIUM`, the default. It printed
  "Medium" fifteen times beside an urgency label computed from a real deadline.
- **The five-column gap board.** 11 of 11 gaps in column one, four headings
  reading "0" stacked above it on a phone. The status moved onto the row.
- **Deleting `Problem` and `Mistake`.** Zero rows, and it was nearly read as
  disuse. It measured an agent outage. Starved is not dead.

---

## NOT OURS TO FIX IN CODE

**The Anthropic credit.** 12 failed drops, the last one days ago — he is still
trying. Every agent-only output in the database stopped on 11 September: 42
flashcards, 11 gaps, 46 topics, all created that one day. The two tables that
kept growing, `Document` and `Lecture`, are the two with a hand path.

This is the single highest-leverage thing on the whole page and no amount of
our work touches it.

---

## THE RULE

Every item here names the figure that justifies it and the figure that proves
it done. An item with neither is an opinion, and opinions go in the chat, not
in this file.
