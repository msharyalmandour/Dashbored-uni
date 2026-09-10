"use client";

import { createClient } from "@/lib/supabase/client";
import { requestUploadSlot } from "@/app/actions/documents";
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
