import type { DocumentProcessor, ProcessorInput, ProcessorResult } from "./types";
import { extensionOf } from "@/lib/capture-kinds";

/**
 * Plain-text formats: notes, markdown, CSV exports, subtitle files.
 *
 * No parser and no dependency — these formats *are* their text, so reading
 * them is a decode. Worth having precisely because it is nearly free: a
 * student's exported notes or a timetable CSV become fully understood content
 * rather than an opaque file sitting in the Library.
 *
 * RTF gets its control words stripped. It is not a real RTF parser and does
 * not try to be; it recovers the prose, which is all the analysis step needs.
 */
const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "log", "srt", "vtt", "rtf"]);

/** Matches the cap the analyser applies anyway — no point holding more. */
const MAX_CHARS = 200_000;

function stripRtf(input: string): string {
  return input
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .trim();
}

export const textProcessor: DocumentProcessor = {
  id: "text-processor",

  supports(mimeType) {
    return mimeType.startsWith("text/") || mimeType === "application/json";
  },

  /**
   * `supports` is checked against the mime type, but browsers report markdown
   * and CSV inconsistently (often as an empty string), so the pipeline also
   * routes here by extension — see getProcessorFor.
   */
  async process(input: ProcessorInput): Promise<ProcessorResult> {
    const raw = input.fileBytes.toString("utf8");
    const ext = extensionOf(input.originalName);
    const text = (ext === "rtf" ? stripRtf(raw) : raw).slice(0, MAX_CHARS).trim();

    return {
      extractedText: text || null,
      metadata: { characters: text.length },
    };
  },
};

export function isPlainTextName(fileName: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(fileName));
}
