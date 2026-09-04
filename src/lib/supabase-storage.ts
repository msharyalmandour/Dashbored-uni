import { createClient } from "@supabase/supabase-js";

const BUCKET = "lecture-slides";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase storage is not configured (SUPABASE_URL / SUPABASE_ANON_KEY missing).");
  return createClient(url, key);
}

export async function uploadSlideFile(file: File, path: string) {
  const supabase = client();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload slide: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
