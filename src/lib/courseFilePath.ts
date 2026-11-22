// Pure helpers for course-file URLs (no app imports, so tests can load them directly).
const MARKER = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/course-files\/([^?#]+)/;

/** Storage path inside the course-files bucket, or null when the URL is not a course file. */
export function courseFilePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = MARKER.exec(url);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
