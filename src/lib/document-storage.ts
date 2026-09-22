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

/**
 * A one-time permission for the browser to write to exactly one path.
 *
 * This is what lets a file skip the server entirely. A Server Action's request
 * body is capped — 4.5MB on this platform, and not by anything config can lift
 * — so every byte that travelled through one put a ceiling on what a student
 * could drop. The bytes now go browser → Storage directly, and the server only
 * ever handles the path.
 *
 * The token is scoped to this single path and expires, so it is not a general
 * write permission: the worst it can do is create the one object the server
 * already decided to allow, in the folder Storage RLS confines this user to.
 */
export async function createSignedUploadSlot(
  path: string,
  accessToken: string
): Promise<{ bucket: string; path: string; token: string }> {
  const supabase = client(accessToken);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not start the upload: ${error?.message ?? "unknown error"}`);
  // The bucket travels with the slot so the browser has no second copy of
  // this name to drift out of step with this one.
  return { bucket: BUCKET, path: data.path, token: data.token };
}

/**
 * What Storage actually holds at a path, or null if nothing does.
 *
 * The size is read back here rather than taken from the browser because, with
 * the upload no longer passing through the server, the browser's claim about
 * it is the only thing the server would otherwise have — and a size limit that
 * trusts the client to report its own size is not a limit. This is also what
 * proves the upload really happened before a row is written pointing at it.
 */
export async function statDocumentFile(
  path: string,
  accessToken: string
): Promise<{ sizeBytes: number; mimeType: string | null } | null> {
  const supabase = client(accessToken);
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);

  const { data, error } = await supabase.storage.from(BUCKET).list(folder, { search: name, limit: 100 });
  if (error || !data) return null;

  const match = data.find((entry) => entry.name === name);
  if (!match) return null;

  const metadata = (match.metadata ?? {}) as { size?: number; mimetype?: string };
  return { sizeBytes: metadata.size ?? 0, mimeType: metadata.mimetype ?? null };
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

/**
 * Downloads a file's raw bytes as the signed-in user, using their own access
 * token so Storage RLS still authorizes the read.
 *
 * The service-role downloader above must never be used on a request path;
 * this is the counterpart for the times a user-facing action genuinely needs
 * the bytes — analysing an image the student just dropped, where the model
 * has to be given the picture itself rather than a description of it.
 */
export async function downloadDocumentFileAsUser(path: string, accessToken: string): Promise<Buffer | null> {
  const supabase = client(accessToken);
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
