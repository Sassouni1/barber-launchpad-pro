export interface NormalizedAttachment {
  url: string;
  name: string;
  mimeType?: string | null;
  isImage: boolean;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)(\?|#|$)/i;

const URL_KEYS = [
  'url',
  'fileUrl',
  'file_url',
  'mediaUrl',
  'media_url',
  'downloadUrl',
  'download_url',
  'link',
] as const;

const NAME_KEYS = ['name', 'fileName', 'file_name', 'title', 'filename'] as const;
const MIME_KEYS = ['mimeType', 'mime_type', 'contentType', 'content_type', 'type'] as const;

function pick(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function nameFromUrl(url: string) {
  try {
    const path = new URL(url, 'https://placeholder.local').pathname;
    const last = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
    return last || 'Attachment';
  } catch {
    return 'Attachment';
  }
}

/**
 * Turns a loosely-typed attachment (string URL, or object using any of the
 * common url/fileUrl/mediaUrl/downloadUrl/link shapes) into a predictable
 * record the UI can render inline.
 */
export function normalizeAttachment(input: unknown): NormalizedAttachment | null {
  let url: string | undefined;
  let name: string | undefined;
  let mimeType: string | undefined;

  if (typeof input === 'string') {
    url = input.trim() || undefined;
  } else if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    url = pick(record, URL_KEYS);
    name = pick(record, NAME_KEYS);
    mimeType = pick(record, MIME_KEYS);
  }

  if (!url) return null;

  const resolvedName = name || nameFromUrl(url);
  const isImage =
    (!!mimeType && mimeType.toLowerCase().startsWith('image/')) ||
    IMAGE_EXTENSIONS.test(url) ||
    IMAGE_EXTENSIONS.test(resolvedName);

  return { url, name: resolvedName, mimeType: mimeType ?? null, isImage };
}

export function normalizeAttachments(input: unknown): NormalizedAttachment[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list
    .map(normalizeAttachment)
    .filter((attachment): attachment is NormalizedAttachment => !!attachment);
}
