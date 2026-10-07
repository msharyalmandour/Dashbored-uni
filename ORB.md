# THE ORB

The owner's instruction, **2026-10-07**: *"ابغا الاورب كلشيء يسوي في الموقع
وايش الناقص ضيفه يكون قوي اكادمي."*

The orb does everything the site can do, and whatever is missing gets added.

This file is the measured gap and the order it closes in. It exists in the
repo because the container has reset twice in this project and a plan that
lives in a chat does not survive that.

---

## WHAT THE ORB IS TODAY

A **filer**. Its own system prompt says so:

> *"They have just dropped one item into their app — a photo, a file, or a
> note — and handed you the job of putting it where it belongs."*

Eight ways in (drag, paste, camera, gallery, file picker, voice recording,
link, typed text), 25 MB a file, honest per type about how far understanding
goes — PDF/Office/text read in full, jpeg/png/gif/webp genuinely looked at,
audio transcribed only when a key is configured, everything else stored and
said to be stored.

Then 22 tools file it, behind propose → confirm → undo.

### What it is not

**It does not take a request.** Type *"ايش عندي بكرا؟"* and it is **filed as
a note**, not answered. The brand the owner states — *"اسألني وأنا أنفذ"* — is
the half that does not exist.

Three further limits, each measured in the code:

| | |
|---|---|
| `MAX_STEPS` | **8** steps per run |
| `MAX_WRITE_CALLS` | 12 writes per run |
| planner / summariser | **neither exists** — `ai-command.tsx` says so outright, which is why "plan my study week" and "summarise my lecture" were deliberately cut from the suggested prompts despite being in the designs |

---

## THE GAP, COUNTED

**86 server actions. 22 orb tools. 54 of the 86 the orb cannot reach.**

Derived by mapping every exported action in `src/app/actions/` against every
tool in `src/lib/ai/agent/tools.ts`, not by judgement.

| what the app can do | actions | the orb can |
|---|---|---|
| **Change state** — postpone a task, close a gap, finish a lecture, re-estimate | 11 | no |
| **Study and review** — grade a card, complete or skip a review, resume where you stopped | 5 | no |
| **Focus and time** — start a session, end it, note a confusion, rescue the day | 4 | no |
| **Delete and undo** — with the consequences shown first | 25 | no |
| **Documents and slides** — retry a stuck file, annotate, page counts | 7 | no |
| **Decide** — "what should I do now" (a rules engine, no model) | 2 | no |

Not all 54 become tools. Two are deliberately excluded:
`updateCompletionPercentage` and `updateSelfAssessment` are in ROADMAP's
DECIDED AGAINST — `null`, `3` and `0` on all seven lectures after 26 days —
and giving a dead field a voice makes it worse, not better.

The upload plumbing (`requestUploadSlot`, `getDocumentViewUrl`,
`getSlideViewUrl`, `attachUploadedSlide`) is machinery the browser calls, not
an act a student asks for. It stays out.

---

## THE ORDER

Each piece ships on its own and is pushed the day it is finished. Nothing here
is a rewrite: the loop, the budget, the spend meter, the propose/confirm/undo
and all 22 tools are reused exactly as they are.

### 1. The orb takes a request
One agent, two modes. A drop keeps the filing prompt; a request gets its own,
and both share the tool set, the loop and the confirm step. **This is the
foundation — 25 new tools are still unreachable without it**, because today the
only way to reach a tool is to drop a file.

*Done when:* "أجّل مهمة الإنجليزي لبكرا" postpones that task, through the same
propose-and-confirm a drop goes through.

### 2. It can answer, not only act
Reading tools, so a question has somewhere to read from: what is due, where
the student stopped, what is worth doing now. `askWhatToDo` already computes
the last one with no model at all — the orb should call it rather than reason
about it.

*Done when:* "ايش عندي بكرا؟" and "وين وقفت في ٤١١؟" are answered from the
student's own rows, with no row written.

### 3. It can do the rest of the site
The tools for the three groups above — change state, study and review, focus
and time — plus `retryDocumentProcessing`, which matters more than it looks:
**nine drops have sat `FAILED` since 11 September** because the sweep cannot
tell "the credit ran out" from "this file is broken".

### 4. It can delete, with the consequences shown
`subjectConsequences`, `lectureConsequences`, `procedureConsequences` and
`semesterConsequences` already exist to say what a delete would destroy. The
orb proposes, the consequences are shown, the student confirms. **Never
otherwise** — deleting a student's material on a sentence it inferred is the
one failure there is no undo for.

### 5. Academically strong — the part that does not exist at all
A summariser and an exam-preparation path. Neither is a missing tool; both are
missing capability, and both are where "قوي أكاديمي" actually lives. Scoped
after 1–4, because a summariser reachable only by dropping a file is the same
mistake again.

---

## WHAT 8 STEPS MEANS FOR THIS

`MAX_STEPS = 8` was sized for filing one drop. "Do everything" does not fit in
it, and the limit is not arbitrary — it is what keeps a confused run from
costing money. It is raised **per mode, with a measured reason**, not globally
and not by guess: a drop keeps 8, and a request gets what the work needs.

The spend meter (`spend.ts`, `costOf`, `CaptureItem.costUsd`) and the caps
(`budget.ts`: $3 a run, $5 a student-day, $10 a deployment-day) already exist
to say what each mode actually costs. They are what decides the number.
