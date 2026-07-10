// Shared name-font-sizing formula. MUST match the copy in
// supabase/functions/generate-certificate/index.ts exactly so admin preview
// and generated PNG render at the same size.
//
// Rule: everyone starts at 170px. Names longer than "Talaundra White" (15 chars)
// shrink by 3px per extra character, floored at 90px.
export const NAME_BASE_FONT_SIZE = 170;
export const NAME_THRESHOLD_CHARS = 15;
export const NAME_MIN_FONT_SIZE = 90;
export const NAME_SHRINK_PER_CHAR = 3;

export function computeCertificateNameFontSize(name: string): number {
  const len = (name || '').trim().length;
  if (len <= NAME_THRESHOLD_CHARS) return NAME_BASE_FONT_SIZE;
  const shrunk = NAME_BASE_FONT_SIZE - (len - NAME_THRESHOLD_CHARS) * NAME_SHRINK_PER_CHAR;
  return Math.max(NAME_MIN_FONT_SIZE, shrunk);
}
