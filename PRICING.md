# 79 SAR A MONTH, PRIVATE — does it survive?

The owner decided **2026-10-07**: each student's study apps are their own, not
shared with a cohort, and the subscription should be around **79 SAR a month**.
His reason, and it is the right one: 592 SAR a semester is absurd for a student.

This file is the arithmetic. **Yes, 79 SAR works** — but only after one change,
and that change is not the model.

---

## THE MEASUREMENT THAT CHANGES THE PRICE

His two finished apps were diffed line by line:

| | |
|---|---|
| Mechanical Ventilation | 2,700 lines · 349,571 bytes |
| ARF & ARDS | 2,733 lines · 351,904 bytes |
| **byte-identical between them** | **2,098 lines · 226,212 characters · 77.7%** |
| actually different | 602 lines · 97,643 characters · 22.3% |

So **78% of every app is the same app.** The template's own instructions say
this outright — *"swap ONLY its data blocks, keep all code, CSS, features"* —
and the diff proves it holds in practice, not just in intent.

### What that means we are paying for today

Today the whole 323,855-character page goes through the model on every build,
so we pay to have the same 226,212 characters re-read and re-emitted for every
lecture. That is the entire difference between 14.79 SAR and 5.22 SAR.

**The code should be a file in the repo. The model should only write the
content.** Nothing about the student's experience changes.

---

## THE PRICE, AFTER THAT CHANGE

Per build: **60,800 input tokens** (deck text + slide images + the shape of the
data) and **44,438 output tokens** (the 97,643 characters that differ, plus
reasoning).

| | per lecture | 40 lectures / semester | with Batch API (−50%) |
|---|---|---|---|
| **today**, template re-sent | 14.79 SAR | 592 SAR | — |
| Opus 5.5 | **5.22 SAR** | 209 SAR | 104 SAR |
| Sonnet 5.5 | **2.99 SAR** | 119 SAR | **60 SAR** |

A build is not urgent — the student drops a deck and gets it back later — so
the Batch API's 50% is a real saving rather than a theoretical one.

## AGAINST 79 SAR A MONTH

A semester is four months, so **316 SAR of revenue per student**:

| | model cost | what is left | margin |
|---|---|---|---|
| Opus 5.5, live | 209 SAR | 107 SAR | 34% |
| **Opus 5.5, Batch** | 104 SAR | **212 SAR** | **67%** |
| Sonnet 5.5, live | 119 SAR | 197 SAR | 62% |
| **Sonnet 5.5, Batch** | 60 SAR | **256 SAR** | **81%** |

**79 SAR holds, privately, with no cohort, at every one of these.** The thin
one is Opus live at 34%, and even that is not a loss.

---

## THE ONE THING THAT WOULD SINK IT

`budget.ts` caps a single student at **$5 a day**, which is 19 SAR a day and
**562 SAR a month**. The subscription is 79 SAR. One student studying hard for
a month costs **484 SAR out of the owner's pocket** and breaks no rule.

That cap was written to stop abuse and it does that job. It was never a
business limit, and now one is needed:

> **The subscription is the budget.** A student's monthly spend is capped by
> what they pay, not by an anti-abuse number. When they reach it the app says
> so plainly and the next build waits for the new month — it never silently
> charges the owner.

This is the only part of the money layer that is missing.

---

## WHAT IS DECIDED

- **Private, not shared.** A student's study apps are theirs. The cohort idea
  from earlier today is dropped — not because the arithmetic failed but
  because the owner's price point does not need it.
- **The code stops going through the model.** This is the change the price
  depends on.
- **Batch by default** for lecture builds, because they are not urgent.
- **The subscription becomes the cap.**

*Unverified:* the image token counts come from the published formula rather
than a `count_tokens` call, the turn count is estimated at 10, and the output
figure assumes the content-only build is as clean as the diff suggests. The
first real build replaces all three with measurements, and `CaptureItem.costUsd`
already exists to hold them.
