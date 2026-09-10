/**
 * The decisions Drop Anything makes before, during and after a run.
 *
 * These are the rules whose failures are invisible: a photo that uploads fine
 * and is never looked at, a retry that duplicates a student's timetable, a
 * deadline in the past written without comment. Each one is a pure function
 * precisely so it can be checked here rather than discovered later in someone's
 * real records.
 *
 * Run: npx tsx scripts/verify-drop.ts
 */
import assert from "node:assert/strict";
import { normalizePlan, scaleFor } from "../src/lib/image-normalize";
import { describeFile, VISION_MIME_TYPES } from "../src/lib/capture-kinds";
import { reviewWrites, type ReviewInput } from "../src/lib/ai/agent/review";
import { extractUrls, isPrivateAddress, htmlToText, readLink } from "../src/lib/link-reader";
import { orderDrop, readingPriority } from "../src/lib/ai/agent/batch";

let failures = 0;

async function check(name: string, run: () => void | Promise<void>) {
  try {
    await run();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log("\nDrop Anything — the decisions that fail silently\n");

  await check("an iPhone photo is converted instead of stored unread", () => {
    // HEIC is the default on every iPhone. It was accepted, stored, and never
    // shown to the model, so a student photographing their timetable watched a
    // successful upload turn into nothing.
    assert.equal(normalizePlan({ name: "IMG_0421.HEIC", type: "image/heic", size: 2_100_000 }).normalize, true);
    // And with the empty type a phone often reports, which is why the name
    // decides and not the header.
    assert.equal(normalizePlan({ name: "IMG_0421.HEIC", type: "", size: 2_100_000 }).normalize, true);
  });

  await check("a photo too heavy to send is shrunk rather than dropped", () => {
    // Over the send limit the picture was left out of the request without a
    // word — the upload succeeded and the model was handed a file name.
    assert.equal(normalizePlan({ name: "photo.jpg", type: "image/jpeg", size: 6_000_000 }).normalize, true);
  });

  await check("an image already fine is left exactly as it is", () => {
    // Re-encoding a readable photo costs quality for nothing.
    assert.equal(normalizePlan({ name: "note.png", type: "image/png", size: 400_000 }).normalize, false);
  });

  await check("an animation is never flattened to its first frame", () => {
    // A canvas would silently turn a GIF into one still, which loses the only
    // thing that made it a GIF.
    assert.equal(normalizePlan({ name: "steps.gif", type: "image/gif", size: 9_000_000 }).normalize, false);
    assert.equal(normalizePlan({ name: "diagram.svg", type: "image/svg+xml", size: 20_000 }).normalize, false);
  });

  await check("nothing that is not an image is touched", () => {
    for (const file of [
      { name: "Syllabus.docx", type: "", size: 900_000 },
      { name: "Lecture.pdf", type: "application/pdf", size: 8_000_000 },
      { name: "memo.m4a", type: "audio/mp4", size: 5_000_000 },
    ]) {
      assert.equal(normalizePlan(file).normalize, false, file.name);
    }
  });

  await check("the converted file is one the model can actually read", () => {
    // The whole point: the name and type after conversion have to land inside
    // the set the request will send, or the work was wasted.
    const { level } = describeFile("IMG_0421.jpg", "image/jpeg");
    assert.equal(level, "VISION");
    assert.ok(VISION_MIME_TYPES.has("image/jpeg"));
  });

  await check("a big photo is shrunk, a small one is not enlarged", () => {
    // 12MP phone photo, portrait.
    assert.equal(scaleFor(3024, 4032, 2200), 2200 / 4032);
    // Already small: scaling up would invent detail that is not there.
    assert.equal(scaleFor(800, 600, 2200), 1);
  });

  // ---- Reading the rows back -------------------------------------------
  //
  // These are the mistakes that do damage: not a crash, which gets noticed and
  // retried, but a row that is plausible and wrong — a year misread off a photo,
  // a 24-hour timetable read as 12-hour — accepted silently and planned around
  // for a fortnight.

  const TODAY = new Date("2026-09-10T09:00:00Z");

  const base: ReviewInput = {
    today: TODAY,
    actions: [],
    tasks: [],
    classes: [],
    newCourses: [],
    existingCourses: [],
    newLectures: [],
    existingLectures: [],
    contentChars: 20_000,
  };

  await check("a deadline already past is pointed out", () => {
    const found = reviewWrites({
      ...base,
      tasks: [{ title: "Care plan", deadline: new Date("2026-08-01T00:00:00Z") }],
    });
    assert.deepEqual(found.map((f) => f.code), ["DEADLINE_IN_PAST"]);
  });

  await check("a deadline far too far out reads as a misread year", () => {
    const found = reviewWrites({
      ...base,
      tasks: [{ title: "Final exam", deadline: new Date("2028-01-01T00:00:00Z") }],
    });
    assert.deepEqual(found.map((f) => f.code), ["DEADLINE_FAR_OFF"]);
  });

  await check("an ordinary deadline is left alone", () => {
    // The check that matters most is the one that does not fire: a warning on
    // every normal row is a warning nobody reads.
    const found = reviewWrites({
      ...base,
      tasks: [
        { title: "Essay", deadline: new Date("2026-09-25T00:00:00Z") },
        { title: "Exam", deadline: new Date("2026-12-20T00:00:00Z") },
      ],
    });
    assert.deepEqual(found, []);
  });

  await check("a class in the middle of the night is pointed out", () => {
    // How a 24-hour timetable read as 12-hour shows up: 15:00 becomes 03:00.
    const threeAm = new Date(2026, 8, 14, 3, 0);
    const found = reviewWrites({ ...base, classes: [{ title: "Pharmacology", startsAt: threeAm }] });
    assert.deepEqual(found.map((f) => f.code), ["CLASS_AT_ODD_HOUR"]);
    assert.equal(found[0].detail.time, "03:00");
  });

  await check("a normal timetable raises nothing", () => {
    const found = reviewWrites({
      ...base,
      classes: [
        { title: "Anatomy", startsAt: new Date(2026, 8, 14, 8, 0) },
        { title: "Clinical", startsAt: new Date(2026, 8, 15, 7, 0) },
        { title: "Evening seminar", startsAt: new Date(2026, 8, 16, 19, 30) },
      ],
    });
    assert.deepEqual(found, []);
  });

  await check("a course that is the student's course under another spelling", () => {
    for (const [created, existing] of [
      ["anatomy", "Anatomy"],
      ["NURC 410", "nurc-410"],
      ["Anatomy and Physiology", "Anatomy & Physiology"],
      ["تشريح", "تشريح"],
    ]) {
      const found = reviewWrites({
        ...base,
        newCourses: [{ id: "new", name: created }],
        existingCourses: [{ id: "old", name: existing }],
      });
      assert.deepEqual(found.map((f) => f.code), ["COURSE_LOOKS_DUPLICATE"], `${created} vs ${existing}`);
    }
  });

  await check("two genuinely different courses are not called duplicates", () => {
    const found = reviewWrites({
      ...base,
      newCourses: [{ id: "new", name: "Microbiology" }],
      existingCourses: [{ id: "old", name: "Anatomy" }],
    });
    assert.deepEqual(found, []);
  });

  await check("a lecture number already taken in that course", () => {
    // Numbering a new deck 1 when the student has 1 to 6 puts it at the start
    // of their course, which is where it will stay unnoticed.
    const found = reviewWrites({
      ...base,
      newLectures: [{ id: "l_new", title: "Cardiac drugs", lectureNumber: 1, subjectId: "s1" }],
      existingLectures: [{ id: "l_old", title: "Introduction", lectureNumber: 1, subjectId: "s1" }],
    });
    assert.deepEqual(found.map((f) => f.code), ["LECTURE_NUMBER_TAKEN"]);
  });

  await check("the same number in a different course is fine", () => {
    const found = reviewWrites({
      ...base,
      newLectures: [{ id: "l_new", title: "Cardiac drugs", lectureNumber: 1, subjectId: "s1" }],
      existingLectures: [{ id: "l_old", title: "Introduction", lectureNumber: 1, subjectId: "s2" }],
    });
    assert.deepEqual(found, []);
  });

  await check("cards outrunning the material are flagged", () => {
    // Forty cards from a two-page handout means answers came from somewhere
    // other than the handout.
    const found = reviewWrites({
      ...base,
      contentChars: 900,
      actions: [{ kind: "FLASHCARDS", count: 40, subjectName: "Pharmacology" }],
    });
    assert.deepEqual(found.map((f) => f.code), ["A_LOT_OF_FLASHCARDS"]);
  });

  await check("a reasonable set of cards from real material is not flagged", () => {
    const found = reviewWrites({
      ...base,
      contentChars: 18_000,
      actions: [{ kind: "FLASHCARDS", count: 25, subjectName: "Pharmacology" }],
    });
    assert.deepEqual(found, []);
    // And a handful of cards is never worth a warning, however short the source.
    assert.deepEqual(
      reviewWrites({
        ...base,
        contentChars: 200,
        actions: [{ kind: "FLASHCARDS", count: 4, subjectName: "Pharmacology" }],
      }),
      []
    );
  });

  await check("a clean drop produces no findings at all", () => {
    assert.deepEqual(reviewWrites(base), []);
  });

  // ---- Opening a pasted link -------------------------------------------
  //
  // Fetching a URL a user supplied is the one place the server can be talked
  // into making a request on someone else's behalf, so the boundary is tested
  // directly rather than reasoned about.

  await check("the server refuses to be pointed at private address space", () => {
    for (const address of [
      "127.0.0.1",        // itself
      "10.0.0.5",         // private
      "172.16.4.1",       // private
      "172.31.255.255",   // private, top of range
      "192.168.1.1",      // private
      "169.254.169.254",  // cloud metadata — the whole point of this check
      "100.64.0.1",       // carrier NAT
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1", // loopback wearing an IPv6 costume
      "not-an-ip",        // unparseable is refused, never allowed
    ]) {
      assert.equal(isPrivateAddress(address), true, address);
    }
  });

  await check("ordinary public addresses are allowed through", () => {
    for (const address of ["93.184.216.34", "8.8.8.8", "172.15.0.1", "172.32.0.1", "2606:2800:220:1::1"]) {
      assert.equal(isPrivateAddress(address), false, address);
    }
  });

  await check("only real web links are picked out of a note", async () => {
    // An explicit scheme is required. "email me at uni.edu" is a sentence about
    // something, not a request to go and read it, and fetching on that guess is
    // exactly the surprise a student should never get from typing a note.
    assert.deepEqual(extractUrls("see https://uni.edu/course/410 for the syllabus"), [
      "https://uni.edu/course/410",
    ]);
    assert.deepEqual(extractUrls("nothing here, ask at registrar.uni.edu please"), []);
    // Trailing punctuation belongs to the sentence.
    assert.deepEqual(extractUrls("read https://uni.edu/a."), ["https://uni.edu/a"]);
    // The same link twice is one fetch.
    assert.deepEqual(extractUrls("https://a.com/x and https://a.com/x"), ["https://a.com/x"]);

    // And the schemes that are not the web are refused at the fetch, not just
    // left unmatched.
    for (const url of ["file:///etc/passwd", "ftp://uni.edu/x", "gopher://uni.edu"]) {
      const result = await readLink(url, (() => {
        throw new Error("must never reach the network");
      }) as unknown as typeof fetch);
      assert.equal(result.ok, false, url);
      if (!result.ok) assert.equal(result.reason, "NOT_A_WEB_LINK");
    }
  });

  await check("a redirect into private space is caught, not followed", async () => {
    // The textbook version: a public URL that redirects to the metadata
    // service. Following redirects by hand is the only reason this is catchable
    // at all — fetch's own following never shows the final address.
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } });
    }) as unknown as typeof fetch;

    const result = await readLink("https://uni.edu/redirect", fakeFetch);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "PRIVATE_ADDRESS");
    assert.equal(calls, 1, "the second hop must never be requested");
  });

  await check("a page's prose comes back, its scripts do not", () => {
    const { title, text } = htmlToText(
      `<html><head><title>NURC 410 &amp; Clinical</title>
       <style>.x{color:red}</style></head>
       <body><script>var secret = "do not read me";</script>
       <h1>Week 3</h1><p>Midterm: 12 November 2026</p>
       <p>Room B-204</p></body></html>`
    );
    assert.equal(title, "NURC 410 & Clinical");
    assert.ok(!text.includes("secret"), "script contents must not survive");
    assert.ok(!text.includes("color:red"), "stylesheet contents must not survive");
    assert.ok(text.includes("Midterm: 12 November 2026"));
    // Paragraph boundaries survive, so a table of dates does not become one
    // unreadable line.
    assert.ok(text.includes("\n"), `expected line breaks, got: ${text}`);
  });

  await check("a page that is not text is reported, not guessed at", async () => {
    const fakeFetch = (async () =>
      new Response("%PDF-1.7", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      })) as unknown as typeof fetch;

    const result = await readLink("https://uni.edu/syllabus.pdf", fakeFetch);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "NOT_READABLE");
  });

  await check("a real page is read and handed over", async () => {
    const fakeFetch = (async () =>
      new Response("<html><title>Anatomy 210</title><body><p>Lecture 4 is on Sunday at 08:00 in Hall C.</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })) as unknown as typeof fetch;

    const result = await readLink("https://uni.edu/anatomy", fakeFetch);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.title, "Anatomy 210");
      assert.ok(result.text.includes("Sunday at 08:00"));
    }
  });

  // ---- An armful read as one delivery -----------------------------------

  await check("the document that explains the course is read first", () => {
    // Read tenth, a syllabus arrives after nine lectures have already been
    // filed by guesswork. This is the whole reason the order matters.
    const order = orderDrop([
      { name: "Lecture 3.pdf" },
      { name: "Lecture 1.pdf" },
      { name: "Syllabus (NURC 410).docx" },
      { name: "IMG_0421.jpg" },
      { name: "Timetable.xlsx" },
    ]).map((f) => f.name);

    assert.equal(order[0], "Syllabus (NURC 410).docx", `got ${order.join(", ")}`);
    assert.equal(order[1], "Timetable.xlsx");
    assert.equal(order[order.length - 1], "IMG_0421.jpg", "a photograph is of one thing, not the course");
  });

  await check("Arabic names for the same documents are recognised too", () => {
    for (const name of ["جدول المحاضرات.pdf", "خطة المقرر.docx", "توصيف المقرر.pdf"]) {
      assert.equal(readingPriority(name), 0, name);
    }
  });

  await check("a folder of numbered lectures keeps its own sequence", () => {
    // Stable within a band, because the order the student picked them in is
    // exactly the information the lecture numbering needs.
    const order = orderDrop([
      { name: "Lecture 1.pdf" },
      { name: "Lecture 2.pdf" },
      { name: "Lecture 3.pdf" },
    ]).map((f) => f.name);
    assert.deepEqual(order, ["Lecture 1.pdf", "Lecture 2.pdf", "Lecture 3.pdf"]);
  });

  await check("ordering never loses or duplicates a file", () => {
    // The one way a reordering could actually do damage.
    const files = Array.from({ length: 12 }, (_, i) => ({ name: `file-${i}.pdf` }));
    files.push({ name: "syllabus.docx" }, { name: "photo.heic" });
    const order = orderDrop(files);
    assert.equal(order.length, files.length);
    assert.deepEqual(
      new Set(order.map((f) => f.name)),
      new Set(files.map((f) => f.name))
    );
  });

  console.log("");
  if (failures > 0) {
    console.log(`${failures} failed.\n`);
    process.exit(1);
  }
  console.log("The drop path's silent decisions hold.\n");
}

main();
