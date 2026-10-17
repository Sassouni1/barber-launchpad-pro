export async function lookupZip(zip: unknown, request: typeof fetch = fetch) {
  if (typeof zip !== 'string' || !/^\d{5}$/.test(zip.trim())) {
    return { status: 400, body: { error: 'Enter a valid 5-digit ZIP code' } };
  }
  const normalized = zip.trim();
  const response = await request(`https://api.zippopotam.us/us/${normalized}`, { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return { status: 404, body: { error: 'ZIP code not found. Please check your ZIP code.' } };
  if (!response.ok) throw new Error('ZIP lookup unavailable');
  const data = await response.json();
  const place = data.places?.[0];
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!place || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('ZIP lookup unavailable');
  }
  return { status: 200, body: { latitude, longitude, display_name: `${place['place name']}, ${place['state abbreviation']}, ${normalized}, United States` } };
}