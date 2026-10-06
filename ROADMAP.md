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

### 1. Make user zero a user
The gate, and it comes before every feature. Measured: 8 abandoned sessions
against 2 completed, **last completed session 15 September** — so three weeks
of building happened with no use behind it. A product whose first user stopped
has no evidence under any of its 41,120 lines.

This is not a feature. It is one week of him opening the app daily and me
watching what the event log says, then fixing whatever the log blames.

- *Justified by:* 8/2 abandoned, 0 completions in 21 days
- *Done when:* `npm run state` shows 4 completed sessions — the floor every
  engine in this codebase requires before it will infer anything
- *If it does not move:* the week's output is the reason, written here. Not code.

### 2. The clinical shift, in three questions
The largest block in the week and the least recoverable. The app already knows
when the blocks end — Sunday 12:50, Tuesday 16:50, from `TimeCommitment`.
After one, ask three things and stop: what did you see, what did you do with
your hands, what did you not understand. The third writes a gap with
`source: CLINICAL_TRAINING`, a source that holds 0 of 11 today.

The previous attempt was a five-field essay form and it held zero rows for 24
days. Three questions on the bus home is a different bet, and it is tied to
something already owed: five of eleven assignments are reflections or
checklists about shifts with no record.

- *Justified by:* `ClinicalTraining` = 0 against 12.4h/week
- *Done when:* one shift recorded without opening a form, and one gap created
  from the third question
- *Why it is a product item, not a personal one:* this is §3.2 of the strategy
  — one of the three things nursing actually needs and nobody has built well

### 3. Fill the OSPE checklists
The wedge, and the engine has been built and tested the whole time — `ospe.ts`
scores a station, `practiceOrder` ranks the drill, the paste path shipped. What
is missing is content.

- *Justified by:* 68 days to the first OSPE, `Procedure` = 0, one exam worth 40%
- *Done when:* one procedure with its critical steps marked, and one practice
  run recorded
- *Needs from the owner:* his faculty sheets, and whether his OSPE is stations
  he performs at or oral questions at each station — it changes the drill, not
  the data

---

## NEXT (max 5)

| # | What | The figure behind it |
|---|---|---|
| 1 | A hand path for every remaining agent-only table | Day one is fatal for a product: all 42 cards, 11 gaps and 46 topics were created on 11 Sept, the one day the agent ran. Only Document and Lecture have a hand path |
| 2 | Competitor and pricing scan, written down | Claimed nowhere in STRATEGY.md because it has not been done in a form worth betting on. Who serves the clinical half, and at what price |
| 3 | Daily cap of 7 cards, ordered by exam proximity | 27 of 42 never shown; the 24-card course has no exam for 68 days, the 18-card one has a midterm |
| 4 | One course, two halves — join 410↔411, 431↔432 in the view | NURP 431: 24 cards, 0 deadlines. NURP 432: 11 deadlines, 0 material |
| 5 | Queue the drop instead of failing it | 12 failed drops. The text survives either way — only the organising is lost, and nothing retries when credit returns |

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

---

## NOT OURS TO FIX IN CODE

**Anthropic credit.** 12 failed drops, the last one days ago — user zero is
still trying. Highest leverage in the project, untouched by any work of ours.
