import { createClient } from "@supabase/supabase-js";

const BUCKET = "lecture-slides";

/**
 * A per-request Storage client authenticated as the current user (via
 * their session access token, not the bare anon key). The bucket is
 * private and its RLS policies check `auth.uid()` against the object
 * path's first segment — every call here must run as that user for
 * Storage RLS to actually authorize it. See slides.ts for how the token
 * is obtained.
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

/** Uploads a slide file and returns its storage path (the bucket is private — not a public URL). */
export async function uploadSlideFile(file: File, path: string, accessToken: string): Promise<string> {
  const supabase = client(accessToken);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload slide: ${error.message}`);
  return path;
}

export async function deleteSlideFile(path: string, accessToken: string): Promise<void> {
  const supabase = client(accessToken);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Failed to delete slide file: ${error.message}`);
}

/** Short-lived signed URL for viewing/rendering a private slide file. */
export async function getSignedSlideUrl(path: string, accessToken: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = client(accessToken);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to sign slide URL: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}
