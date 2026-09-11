/**
 * Turning a recorded lecture into words.
 *
 * The app has recorded voice for a while and accepted audio files, and nothing
 * ever read them: the model this agent runs on takes text, images and PDFs, not
 * sound. So a student could record fifty minutes of a lecture, watch it upload,
 * and get nothing — the file sat in the Library and the inbox honestly reported
 * that nobody had listened to it. Honest, and useless.
 *
 * Transcription needs a second provider, which means a second key, which is a
 * decision only the person paying for it can make. So this is built to the
 * shape of that decision: configured by environment variable, absent by
 * default, and when it is absent the app says plainly that audio is stored but
 * not read rather than pretending or failing oddly. Nothing here assumes a
 * particular vendor — a base URL and a model name are all that separates one
 * OpenAI-compatible transcription endpoint from another, and several are.
 */

const KEY_ENV = "TRANSCRIPTION_API_KEY";
const BASE_URL_ENV = "TRANSCRIPTION_BASE_URL";
const MODEL_ENV = "TRANSCRIPTION_MODEL";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "whisper-1";

/**
 * The largest recording that will be sent.
 *
 * Transcription endpoints commonly refuse anything over 25MB, and this request
 * has its own wall clock to keep. A recording above this is reported as too
 * long rather than sent to be rejected — the student can then split it, which
 * is something they can actually do.
 */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** Long enough for a full lecture, short enough to leave the request room. */
const TIMEOUT_MS = 55_000;

export interface TranscriptionStatus {
  configured: boolean;
  requiredEnvVar: string;
}

export function getTranscriptionStatus(): TranscriptionStatus {
  return { configured: !!process.env[KEY_ENV]?.trim(), requiredEnvVar: KEY_ENV };
}

export type TranscriptionResult =
  | { ok: true; text: string }
  | { ok: false; reason: "NOT_CONFIGURED" | "TOO_LONG" | "TIMED_OUT" | "REFUSED" | "UNREADABLE" };

/**
 * Transcribes one recording.
 *
 * Never throws. A lecture that could not be transcribed is a fact to record on
 * the document, the same as a PDF that could not be read — the run that
 * triggered it has other things to organise and must not be taken down by this.
 */
export async function transcribeAudio(
  bytes: Buffer,
  fileName: string,
  mimeType: string,
  fetchImpl: typeof fetch = fetch
): Promise<TranscriptionResult> {
  const key = process.env[KEY_ENV]?.trim();
  if (!key) return { ok: false, reason: "NOT_CONFIGURED" };
  if (bytes.byteLength > MAX_AUDIO_BYTES) return { ok: false, reason: "TOO_LONG" };

  const baseUrl = (process.env[BASE_URL_ENV]?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env[MODEL_ENV]?.trim() || DEFAULT_MODEL;

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType || "audio/mpeg" }), fileName);
  form.append("model", model);
  // Plain text back, because that is all this needs. Asking for timestamps or
  // segments would return a structure to parse for information nothing uses.
  form.append("response_format", "text");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      // The body is not surfaced anywhere a student can see it: it echoes the
      // request, and the request is a recording of their lecture.
      console.error(`transcribeAudio: ${response.status} from ${baseUrl}`);
      return { ok: false, reason: "REFUSED" };
    }

    const text = (await response.text()).trim();
    return text.length >= 20 ? { ok: true, text } : { ok: false, reason: "UNREADABLE" };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    if (!aborted) console.error("transcribeAudio:", err);
    return { ok: false, reason: aborted ? "TIMED_OUT" : "REFUSED" };
  } finally {
    clearTimeout(timer);
  }
}
