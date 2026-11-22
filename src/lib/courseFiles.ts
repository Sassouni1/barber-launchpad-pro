import { supabase } from '@/integrations/supabase/client';
import { courseFilePath } from './courseFilePath';

/**
 * Course files live in a private bucket. Stored rows keep a stable
 * "/object/public/course-files/<path>" style URL as an identifier only; the app
 * turns it into a short-lived signed URL, which the server issues only to
 * accounts allowed to open member training.
 */
export const COURSE_FILES_BUCKET = 'course-files';
export const COURSE_FILE_URL_SECONDS = 60 * 60;

export { courseFilePath };

/** Stable stored form of a course-file URL (never a signed, expiring URL). */
export function canonicalCourseFileUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  const path = courseFilePath(url);
  if (!path) return url;
  return supabase.storage.from(COURSE_FILES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Map each course-file URL to a short-lived signed URL; other URLs pass through unchanged. */
export async function signCourseFileUrls(urls: Array<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byPath = new Map<string, string[]>();
  for (const url of urls) {
    const path = courseFilePath(url);
    if (!url || !path) continue;
    byPath.set(path, [...(byPath.get(path) ?? []), url]);
  }
  if (byPath.size === 0) return out;
  const { data, error } = await supabase.storage
    .from(COURSE_FILES_BUCKET)
    .createSignedUrls([...byPath.keys()], COURSE_FILE_URL_SECONDS);
  if (error) throw error;
  for (const row of data ?? []) {
    if (!row.path || !row.signedUrl) continue;
    for (const original of byPath.get(row.path) ?? []) out.set(original, row.signedUrl);
  }
  return out;
}

/** Replace `key` URLs on each row with signed URLs, keeping the stored URL as `storage_url`. */
export async function withSignedCourseFiles<T extends { [P in K]: string | null }, K extends string>(
  rows: T[],
  key: K,
): Promise<Array<T & { storage_url: string | null }>> {
  const signed = await signCourseFileUrls(rows.map((r) => r[key]));
  return rows.map((r) => {
    const stored = r[key] ?? null;
    return { ...r, [key]: stored ? signed.get(stored) ?? stored : stored, storage_url: stored };
  });
}
