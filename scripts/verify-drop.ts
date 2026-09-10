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

  console.log("");
  if (failures > 0) {
    console.log(`${failures} failed.\n`);
    process.exit(1);
  }
  console.log("The drop path's silent decisions hold.\n");
}

main();
