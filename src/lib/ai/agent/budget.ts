/**
 * What may be spent, before anything is spent.
 *
 * `spend.ts` answers "what has this run cost so far" and stops a run that goes
 * past its allowance. That is a cap on ONE run, and one run was already bounded
 * — at most 12 steps at max_tokens 16,000, so no single run can run away very
 * far. The thing that is genuinely unbounded is the NUMBER of runs: /register
 * is open, every drop starts an agent, and every agent call is billed to
 * whoever's key is in the environment. A per-run cap does nothing about a
 * thousand drops.
 *
 * So there are three limits here, and only the last two are new protection:
 *
 *   per run      — a pathological single run. Bounded already; this trims it.
 *   per student   — one account's day.
 *   everyone      — the whole deployment's day, across all accounts.
 *
 * Checked BEFORE a run starts, which is the only point at which refusing is
 * free. A run already under way cannot be interrupted mid-call, so a day can
 * finish over its cap by at most one run — said here rather than implied,
 * exactly as `overCap` says it.
 *
 * Pure: no clock, no database, no environment reads beyond the explicit
 * argument. The caller measures the day and asks what to do about it.
 */

/**
 * The per-run ceiling, in dollars, when nothing is configured.
 *
 * Derived from the loop's own limits rather than from measurement, and that
 * distinction matters enough to state: no run's cost has ever been recorded
 * (`describeSpend` went to a console log and nowhere else), so there is no
 * measured distribution to put a percentile on. What there is, is arithmetic:
 *
 *   content per run  PASS_CHARS = 30,000 chars, about 7,500 tokens
 *   a whole PDF      MAX_PDF_BYTES = 20MB, up to the API's ~100 pages,
 *                    roughly 250,000 tokens
 *   steps            8 filing a drop, 12 answering a request (run.ts),
 *                    max_tokens 16,000 each
 *
 * The largest LEGITIMATE run is therefore a hundred-page PDF re-read across
 * eight cached steps: one cache write at 1.25x plus seven reads at 0.1x is
 * about 487,000 billable-equivalent input tokens, which on opus-5 input is
 * ~$2.44, plus realistic output — call it $2.60. The theoretical worst is an
 * output-saturated eight steps: 128,000 output tokens at $25/MTok is $3.20,
 * plus input, about $4.20.
 *
 * The twelve-step request mode added on 2026-10-07 does not move either
 * number, and it is worth saying why rather than leaving it to be rechecked.
 * A request carries no PDF and no 30,000 characters of content — it is one
 * sentence — so the quarter-million input tokens that dominate the filing
 * arithmetic are simply absent. Its four extra steps are reads of the
 * student's own rows: a task list, a lecture, a due count. Twelve steps of
 * *that* is far below eight steps of a textbook, so the filing case remains
 * the binding one and $3 still sits above it.
 *
 * $3 sits above the largest run that is real work and below the runaway. A
 * lower number would cut a textbook off part way through and report it as a
 * spending failure, which is worse than the spending.
 *
 * Replace this with a percentile once `CaptureItem.costUsd` has a month of
 * rows in it. That column exists so this constant can stop being arithmetic.
 */
export const DEFAULT_RUN_CAP_USD = 3;

/**
 * One account's day.
 *
 * $5 is about one twelve-pass textbook (~$3) plus a normal day's lecture
 * drops (~$1.50) — a genuinely heavy day of real use, with room above it.
 */
export const DEFAULT_STUDENT_DAY_CAP_USD = 5;

/**
 * Everyone's day, across every account on the deployment.
 *
 * This is the one that answers the actual exposure: registration is open, so
 * the per-student cap is only ever as strong as the number of accounts someone
 * is willing to create. $10 is two heavy days of real use — enough that the
 * student who owns the site is never the one who trips it, low enough that an
 * abusive afternoon costs the price of a coffee instead of a phone bill.
 */
export const DEFAULT_EVERYONE_DAY_CAP_USD = 10;

/** How long "a day" is. A rolling window, not a calendar day: a calendar
 *  boundary gives an abuser two full allowances an hour apart at midnight. */
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface BudgetCaps {
  runUsd: number;
  studentDayUsd: number;
  everyoneDayUsd: number;
}

/** What the last day actually cost, measured by the caller. */
export interface DaySpend {
  /** This account, over the window. */
  student: number;
  /** Every account, over the window. Includes `student`. */
  everyone: number;
}

/**
 * Why a run was refused before it began.
 *
 * Two codes rather than one message because the two need different words in
 * front of the student: their own allowance is something they spent and will
 * get back, and the deployment's is not about them at all.
 */
export type BudgetRefusal = "STUDENT_DAY" | "EVERYONE_DAY";

function positive(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw.trim());
  /* Zero, negative and unparseable all fall back to the default rather than
     becoming a cap of zero. A typo in an environment variable must not quietly
     refuse every drop the student makes — and it must not quietly remove the
     cap either, which is why there is no null here the way `capFromEnv` has
     one. Misconfiguration lands on the documented default, in both
     directions. */
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/**
 * The caps in force, read from the environment.
 *
 * Unset means the default, NOT unlimited. That is the whole change: before
 * this, an unset `AI_SPEND_CAP_USD` meant no cap at all, and unset is exactly
 * what a real deployment looks like on the day someone forgets.
 *
 * The three variables read are `AI_SPEND_CAP_USD` (one run),
 * `AI_DAY_CAP_USD` (one account's day) and `AI_DAY_CAP_TOTAL_USD` (every
 * account's day). Typed as a bag of strings rather than those three keys so
 * `process.env` can be passed straight in — a narrower type makes this a weak
 * type and every caller has to pick the keys out by hand, which is three more
 * places for a name to be mistyped.
 */
export function capsFrom(env: Record<string, string | undefined>): BudgetCaps {
  const studentDayUsd = positive(env.AI_DAY_CAP_USD, DEFAULT_STUDENT_DAY_CAP_USD);
  const everyoneDayUsd = positive(env.AI_DAY_CAP_TOTAL_USD, DEFAULT_EVERYONE_DAY_CAP_USD);
  return {
    runUsd: positive(env.AI_SPEND_CAP_USD, DEFAULT_RUN_CAP_USD),
    /* A student may not be allowed more than everyone is allowed. Configured
       the other way round — a $5 student cap under a $2 total — the student cap
       would be unreachable and the setting would look active while doing
       nothing. Clamping makes the effective number the one that bites, and the
       one a log can print. */
    studentDayUsd: Math.min(studentDayUsd, everyoneDayUsd),
    everyoneDayUsd,
  };
}

/**
 * Whether this run may start, and if not, which limit stopped it.
 *
 * The student's own allowance is checked first, and the order is a decision
 * rather than an accident: when both are spent, it is their own day that
 * explains it, and telling them "the site is out of budget" while they
 * personally accounted for all of it would be true and misleading at once.
 *
 * At the cap, not past it, for the same reason `overCap` triggers on equality:
 * a limit that only bites strictly above can be sat on exactly at the line
 * forever.
 */
export function refusal(spent: DaySpend, caps: BudgetCaps): BudgetRefusal | null {
  if (spent.student >= caps.studentDayUsd) return "STUDENT_DAY";
  if (spent.everyone >= caps.everyoneDayUsd) return "EVERYONE_DAY";
  return null;
}

/**
 * How a refusal is written into `CaptureItem.error`, and read back out.
 *
 * That column normally holds the provider's own words — an HTTP status, a
 * model name — which the inbox deliberately never shows a student: it renders
 * one sentence, "the agent could not read this". For a budget refusal that
 * sentence is false in a way that costs the student something real. The agent
 * could have read it perfectly; nothing was tried. Told the wrong reason they
 * would retry the same item all afternoon, and every retry is refused.
 *
 * So the two refusals are written as marked codes and the inbox matches on
 * them exactly. The prefix is what makes the match safe — a provider message
 * cannot accidentally look like one of these, and an unrecognised value falls
 * back to the generic sentence rather than to a guess.
 */
const ERROR_PREFIX = "BUDGET_";

export function refusalToError(code: BudgetRefusal): string {
  return `${ERROR_PREFIX}${code}`;
}

export function errorToRefusal(error: string | null | undefined): BudgetRefusal | null {
  if (error === `${ERROR_PREFIX}STUDENT_DAY`) return "STUDENT_DAY";
  if (error === `${ERROR_PREFIX}EVERYONE_DAY`) return "EVERYONE_DAY";
  return null;
}

/**
 * The per-run cap, with the default applied.
 *
 * Separate from `capFromEnv` in spend.ts, which stays as it is: that function
 * answers "what does this string say" and returning null for absent is the
 * honest answer to that question. This one answers "what is the cap", where
 * absent has to mean the default. Keeping them apart means the parser's own
 * tests still assert what the parser actually does.
 */
export function runCapUsd(raw: string | undefined): number {
  return positive(raw, DEFAULT_RUN_CAP_USD);
}

/**
 * One line for a log, so a refusal is never mysterious.
 *
 * Dollars to the cent: these are small numbers, and rounding them to whole
 * dollars would print "$0 of $5 spent" for a day that had in fact spent
 * ninety cents.
 */
export function describeBudget(spent: DaySpend, caps: BudgetCaps): string {
  return (
    `student $${spent.student.toFixed(2)}/$${caps.studentDayUsd.toFixed(2)}, ` +
    `everyone $${spent.everyone.toFixed(2)}/$${caps.everyoneDayUsd.toFixed(2)}, ` +
    `run cap $${caps.runUsd.toFixed(2)}`
  );
}
