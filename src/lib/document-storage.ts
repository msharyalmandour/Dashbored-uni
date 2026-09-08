import { createClient } from "@supabase/supabase-js";

const BUCKET = "documents";

/**
 * A per-request Storage client authenticated as the current user (their
 * session access token, not the bare anon key). The bucket is private and
 * its RLS policies check `auth.uid()` against the object path's first
 * segment — every call here must run as that user for Storage RLS to
 * actually authorize it.
 */
function client(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Uploads a file and returns its storage path (the bucket is private — not a public URL). */
export async function uploadDocumentFile(file: File, path: string, accessToken: string): Promise<string> {
  const supabase = client(accessToken);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload file: ${error.message}`);
  return path;
}

export async function deleteDocumentFile(path: string, accessToken: string): Promise<void> {
  const supabase = client(accessToken);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Failed to delete file: ${error.message}`);
}

/** Short-lived signed URL for viewing a private document file. */
export async function getSignedDocumentUrl(path: string, accessToken: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = client(accessToken);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to sign document URL: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

/** Whether the background job has what it needs to actually download files. */
export function isServiceStorageConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Downloads a file's raw bytes using the Supabase **service role** key —
 * used only by the background processing job (netlify/functions), which
 * runs outside any user's request/session and therefore has no user
 * access token to act as. The service role key intentionally bypasses
 * Storage RLS; it must never be used in a user-facing request path (only
 * `client()` above, scoped to the caller's own token, may be used there).
 * Returns null if the key isn't configured, so the job can skip
 * processing cleanly instead of crashing.
 */
export async function downloadDocumentFileAsService(path: string): Promise<Buffer | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
