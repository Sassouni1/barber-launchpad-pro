/**
 * Spanish (Español) Vimeo video overrides per module.
 *
 * Keyed by `modules.id`. Value is the full Vimeo URL (standard or with
 * privacy hash) — the existing `getVimeoEmbedUrl()` helper handles
 * conversion to the embeddable player URL.
 *
 * If a module is NOT in this map (or the value is empty), the app falls
 * back to the original English video. That way new Spanish videos can be
 * dropped in just by adding/updating a single line here — no other code
 * changes needed.
 *
 * To add a new Spanish video later, append/replace an entry below.
 */
export const SPANISH_VIDEO_BY_MODULE_ID: Record<string, string> = {
  // Hair System Mastery — How to Customize the Hair System
  "bd6e3e20-5fd5-4852-91ce-50a15fa991e3": "https://vimeo.com/1195975327/ca5299ade5",

  // Hair System Mastery — Applying the Hair System with Tape
  "e5a053f3-2fd3-4eaf-b4d0-98fd27ee1ef8": "https://vimeo.com/1195976934/486a6da8bd",

  // Hair System Mastery — How to Style a Hair System
  "ded8a28b-8432-4338-b936-a8a7e86e66f8": "https://vimeo.com/1195978973/72ef41e1f6",

  // Hair System Mastery — The Consultation & Questions to Ask
  "7cf461b7-a969-4ec2-8c21-7901d88561a1": "https://vimeo.com/1195982575/6a6fe32051",

  // Hair System Mastery — Live Client Part 2
  "7c4808e9-0b1e-40e8-b188-016d4f9398a4": "https://vimeo.com/1195973824/0c2482e379",

  // Hair System Mastery — The Color Ring
  "269e90ae-9320-4a8d-b326-1b9f6c394dd4": "https://vimeo.com/1195980538/cfac4efaf7",
};

/**
 * Resolve the video URL to render for a given module + locale.
 * Falls back to the English URL when no Spanish override exists.
 */
export function resolveVideoUrl(
  moduleId: string | undefined | null,
  englishUrl: string | undefined | null,
  locale: "en" | "es"
): string {
  if (locale === "es" && moduleId) {
    const es = SPANISH_VIDEO_BY_MODULE_ID[moduleId];
    if (es && es.trim()) return es;
  }
  return englishUrl ?? "";
}
