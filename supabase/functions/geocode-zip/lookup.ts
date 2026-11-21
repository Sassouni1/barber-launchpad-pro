type Coordinates = { latitude: number; longitude: number; display_name: string };

const validCoords = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Primary: Zippopotam. null = not found (404); throws when the provider is unavailable. */
async function zippopotam(zip: string, request: typeof fetch): Promise<Coordinates | null> {
  const response = await request(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) { await response.body?.cancel(); return null; }
  if (!response.ok) { await response.body?.cancel(); throw new Error('ZIP lookup unavailable'); }
  const data = await response.json();
  const place = data.places?.[0];
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!place || !validCoords(latitude, longitude)) throw new Error('ZIP lookup unavailable');
  return { latitude, longitude, display_name: `${place['place name']}, ${place['state abbreviation']}, ${zip}, United States` };
}

/** Fallback: OpenStreetMap Nominatim, US postal codes only. null = no exact match; throws when unavailable. */
async function nominatim(zip: string, request: typeof fetch): Promise<Coordinates | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&countrycodes=us&format=jsonv2&addressdetails=1&limit=5`;
  const response = await request(url, {
    headers: { 'User-Agent': 'BarberLaunch-SpecialistDirectory/1.0 (find.menshairexpert.com)', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('ZIP fallback unavailable'); }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('ZIP fallback unavailable');
  const match = rows.find((r) =>
    r?.address?.country_code === 'us' && String(r?.address?.postcode ?? '').slice(0, 5) === zip && validCoords(Number(r.lat), Number(r.lon)));
  if (!match) return null;
  const place = match.address.city || match.address.town || match.address.village || match.address.hamlet || match.address.county || '';
  const state = match.address['ISO3166-2-lvl4']?.replace(/^US-/, '') || match.address.state || '';
  return {
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    display_name: [place, state, zip, 'United States'].filter(Boolean).join(', '),
  };
}

export async function lookupZip(zip: unknown, request: typeof fetch = fetch) {
  if (typeof zip !== 'string' || !/^\d{5}$/.test(zip.trim())) {
    return { status: 400, body: { error: 'Enter a valid 5-digit ZIP code' } };
  }
  const normalized = zip.trim();

  let primary: Coordinates | null = null;
  let primaryFailed = false;
  try {
    primary = await zippopotam(normalized, request);
  } catch {
    primaryFailed = true;
  }
  if (primary) return { status: 200, body: primary };

  // Primary missed (not found) or was unavailable: try the fallback once.
  try {
    const fallback = await nominatim(normalized, request);
    if (fallback) return { status: 200, body: fallback };
  } catch {
    if (primaryFailed) throw new Error('ZIP lookup unavailable');
  }
  if (primaryFailed) throw new Error('ZIP lookup unavailable');
  return { status: 404, body: { error: 'ZIP code not found. Please check your ZIP code.' } };
}
