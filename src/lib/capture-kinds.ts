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
 * The largest file this app accepts: 25 MB, matching the storage bucket.
 *
 * This number has been wrong in both directions. It said 40 MB while a Server
 * Action's request body — the route every upload took — was capped at 1 MB by
 * default and 4.5 MB by the platform, a ceiling no configuration lifts. So the
 * check passed files the platform then refused at the door, before any of this
 * code ran, and the student saw an opaque crash rather than "that file is too
 * big".
 *
 * The bytes no longer travel through a Server Action at all: the browser
 * uploads straight to Storage with a one-time signed slot, and the server only
 * handles the path (see `upload-direct.ts`). So the limit is finally the one
 * thing that was always the real constraint — what the bucket will hold — and
 * a lecture PDF fits.
 *
 * It is per file, not per drop, and always was: each upload is its own
 * request. An armful of six is six separate budgets.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

/**
 * The modern Office formats, which are read: a ZIP of XML that the OOXML
 * processor unpacks without any dependency. A syllabus in .docx and a lecture
 * deck in .pptx are two of the most common things a course actually hands a
 * student, and both used to arrive and simply sit there.
 */
const OOXML_EXTENSIONS = new Set(["docx", "pptx", "xlsx"]);

/**
 * Older and non-Microsoft office formats, plus e-books: accepted and stored,
 * not read. `.doc` is a binary format with nothing in common with `.docx`, and
 * the OpenDocument and Apple formats each want their own reader.
 */
const DOCUMENT_EXTENSIONS = new Set([
  "pdf", "doc", "ppt", "xls", "odt", "odp", "ods", "epub", "pages", "key", "numbers",
  ...OOXML_EXTENSIONS,
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

  if (OOXML_EXTENSIONS.has(ext)) {
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
