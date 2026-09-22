/**
 * What a run costs, counted rather than guessed.
 *
 * Every response carries a `usage` block saying exactly how many tokens were
 * read and written. This file was added because the agent had been throwing
 * that away: the only thing anyone could say about the bill was that it
 * existed. A cap you cannot measure is a hope, and "it feels expensive" is not
 * a number you can act on.
 *
 * Pure on purpose — no SDK types, no network, no clock. The loop hands it the
 * four numbers from a response and asks two questions: what has this run spent
 * so far, and is that over the line.
 */

/** The four token counts a response reports, accumulated across a run. */
export interface AgentSpend {
  /** Full-price input: everything not served from, or written to, the cache. */
  inputTokens: number;
  outputTokens: number;
  /** Written into the cache this step. Billed above the input rate. */
  cacheWriteTokens: number;
  /** Served from the cache. This is the number that should grow. */
  cacheReadTokens: number;
  /** Model calls made. Useful on its own: a run that took eight steps is a
      run that went wrong, whatever it cost. */
  steps: number;
}

export function emptySpend(): AgentSpend {
  return { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, steps: 0 };
}

/** The shape we need from the SDK's usage block. Narrow on purpose so this
 *  file stays testable without constructing an SDK response. */
export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Fold one response's usage into the running total.
 *
 * Returns a new object rather than mutating, so a caller can keep the total
 * before a step and compare. Missing and negative fields are treated as zero:
 * a usage block that is partly absent must not silently subtract from a
 * budget, which is the direction that would let a run overspend.
 */
export function addUsage(spend: AgentSpend, usage: UsageLike | null | undefined): AgentSpend {
  const n = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? v : 0);
  return {
    inputTokens: spend.inputTokens + n(usage?.input_tokens),
    outputTokens: spend.outputTokens + n(usage?.output_tokens),
    cacheWriteTokens: spend.cacheWriteTokens + n(usage?.cache_creation_input_tokens),
    cacheReadTokens: spend.cacheReadTokens + n(usage?.cache_read_input_tokens),
    steps: spend.steps + 1,
  };
}

/**
 * Dollars per million tokens, as published.
 *
 * Cache pricing is a multiple of the input rate rather than a separate column:
 * a write costs 1.25x because the cache has to be built, a read costs 0.1x
 * because it does not. That is the whole reason caching is worth doing — the
 * same tokens, resent on step after step, at a tenth of the price.
 */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

interface Price {
  inputPerMTok: number;
  outputPerMTok: number;
}

const PRICES: Record<string, Price> = {
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-fable-5": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-7": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-6": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
};

/**
 * The price list's own worst case, used for a model we do not recognise.
 *
 * Deliberately pessimistic, and the direction matters. This number exists to
 * enforce a spending cap; guessing low on an unknown model would let a run
 * spend past the line the student set, which is the one outcome a cap is for.
 * Guessing high stops a run early and says so. Computed from the table rather
 * than written down, so adding a pricier model cannot leave it stale.
 */
function worstCasePrice(): Price {
  return Object.values(PRICES).reduce(
    (worst, p) => ({
      inputPerMTok: Math.max(worst.inputPerMTok, p.inputPerMTok),
      outputPerMTok: Math.max(worst.outputPerMTok, p.outputPerMTok),
    }),
    { inputPerMTok: 0, outputPerMTok: 0 }
  );
}

export function priceOf(model: string): Price {
  return PRICES[model.trim()] ?? worstCasePrice();
}

/** Whether this model's price is known, so a caller can say so rather than
 *  quietly presenting a worst-case figure as a measurement. */
export function isKnownModel(model: string): boolean {
  return model.trim() in PRICES;
}

/** What the run has cost so far, in dollars. */
export function costOf(spend: AgentSpend, model: string): number {
  const price = priceOf(model);
  const input =
    spend.inputTokens +
    spend.cacheWriteTokens * CACHE_WRITE_MULTIPLIER +
    spend.cacheReadTokens * CACHE_READ_MULTIPLIER;
  return (input * price.inputPerMTok + spend.outputTokens * price.outputPerMTok) / 1_000_000;
}

/**
 * What the same run would have cost with no caching at all.
 *
 * Cached tokens were still sent — the saving is in the rate, not the volume —
 * so the comparison is those same tokens charged at the full input price.
 * This is what turns "caching is on" into a number someone can check.
 */
export function costWithoutCaching(spend: AgentSpend, model: string): number {
  const price = priceOf(model);
  const input = spend.inputTokens + spend.cacheWriteTokens + spend.cacheReadTokens;
  return (input * price.inputPerMTok + spend.outputTokens * price.outputPerMTok) / 1_000_000;
}

/**
 * The cap, read from the environment.
 *
 * Unset means no cap, which is the behaviour this code replaces and so the
 * safe default: switching the file on must not start refusing work nobody
 * asked it to refuse. Zero and negative are treated as unset rather than as
 * "refuse everything", because a misconfigured variable should not silently
 * disable the whole feature with no error anywhere.
 */
export function capFromEnv(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Whether the run has spent its allowance.
 *
 * Checked between steps, never mid-step: a model call cannot be interrupted,
 * so the honest question is whether to start another one. That means a run can
 * finish slightly over the cap — by at most one step — and saying so here is
 * better than implying a precision the design does not have.
 */
export function overCap(spend: AgentSpend, model: string, capUsd: number | null): boolean {
  if (capUsd === null) return false;
  return costOf(spend, model) >= capUsd;
}

/** One line for a log, in cents, since a single run costs well under a dollar. */
export function describeSpend(spend: AgentSpend, model: string): string {
  const cents = costOf(spend, model) * 100;
  const naive = costWithoutCaching(spend, model) * 100;
  const saved = naive > 0 ? Math.round((1 - cents / naive) * 100) : 0;
  const known = isKnownModel(model) ? "" : " (price unknown for this model; worst case assumed)";
  return (
    `${spend.steps} step(s), ${spend.inputTokens} in / ${spend.outputTokens} out, ` +
    `cache ${spend.cacheReadTokens} read / ${spend.cacheWriteTokens} written, ` +
    `${cents.toFixed(2)}c vs ${naive.toFixed(2)}c uncached (${saved}% saved)${known}`
  );
}
