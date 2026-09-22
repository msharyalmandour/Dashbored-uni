/**
 * Proves the Office reader on real archives.
 *
 * The fixtures beside this file are written by a ZIP implementation that is
 * not this one, which is the whole point: a reader tested only against
 * archives its own code produced proves that two mistakes agree, not that the
 * file a student uploads can be read. They are deliberately awkward in the
 * ways real Office files are — slides numbered past ten and stored out of
 * order, a deflated part next to a stored one, an embedded PNG that is not
 * XML, escaped ampersands, and text split across runs mid-sentence.
 *
 * Run: npx tsx scripts/verify-ooxml.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ooxmlProcessor } from "../src/lib/processors/ooxml-processor";
import { getProcessorFor } from "../src/lib/processors";
import { describeFile } from "../src/lib/capture-kinds";

let failures = 0;

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err instanceof Error ? err.message : String(err)}`);
  }
}

function read(fixture: string) {
  return readFileSync(join(import.meta.dirname, "fixtures", fixture));
}

async function extract(fixture: string, mimeType = "") {
  return ooxmlProcessor.process({
    documentId: "doc_test",
    mimeType,
    originalName: fixture,
    fileBytes: read(fixture),
  });
}

async function main() {
  console.log("\nOffice files — what a student's syllabus and slides actually say\n");

  await check("a Word document reads out as its prose", async () => {
    const result = await extract("sample.docx");
    const text = result.extractedText ?? "";
    assert.ok(text.includes("Syllabus (NURC 410) & Clinical"), `escaped text lost: ${text}`);
    assert.ok(text.includes("12 November 2026"), "the date must survive");
    // Two runs, one sentence — Word splits text mid-line constantly, and a
    // reader that inserts a break between runs turns every line into confetti.
    assert.ok(text.includes("Room B-204"), `runs were not joined: ${text}`);
  });

  await check("paragraphs stay on separate lines", async () => {
    const text = (await extract("sample.docx")).extractedText ?? "";
    // The reason this matters is a timetable: rows that collapse into one line
    // cannot be told apart, and Sunday's class becomes Monday's.
    assert.equal(text.split("\n").filter(Boolean).length, 3, text);
  });

  await check("every slide is read, in the order they are presented", async () => {
    const result = await extract("sample.pptx");
    assert.equal(result.pageCount, 3);
    assert.deepEqual(
      (result.pages ?? []).map((p) => p.text.split("\n")[0]),
      ["Slide 1 heading", "Slide 2 heading", "Slide 10 heading"],
      "slide 10 must sort after slide 2, not beside slide 1"
    );
  });

  await check("speaker notes are read as well as the slide", async () => {
    const result = await extract("sample.pptx");
    // Often where the actual explanation is, while the slide is five bullets.
    assert.ok((result.pages ?? [])[1].text.includes("Remember the dosage rule"));
  });

  await check("an embedded image does not derail the deck", async () => {
    // The PNG is stored, not deflated, and is not XML. Inflating every entry
    // to look for text would fail on it — and cost a deck's worth of photos.
    const text = (await extract("sample.pptx")).extractedText ?? "";
    assert.ok(text.includes("Slide 1 heading"));
  });

  await check("a spreadsheet keeps its rows and columns", async () => {
    const text = (await extract("sample.xlsx")).extractedText ?? "";
    assert.equal(text, "Sunday\tAnatomy\t8\nMonday\tPharmacology & Lab\t10", text);
  });

  await check("a file that is not an Office file fails with something sayable", async () => {
    await assert.rejects(
      () =>
        ooxmlProcessor.process({
          documentId: "doc_test",
          mimeType: "",
          originalName: "notes.docx",
          fileBytes: Buffer.from("this is not a zip at all"),
        }),
      /not a readable Office document/
    );
  });

  await check("the pipeline routes these files here even with no mime type", async () => {
    // Browsers report `type` as empty for Office files often enough that
    // matching on the header alone is exactly how a real .docx went unread.
    assert.equal(getProcessorFor("", "Syllabus.docx")?.id, "ooxml-processor");
    assert.equal(getProcessorFor("application/octet-stream", "Lecture 3.pptx")?.id, "ooxml-processor");
    assert.equal(
      getProcessorFor(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Syllabus.docx"
      )?.id,
      "ooxml-processor"
    );
  });

  await check("the interface no longer promises less than it delivers", async () => {
    // The capability shown to the student and the processor that runs are two
    // statements about the same file, and they have drifted apart before.
    for (const name of ["Syllabus.docx", "Lecture.pptx", "Timetable.xlsx"]) {
      assert.equal(describeFile(name, "").level, "TEXT", name);
      assert.ok(getProcessorFor("", name), `${name} has no processor`);
    }
    // And the honesty runs the other way too: .doc is a different format
    // entirely, with no reader here.
    assert.equal(describeFile("Old syllabus.doc", "").level, "STORED");
    assert.equal(getProcessorFor("", "Old syllabus.doc"), null);
  });

  if (failures > 0) {
    console.log(`\n${failures} failed.\n`);
    process.exit(1);
  }
  console.log("\nWord, PowerPoint and Excel files are read.\n");
}

main();
