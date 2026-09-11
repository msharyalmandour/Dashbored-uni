import type { DocumentProcessor, ProcessorInput, ProcessorResult } from "./types";
import { extensionOf } from "@/lib/capture-kinds";
import { getTranscriptionStatus, transcribeAudio } from "@/lib/transcription";

/**
 * A recorded lecture, read as what was said in it.
 *
 * This is the only processor that can decline to exist. The others need nothing
 * but the file: a PDF is a PDF whatever anyone has paid for. Transcription
 * needs a second provider and therefore a second key, and until someone
 * configures one the honest answer about a recording is that it was stored and
 * nobody listened to it — which is what `supports` returning false makes the
 * whole app say, in the student's own language, without a single special case
 * anywhere else.
 */

const AUDIO_EXTENSIONS = new Set([
  "mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "wma", "weba", "webm", "mp4",
]);

/** A recording is not the same as a document; the failures need their own words. */
const REASONS: Record<string, string> = {
  TOO_LONG: "This recording is too long to transcribe in one go. Splitting it into shorter parts will work.",
  TIMED_OUT: "Transcribing this recording took too long and was stopped.",
  REFUSED: "The transcription service refused this recording.",
  UNREADABLE: "Nothing could be made out in this recording.",
  NOT_CONFIGURED: "Transcription is not set up, so this recording was stored but not listened to.",
};

export const audioProcessor: DocumentProcessor = {
  id: "audio-processor",

  supports(mimeType) {
    if (!getTranscriptionStatus().configured) return false;
    return mimeType.toLowerCase().startsWith("audio/");
  },

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    const result = await transcribeAudio(input.fileBytes, input.originalName, input.mimeType);

    if (!result.ok) {
      // Thrown rather than returned empty, so the pipeline records it as a
      // failure with a reason on the row. A recording that produced no text and
      // no explanation is indistinguishable from a silent one.
      throw new Error(REASONS[result.reason] ?? "This recording could not be transcribed.");
    }

    return {
      extractedText: result.text,
      metadata: { processor: "audio-processor", transcribed: true },
    };
  },
};

/** Whether the pipeline should route a file here on its name alone. */
export function isAudioName(fileName: string): boolean {
  return AUDIO_EXTENSIONS.has(extensionOf(fileName));
}
