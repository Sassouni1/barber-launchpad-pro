export function formatServiceCity(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned !== cleaned.toLocaleUpperCase('en-US')) return cleaned;

  return cleaned
    .toLocaleLowerCase('en-US')
    .replace(/(^|[\s,.'’-])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('en-US'))
    .replace(/,\s*([A-Za-z]{2})$/, (_, state: string) => `, ${state.toUpperCase()}`);
}
