/**
 * What a run costs, and the cap that stops it.
 *
 * Two things are being checked, and the second matters more than the first.
 *
 * The arithmetic: cached tokens are billed at a tenth, cache writes at a
 * quarter above, and the saving the log reports has to be the real one — a
 * number that flatters itself is worse than no number, because it will be
 * believed.
 *
 * The cap: it is a safety net, and a safety net fails in one direction only.
 * Every case below that involves an unknown model, a malformed budget, or a
 * missing usage field is asking the same question — when this code is unsure,
 * does it stop early or does it keep spending? Stopping early is recoverable.
 *
 * Run: npx tsx scripts/verify-agent-spend.ts
 */

import {
  addUsage,
  capFromEnv,
  costOf,
  costWithoutCaching,
  describeSpend,
  emptySpend,
  isKnownModel,
  overCap,
  priceOf,
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
} from "../src/lib/ai/agent/spend";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

console.log("Agent spend accounting\n");

/* ── Counting ────────────────────────────────────────────────────────────── */

{
  const s = addUsage(emptySpend(), {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 10,
    cache_read_input_tokens: 5,
  });
  check("one response is counted in full",
    s.inputTokens === 100 && s.outputTokens === 50 && s.cacheWriteTokens === 10 && s.cacheReadTokens === 5 && s.steps === 1,
    JSON.stringify(s));
}

{
  let s = emptySpend();
  s = addUsage(s, { input_tokens: 10, output_tokens: 1 });
  s = addUsage(s, { input_tokens: 20, output_tokens: 2 });
  check("steps accumulate across a run", s.steps === 2 && s.inputTokens === 30 && s.outputTokens === 3, JSON.stringify(s));
}

{
  // A usage block missing fields must not reduce the total. This is the
  // direction that would let a run spend past its cap.
  const s = addUsage(addUsage(emptySpend(), { input_tokens: 100 }), {});
  check("a usage block with missing fields adds nothing and subtracts nothing",
    s.inputTokens === 100 && s.outputTokens === 0 && s.steps === 2, JSON.stringify(s));
  const t = addUsage(emptySpend(), null);
  check("a null usage block is safe", t.inputTokens === 0 && t.steps === 1);
}

{
  // Negative numbers should never arrive, and must not be able to buy budget
  // back if they do.
  const s = addUsage(addUsage(emptySpend(), { input_tokens: 100 }), { input_tokens: -500 });
  check("a negative token count cannot refund the budget", s.inputTokens === 100, JSON.stringify(s));
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */

{
  const p = priceOf("claude-opus-5");
  check("opus 5 is priced at the published rate", p.inputPerMTok === 5 && p.outputPerMTok === 25, JSON.stringify(p));
  check("a known model is reported as known", isKnownModel("claude-opus-5"));
  check("surrounding whitespace does not make a known model unknown", isKnownModel("  claude-opus-5 "));
}

{
  const s = { ...emptySpend(), inputTokens: 1_000_000, outputTokens: 0, steps: 1 };
  check("a million input tokens on opus 5 costs $5", near(costOf(s, "claude-opus-5"), 5), String(costOf(s, "claude-opus-5")));
}

{
  const s = { ...emptySpend(), outputTokens: 1_000_000, steps: 1 };
  check("a million output tokens on opus 5 costs $25", near(costOf(s, "claude-opus-5"), 25), String(costOf(s, "claude-opus-5")));
}

{
  // The whole reason caching is worth doing.
  const cached = { ...emptySpend(), cacheReadTokens: 1_000_000, steps: 1 };
  const full = { ...emptySpend(), inputTokens: 1_000_000, steps: 1 };
  check("a cache read costs a tenth of a full-price read",
    near(costOf(cached, "claude-opus-5"), costOf(full, "claude-opus-5") * CACHE_READ_MULTIPLIER),
    `${costOf(cached, "claude-opus-5")} vs ${costOf(full, "claude-opus-5")}`);
}

{
  const written = { ...emptySpend(), cacheWriteTokens: 1_000_000, steps: 1 };
  const full = { ...emptySpend(), inputTokens: 1_000_000, steps: 1 };
  check("a cache write costs more than a plain read, not less",
    costOf(written, "claude-opus-5") > costOf(full, "claude-opus-5") &&
      near(costOf(written, "claude-opus-5"), costOf(full, "claude-opus-5") * CACHE_WRITE_MULTIPLIER));
}

{
  // An unknown model must be priced at the worst case, never the cheapest —
  // a cap that guesses low is a cap that does not hold.
  const s = { ...emptySpend(), inputTokens: 1_000_000, outputTokens: 1_000_000, steps: 1 };
  const unknown = costOf(s, "some-model-shipped-next-year");
  const dearest = costOf(s, "claude-fable-5-1");
  const cheapest = costOf(s, "claude-haiku-4-5");
  check("an unknown model is priced at the worst case, not the cheapest",
    near(unknown, dearest) && unknown > cheapest, `unknown ${unknown}, dearest ${dearest}`);
  check("an unknown model is reported as unknown", !isKnownModel("some-model-shipped-next-year"));
}

/* ── The saving, honestly reported ───────────────────────────────────────── */

{
  // Same tokens, two rates. The comparison must charge the cached tokens at
  // full price — the saving is the rate, not the volume.
  const s = { ...emptySpend(), inputTokens: 1000, cacheReadTokens: 9000, outputTokens: 0, steps: 4 };
  const real = costOf(s, "claude-opus-5");
  const naive = costWithoutCaching(s, "claude-opus-5");
  check("the uncached comparison charges the same tokens at full price",
    near(naive, (10_000 * 5) / 1_000_000), String(naive));
  check("caching makes this run cheaper", real < naive, `${real} vs ${naive}`);
}

{
  // With nothing cached the two figures must agree, or the log would claim a
  // saving on a run that never used the cache.
  const s = { ...emptySpend(), inputTokens: 5000, outputTokens: 500, steps: 2 };
  check("with no cache activity the two costs are identical",
    near(costOf(s, "claude-opus-5"), costWithoutCaching(s, "claude-opus-5")));
  check("and the log reports no saving", describeSpend(s, "claude-opus-5").includes("(0% saved)"),
    describeSpend(s, "claude-opus-5"));
}

{
  const s = { ...emptySpend(), inputTokens: 100, steps: 1 };
  check("an unknown model's cost is flagged in the log, not presented as measured",
    describeSpend(s, "mystery-model").includes("price unknown"), describeSpend(s, "mystery-model"));
}

/* ── The cap ─────────────────────────────────────────────────────────────── */

{
  check("an unset budget means no cap", capFromEnv(undefined) === null);
  check("an empty budget means no cap", capFromEnv("") === null);
  check("a non-numeric budget means no cap, not a cap of zero", capFromEnv("lots") === null);
  check("zero means no cap rather than refuse-everything", capFromEnv("0") === null);
  check("a negative budget means no cap", capFromEnv("-5") === null);
  check("a real budget is read", capFromEnv("0.25") === 0.25);
  check("whitespace around a real budget is tolerated", capFromEnv("  1.5  ") === 1.5);
}

{
  const cheap = { ...emptySpend(), inputTokens: 1000, steps: 1 };
  check("no cap never stops a run", !overCap(cheap, "claude-opus-5", null));
  check("a run below its cap continues", !overCap(cheap, "claude-opus-5", 1));
}

{
  // $0.05 of output on opus 5 is 2,000 tokens. At exactly the cap the run
  // stops: the next step would cross it, and a cap that only triggers strictly
  // above is a cap that can be sat on forever.
  const s = { ...emptySpend(), outputTokens: 2000, steps: 1 };
  check("spend exactly at the cap stops the run", overCap(s, "claude-opus-5", 0.05),
    String(costOf(s, "claude-opus-5")));
  check("spend past the cap stops the run", overCap({ ...s, outputTokens: 3000 }, "claude-opus-5", 0.05));
}

{
  // The cap is in dollars, so the model changes when it bites. The same
  // tokens on a dearer model must stop sooner, or a model switch would
  // silently raise a limit the student set.
  const s = { ...emptySpend(), outputTokens: 2000, steps: 1 };
  check("the same tokens hit a dollar cap sooner on a dearer model",
    overCap(s, "claude-opus-5", 0.05) && !overCap(s, "claude-haiku-4-5", 0.05),
    `opus ${costOf(s, "claude-opus-5")}, haiku ${costOf(s, "claude-haiku-4-5")}`);
}

{
  // The safety-net direction, stated as a test: an unrecognised model must
  // trip the cap no later than a known one, never later.
  const s = { ...emptySpend(), outputTokens: 2000, steps: 1 };
  check("an unknown model trips the cap at least as early as the dearest known one",
    overCap(s, "something-new", 0.05) >= overCap(s, "claude-fable-5-1", 0.05));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
