# WHAT STUDENTS ACTUALLY SUFFER FROM

Where the owner's daily research reports land, and what each finding does to
the roadmap. He supplies them; this file is what we do with them.

**The rule for this file:** a finding changes what we build only when it meets
a measurement in this project, or is strong enough on its own to measure. Both
reports so far carry that warning in their own words — *"Do not turn every
complaint into a feature"* — and it is kept here rather than paraphrased.

---

## HOW GOOD THE EVIDENCE IS, said first

Both reports state their own weakness and it is not small:

- **No posts from the last 72 hours.** Reddit, X, TikTok, Instagram, YouTube,
  Facebook and Discord were not searchable in either run.
- Most sources are **university newspapers, researchers and staff forums** —
  journalist and instructor accounts, not raw student posts.
- The 2026-10-06 report says plainly: **"Treat confidence as moderate."**

So this is a direction-finder, not market research. It is used here to rank
things we were going to build anyway, and to kill things we were not.

---

## 2026-10-06 · 2026-10-07

### What the two reports agree on, and the agreement matters

Clinical training appears in both, and the second one is what makes it real.

| | |
|---|---|
| **10-06** | "Clinical rotation scheduling run on spreadsheets and paper" — UConn, Sept 2022, **staff-side, dated, weak**. The report's own verdict: *"Build only if more student-side evidence appears."* |
| **10-07** | Penn, Feb 2026: *"they may change your shift at the last moment, even after assignment."* UK NSS survey: practical training ≈ **21.5% of all comments**, scheduling index **−29.3**. Night shifts disrupt lectures and sleep. Severity: **high for this group** |

One day moved it from "do not build this" to corroborated, and that is the
whole argument for the reports being daily. Nothing else in either document
changed category.

**Against our own measurement:** `ClinicalTraining` holds **0 rows** against
12.4 scheduled hours a week — and his NURC 411 syllabus, already extracted in
his own account, prices it:

```
Semester work              60%
Clinical Evaluation        30%   <- 0 rows
Problem Solving project    10%
Daily Assessment Sheet     10%   <- 0 rows
```

Two external reports and 40% of one of his courses point at the same hole.

### The willingness-to-pay signal, and the warning attached to it

10-07, from a Reddit thread of December 2025: a student built a tool because he
was *"tired of searching every syllabus for deadlines"* and it reached **225
users with no advertising**. A graduate: *"I'd have paid if it existed."*

That is the only thing resembling evidence that a student will pay for any of
this, in either document. It is also the most crowded ground, and the report
says so: competitors **CourseLink, Semora, EduSync**, and —

> **"Extraction alone is not a differentiator."**

What it names as the differentiator is **conflict detection** and staying in
step with the institution's own changes. Taken together with the weights
above, this is the correction to our plan: not *"we read your syllabus"*, which
three products already do, but *"we know what each thing is worth, and what it
collides with."*

### The thing we already have and did not know was a feature

Both reports rank an offline copy of course material at or near the top.
10-07 names it **Course Vault**; 10-06 calls it an *"offline course mirror"*.
The evidence is a Canvas outage at Xavier during finals week, May 2026:

> *"everything is in Canvas… there are no backups"* — and the deadline was
> that same night. Erasmus students were not told Canvas would close.

It is an old pattern too (Blackboard, 2013), so the risk is structural rather
than one bad month.

**And University OS is already most of the way there without having meant to
be.** Measured in his account: **33 documents, 19 carrying real extracted text
across 277 pages**, in his own storage, independent of any LMS. The vault
exists. What is missing is that it works with no connection and that it is
complete — and that anyone knows it is a feature.

### The strongest-evidence finding, which we are not building yet

Notification and email overload is the best-supported item in either report:
three independent sources across three countries, with consequences.

- Maastricht: *"sometimes as many as twenty"* emails a day, including ones
  about assignments for third-year students.
- One student **lost a tuition-fee notice** in her inbox.
- UK: *"so many emails being sent out that I basically just gave up."*
- Duke staff: students *"did NOT get a very important course announcement"*
  because of their own notification settings.

It is also the one finding that needs something this product does not have: a
mail and LMS integration, which is an outward-facing connection per
institution. Deferred on cost, not on doubt, and said so here so that the
ranking is not mistaken for disagreement.

**A note we owe ourselves:** this app *had* an inbox and deleted it — 11 rows,
all of them errors, *"a fault log named a workspace"* (ROADMAP, DECIDED
AGAINST). That is not a contradiction of this finding. What was deleted was an
error list; what the research describes is a ranked merge of real messages.
Building the second is not reviving the first, and the distinction has to stay
written down or the argument runs again.

### What the reports say not to build

- **Group-project coordination.** 10-06 found only opinion columns, no primary
  student discussion of the mechanics, and moved it to "investigate".
- **A "panic week" view** for midterm pressure. 10-07 rates the evidence
  *weak* — editorials, not complaints — and says to build it last, on data
  that is already trusted.

Both match this project's own habit: it deleted a health score for being a
weighted average of nothing, and a five-column gap board with 11 of 11 rows in
column one. A screen built on weak evidence is the same mistake with a
different source.

---

## HOW A FINDING BECOMES WORK

```
1. It lands here, with its source, its evidence strength, and the
   report's own verdict — not a paraphrase of it.

2. It is held against a measured figure in this account. A finding that
   meets one gets ranked. A finding that meets none gets a measurement
   first, not a feature.

3. It names what it would collide with. Twice now a finding has
   corroborated something already on the roadmap rather than adding to
   it, and that is the useful outcome, not a wasted report.

4. What it says NOT to build is recorded with equal weight. Half the
   value of both reports so far is in the three things they killed.
```
