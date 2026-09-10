"use client";

import { extensionOf, VISION_MIME_TYPES } from "@/lib/capture-kinds";

/**
 * Turns whatever the camera produced into something the model can actually
 * look at.
 *
 * Two silent failures lived here, and both hit the most ordinary thing a
 * student does — photographing a timetable on the wall.
 *
 * The first is HEIC. It is the default format on every iPhone, it was accepted
 * and stored, and it is not in `VISION_MIME_TYPES` — so the inbox filed it as
 * "stored, not read" and the model never saw it. The second is size: a photo
 * off a modern phone is routinely more than the 3.5MB `loadImage` will send,
 * and over that line the picture was dropped from the request without a word.
 * In both cases the student watched their photo upload successfully and get
 * organised into nothing.
 *
 * Neither is worth a server round trip or a dependency. The browser already
 * has a decoder for every format its own camera writes — including HEIC, on
 * the iPhone where HEIC comes from — so the fix is to decode, shrink, and
 * re-encode as JPEG before the file ever leaves the device. That also means
 * less to upload on a phone connection, which is the same student's other
 * problem.
 */

/**
 * The longest edge kept, in pixels.
 *
 * Chosen for the hardest thing these photos have to do: small print in a
 * photographed timetable, at an angle, in bad light. 2200px keeps that legible
 * while cutting a 12MP phone photo to a fraction of its weight. Going higher
 * buys nothing the model can use and costs the student's upload.
 */
const MAX_EDGE = 2200;

/**
 * The weight to come in under, held below what `loadImage` will send.
 *
 * That limit is on the raw bytes; base64 inflates them by a third on the way
 * to the provider. This leaves room rather than landing exactly on the line.
 */
const TARGET_BYTES = 3_000_000;

/** Quality steps tried, in order, before the image is shrunk further. */
const QUALITY_STEPS = [0.85, 0.7, 0.55];

/**
 * `describeFile` decides by extension first because browsers report `type`
 * inconsistently for camera formats. The same is true here, and for the same
 * reason: an iPhone HEIC often arrives with an empty type.
 */
const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "tiff", "tif", "avif",
]);

/**
 * Whether this file is worth re-encoding, decided without touching it.
 *
 * Kept pure and exported so the rule itself can be tested — it decides whether
 * a student's photo is looked at or not, and every case it gets wrong is
 * invisible in the interface.
 */
export function normalizePlan(
  file: { name: string; type: string; size: number }
): { normalize: false; reason: string } | { normalize: true; reason: string } {
  const extension = extensionOf(file.name);
  const mime = file.type.toLowerCase();

  // An animated GIF is a sequence, and a canvas would flatten it to its first
  // frame. Losing the animation to gain nothing is not a fix.
  if (extension === "gif" || mime === "image/gif") return { normalize: false, reason: "animated" };

  // SVG is instructions rather than pixels; browsers decode it from a File
  // inconsistently, and a wrong result here is a blank picture sent as if it
  // were the student's note.
  if (extension === "svg" || mime === "image/svg+xml") return { normalize: false, reason: "vector" };

  const looksLikeImage = mime.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
  if (!looksLikeImage) return { normalize: false, reason: "not an image" };

  // The format the model cannot decode is the whole reason this exists, so it
  // is converted at any size.
  if (!VISION_MIME_TYPES.has(mime)) return { normalize: true, reason: "unreadable format" };

  // A readable format that is too heavy to send is the other half: it uploads
  // fine and is then quietly left out of the request.
  if (file.size > TARGET_BYTES) return { normalize: true, reason: "too heavy to send" };

  return { normalize: false, reason: "already readable" };
}

/** How much to shrink an image of this size to fit within the longest edge. */
export function scaleFor(width: number, height: number, maxEdge = MAX_EDGE): number {
  const longest = Math.max(width, height);
  return longest > maxEdge ? maxEdge / longest : 1;
}

/**
 * Re-encodes one image, or hands back the original untouched.
 *
 * Every failure path returns the file it was given. A student who photographed
 * their timetable should never lose the photo because a browser could not
 * decode it — the worst acceptable outcome is the behaviour that existed
 * before, which is the file stored and honestly reported as unread.
 */
export async function normalizeImage(file: File): Promise<File> {
  if (!normalizePlan(file).normalize) return file;

  let bitmap: ImageBitmap;
  try {
    // The decode is the step that fails on a desktop browser handed a HEIC,
    // which is exactly the case where there is nothing better to do than keep
    // the original.
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = scaleFor(bitmap.width, bitmap.height);
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));

    // Quality first, then size. Text in a photographed timetable survives JPEG
    // compression far better than it survives being made smaller, so the
    // resolution is the last thing given up.
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const quality of QUALITY_STEPS) {
        const blob = await encode(bitmap, width, height, quality);
        if (!blob) return file;
        if (blob.size <= TARGET_BYTES) return asJpeg(blob, file.name);
      }
      width = Math.max(1, Math.round(width * 0.75));
      height = Math.max(1, Math.round(height * 0.75));
    }

    // Nine attempts and still too heavy. The original at least gets stored and
    // reported honestly, rather than a picture too big to send.
    return file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

async function encode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
  );
}

/**
 * The re-encoded bytes, named so the rest of the app can tell what they are.
 *
 * The extension matters as much as the mime type: `describeFile` reads the name
 * first, deliberately, so a file still called `.heic` would go on being
 * classified as unreadable however correct its contents now are.
 */
function asJpeg(blob: Blob, originalName: string): File {
  const dot = originalName.lastIndexOf(".");
  const stem = dot === -1 ? originalName : originalName.slice(0, dot);
  return new File([blob], `${stem}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
