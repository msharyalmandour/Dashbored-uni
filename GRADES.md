# WHAT EACH THING IS WORTH

Read on **2026-10-07** out of the owner's own syllabi, already extracted in his
account and reaching no screen in the app. This is the measurement promised
before any code: he checks it, then we build on it.

Two of his six courses have a syllabus in the account. The other four have
none, which is itself a finding — see the bottom.

---

## NURC 411 — Critical Care Nursing **Clinical**

| | weight |
|---|---|
| **1. Semester work** | **60%** |
| · Clinical Evaluation | **30%** |
| · Problem Solving project | 10% |
| · Documentation | **20%** |
|   – ICU Assessment Sheet and Nursing Care Plan | (10%) |
|   – Daily Assessment Sheet | (10%) |
| **2. Final** | **40%** |
| · Final Written Exam, **Final OSCE and OSPE** | |
| **Total** | **100%** |

30 + 10 + 20 = 60. It adds up exactly, so this is the real table and not a
fragment.

### The sentence that reorders the whole project

**The 411 final is the OSCE and OSPE.** So the OSPE is not "an exam in 68
days" — it is **40% of this course**. Add Clinical Evaluation at 30% and:

> **70% of NURC 411 is clinical performance.**

Against the live database on the same day:

| | rows |
|---|---|
| `ClinicalTraining` | **0** |
| `Procedure` | **0** |
| `ProcedureStep` | **0** |

The app records **nothing** about 70% of this course, and the OSPE engine that
would score it (`ospe.ts`, `practice-run.tsx`, `/clinical`) was built and left
empty because `create_procedure` was agent-only.

### And the graded paperwork's own templates are already here

`Documentation` is 20%, as two sheets. Both are in his documents:

| the syllabus grades | the file in his account |
|---|---|
| ICU Assessment Sheet and Nursing Care Plan (10%) | `ICU flowsheet and NCP.pdf` — 6 pages, text extracted |
| Daily Assessment Sheet (10%) | `Daily assessment sheet.pdf` — 2 pages, text extracted |

So 20% of the course is two forms he has to fill repeatedly, whose blank
templates are sitting in the app, connected to nothing.

### One more rule worth storing

> *"Students are expected to attend all clinical experiences, which
> constitutes 50% of the…"*

and

> *"Excessive absences of the total study hours more than 25% may result in a
> grade F"*

A grade cap that has nothing to do with marks. Neither appears anywhere in the
app.

---

## NURC 410 — Critical Care Nursing

| | weight |
|---|---|
| **1. Semester Work** | **60%** |
| · Midterm | **30%** |
| · Case-Based Learning (Presentation) | 20% |
| · BB MCQs | 10% |
| **2. Final** | **40%** |
| · Final Written Exam | 40% |
| **Total** | **100%** |

30 + 20 + 10 = 60. Also exact.

This one is the ordinary shape — a written course. Which is the point of
reading both: **411 and 410 share a name and are graded completely
differently**, and the app currently treats them identically.

---

## WHAT READING THESE PROVED ABOUT HOW TO BUILD IT

### 1. Weights live in tables, and flattened text loses the pairing

NURC 410's weights extract as bare numbers — `60 (60%)`, `30 (30%)` — because
the labels are in one table column and the values in another, and flattening
puts them on alternating lines. 411's happen to extract inline.

So **a regex over extracted text cannot read a weight reliably.** The pairing
survives in the document's layout, not in its text, which means this is a job
for the model reading the document — exactly as the PDF path already does for
a timetable printed as a PDF. Worth knowing before writing a parser that would
work on one of his two syllabi.

### 2. The 411 syllabus is unfiled, in five copies

| | |
|---|---|
| `NURC (411)` as a course | **0 documents** |
| `Syllbus_NURC411_1st Term-updated 26-27.pdf` | **5 copies, all unfiled** |

The document carrying 70%-is-clinical is in his account, extracted, attached to
no course. Reading weights is therefore not the first problem: **filing is.**

### 3. One document is filed under the wrong course

`ETT suctioning_ES .pdf` sits under **NURP (431) Nursing Leadership**.
Endotracheal suctioning is critical care, not leadership. One copy is filed
there and another copy is unfiled.

### 4. Four of six courses have no syllabus at all

`NURC (411)`, `NURM (410) Research Methods`, `NURP (432)` and `Elective Course`
have no syllabus in the account — 411's exists but is unfiled; the other three
are genuinely absent.

So the orb can price **two** of six courses today. For the rest the honest
answer is "I don't know what this is worth yet, send me the syllabus" — which
is a far better answer than a guess, and is the one thing a weighted score
must never do. This project already deleted one that substituted 70 and 80
wherever an axis had no data.
