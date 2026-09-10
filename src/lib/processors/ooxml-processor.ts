import { inflateRawSync } from "node:zlib";
import type { DocumentProcessor, ProcessorInput, ProcessorPage, ProcessorResult } from "./types";
import { extensionOf } from "@/lib/capture-kinds";

/**
 * Word, PowerPoint and Excel files, read for what they say.
 *
 * These were the last common academic formats that arrived and were simply
 * stored — a syllabus in .docx and a lecture deck in .pptx both came back
 * "unsupported mime type", which is a strange answer for a feature called
 * Drop Anything to give a student about the two files their course actually
 * hands them.
 *
 * There is no library here on purpose. An OOXML file is a ZIP of XML, and
 * both halves of that are in the standard library: `inflateRawSync` for the
 * entries, and a tag strip for the text. A parser that understood styles,
 * numbering and drawing layout would be a great deal more code to produce the
 * same prose, and prose is the entire requirement — what happens next is a
 * language model reading it, not a renderer drawing it.
 */

const OOXML_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const OOXML_EXTENSIONS = new Set(["docx", "pptx", "xlsx"]);

/** Matches the cap the analyser applies anyway — no point holding more. */
const MAX_CHARS = 200_000;

/**
 * The largest entry that will be decompressed.
 *
 * A ZIP can claim an entry expands to far more than the archive weighs, and
 * nothing in the header has to be true. This is what stops a 2MB upload from
 * asking for gigabytes of memory on a shared server.
 */
const MAX_ENTRY_BYTES = 60 * 1024 * 1024;

interface ZipEntry {
  name: string;
  read: () => Buffer;
}

/**
 * Reads a ZIP's central directory and returns each entry, decompressed lazily.
 *
 * Lazily because a .pptx holds every embedded image as its own entry, and
 * inflating a deck's photographs to look for text in the XML would be most of
 * the work for none of the answer.
 */
function readZip(bytes: Buffer): ZipEntry[] {
  // The end-of-central-directory record lives at the very end, after a comment
  // of up to 64KB, so it is found by scanning backwards for its signature.
  const maxBack = Math.min(bytes.length, 0xffff + 22);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= bytes.length - maxBack && i >= 0; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("This file is not a readable Office document.");

  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) throw new Error("This Office file is too large to read.");

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) break;

    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);

    entries.push({
      name,
      read() {
        if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error("This Office file is too large to read.");
        // The local header repeats the name and carries its own extra field,
        // which is usually a different length from the central one — so where
        // the data starts can only be computed from the local header itself.
        if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
          throw new Error("This Office file is damaged.");
        }
        const localNameLength = bytes.readUInt16LE(localOffset + 26);
        const localExtraLength = bytes.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localNameLength + localExtraLength;
        const end = start + compressedSize;
        if (end > bytes.length) throw new Error("This Office file is damaged.");

        const raw = bytes.subarray(start, end);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
        throw new Error("This Office file uses compression that cannot be read.");
      },
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    // Ampersand last, so an escaped entity in the source is not re-decoded.
    .replace(/&amp;/g, "&");
}

/**
 * Turns one OOXML part into readable text.
 *
 * The paragraph and break tags are converted to real line breaks *before* the
 * tags are stripped, because that structure is the only thing separating a
 * timetable's rows from one long unreadable line — and telling a Sunday class
 * from a Monday one is exactly what this is read for.
 */
function xmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<w:tab\b[^>]*\/?>/g, "\t")
      .replace(/<(w|a):br\b[^>]*\/?>/g, "\n")
      .replace(/<\/(w|a):p>/g, "\n")
      .replace(/<\/a:tr>/g, "\n")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every `<t>` in document order — how a spreadsheet's shared strings are held. */
function sharedStrings(xml: string): string[] {
  const items = xml.match(/<si\b[\s\S]*?<\/si>/g) ?? [];
  return items.map((item) => decodeEntities(item.replace(/<[^>]*>/g, "")));
}

/** The numeric suffix a slide or sheet is named by, so 10 sorts after 2. */
function numberIn(name: string): number {
  const match = name.match(/(\d+)\D*$/);
  return match ? Number(match[1]) : 0;
}

function readDocx(entries: ZipEntry[]): ProcessorResult {
  const main = entries.find((e) => e.name === "word/document.xml");
  if (!main) throw new Error("This Word file has no readable document part.");

  const text = xmlToText(main.read().toString("utf8"));
  return { extractedText: text || null, metadata: { format: "docx" } };
}

function readPptx(entries: ZipEntry[]): ProcessorResult {
  const slides = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => numberIn(a.name) - numberIn(b.name));
  if (slides.length === 0) throw new Error("This presentation has no readable slides.");

  // Speaker notes are read as well as the slide. A lecturer's notes are often
  // where the actual explanation lives, while the slide is five bullet points.
  const notes = new Map<number, string>();
  for (const entry of entries) {
    if (!/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(entry.name)) continue;
    notes.set(numberIn(entry.name), xmlToText(entry.read().toString("utf8")));
  }

  const pages: ProcessorPage[] = slides.map((entry, index) => {
    const slideText = xmlToText(entry.read().toString("utf8"));
    const note = notes.get(numberIn(entry.name));
    return {
      pageNumber: index + 1,
      text: note ? `${slideText}\n\nNotes: ${note}` : slideText,
    };
  });

  const text = pages.map((p) => `--- Slide ${p.pageNumber} ---\n${p.text}`).join("\n\n").trim();
  return {
    extractedText: text || null,
    pages,
    pageCount: pages.length,
    metadata: { format: "pptx" },
  };
}

function readXlsx(entries: ZipEntry[]): ProcessorResult {
  const stringsEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const strings = stringsEntry ? sharedStrings(stringsEntry.read().toString("utf8")) : [];

  const sheets = entries
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => numberIn(a.name) - numberIn(b.name));
  if (sheets.length === 0) throw new Error("This spreadsheet has no readable sheets.");

  const out: string[] = [];
  for (const sheet of sheets) {
    const xml = sheet.read().toString("utf8");
    for (const row of xml.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
      const cells: string[] = [];
      for (const cell of row.match(/<c\b[^>]*(?:\/>|[\s\S]*?<\/c>)/g) ?? []) {
        // A cell is either an index into the shared-string table (t="s"), a
        // string held inline, or a literal value. Anything else — a formula's
        // cached result included — reads out of <v> the same way.
        const value = cell.match(/<v>([\s\S]*?)<\/v>/);
        if (/\bt="s"/.test(cell) && value) {
          cells.push(strings[Number(value[1])] ?? "");
        } else if (/\bt="(inlineStr|str)"/.test(cell)) {
          cells.push(decodeEntities(cell.replace(/<[^>]*>/g, "")));
        } else if (value) {
          cells.push(decodeEntities(value[1]));
        }
      }
      const line = cells.join("\t").trim();
      if (line) out.push(line);
    }
  }

  const text = out.join("\n").trim();
  return { extractedText: text || null, metadata: { format: "xlsx" } };
}

export const ooxmlProcessor: DocumentProcessor = {
  id: "ooxml-processor",

  supports(mimeType) {
    return OOXML_MIME_TYPES.has(mimeType);
  },

  /**
   * The extension decides which reader runs, not the mime type. Word and
   * PowerPoint files arrive with an empty or wrong `type` often enough — from
   * a phone, from Drive, from anything that re-wraps a download — that
   * trusting the header is how a real .docx ends up unread.
   */
  async process(input: ProcessorInput): Promise<ProcessorResult> {
    const extension = extensionOf(input.originalName);
    const entries = readZip(input.fileBytes);

    const result =
      extension === "pptx" || input.mimeType.includes("presentationml")
        ? readPptx(entries)
        : extension === "xlsx" || input.mimeType.includes("spreadsheetml")
          ? readXlsx(entries)
          : readDocx(entries);

    return {
      ...result,
      extractedText: result.extractedText ? result.extractedText.slice(0, MAX_CHARS) : null,
    };
  },
};

/** Whether the pipeline should route a file here on its name alone. */
export function isOoxmlName(fileName: string): boolean {
  return OOXML_EXTENSIONS.has(extensionOf(fileName));
}
