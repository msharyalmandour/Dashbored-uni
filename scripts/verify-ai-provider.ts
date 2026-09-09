/**
 * Runs the Anthropic provider against the response shapes that actually broke
 * it, without spending a request.
 *
 * The bug this exists for was invisible to every check the repo had: types
 * passed, lint passed, the build passed, and the call itself returned HTTP
 * 200. What arrived was a valid response containing no text — the whole
 * output budget had gone to the model's own reasoning — and the code read
 * that as "empty" and gave up. Nothing short of an assertion about a real
 * response body would have caught it, so this asserts against real response
 * bodies.
 *
 * `fetch` is stubbed rather than mocked at the module boundary on purpose:
 * everything downstream of it — the request that is built, the block that is
 * picked out of `content`, the fenced-JSON recovery, the schema — is the
 * shipping code, not a stand-in for it.
 *
 * Run with: npx tsx scripts/verify-ai-provider.ts
 */
import assert from "node:assert/strict";
import { createAnthropicProvider } from "../src/lib/ai/anthropic-provider";
import type { CaptureAnalysisInput } from "../src/lib/ai/types";

const INPUT: CaptureAnalysisInput = {
  content: "Timetable photo",
  source: "FILE",
  fileName: "timetable.png",
  subjects: [{ id: "subj_1", name: "Pharmacology", code: "PHAR201" }],
  knownTopics: ["Receptors"],
  today: "2026-09-09",
};

/** A valid answer, as the model actually formats one. */
const TIMETABLE_JSON = JSON.stringify({
  contentType: "REFERENCE",
  title: "Semester timetable",
  summary: "Weekly class schedule",
  subjectId: null,
  proposedSubjectName: null,
  topics: [],
  keyConcepts: ["Pharmacology", "Critical Care"],
  demandingConcepts: [],
  detectedEvent: null,
  detectedTimetable: {
    entries: [
      {
        courseName: "Critical Care",
        weekday: 0,
        startTime: "08:00",
        endTime: "10:00",
        location: "Hall 3",
        kind: "LECTURE",
      },
      {
        courseName: "Pharmacology",
        weekday: 2,
        startTime: "11:00",
        endTime: "13:00",
        location: null,
        kind: "LAB",
      },
    ],
  },
  suggestedDestinations: [{ destination: "NONE", reason: "This is a schedule" }],
  confidence: 0.92,
});

/** Installs a one-shot `fetch` returning `body`, and captures the request sent. */
function stubFetch(body: unknown, status = 200) {
  const seen: { request?: Record<string, unknown> } = {};
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    seen.request = JSON.parse(init.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return seen;
}

const provider = createAnthropicProvider("test-key");
const failures: string[] = [];

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** The error a call rejects with, or a marker when it wrongly succeeded. */
async function errorFrom(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "<resolved, but should have thrown>";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function main() {
  console.log("Anthropic provider — response handling\n");

  // The regression itself. Before the fix this response — the literal shape of
  // a reply that reasoned until the budget ran out — produced "returned an
  // empty response", which sent three debugging sessions after the API key.
  await check("a reply that spent its budget thinking says so", async () => {
    stubFetch({
      content: [{ type: "thinking", thinking: "Reading the timetable rows..." }],
      stop_reason: "max_tokens",
    });
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.equal(message, "The AI ran out of room before it finished its answer.");
  });

  await check("a declined answer is not reported as empty", async () => {
    stubFetch({ content: [], stop_reason: "refusal" });
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.equal(message, "The AI declined to answer about this item.");
  });

  await check("a genuinely empty reply keeps the original message", async () => {
    stubFetch({ content: [], stop_reason: "end_turn" });
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.equal(message, "The AI provider returned an empty response.");
  });

  await check("a budget large enough for the answer is requested", async () => {
    const seen = stubFetch({ content: [{ type: "text", text: TIMETABLE_JSON }], stop_reason: "end_turn" });
    await provider.analyzeCapture(INPUT);
    // 1024 was the number that broke this. The assertion is on the floor, not
    // the exact value, so tuning the budget upward never fails the test.
    assert.ok(
      typeof seen.request?.max_tokens === "number" && seen.request.max_tokens >= 8000,
      `max_tokens was ${String(seen.request?.max_tokens)}`
    );
  });

  await check("a real timetable parses into entries", async () => {
    stubFetch({ content: [{ type: "text", text: TIMETABLE_JSON }], stop_reason: "end_turn" });
    const result = await provider.analyzeCapture(INPUT);
    assert.equal(result.detectedTimetable?.entries.length, 2);
    assert.equal(result.detectedTimetable?.entries[0].courseName, "Critical Care");
    assert.equal(result.detectedTimetable?.entries[0].weekday, 0);
    assert.equal(result.detectedTimetable?.entries[0].startTime, "08:00");
    assert.equal(result.detectedTimetable?.entries[1].kind, "LAB");
  });

  // The model reasons and then answers, so the answer is the last text block.
  // Taking the first would classify against a preamble.
  await check("the answer is read after a thinking block, not before it", async () => {
    stubFetch({
      content: [
        { type: "thinking", thinking: "Two rows are legible." },
        { type: "text", text: TIMETABLE_JSON },
      ],
      stop_reason: "end_turn",
    });
    const result = await provider.analyzeCapture(INPUT);
    assert.equal(result.detectedTimetable?.entries.length, 2);
  });

  await check("JSON inside a fenced block is recovered", async () => {
    stubFetch({
      content: [{ type: "text", text: "Here you go:\n```json\n" + TIMETABLE_JSON + "\n```" }],
      stop_reason: "end_turn",
    });
    const result = await provider.analyzeCapture(INPUT);
    assert.equal(result.detectedTimetable?.entries.length, 2);
  });

  // A truncated reply is the other half of the old bug: this is what produced
  // a real course in the database called `CRTICAL car`. It must fail loudly,
  // never parse into half a timetable.
  await check("a reply cut off mid-JSON is rejected, not half-parsed", async () => {
    stubFetch({
      content: [{ type: "text", text: TIMETABLE_JSON.slice(0, 220) }],
      stop_reason: "max_tokens",
    });
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.ok(message.length > 0, "should have thrown");
    assert.ok(!message.includes("undefined"), message);
  });

  await check("an unusable answer is rejected by the schema", async () => {
    stubFetch({
      content: [{ type: "text", text: '{"contentType":"NOT_A_REAL_TYPE"}' }],
      stop_reason: "end_turn",
    });
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.ok(message.length > 0, "should have thrown");
  });

  await check("an empty balance is reported as an empty balance", async () => {
    stubFetch({ error: { message: "Your credit balance is too low" } }, 400);
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.equal(message, "The AI account has no credit left. Add credit to continue.");
  });

  await check("a rejected key is reported as a rejected key", async () => {
    stubFetch({ error: { message: "invalid x-api-key" } }, 401);
    const message = await errorFrom(provider.analyzeCapture(INPUT));
    assert.ok(message.includes("rejected as invalid"), message);
  });

  console.log("");
  if (failures.length > 0) {
    console.log(`${failures.length} failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("All response shapes handled correctly.");
}

main();
