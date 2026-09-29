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
import {
  capsFrom,
  refusal,
  runCapUsd,
  refusalToError,
  errorToRefusal,
  describeBudget,
  DEFAULT_RUN_CAP_USD,
  DEFAULT_STUDENT_DAY_CAP_USD,
  DEFAULT_EVERYONE_DAY_CAP_USD,
} from "../src/lib/ai/agent/budget";

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

/* ── The budgets ──────────────────────────────────────────────────────────────

   The per-run cap above is the old net and it was never the real hole. One run
   is bounded by MAX_STEPS; the unbounded thing is the number of runs, and until
   budget.ts there was nothing between an open /register page and a bill.

   Every case below asks the safety-net question in the same direction as the
   cap cases: when this code is unsure — an unset variable, a typo, a database
   that cannot be summed — does it end up cheaper or dearer? Unset and typo must
   land on a limit. Only the unmeasurable day is allowed to continue, and that
   one is a stated trade rather than an oversight.                             */

{
  // Unset is the case this whole module exists for. AI_SPEND_CAP_USD was unset
  // on a public deployment, and unset used to mean no cap at all.
  check("an unset run cap falls back to the default, never to unlimited",
    runCapUsd(undefined) === DEFAULT_RUN_CAP_USD);
  check("an empty run cap falls back to the default", runCapUsd("") === DEFAULT_RUN_CAP_USD);
  check("a typo in the run cap falls back to the default, not to zero",
    runCapUsd("three dollars") === DEFAULT_RUN_CAP_USD);
  check("zero falls back to the default rather than refusing every run",
    runCapUsd("0") === DEFAULT_RUN_CAP_USD);
  check("a negative run cap falls back to the default", runCapUsd("-2") === DEFAULT_RUN_CAP_USD);
  check("a real run cap is honoured", runCapUsd("0.25") === 0.25);
  check("whitespace around a real run cap is tolerated", runCapUsd(" 1.5 ") === 1.5);

  // The old parser keeps its own meaning, and this asserts the two have not
  // been conflated: capFromEnv answers "what does this string say", where null
  // for absent is correct. Only runCapUsd is allowed to invent a number.
  check("the parser and the policy stay distinct", capFromEnv(undefined) === null);
}

{
  // An empty environment is what a real deployment looks like the day someone
  // forgets, so it is the case with the defaults asserted on it.
  const caps = capsFrom({});
  check("an empty environment still has all three caps",
    caps.runUsd === DEFAULT_RUN_CAP_USD &&
      caps.studentDayUsd === DEFAULT_STUDENT_DAY_CAP_USD &&
      caps.everyoneDayUsd === DEFAULT_EVERYONE_DAY_CAP_USD,
    JSON.stringify(caps));

  // Ordering the defaults is a claim, not a coincidence: a student's day must
  // be able to fit inside everyone's day, and a single run must fit inside a
  // student's day or the day cap could never be reached by ordinary use.
  check("the defaults are ordered run <= student <= everyone",
    DEFAULT_RUN_CAP_USD <= DEFAULT_STUDENT_DAY_CAP_USD &&
      DEFAULT_STUDENT_DAY_CAP_USD <= DEFAULT_EVERYONE_DAY_CAP_USD);
}

{
  const caps = capsFrom({ AI_DAY_CAP_USD: "2", AI_DAY_CAP_TOTAL_USD: "6" });
  check("configured day caps are read", caps.studentDayUsd === 2 && caps.everyoneDayUsd === 6);

  // Configured upside down, the student cap would be unreachable: a setting
  // that looks active while doing nothing is worse than no setting.
  const inverted = capsFrom({ AI_DAY_CAP_USD: "50", AI_DAY_CAP_TOTAL_USD: "4" });
  check("a student may not be allowed more than everyone",
    inverted.studentDayUsd === 4, JSON.stringify(inverted));
}

{
  const caps = capsFrom({});
  check("a quiet day runs", refusal({ student: 0, everyone: 0 }, caps) === null);
  check("a busy but unspent day runs",
    refusal({ student: 4.99, everyone: 9.99 }, caps) === null);

  // At the limit, not past it — the same rule overCap follows. A limit that
  // only bites strictly above can be sat on exactly at the line indefinitely.
  check("a student exactly at their day cap is refused",
    refusal({ student: DEFAULT_STUDENT_DAY_CAP_USD, everyone: 9 }, caps) === "STUDENT_DAY");
  check("the deployment exactly at its day cap is refused",
    refusal({ student: 0.1, everyone: DEFAULT_EVERYONE_DAY_CAP_USD }, caps) === "EVERYONE_DAY");

  // Both spent: the reason given is the student's own day, because it is the
  // one that explains it. Telling them the site is out of budget when they
  // personally accounted for all of it is true and misleading at once.
  check("when both are spent the student's own day is the reason given",
    refusal({ student: 99, everyone: 99 }, caps) === "STUDENT_DAY");

  // The everyone cap has to be reachable by someone who is under their own —
  // otherwise it is unreachable in the single-account case it was written for.
  check("one student under their own cap can still trip the deployment's",
    refusal({ student: 1, everyone: 40 }, caps) === "EVERYONE_DAY");
}

{
  // A refusal reaches the student through CaptureItem.error, and the inbox
  // renders one generic sentence for everything in that column. If a code did
  // not survive the round trip the student would be told the agent could not
  // read a file it never opened, and would retry it all afternoon.
  check("a student-day refusal survives the round trip",
    errorToRefusal(refusalToError("STUDENT_DAY")) === "STUDENT_DAY");
  check("a deployment refusal survives the round trip",
    errorToRefusal(refusalToError("EVERYONE_DAY")) === "EVERYONE_DAY");

  // And the other direction: a provider's own words must never be mistaken for
  // a budget refusal, or a genuine failure gets the reassuring sentence.
  check("a provider error is not read as a budget refusal",
    errorToRefusal("429 rate_limit_error") === null);
  check("an unmarked code is not read as a budget refusal",
    errorToRefusal("STUDENT_DAY") === null);
  check("null and empty are not budget refusals",
    errorToRefusal(null) === null && errorToRefusal("") === null);
}

{
  // The log line is what someone reads at 2am wondering why drops stopped, so
  // the numbers in it have to be the numbers that were compared — including
  // the clamp, which is the one that surprises.
  const caps = capsFrom({ AI_DAY_CAP_USD: "50", AI_DAY_CAP_TOTAL_USD: "4" });
  const line = describeBudget({ student: 0.9, everyone: 4 }, caps);
  check("the log reports the clamped student cap, not the configured one",
    line.includes("$0.90/$4.00"), line);
  check("the log keeps cents rather than rounding a real day to zero",
    describeBudget({ student: 0.9, everyone: 0.9 }, caps).includes("0.90"));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
