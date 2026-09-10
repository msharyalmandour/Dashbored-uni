/**
 * Drives the real agent loop through scripted model conversations.
 *
 * The loop is the part of this feature that cannot be checked by reading it.
 * Its behaviour only exists across turns — did it hand every tool result back
 * in one message, did it stop when told to stop, does a failed tool reach the
 * model as something it can recover from — and none of that is visible in any
 * single function. So `fetch` is replaced with a script of responses and the
 * shipping loop is run against it: the loop, the tool dispatch, the argument
 * validation and the action log are all the real ones.
 *
 * The tool executors are the one thing stubbed out, because they write to
 * Postgres and this has to run anywhere. What they would have written is
 * asserted through the action log instead, which is the same thing the
 * interface reads.
 *
 * Run with: npx tsx scripts/verify-agent.ts
 */
import assert from "node:assert/strict";
import { runAgent, type AgentInput } from "../src/lib/ai/agent/run";
import { planPdfRetry } from "../src/lib/ai/agent/organize";
import type { AgentContext } from "../src/lib/ai/agent/tools";
import { agentActionsSchema } from "../src/lib/ai/agent/types";

const CTX: AgentContext = { userId: "user_1", captureId: "cap_1" };

const INPUT: AgentInput = {
  content: "Timetable photo",
  fileName: "timetable.png",
  subjects: [{ id: "subj_pharm", name: "Pharmacology", code: "PHAR201" }],
  recentActivity: [],
  today: "2026-09-10",
};

type Turn = {
  content: unknown[];
  stop_reason: string;
};

/** Every request the loop sent, so the conversation itself can be asserted on. */
type Sent = { body: Record<string, unknown> };

/**
 * Replaces `fetch` with a scripted sequence of model turns.
 *
 * Each call to the API consumes the next turn. Running out is a failure rather
 * than a silent stop: it means the loop asked for more turns than the scenario
 * expected, which is exactly the kind of runaway the limits exist to prevent.
 */
function scriptModel(turns: Turn[]): Sent[] {
  const sent: Sent[] = [];
  let i = 0;

  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    sent.push({ body: JSON.parse(init.body) });
    const turn = turns[i];
    i += 1;
    if (!turn) throw new Error(`The loop asked for turn ${i}, but only ${turns.length} were scripted.`);

    return new Response(
      JSON.stringify({
        id: `msg_${i}`,
        type: "message",
        role: "assistant",
        model: "claude-opus-5",
        content: turn.content,
        stop_reason: turn.stop_reason,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;

  return sent;
}

/** An HTTP failure from the provider, for the error-mapping checks. */
function scriptHttpError(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function toolUse(id: string, name: string, input: unknown) {
  return { type: "tool_use", id, name, input };
}

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

/**
 * Runs the loop with recording stand-ins for the tool executors.
 *
 * `runAgent` takes the executor as a parameter with the real one as its
 * default, so this passes a stand-in through the same seam the application
 * uses — there is no test-only branch inside the loop that could drift away
 * from what ships.
 */
type Call = { name: string; input: Record<string, unknown> };

function withStubbedTools(
  handler: (call: Call) => { result: string; action?: unknown; question?: string; finished?: boolean },
  input: AgentInput = INPUT
) {
  const calls: Call[] = [];
  const execute = async (_ctx: AgentContext, name: string, raw: unknown) => {
    const call = { name, input: (raw ?? {}) as Record<string, unknown> };
    calls.push(call);
    return handler(call) as never;
  };
  return { calls, run: () => runAgent("test-key", CTX, input, undefined, execute) };
}

/** The ordinary path: read the item, write several things, finish. */
function respondNormally(call: Call) {
  switch (call.name) {
    case "import_timetable":
      return {
        result: "Added 6 classes.",
        action: { kind: "TIMETABLE", coursesCreated: 2, classesAdded: 6, skipped: 1, replaced: 0 },
      };
    case "create_knowledge_gap":
      return {
        result: "Created gap.",
        action: { kind: "GAP", id: "gap_1", title: String(call.input.title), subjectName: "Pharmacology" },
      };
    case "create_task":
      return {
        result: "Created task.",
        action: {
          kind: "TASK",
          id: "task_1",
          title: String(call.input.title),
          deadline: "2026-10-01T00:00:00.000Z",
          subjectName: "Pharmacology",
        },
      };
    case "search_courses":
      return { result: "id: subj_pharm | name: Pharmacology" };
    case "ask_student":
      return { result: "Asked.", question: String(call.input.question) };
    case "finish":
      return { result: String(call.input.summary), finished: true };
    default:
      return { result: "ok" };
  }
}

/**
 * Walks a published schema and reports anything the API will reject.
 *
 * This exists because two separate schema bugs reached production, and neither
 * was visible to types, lint, the build, or the seventeen loop tests below —
 * all of which exercise the loop through a stubbed transport and never look at
 * the schemas the way the API does.
 *
 * The first was nullable fields written as `type: ["string", "null"]`: correct
 * JSON Schema, and not a form this API accepts. The second was `strict: true`
 * over eleven tools, which the server refused wholesale as "Schema is too
 * complex" — a limit on the combined tool surface, not on any one field. Both
 * failed every request, and neither error named a tool or a field.
 *
 * So this checks the two things that actually bit, plus the object hygiene
 * that keeps the surface small enough for the next tool to be safe to add.
 */
function schemaProblems(node: unknown, path: string): string[] {
  if (!node || typeof node !== "object") return [];
  const schema = node as Record<string, unknown>;
  const problems: string[] = [];

  if (Array.isArray(schema.type)) {
    problems.push(`${path}: type is an array (${JSON.stringify(schema.type)}); use anyOf`);
  }

  if (schema.type === "object") {
    if (schema.additionalProperties !== false) {
      problems.push(`${path}: objects must set additionalProperties: false`);
    }
    const props = (schema.properties ?? {}) as Record<string, unknown>;
    const required = (schema.required ?? []) as string[];
    for (const key of required) {
      if (!(key in props)) problems.push(`${path}: "${key}" is required but not a property`);
    }
    for (const key of Object.keys(props)) {
      problems.push(...schemaProblems(props[key], `${path}.${key}`));
    }
  }

  if (schema.items) problems.push(...schemaProblems(schema.items, `${path}[]`));
  for (const key of ["anyOf", "allOf"] as const) {
    const branches = schema[key];
    if (Array.isArray(branches)) {
      branches.forEach((b, i) => problems.push(...schemaProblems(b, `${path}.${key}[${i}]`)));
    }
  }

  return problems;
}

async function main() {
  console.log("Agent loop — behaviour across turns\n");

  await check("every published tool schema is one the API will accept", async () => {
    const { AGENT_TOOLS } = await import("../src/lib/ai/agent/tools");
    const problems = AGENT_TOOLS.flatMap((tool) => schemaProblems(tool.input_schema, tool.name));
    assert.deepEqual(problems, [], `\n      ${problems.join("\n      ")}`);
  });

  await check("no tool asks for schema compilation the surface is too big for", async () => {
    const { AGENT_TOOLS } = await import("../src/lib/ai/agent/tools");

    // `strict: true` makes the server compile every tool schema into a decoder,
    // and eleven tools is already past what it will accept — it answers
    // "Schema is too complex" and refuses the whole request, so one tool
    // declaring it breaks every drop, not just its own. Zod does this job in
    // the executors instead; see the note above AGENT_TOOLS.
    const strict = AGENT_TOOLS.filter((t) => (t as { strict?: boolean }).strict).map((t) => t.name);
    assert.deepEqual(strict, [], `these declare strict: ${strict.join(", ")}`);
  });

  await check("the agent can read the student's own records before writing", async () => {
    const { AGENT_TOOLS } = await import("../src/lib/ai/agent/tools");
    const read = AGENT_TOOLS.find((t) => t.name === "whats_already_there");
    assert.ok(read, "there must be a way to look before writing");

    // Every argument optional on purpose: the call the model makes most is the
    // one with nothing to say yet — "what has this student got?" — and a
    // required field would turn that into a guess about a course id.
    const schema = read.input_schema as { required?: string[] };
    assert.ok(!schema.required || schema.required.length === 0, "nothing here should be required");

    // The tools that create duplicates are the ones that must mention it.
    for (const name of ["create_task", "create_lecture", "create_knowledge_gap"]) {
      const tool = AGENT_TOOLS.find((t) => t.name === name);
      assert.ok(
        tool?.description?.includes("whats_already_there"),
        `${name} must point at the check that prevents a duplicate`
      );
    }
  });

  await check("a drop that needs several writes does them in one turn", async () => {
    scriptModel([
      {
        content: [
          { type: "text", text: "This is a timetable." },
          toolUse("t1", "import_timetable", {
            entries: [
              {
                courseName: "Pharmacology",
                weekday: 0,
                startTime: "08:00",
                endTime: "10:00",
                location: null,
                kind: "LECTURE",
              },
            ],
          }),
          toolUse("t2", "create_knowledge_gap", {
            subjectId: "subj_pharm",
            title: "Receptor binding",
            description: null,
            difficulty: "HARD",
            source: "LECTURE",
          }),
        ],
        stop_reason: "tool_use",
      },
      {
        content: [toolUse("t3", "finish", { summary: "أضفت جدولك وسجّلت مفهومًا تحتاج تفهمه." })],
        stop_reason: "tool_use",
      },
    ]);

    const result = await withStubbedTools(respondNormally).run();

    assert.equal(result.status, "DONE");
    assert.equal(result.actions.length, 2);
    assert.equal(result.actions[0].kind, "TIMETABLE");
    assert.equal(result.actions[1].kind, "GAP");
    // The summary is the model's own words, in the student's language.
    assert.ok(result.status === "DONE" && result.summary.includes("جدولك"));
  });

  await check("every result from one turn goes back in a single message", async () => {
    const sent = scriptModel([
      {
        content: [
          toolUse("t1", "create_task", { title: "Essay", deadline: "2026-10-01", type: "ASSIGNMENT" }),
          toolUse("t2", "create_knowledge_gap", {
            subjectId: "subj_pharm",
            title: "X",
            difficulty: "MEDIUM",
            source: "LECTURE",
          }),
        ],
        stop_reason: "tool_use",
      },
      { content: [toolUse("t3", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally).run();

    // Second request = [user item, assistant tool_use, user tool_results].
    // Both results must be in that one final user message: splitting them
    // teaches the model to stop asking for several things at once.
    const messages = sent[1].body.messages as { role: string; content: unknown }[];
    assert.equal(messages.length, 3);
    const results = messages[2].content as { type: string }[];
    assert.equal(messages[2].role, "user");
    assert.equal(results.filter((b) => b.type === "tool_result").length, 2);
  });

  await check("a question stops the run and is handed back", async () => {
    scriptModel([
      {
        content: [toolUse("t1", "ask_student", { question: "هذي لمادة جديدة والا عندك مادة لها؟" })],
        stop_reason: "tool_use",
      },
    ]);

    const result = await withStubbedTools(respondNormally).run();

    assert.equal(result.status, "ASKED");
    assert.ok(result.status === "ASKED" && result.question.includes("مادة"));
  });

  await check("an answer from the student reaches the model", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally, { ...INPUT, studentAnswer: "هي مادة جديدة" }).run();

    const messages = sent[0].body.messages as { content: { type: string; text?: string }[] }[];
    const text = messages[0].content.find((b) => b.type === "text")?.text ?? "";
    assert.ok(text.includes("هي مادة جديدة"), text);
  });

  await check("a failed tool is reported to the model, not thrown", async () => {
    scriptModel([
      {
        content: [
          toolUse("t1", "create_knowledge_gap", {
            subjectId: "someone_elses_subject",
            title: "X",
            difficulty: "MEDIUM",
            source: "LECTURE",
          }),
        ],
        stop_reason: "tool_use",
      },
      { content: [toolUse("t2", "finish", { summary: "Could not file that." })], stop_reason: "tool_use" },
    ]);

    const result = await withStubbedTools((call) => {
      if (call.name === "create_knowledge_gap") throw new Error("Not found: Subject");
      return respondNormally(call);
    }).run();

    // The run survived, and — the part that matters — nothing was logged as
    // done. A rejected write must never produce an entry the student can see.
    assert.equal(result.status, "NOTHING_TO_DO");
    assert.equal(result.actions.length, 0);
  });

  await check("the write budget stops a runaway agent", async () => {
    // Fifteen writing turns, one write each; the budget is twelve.
    const turns: Turn[] = Array.from({ length: 15 }, (_, i) => ({
      content: [
        toolUse(`t${i}`, "create_knowledge_gap", {
          subjectId: "subj_pharm",
          title: `Gap ${i}`,
          description: null,
          difficulty: "MEDIUM",
          source: "LECTURE",
        }),
      ],
      stop_reason: "tool_use",
    }));
    scriptModel(turns);

    const result = await withStubbedTools(respondNormally).run();

    // The step limit bites first (8 steps), which is the point: two
    // independent ceilings, and whichever is reached first ends the run.
    assert.equal(result.status, "PARTIAL");
    assert.ok(result.actions.length <= 12, `${result.actions.length} writes got through`);
  });

  await check("a run cut short still reports what it wrote", async () => {
    const turns: Turn[] = Array.from({ length: 9 }, (_, i) => ({
      content: [
        toolUse(`t${i}`, "create_task", {
          title: `Task ${i}`,
          deadline: "2026-10-01",
          type: "ASSIGNMENT",
          subjectId: null,
          notes: null,
          estimatedMinutes: null,
        }),
      ],
      stop_reason: "tool_use",
    }));
    scriptModel(turns);

    const result = await withStubbedTools(respondNormally).run();

    assert.equal(result.status, "PARTIAL");
    assert.ok(result.actions.length > 0, "writes that landed must still be reported");
    assert.ok(result.status === "PARTIAL" && result.reason.length > 0);
  });

  await check("stopping without finishing still reports the writes", async () => {
    scriptModel([
      {
        content: [
          toolUse("t1", "create_task", {
            title: "Essay",
            deadline: "2026-10-01",
            type: "ASSIGNMENT",
            subjectId: null,
            notes: null,
            estimatedMinutes: null,
          }),
        ],
        stop_reason: "tool_use",
      },
      { content: [{ type: "text", text: "All set." }], stop_reason: "end_turn" },
    ]);

    const result = await withStubbedTools(respondNormally).run();

    assert.equal(result.status, "DONE");
    assert.equal(result.actions.length, 1);
  });

  await check("a model that writes nothing is not reported as success", async () => {
    scriptModel([{ content: [{ type: "text", text: "I could not read this." }], stop_reason: "end_turn" }]);

    const result = await withStubbedTools(respondNormally).run();

    assert.equal(result.status, "NOTHING_TO_DO");
    assert.equal(result.actions.length, 0);
  });

  await check("a refusal is not reported as success", async () => {
    scriptModel([{ content: [], stop_reason: "refusal" }]);
    const result = await withStubbedTools(respondNormally).run();
    assert.equal(result.status, "FAILED");
  });

  await check("running out of room is not reported as success", async () => {
    scriptModel([{ content: [{ type: "text", text: "partial" }], stop_reason: "max_tokens" }]);
    const result = await withStubbedTools(respondNormally).run();
    assert.equal(result.status, "FAILED");
  });

  await check("an empty balance is reported as an empty balance", async () => {
    scriptHttpError(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low" } });
    const result = await runAgent("test-key", CTX, INPUT);
    assert.equal(result.status, "FAILED");
    assert.ok(result.status === "FAILED" && result.message.includes("credit"), result.status === "FAILED" ? result.message : "");
  });

  await check("a rejected key is reported as a rejected key", async () => {
    scriptHttpError(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    const result = await runAgent("test-key", CTX, INPUT);
    assert.ok(result.status === "FAILED" && result.message.includes("rejected as invalid"), "wrong message");
  });

  await check("the image is sent before the instructions", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally, { ...INPUT, image: { mediaType: "image/png", base64: "AAAA" } }).run();

    const messages = sent[0].body.messages as { content: { type: string }[] }[];
    assert.equal(messages[0].content[0].type, "image");
    assert.equal(messages[0].content[1].type, "text");
  });

  await check("a PDF is sent whole, as a document, and not as its file name", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally, {
      ...INPUT,
      content: "Lecture 3.pdf",
      fileName: "Lecture 3.pdf",
      pdf: { base64: "JVBERi0=" },
    }).run();

    const messages = sent[0].body.messages as { content: { type: string; text?: string }[] }[];
    assert.equal(messages[0].content[0].type, "document", "the PDF must lead the message");
    assert.equal(messages[0].content[1].type, "text");

    // The regression this guards: extraction produced nothing in the deployed
    // build, so a PDF reached the model as its own file name dressed up as
    // content. If that line comes back, the model is reading a title again.
    const text = String(messages[0].content[1].text);
    assert.ok(!text.includes('"""'), "a PDF must not be sent as extracted content");
    assert.ok(text.includes("Read every page"), "the model must be told the PDF is the item");
  });

  await check("a PDF the provider refuses falls back to reading its text", async () => {
    // Encrypted, past the page ceiling, or written by something that produced
    // a file only its own reader accepts: the request fails before the model
    // reads a word, and the student did nothing wrong. One text-only retry is
    // the older, weaker route — worse than sending the file, and far better
    // than a sentence about the API.
    const plan = planPdfRetry({
      sentPdf: true,
      status: "FAILED",
      actionCount: 0,
      canReadFile: true,
      elapsedMs: 5_000,
      budgetMs: 95_000,
    });
    assert.ok(plan.retry && plan.remainingMs === 90_000, "the retry must inherit the time left");
  });

  await check("nothing is retried once rows have been written", async () => {
    // The failure that matters here is silent: a second run over an item that
    // already created a course and four tasks gives the student duplicates of
    // their own timetable, and nothing in the interface says why.
    assert.equal(
      planPdfRetry({
        sentPdf: true,
        status: "FAILED",
        actionCount: 2,
        canReadFile: true,
        elapsedMs: 5_000,
      }).retry,
      false
    );

    // And a run that succeeded, or asked a question, is not a failure to
    // recover from at all.
    for (const status of ["DONE", "ASKED", "PARTIAL", "NOTHING_TO_DO"] as const) {
      assert.equal(
        planPdfRetry({ sentPdf: true, status, actionCount: 0, canReadFile: true, elapsedMs: 0 }).retry,
        false,
        status
      );
    }
  });

  await check("a retry is never started with no time to finish it", async () => {
    // A second run cut off part way through writing is worse than the first
    // failure, which at least had a reason to show.
    assert.equal(
      planPdfRetry({
        sentPdf: true,
        status: "FAILED",
        actionCount: 0,
        canReadFile: true,
        elapsedMs: 90_000,
        budgetMs: 95_000,
      }).retry,
      false
    );

    // Nor when there is no PDF to fall back from, or no way to fetch the file.
    assert.equal(
      planPdfRetry({ sentPdf: false, status: "FAILED", actionCount: 0, canReadFile: true, elapsedMs: 0 }).retry,
      false
    );
    assert.equal(
      planPdfRetry({ sentPdf: true, status: "FAILED", actionCount: 0, canReadFile: false, elapsedMs: 0 }).retry,
      false
    );
  });

  await check("the model is given the student's courses up front", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally).run();

    // Front-loading the course list is what lets the ordinary drop skip a
    // lookup round trip and go straight from reading to writing.
    const system = String(sent[0].body.system);
    assert.ok(system.includes("subj_pharm"), "the course id must be in the system prompt");
    assert.ok(system.includes("Pharmacology"));
  });

  await check("what the student corrected reaches the next run", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally, {
      ...INPUT,
      corrections: "- 2026-09-01: they took back everything one drop wrote (tasks: 4).",
    }).run();

    const system = String(sent[0].body.system);
    assert.ok(system.includes("ALREADY CORRECTED"), "corrections must be in the instructions");
    assert.ok(system.includes("took back everything"));
    // And framed as a constraint on what to do next, not as an apology to make.
    assert.ok(system.includes("do less"), "a correction has to change the behaviour, not the tone");
  });

  await check("a student who has corrected nothing is told nothing", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally).run();

    // The section is absent rather than empty. A heading followed by "(none)"
    // spends the model's attention saying nothing, and this prompt is shared
    // with the rules that keep the agent safe.
    const system = String(sent[0].body.system);
    assert.ok(!system.includes("ALREADY CORRECTED"), "an empty history must not appear at all");
  });

  await check("thinking is on, and the budget is not lowballed", async () => {
    const sent = scriptModel([
      { content: [toolUse("t1", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    await withStubbedTools(respondNormally).run();

    const body = sent[0].body as { thinking?: { type: string }; max_tokens?: number; tools?: unknown[] };
    assert.equal(body.thinking?.type, "adaptive");
    assert.ok((body.max_tokens ?? 0) >= 8000, `max_tokens was ${body.max_tokens}`);
    assert.ok((body.tools?.length ?? 0) >= 10, "every tool must be published");
  });

  await check("the action log matches the shape the interface reads", async () => {
    scriptModel([
      {
        content: [
          toolUse("t1", "import_timetable", { entries: [] }),
          toolUse("t2", "create_task", {
            title: "Essay",
            deadline: "2026-10-01",
            type: "ASSIGNMENT",
            subjectId: null,
            notes: null,
            estimatedMinutes: null,
          }),
        ],
        stop_reason: "tool_use",
      },
      { content: [toolUse("t3", "finish", { summary: "Done." })], stop_reason: "tool_use" },
    ]);

    const result = await withStubbedTools(respondNormally).run();

    // The log is stored as JSON and read back through this schema. If the two
    // ever disagree, the interface silently shows an empty list for a run that
    // really did write things.
    const parsed = agentActionsSchema.safeParse(JSON.parse(JSON.stringify(result.actions)));
    assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  });

  // An armful of files is the ordinary way this gets used — a term's worth of
  // material goes in at once, not one item a day. The panel used to upload
  // every file and then organise `created[0]`, so nine of ten sat in the inbox
  // untouched while the confirmation said the drop was handled. These check the
  // loop still behaves per item when a batch runs them back to back, which is
  // what the panel now does.
  await check("each item in a batch is organised on its own", async () => {
    const results: string[] = [];

    for (const title of ["Essay", "Lab report", "Presentation"]) {
      scriptModel([
        {
          content: [
            toolUse("t1", "create_task", {
              title,
              deadline: "2026-10-01",
              type: "ASSIGNMENT",
              subjectId: null,
              notes: null,
              estimatedMinutes: null,
            }),
          ],
          stop_reason: "tool_use",
        },
        { content: [toolUse("t2", "finish", { summary: `Filed ${title}.` })], stop_reason: "tool_use" },
      ]);

      const result = await withStubbedTools(respondNormally).run();
      assert.equal(result.status, "DONE");
      assert.equal(result.actions.length, 1);
      results.push(result.actions[0].kind === "TASK" ? result.actions[0].title : "");
    }

    // Three items in, three distinct records out — no run reusing another's
    // conversation, and nothing silently dropped.
    assert.deepEqual(results, ["Essay", "Lab report", "Presentation"]);
  });

  await check("one failure in a batch does not sink the items around it", async () => {
    // Middle item fails outright; the ones on either side must still land,
    // because the panel merges their actions into a single report and a
    // student who is told nothing happened will drop the lot again.
    const collected: string[] = [];

    for (const [i, title] of ["First", "Broken", "Third"].entries()) {
      if (i === 1) {
        scriptHttpError(500, { type: "error", error: { type: "api_error", message: "upstream" } });
        const result = await runAgent("test-key", CTX, INPUT);
        assert.equal(result.status, "FAILED");
        assert.equal(result.actions.length, 0);
        continue;
      }

      scriptModel([
        {
          content: [
            toolUse("t1", "create_task", {
              title,
              deadline: "2026-10-01",
              type: "ASSIGNMENT",
              subjectId: null,
              notes: null,
              estimatedMinutes: null,
            }),
          ],
          stop_reason: "tool_use",
        },
        { content: [toolUse("t2", "finish", { summary: "ok" })], stop_reason: "tool_use" },
      ]);
      const result = await withStubbedTools(respondNormally).run();
      collected.push(...result.actions.map((a) => (a.kind === "TASK" ? a.title : "")));
    }

    assert.deepEqual(collected, ["First", "Third"]);
  });

  console.log("");
  if (failures.length > 0) {
    console.log(`${failures.length} failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("The loop behaves correctly across turns.");
}

main();
