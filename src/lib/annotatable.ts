/**
 * Which files the annotator can actually draw.
 *
 * `slide-annotator.tsx` renders either a PDF page or a raster image onto a
 * canvas — see its `renderBase`. That is a real constraint rather than an
 * arbitrary allowlist: HEIC and TIFF do not decode through `<img>` in any
 * target browser, so accepting one produces an empty canvas instead of a page
 * to write on.
 *
 * This lives in its own module because two paths now decide it: the student
 * attaching a deck by hand, and the agent turning a dropped lecture into one.
 * Two copies of this rule would drift, and the way they would drift is that
 * one path starts accepting a file the viewer cannot open — which the student
 * only discovers when the page is blank.
 */
export const ANNOTATABLE_TYPES: Record<string, "pdf" | "image"> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/bmp": "image",
};

const ANNOTATABLE_EXTENSIONS: Record<string, "pdf" | "image"> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  bmp: "image",
};

/**
 * Which of the two renderers a file needs, or null if neither can draw it.
 *
 * The extension decides when the recorded type does not, because the type in
 * Storage is whatever the browser claimed at upload time and a browser
 * routinely claims nothing at all.
 */
export function annotatableType(mimeType: string | null, fileName: string): "pdf" | "image" | null {
  const byMime = mimeType ? ANNOTATABLE_TYPES[mimeType] : undefined;
  if (byMime) return byMime;

  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ANNOTATABLE_EXTENSIONS[ext] ?? null;
}
