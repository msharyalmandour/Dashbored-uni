"use client";

import { createClient } from "@/lib/supabase/client";
import { requestUploadSlot } from "@/app/actions/documents";
import { attachUploadedSlide } from "@/app/actions/slides";
import { captureUploadedFile } from "@/app/actions/capture";
import { describeFile, isBlocked, MAX_FILE_BYTES } from "@/lib/capture-kinds";
import type { CaptureFailureReason } from "@/app/actions/capture";

/**
 * Sends one dropped file to Storage without it passing through the server.
 *
 * Every byte used to travel inside a Server Action's request body, which the
 * platform caps at 4.5MB — a ceiling nothing in this app chose and no
 * configuration lifts. It had nothing to do with what the storage bucket holds
 * (25MB) or what a student actually drops; a lecture PDF simply could not get
 * in. Three steps replace it:
 *
 *   1. Ask the server for permission to write one specific path. It decides,
 *      knowing the name and the claimed size, and returns a token good for
 *      that path alone.
 *   2. The browser uploads straight to Storage with that token.
 *   3. Tell the server the path. It re-checks the path is inside this
 *      student's own folder and reads the *real* size back from Storage
 *      before writing a row — the browser's word about its own file is a
 *      claim, not a fact, and a size limit that trusts it is not a limit.
 *
 * Only steps 1 and 3 touch a Server Action, and both carry a few hundred bytes
 * whatever the file weighs.
 */
export async function uploadAndCapture(
  file: File
): Promise<{ ok: true; id: string } | { ok: false; reason: CaptureFailureReason }> {
  // Refused in the browser, before anything moves. The server checks both of
  // these again — this is only so the student hears about it instantly and
  // without spending the upload.
  if (isBlocked(file.name)) return { ok: false, reason: "BLOCKED_TYPE" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "TOO_BIG" };

  const { category } = describeFile(file.name, file.type);

  try {
    const slot = await requestUploadSlot({
      fileName: file.name,
      sizeBytes: file.size,
      category: category === "IMAGE" ? "IMAGE" : "OTHER",
    });

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(slot.bucket)
      .uploadToSignedUrl(slot.path, slot.token, file, {
        // The browser's own guess, and often empty or wrong — which is exactly
        // why nothing downstream depends on it. What the file *is* comes from
        // its extension, and the size comes back from Storage.
        contentType: file.type || "application/octet-stream",
      });
    if (error) {
      console.error(`uploadAndCapture: ${file.name} —`, error.message);
      return { ok: false, reason: "UPLOAD_FAILED" };
    }

    const capture = await captureUploadedFile({ path: slot.path, fileName: file.name });
    return { ok: true, id: capture.id };
  } catch (err) {
    // A production build withholds the message of anything a Server Action
    // throws, so this is kept for the console and the student is told which
    // file failed, in their own language, by the caller.
    console.error(`uploadAndCapture: ${file.name} —`, err);
    return { ok: false, reason: "UPLOAD_FAILED" };
  }
}

/** What went wrong, in a form the caller can translate. */
export type SlideUploadFailure = "TOO_BIG" | "NOT_ANNOTATABLE" | "UPLOAD_FAILED";

/**
 * Sends a lecture file to Storage and attaches it to the lecture.
 *
 * The same three steps as `uploadAndCapture`, for the one entry point that
 * never got them. Attaching a lecture used to hand the whole `File` to a
 * Server Action, which meant it died at the request-body cap — 2MB here, 4.5MB
 * on the platform — and a lecture deck is essentially never under either. The
 * student saw a dialog that did nothing.
 *
 * Failures come back as a reason rather than a thrown message on purpose: a
 * production build withholds what a Server Action throws, so a message crossing
 * that boundary arrives as the framework's generic text. A reason survives it,
 * and the caller renders it in the student's own language.
 */
export async function uploadSlideDirect(input: {
  lectureId: string;
  file: File;
  title?: string;
}): Promise<{ ok: true } | { ok: false; reason: SlideUploadFailure }> {
  const { file, lectureId } = input;

  // Refused here first, so the student hears about it instantly instead of
  // after spending the upload. The server checks both again.
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "TOO_BIG" };
  if (!isAnnotatable(file)) return { ok: false, reason: "NOT_ANNOTATABLE" };

  try {
    const slot = await requestUploadSlot({
      fileName: file.name,
      sizeBytes: file.size,
      category: "LECTURE",
      lectureId,
    });

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(slot.bucket)
      .uploadToSignedUrl(slot.path, slot.token, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (error) {
      console.error(`uploadSlideDirect: ${file.name} —`, error.message);
      return { ok: false, reason: "UPLOAD_FAILED" };
    }

    await attachUploadedSlide({
      path: slot.path,
      fileName: file.name,
      title: input.title,
      lectureId,
    });
    return { ok: true };
  } catch (err) {
    console.error(`uploadSlideDirect: ${file.name} —`, err);
    // The server throws this exact string when it can find no renderer for the
    // file; a production build masks the message, so the reason is recovered
    // from the digest-free development message when it survives and falls back
    // to a generic failure when it does not.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("NOT_ANNOTATABLE")) return { ok: false, reason: "NOT_ANNOTATABLE" };
    return { ok: false, reason: "UPLOAD_FAILED" };
  }
}

/**
 * Whether the annotator has a renderer for this file.
 *
 * Checked in the browser as well as on the server so the student is told
 * before the upload rather than after it — a fifteen-megabyte PowerPoint
 * should not have to travel to Storage to be refused.
 */
function isAnnotatable(file: File): boolean {
  const byMime = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];
  if (byMime.includes(file.type)) return true;
  // A browser often reports nothing for a file picked on a phone.
  if (file.type) return false;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext);
}
