/**
 * Spanish (Español) Vimeo video overrides for Hair System Mastery.
 *
 * Keyed by `modules.id` (verified against the database by stable lesson
 * number 00, 01, 02, … — NOT array order or title fuzzy-match).
 *
 * Lessons 10 (Live Client Part 4), 12 (The Maintenance Appointment),
 * and 15 (Placing a Hair System Order) intentionally have no Spanish
 * override yet — they fall back to the English video.
 *
 * To add/replace a Spanish video, look up the module ID for that exact
 * lesson number and update the entry below.
 */
export const SPANISH_VIDEO_BY_MODULE_ID: Record<string, string> = {
  // 00 — Terms of the Industry
  "409c4aa9-b5e0-4589-b470-106f07f76364": "https://vimeo.com/1195973463/b7ed38c1c1",

  // 01 — The Color Ring
  "269e90ae-9320-4a8d-b326-1b9f6c394dd4": "https://vimeo.com/1195973824/0c2482e379",

  // 02 — How to Make a Template
  "62f0a33c-c95c-4453-a34d-c825a4dfb6a0": "https://vimeo.com/1196206697/81dcca3a63",

  // 03 — How to Customize the Hair System
  "bd6e3e20-5fd5-4852-91ce-50a15fa991e3": "https://vimeo.com/1195975327/ca5299ade5",

  // 04 — Applying the Hair System with Tape
  "e5a053f3-2fd3-4eaf-b4d0-98fd27ee1ef8": "https://vimeo.com/1195976934/486a6da8bd",

  // 05 — Applying Hair Systems with Adhesive
  "55ace175-0f37-4ebd-a504-ec4e5f8caad2": "https://vimeo.com/1196206696/e8067f2a1e",

  // 06 — How to Style a Hair System
  "ded8a28b-8432-4338-b936-a8a7e86e66f8": "https://vimeo.com/1195978973/72ef41e1f6",

  // 07 — Live Client Part 1
  "582837c7-5a6e-4467-b0ff-36446de0e478": "https://vimeo.com/1196206694/e0e7a9dcaa",

  // 08 — Live Client Part 2
  "7c4808e9-0b1e-40e8-b188-016d4f9398a4": "https://vimeo.com/1195980538/cfac4efaf7",

  // 09 — Live Client Part 3
  "ef71fd79-972e-4aca-a6eb-771dfbb1b865": "https://vimeo.com/1196206695/3c21634878",

  // 11 — At Home Care
  "a576965f-2668-4603-9138-2d023457e320": "https://vimeo.com/1196205873/5eeeb2d8bf",

  // 13 — The Consultation & Questions to Ask
  "7cf461b7-a969-4ec2-8c21-7901d88561a1": "https://vimeo.com/1195982575/6a6fe32051",

  // 14 — How and What to Charge
  "c45caf90-af21-44cd-898c-76fc8015ea00": "https://vimeo.com/1196208396/3ad849bcc7",
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
