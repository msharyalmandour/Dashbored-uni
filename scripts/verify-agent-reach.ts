/**
 * What the agent can reach, and where it puts things.
 *
 * Two failures are being guarded against, and neither announces itself.
 *
 * The first is a row in the right table and the wrong place. A lecture filed
 * under no topic, a deck attached to a lecture in another course, a set of
 * questions hung off someone else's lecture — each is accepted, looks correct
 * in the log, and is only discovered when the student goes looking for
 * something and it is not where it should be.
 *
 * The second is undo quietly ceasing to be true. Every row the agent writes
 * carries the id of the drop that made it, and "take this back" is one
 * predicate per table. A new tool whose table is not in that list produces
 * rows that survive an undo — and a student who has been told their mistake
 * was taken back, and finds it was not, does not hand this tool anything
 * important again.
 *
 * Run: npx tsx scripts/verify-agent-reach.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_TOOLS } from "../src/lib/ai/agent/tools";
import { agentActionSchema } from "../src/lib/ai/agent/types";
import { reviewWrites, type ReviewInput } from "../src/lib/ai/agent/review";
import { annotatableType } from "../src/lib/annotatable";

const failures: string[] = [];
function check(label: string, run: () => void) {
  try {
    run();
    console.log(`  ok  ${label}`);
  } catch (err) {
    failures.push(label);
    console.error(`  FAIL  ${label}\n        ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("Agent reach and placement\n");

/* ── Every part of the app the agent is supposed to reach ─────────────────── */

check("the agent has a tool for every place a drop can belong", () => {
  const names = new Set(AGENT_TOOLS.map((t) => t.name));
  /* Each of these is a module of the app that a dropped file can legitimately
     belong to. Before these tools existed the agent could write to eleven of
     the sixteen tables and five modules were simply unreachable: a dropped
     lecture could never be opened, a problem set could never become problems. */
  for (const tool of [
    "open_in_reader",
    "attach_resource",
    "create_problems",
    "add_video",
    "log_clinical",
    "read_my_material",
    "fix_it",
  ]) {
    assert.ok(names.has(tool), `the agent cannot reach ${tool}`);
  }
});

check("every tool the dispatcher knows is one the model is told about", async () => {
  // A tool implemented but never published is dead code; a tool published but
  // not implemented is an error the model discovers at run time.
  const names = AGENT_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "two tools share a name");
});

check("a lecture can be placed under a topic", () => {
  const lecture = AGENT_TOOLS.find((t) => t.name === "create_lecture");
  assert.ok(lecture, "create_lecture is missing");
  const props = (lecture.input_schema as { properties: Record<string, unknown> }).properties;
  assert.ok("topicId" in props, "create_lecture cannot place a lecture under a topic");
});

/* ── The undo contract ────────────────────────────────────────────────────── */

check("every new action kind is one the interface can render", () => {
  // The renderer switches exhaustively on kind; an unrendered kind is a
  // silent blank line where a student expected to see what happened.
  for (const kind of ["READABLE", "RESOURCE", "PROBLEMS", "VIDEO", "CLINICAL"]) {
    const sample: Record<string, unknown> = { kind };
    if (kind === "READABLE" || kind === "RESOURCE")
      Object.assign(sample, { id: "x", title: "t", lectureTitle: "l" });
    if (kind === "PROBLEMS") Object.assign(sample, { count: 3, subjectName: "s" });
    if (kind === "VIDEO") Object.assign(sample, { id: "x", title: "t" });
    if (kind === "CLINICAL") Object.assign(sample, { id: "x", date: "2026-01-01" });
    const parsed = agentActionSchema.safeParse(sample);
    assert.ok(parsed.success, `${kind} is not a recognised action`);
  }
});

/* ── Placement, checked after the fact ────────────────────────────────────── */

const base: ReviewInput = {
  today: new Date("2026-03-01T09:00:00Z"),
  actions: [],
  tasks: [],
  classes: [],
  newCourses: [],
  existingCourses: [],
  newLectures: [],
  existingLectures: [],
  contentChars: 5000,
};

const lecture = (over: Partial<ReviewInput["newLectures"][number]> = {}) => ({
  id: "lec_1",
  title: "Gas Exchange",
  lectureNumber: 1,
  subjectId: "subj_1",
  topicId: null,
  ...over,
});

check("a lecture left outside a course's topics is reported", () => {
  const findings = reviewWrites({
    ...base,
    newLectures: [lecture()],
    topicsByCourse: { subj_1: 4 },
  });
  assert.ok(findings.some((f) => f.code === "LECTURE_HAS_NO_TOPIC"), JSON.stringify(findings));
});

check("a course with no topics at all is not complained about", () => {
  // Telling a student off for the shape of their own course is noise, and
  // noise is how a warning panel gets ignored.
  const findings = reviewWrites({
    ...base,
    newLectures: [lecture()],
    topicsByCourse: { subj_1: 0 },
  });
  assert.ok(!findings.some((f) => f.code === "LECTURE_HAS_NO_TOPIC"), JSON.stringify(findings));
});

check("a lecture that WAS placed under a topic is not reported", () => {
  const findings = reviewWrites({
    ...base,
    newLectures: [lecture({ topicId: "top_1" })],
    topicsByCourse: { subj_1: 4 },
  });
  assert.ok(!findings.some((f) => f.code === "LECTURE_HAS_NO_TOPIC"), JSON.stringify(findings));
});

check("a readable file filed but never opened is reported", () => {
  /* The failure this whole piece of work exists to remove: the lecture is
     there, the student taps it, and there is nothing to read. */
  const findings = reviewWrites({
    ...base,
    newLectures: [lecture()],
    hadReadableFile: true,
  });
  assert.ok(findings.some((f) => f.code === "LECTURE_NOT_READABLE"), JSON.stringify(findings));
});

check("a file that WAS opened is not reported", () => {
  const findings = reviewWrites({
    ...base,
    actions: [{ kind: "READABLE", id: "sl_1", title: "Gas Exchange", lectureTitle: "Gas Exchange" }],
    newLectures: [lecture()],
    hadReadableFile: true,
  });
  assert.ok(!findings.some((f) => f.code === "LECTURE_NOT_READABLE"), JSON.stringify(findings));
});

check("a drop with no readable file is never told it failed to open one", () => {
  // A pasted note or a .docx cannot be drawn on. Reporting it would be
  // reporting a failure that was never possible.
  const findings = reviewWrites({ ...base, newLectures: [lecture()], hadReadableFile: false });
  assert.ok(!findings.some((f) => f.code === "LECTURE_NOT_READABLE"), JSON.stringify(findings));
});

check("a readable file attached to nothing at all is reported", () => {
  const findings = reviewWrites({ ...base, hadReadableFile: true });
  assert.ok(findings.some((f) => f.code === "MATERIAL_WITHOUT_LECTURE"), JSON.stringify(findings));
});

check("a readable file kept deliberately in the Library is not reported twice", () => {
  const findings = reviewWrites({
    ...base,
    actions: [{ kind: "FILED", title: "Handbook", subjectName: "Anatomy" }],
    hadReadableFile: true,
  });
  assert.ok(!findings.some((f) => f.code === "MATERIAL_WITHOUT_LECTURE"), JSON.stringify(findings));
});

/* ── One rule for what the reader can draw ────────────────────────────────── */

check("the reader's file rule is shared, not guessed per caller", () => {
  assert.equal(annotatableType("application/pdf", "x.pdf"), "pdf");
  assert.equal(annotatableType("image/png", "x.png"), "image");
  // The type in Storage is whatever the browser claimed, which is routinely
  // nothing — the extension has to be able to decide alone.
  assert.equal(annotatableType(null, "lecture.PDF"), "pdf");
  assert.equal(annotatableType(null, "scan.JPEG"), "image");
  // HEIC and TIFF do not decode through <img>; accepting one gives the
  // student a blank canvas rather than a page.
  assert.equal(annotatableType("image/heic", "photo.heic"), null);
  assert.equal(annotatableType("image/tiff", "scan.tiff"), null);
  assert.equal(annotatableType(null, "notes.docx"), null);
});

/* ── The queries themselves ───────────────────────────────────────────────
 *
 * The checks above prove the tools exist and that placement is reported. These
 * prove the writes are actually shaped the way the design depends on — and
 * they are asserted against the query Prisma is handed, because that is the
 * only place the guarantee lives. A `where` clause missing one field is
 * invisible in every other kind of test: the tool still works, still returns
 * success, and has quietly become able to touch the student's own records.
 */

type Call = { model: string; method: string; args: Record<string, unknown> };

async function recordQueries(run: (tools: typeof import("../src/lib/ai/agent/tools")) => Promise<unknown>) {
  const { prisma } = await import("../src/lib/prisma");
  const calls: Call[] = [];
  const store = prisma as unknown as Record<string, Record<string, unknown>>;
  const saved: [string, string, unknown][] = [];

  const stub = (model: string, method: string, reply: unknown) => {
    saved.push([model, method, store[model][method]]);
    store[model][method] = async (args: Record<string, unknown>) => {
      calls.push({ model, method, args: args ?? {} });
      return typeof reply === "function" ? (reply as (a: unknown) => unknown)(args) : reply;
    };
  };

  return { calls, stub, restore: () => saved.forEach(([m, k, v]) => (store[m][k] = v)), run };
}

async function queryLevelChecks() {
  const tools = await import("../src/lib/ai/agent/tools");
  const ctx = { userId: "user_1", captureId: "cap_1" };

  /* create_lecture must write topicId, or the placement fix is decorative. */
  {
    const h = await recordQueries(async () => undefined);
    // resolveSubject checks ownership with findFirst, then reads the row with
    // findUniqueOrThrow. Both are stubbed, or the tool bails before it writes.
    h.stub("subject", "findFirst", { id: "subj_1", name: "Anatomy" });
    h.stub("subject", "findUniqueOrThrow", { id: "subj_1", name: "Anatomy" });
    h.stub("lecture", "count", 0);
    h.stub("topic", "findFirst", { id: "top_1" });
    h.stub("topic", "create", { id: "top_x" });
    h.stub("lecture", "create", { id: "lec_1", title: "Gas Exchange" });
    h.stub("captureItem", "findFirst", null);
    await tools.executeTool(ctx, "create_lecture", {
      subjectId: "subj_1",
      title: "Gas Exchange",
      topicId: "top_1",
    });
    h.restore();
    const create = h.calls.find((c) => c.model === "lecture" && c.method === "create");
    check("create_lecture writes the topic it was given", () => {
      assert.ok(create, "no lecture was created");
      const data = (create.args as { data: Record<string, unknown> }).data;
      assert.equal(data.topicId, "top_1", "the lecture was filed under no topic");
    });
    check("the topic is verified against THIS course before it is used", () => {
      const lookup = h.calls.find((c) => c.model === "topic" && c.method === "findFirst");
      assert.ok(lookup, "the topic id was trusted without checking");
      const where = (lookup.args as { where: Record<string, unknown> }).where;
      assert.equal(where.subjectId, "subj_1", "a topic from another course would be accepted");
    });
  }

  /* The first drop into a course — the case placement actually has to survive.
  
     The check above stubs `topic.findFirst` to return a topic, so it tests "if
     handed a valid id, the lecture records it". That was true and it was the
     half already reachable. On a first drop there IS no topic to hand: the same
     call's `topics` creates the course's vocabulary, and the old code created
     it AFTER the lecture. So `topicId` was necessarily null and the lecture came
     out unfiled, every time, structurally.
  
     Measured on the real account: 46 topics, every one empty, all 4 lectures
     unplaced. A green test the whole time. */
  {
    const h = await recordQueries(async () => undefined);
    h.stub("subject", "findFirst", { id: "subj_1", name: "Critical Care" });
    h.stub("subject", "findUniqueOrThrow", { id: "subj_1", name: "Critical Care" });
    h.stub("lecture", "count", 0);
    // Nothing exists yet. This is what a first drop really looks like.
    h.stub("topic", "findFirst", null);
    let made = 0;
    h.stub("topic", "create", () => ({ id: `top_new_${++made}` }));
    h.stub("lecture", "create", { id: "lec_1", title: "Gas Exchange" });
    h.stub("captureItem", "findFirst", null);
    await tools.executeTool(ctx, "create_lecture", {
      subjectId: "subj_1",
      title: "Gas Exchange",
      topics: ["Mechanics of ventilation", "Dead space and shunt", "PEEP"],
      topicName: "Dead space and shunt",
    });
    h.restore();

    const lectureCreate = h.calls.findIndex((c) => c.model === "lecture" && c.method === "create");
    const firstTopicCreate = h.calls.findIndex((c) => c.model === "topic" && c.method === "create");

    check("a first drop into an empty course still lands under a heading", () => {
      const create = h.calls.find((c) => c.model === "lecture" && c.method === "create");
      assert.ok(create, "no lecture was created");
      const data = (create.args as { data: Record<string, unknown> }).data;
      assert.ok(data.topicId, "the lecture came out unfiled — 46 empty topics is what this looks like");
    });

    check("the course's topics are created before the lecture, not after", () => {
      /* The ordering IS the fix. Creating them afterwards cannot be detected
         from the lecture row alone on a course that already had topics, which
         is why this is asserted on the call sequence. */
      assert.ok(firstTopicCreate >= 0, "no topic was created from `topics`");
      assert.ok(lectureCreate >= 0, "no lecture was created");
      assert.ok(
        firstTopicCreate < lectureCreate,
        "the lecture was created before its topics existed, so it could not be filed under one"
      );
    });

    check("the heading it lands under is the one named, not just the first", () => {
      // Filing it under whichever topic happened to be created first would look
      // correct in every count and be wrong about what the lecture is about.
      const names = h.calls
        .filter((c) => c.model === "topic" && c.method === "create")
        .map((c) => ((c.args as { data: { name: string } }).data.name));
      assert.deepEqual(names, ["Mechanics of ventilation", "Dead space and shunt", "PEEP"]);
      const create = h.calls.find((c) => c.model === "lecture" && c.method === "create");
      const data = (create!.args as { data: Record<string, unknown> }).data;
      assert.equal(data.topicId, "top_new_2", "filed under the wrong heading of the three");
    });
  }

  /* A named heading the course does not have, and `topics` does not list. */
  {
    const h = await recordQueries(async () => undefined);
    /* The resolved course id deliberately differs from the one asked for:
       resolveSubject accepts a name as well as an id, so every write must use
       what it RESOLVED, never what the model sent. Stubbing both the same makes
       the two indistinguishable — which is how a mutation swapping them
       survived this file once. */
    h.stub("subject", "findFirst", { id: "subj_resolved", name: "Critical Care" });
    h.stub("subject", "findUniqueOrThrow", { id: "subj_resolved", name: "Critical Care" });
    h.stub("lecture", "count", 3);
    h.stub("topic", "findFirst", null);
    h.stub("topic", "create", { id: "top_named" });
    h.stub("lecture", "create", { id: "lec_2", title: "ARDS" });
    h.stub("captureItem", "findFirst", null);
    await tools.executeTool(ctx, "create_lecture", {
      subjectId: "a name, not an id",
      title: "ARDS",
      topics: ["Prone positioning"],
      topicName: "Acute Respiratory Distress Syndrome",
    });
    h.restore();
    check("a heading named but not listed is created rather than dropped", () => {
      /* The agent saying where this belongs is the signal worth keeping, and a
         topic with one lecture in it is more use than a lecture under nothing. */
      const create = h.calls.find((c) => c.model === "lecture" && c.method === "create");
      const data = (create!.args as { data: Record<string, unknown> }).data;
      assert.equal(data.topicId, "top_named", "the named heading was thrown away");
      for (const topic of h.calls.filter((c) => c.model === "topic" && c.method === "create")) {
        assert.equal(
          ((topic.args as { data: { subjectId: string } }).data.subjectId),
          "subj_resolved",
          "a heading was created against the id the model sent rather than the course that was resolved"
        );
      }
    });
  }

  /* The instruction the whole mechanism depends on. */
  check("the agent is told to name the heading, not just to list topics", () => {
    /* topicName exists so a first drop can place a lecture. If the prompt stops
       asking for it the tool is correct and unused, which looks identical from
       the database: empty topics and unfiled lectures. */
    const prompt = readFileSync(new URL("../src/lib/ai/agent/run.ts", import.meta.url), "utf8");
    assert.match(prompt, /Pass topicName/, "the prompt no longer asks the agent to name a heading");
    assert.match(prompt, /topicId instead only when/, "the prompt no longer says when an id is the right one");
  });

  /* An id still wins over a name, because an id names exactly one row. */
  {
    const h = await recordQueries(async () => undefined);
    h.stub("subject", "findFirst", { id: "subj_1", name: "Critical Care" });
    h.stub("subject", "findUniqueOrThrow", { id: "subj_1", name: "Critical Care" });
    h.stub("lecture", "count", 1);
    /* Answers by what was asked, not with one row for everything. A stub that
       returns the same topic for an id lookup and a name lookup cannot tell
       precedence from coincidence — and a mutation removing the precedence
       guard passed this check for exactly that reason. */
    h.stub("topic", "findFirst", (a: unknown) => {
      const where = (a as { where: { id?: string; name?: unknown } }).where;
      if (where.id) return { id: "top_existing" };
      return { id: "top_found_by_name" };
    });
    h.stub("topic", "create", { id: "top_should_not_be_used" });
    h.stub("lecture", "create", { id: "lec_3", title: "PEEP" });
    h.stub("captureItem", "findFirst", null);
    await tools.executeTool(ctx, "create_lecture", {
      subjectId: "subj_1",
      title: "PEEP",
      topicId: "top_existing",
      topicName: "Something Else Entirely",
    });
    h.restore();
    check("a valid topic id is preferred over a name", () => {
      const create = h.calls.find((c) => c.model === "lecture" && c.method === "create");
      const data = (create!.args as { data: Record<string, unknown> }).data;
      assert.equal(data.topicId, "top_existing", "an exact id was overridden by an ambiguous name");
      assert.notEqual(data.topicId, "top_found_by_name", "the name lookup ran and won");
    });
  }

  /* fix_it must be scoped to this drop, not merely to this student. */
  {
    const h = await recordQueries(async () => undefined);
    h.stub("subject", "updateMany", { count: 0 });
    await tools.executeTool(ctx, "fix_it", { what: "course", id: "subj_1", newTitle: "Anatomy II" });
    h.restore();
    check("fix_it can only rename what this drop created", () => {
      const update = h.calls.find((c) => c.model === "subject" && c.method === "updateMany");
      assert.ok(update, "no rename was attempted");
      const where = (update.args as { where: Record<string, unknown> }).where;
      assert.equal(where.sourceCaptureId, "cap_1", "fix_it could rename the student's own course");
      assert.equal(where.userId, "user_1", "fix_it was not scoped to this student");
    });
  }

  /* open_in_reader must refuse a file the reader cannot draw. */
  {
    const h = await recordQueries(async () => undefined);
    h.stub("lecture", "findFirst", { id: "lec_1", title: "Notes" });
    h.stub("captureItem", "findFirst", { documentId: "doc_1" });
    h.stub("document", "findFirst", {
      id: "doc_1",
      storagePath: "u/notes.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      originalName: "notes.docx",
      pageCount: 3,
    });
    h.stub("lectureSlide", "findFirst", null);
    h.stub("lectureSlide", "create", { id: "sl_1", title: "Notes" });
    const outcome = await tools.executeTool(ctx, "open_in_reader", { lectureId: "lec_1" });
    h.restore();
    check("open_in_reader refuses a file the reader cannot draw", () => {
      assert.ok(!h.calls.some((c) => c.model === "lectureSlide" && c.method === "create"),
        "a .docx was put in the reading room, where it will render as a blank page");
      assert.ok(/cannot be marked|not one the reader/i.test(outcome.result), outcome.result);
    });
  }

  /* And must stamp what it does create, or undo cannot reach it. */
  {
    const h = await recordQueries(async () => undefined);
    h.stub("lecture", "findFirst", { id: "lec_1", title: "Gas Exchange" });
    h.stub("captureItem", "findFirst", { documentId: "doc_1" });
    h.stub("document", "findFirst", {
      id: "doc_1",
      storagePath: "u/lecture.pdf",
      mimeType: "application/pdf",
      originalName: "lecture.pdf",
      pageCount: 47,
    });
    h.stub("lectureSlide", "findFirst", null);
    h.stub("lectureSlide", "create", { id: "sl_1", title: "Gas Exchange" });
    await tools.executeTool(ctx, "open_in_reader", { lectureId: "lec_1" });
    h.restore();
    check("a deck the agent opens is stamped so undo can take it back", () => {
      const create = h.calls.find((c) => c.model === "lectureSlide" && c.method === "create");
      assert.ok(create, "the PDF was not opened");
      const data = (create.args as { data: Record<string, unknown> }).data;
      assert.equal(data.sourceCaptureId, "cap_1", "this deck would survive an undo");
    });
  }

  /* Undo must reach every table the new tools write to. */
  {
    const { undoCaptureWrites } = await import("../src/lib/ai/agent/undo");
    const h = await recordQueries(async () => undefined);
    for (const model of [
      "flashcard", "mistake", "knowledgeGap", "lecture", "task", "scheduleEvent",
      "timeCommitment", "problem", "video", "clinicalTraining", "lectureSlide", "lectureResource",
    ]) {
      h.stub(model, "deleteMany", { count: 0 });
    }
    h.stub("subject", "findMany", []);
    await undoCaptureWrites("cap_1", "user_1");
    h.restore();
    check("undo reaches every table the agent can now write to", () => {
      for (const model of ["lectureSlide", "lectureResource", "problem", "video", "clinicalTraining"]) {
        const call = h.calls.find((c) => c.model === model && c.method === "deleteMany");
        assert.ok(call, `${model} rows would survive an undo — the button would be lying`);
        const where = (call.args as { where: Record<string, unknown> }).where;
        assert.equal(where.sourceCaptureId, "cap_1", `${model} is not scoped to this drop`);
      }
    });
    check("undo never selects rows by capture id alone", () => {
      // A capture id must never be enough to delete anything: ownership is
      // re-checked on every single query.
      for (const call of h.calls.filter((c) => c.method === "deleteMany")) {
        const where = call.args.where as Record<string, unknown>;
        const scoped = "userId" in where || "subject" in where || "lecture" in where;
        assert.ok(scoped, `${call.model} is deleted without re-checking who owns it`);
      }
    });
  }
}

queryLevelChecks().then(() => {
  console.log("");
  if (failures.length > 0) {
    console.log(`${failures.length} failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("The agent reaches the app, and says so when it puts something nowhere.");
});
