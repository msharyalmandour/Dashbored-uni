# THE FREE LLM APIS, MEASURED AGAINST THIS APP

The owner sent `mnfst/awesome-free-llm-apis` on **2026-10-08** wanting the app
run on free tiers — "يصير لانهائي". Sixteen providers read, then held against
this project's own measured workload rather than against the word "free".

---

## THE WORKLOAD, from his own finished app

| | |
|---|---|
| one study-app build | **105,238 tokens** (60,800 in + 44,438 out) |
| forty lectures, one semester | **4,209,520 tokens** |
| what the orb must be able to do | read a 51-page PDF whole · **look at** contact sheets and a timetable photo · hold a 320KB template's data shape |

Vision and long context are not preferences here. The `lecture-study-app`
template's own instructions require rendering slides and *looking* at them,
because text extraction misses the image-only slides, the handwritten ★ and
"مهم" marks, and the past-exam pages — which is exactly the material the quiz
is built from.

---

## WHAT THE CAPS ACTUALLY ALLOW

A build is roughly ten calls.

| provider | free limit | builds/day | across 30 students | notes |
|---|---|---|---|---|
| **Aion Labs** | 20K tokens/day | **0.19** | — | one build is 5 days of quota |
| OpenRouter free | 50 req/day per model | ~5 | 0.2 each | 1,000/day after a $10 purchase |
| Groq | 1,000 req/day | ~100 | 3.3 each | **no vision** |
| **Google Gemini** | 1,500 req/day | ~150 | **5.0 each** | 1M context, vision — the strongest |
| Kilo Code | 200/hour | ~480 | 16 each | may route to providers that log |
| **NVIDIA NIM** | 10,000 req/day | ~1,000 | 33 each | *"Trial use only — do not submit personal or confidential data"* |

So "infinite" is five builds per student per day on the best option, on one
shared key, and the cap is reached by whoever drops a lecture first.

---

## THE TWO THINGS THAT DECIDE IT, AND NEITHER IS A RATE LIMIT

### 1. He intends to charge for this

| | |
|---|---|
| **Cohere** | *"Non-commercial use only."* |
| everyone else | silent — and silence is not permission |

A 79 SAR subscription on a non-commercial key is not a cost saving, it is a
term being broken.

### 2. What would be sent through them

The orb's input is a student's annotated lecture PDFs, their faculty's
syllabus, their handwriting, and the questions they got wrong.

| | what the provider says |
|---|---|
| Google Gemini free | *"Free-tier prompts may be used by Google to improve products"* |
| Mistral free | *"Free-mode inputs and outputs may be used to train Mistral models"* |
| OpenRouter free | *"Free providers may log prompts for training"* |
| Kilo Code | *"may route your requests to providers that log prompts and outputs"* |
| NVIDIA NIM | *"do not submit personal or confidential data"* |

---

## AND THE NUMBER THAT SETTLES IT

What the free tier is being compared against is not the 14.79 SAR estimate
from before the template stopped going through the model. It is this:

| | per build | 40 lectures | with Batch |
|---|---|---|---|
| Sonnet 5.5 | 2.24 SAR | 89 SAR | **45 SAR** |
| **Haiku 4.5** | **1.12 SAR** | 45 SAR | **22 SAR** |

Against 316 SAR of revenue a semester, **Haiku batched is 22 SAR — seven per
cent.**

So the trade is not "free versus expensive". It is:

> **22 SAR a semester, against a classmate's annotated lecture notes and their
> faculty's syllabus sitting in somebody's training set — for a product they
> paid for.**

Stated that way it is not a close call, and it is his to make rather than
mine. What it is not is a saving worth engineering for.

---

## WHERE THE LIST IS GENUINELY WORTH USING

**His own development.** Right now every test of the orb spends money he does
not have, and that is the measured cause of twenty silent days: nine drops
sit `FAILED` from 11 September because the credit ran out. For *his own*
material, on *his own* decision, a free tier is the right tool — the privacy
objection above is about his classmates' data, not his.

### What that costs to build, honestly

It is not a base-URL swap. `run.ts` builds an `Anthropic` client and the whole
loop speaks Anthropic's tool-call shape; none of these providers does. Pointing
at an OpenAI-compatible endpoint means rewriting the tool layer, and **prompt
caching is Anthropic-specific — the 9× price difference measured in
PRICING.md comes from it.** A free-tier path would be slower, dumber, and
unable to use the one mechanism the economics depend on.

Set against what it saves: a development semester is perhaps twenty builds.
**On Haiku that is 22 SAR.**

> **The integration costs more than the tokens it saves.**

### The one change that is worth making

`DEFAULT_MODEL` in `run.ts:41` is `claude-opus-5` — $5/$25. The price table in
`spend.ts` already carries `claude-haiku-4-5` at $1/$5 and `claude-sonnet-5-5`
is absent from it entirely. Setting `AI_MODEL=claude-haiku-4-5` for
development is one environment variable, needs no code, and lands most of the
saving the free tiers were being considered for.

---

## DECIDED

- **Not as the product's engine.** Commercial terms and training-on-prompts,
  not rate limits, and the paid floor it replaces is 22 SAR a semester.
- **Not an integration.** The work costs more than the tokens, and it forfeits
  prompt caching, which is where the measured price comes from.
- **Yes as a development stopgap, by environment variable** — and the cheapest
  version of that is `AI_MODEL=claude-haiku-4-5`, which works today.
