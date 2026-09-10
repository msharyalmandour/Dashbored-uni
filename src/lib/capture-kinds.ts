/**
 * What Drop Anything accepts, and what each thing actually gets.
 *
 * The old rule was "PDF or image, everything else is rejected", which made a
 * feature called Drop Anything refuse most of what a student has. This widens
 * acceptance to everything it is reasonable to bring into an academic
 * workspace — and, just as importantly, is honest per type about how far the
 * understanding goes.
 *
 * That honesty is the design. A file that is stored but not read is a useful
 * outcome; a file that is stored while the interface implies it was
 * understood is a lie the student only discovers later, when the notes they
 * expected are not there.
 */

/** How far the system can actually take a file, today. */
export type ProcessingLevel =
  /** Text is extracted and analysed. Full understanding. */
  | "TEXT"
  /** Sent to the model as an image and genuinely looked at. */
  | "VISION"
  /** Accepted and stored, but nothing here can read inside it yet. */
  | "STORED";

export type CaptureCategory = "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO" | "OTHER";

export interface FileCapability {
  category: CaptureCategory;
  level: ProcessingLevel;
}

/**
 * The largest file this app can actually accept, as opposed to the one it
 * used to claim.
 *
 * It said 40 MB, and 40 MB was never deliverable: a dropped file travels
 * through a Server Action, whose request body is capped — at 1MB by Next's
 * default, and at 4.5MB by the serverless platform underneath, which is not a
 * limit any config can lift. So the check here passed a 20MB file that the
 * platform then refused at the door, before any of this code ran, and the
 * student saw an opaque crash rather than "that file is too big".
 *
 * 4 MB is the real number, and it is the ceiling rather than a choice: the
 * platform refuses a request body over 4.5MB, and the multipart boundaries and
 * part headers count against the same budget. A phone photograph fits, and so
 * does most of what a student drops. A recorded lecture does not, and now says
 * so in a sentence instead of failing silently.
 *
 * The limit is per file, not per drop — each one is sent as its own request —
 * so an armful of six is six separate 4 MB budgets, not one shared between
 * them.
 *
 * Raising this properly means uploading from the browser straight to storage
 * with a signed URL, so the bytes never pass through a Server Action at all.
 * That is the change to make when it matters; this is the honest limit until
 * then.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Extensions that are never accepted.
 *
 * Nothing here is ever executed — files go to private Storage and come back
 * through signed URLs — so this is not the boundary that keeps the app safe.
 * It exists so the student's own Library cannot quietly become a place they
 * hand each other installers, and so an obviously-wrong drop is refused with
 * a reason rather than stored forever.
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl",
  "dll", "so", "dylib", "jar", "app", "deb", "rpm", "apk",
  "sh", "bash", "zsh", "ps1", "vbs", "wsf",
]);

/** Read as plain text with no parser at all — just a decode. */
const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "rtf", "log", "srt", "vtt"]);

/** Office and e-book formats: accepted and stored, not yet read. */
const DOCUMENT_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "epub", "pages", "key", "numbers",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp", "tiff", "tif", "avif", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "avi", "mkv", "m4v", "wmv", "flv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "wma", "weba"]);

/**
 * Image formats the model's vision can actually decode. Others are stored and
 * shown, but not sent — HEIC off an iPhone and SVG are the common cases, and
 * claiming to have looked at one would be false.
 */
export const VISION_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** True when the file must be refused outright. */
export function isBlocked(fileName: string): boolean {
  return BLOCKED_EXTENSIONS.has(extensionOf(fileName));
}

/**
 * What this file is, and how far understanding will get.
 *
 * Decided from the extension first and the mime type second: browsers report
 * an empty or wrong `type` often enough (HEIC, markdown, and anything dragged
 * from certain apps) that trusting it alone is what made "unsupported file"
 * appear for files that were perfectly fine.
 */
export function describeFile(fileName: string, mimeType: string): FileCapability {
  const ext = extensionOf(fileName);
  const mime = mimeType.toLowerCase();

  if (ext === "pdf" || mime === "application/pdf") {
    return { category: "DOCUMENT", level: "TEXT" };
  }

  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith("text/")) {
    return { category: "DOCUMENT", level: "TEXT" };
  }

  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith("image/")) {
    return { category: "IMAGE", level: VISION_MIME_TYPES.has(mime) ? "VISION" : "STORED" };
  }

  if (VIDEO_EXTENSIONS.has(ext) || mime.startsWith("video/")) {
    return { category: "VIDEO", level: "STORED" };
  }

  if (AUDIO_EXTENSIONS.has(ext) || mime.startsWith("audio/")) {
    return { category: "AUDIO", level: "STORED" };
  }

  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return { category: "DOCUMENT", level: "STORED" };
  }

  return { category: "OTHER", level: "STORED" };
}

/**
 * The `accept` attribute for the file picker.
 *
 * Deliberately broad, and deliberately not the security boundary — a picker
 * hint is trivially bypassed, so `isBlocked` and the server-side check are
 * what actually decide. This exists only so the picker does not grey out most
 * of a student's files.
 */
export const FILE_ACCEPT_ATTRIBUTE = [
  "image/*",
  "video/*",
  "audio/*",
  "text/*",
  "application/pdf",
  ...[...DOCUMENT_EXTENSIONS, ...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS].map(
    (e) => `.${e}`
  ),
].join(",");
