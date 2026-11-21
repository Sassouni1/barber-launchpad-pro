import { test, expect } from 'bun:test';
import { lookupZip } from '../supabase/functions/geocode-zip/lookup';

test('Sierra ZIP 84045 resolves to Saratoga Springs, Utah', async () => {
  const mock = (async (url: string) => {
    expect(url).toBe('https://api.zippopotam.us/us/84045');
    return Response.json({ places: [{ latitude: '40.3495', longitude: '-111.9043', 'place name': 'Saratoga Springs', 'state abbreviation': 'UT' }] });
  }) as typeof fetch;
  const result = await lookupZip('84045', mock);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ latitude: 40.3495, longitude: -111.9043 });
});

test('malformed ZIP is refused before lookup', async () => {
  const result = await lookupZip('8404', (() => { throw new Error('Must not fetch'); }) as typeof fetch);
  expect(result.status).toBe(400);
});

test('provider denial is not treated as an invalid ZIP', async () => {
  await expect(lookupZip('84045', (async () => new Response('Access denied', { status: 403 })) as typeof fetch)).rejects.toThrow('ZIP lookup unavailable');
});

test('unknown ZIP returns not found', async () => {
  const result = await lookupZip('00000', (async () => new Response('', { status: 404 })) as typeof fetch);
  expect(result.status).toBe(404);
});
const nominatimRow = (zip: string) => [{ lat: '38.93', lon: '-77.17', address: { postcode: zip, country_code: 'us', town: 'McLean', 'ISO3166-2-lvl4': 'US-VA' } }];

test('valid ZIP the primary provider misses is resolved by the US-only fallback', async () => {
  const seen: string[] = [];
  const mock = (async (url: string) => {
    seen.push(url);
    if (url.includes('zippopotam')) return new Response('', { status: 404 });
    expect(url).toContain('postalcode=22101');
    expect(url).toContain('countrycodes=us');
    return Response.json(nominatimRow('22101'));
  }) as typeof fetch;
  const result = await lookupZip('22101', mock);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ latitude: 38.93, longitude: -77.17, display_name: 'McLean, VA, 22101, United States' });
  expect(seen.length).toBe(2);
});

test('primary outage falls back; both down is a retryable outage, never "not found"', async () => {
  const fallbackOk = (async (url: string) => url.includes('zippopotam') ? new Response('', { status: 503 }) : Response.json(nominatimRow('22101'))) as typeof fetch;
  expect((await lookupZip('22101', fallbackOk)).status).toBe(200);
  const bothDown = (async (url: string) => { if (url.includes('zippopotam')) throw new Error('timeout'); return new Response('', { status: 503 }); }) as typeof fetch;
  await expect(lookupZip('22101', bothDown)).rejects.toThrow('ZIP lookup unavailable');
});

test('fallback ignores non-matching postcodes', async () => {
  const mock = (async (url: string) => url.includes('zippopotam') ? new Response('', { status: 404 }) : Response.json(nominatimRow('22102'))) as typeof fetch;
  expect((await lookupZip('22101', mock)).status).toBe(404);
});

test('primary success never calls the fallback', async () => {
  const mock = (async (url: string) => {
    if (!url.includes('zippopotam')) throw new Error('fallback must not be called');
    return Response.json({ places: [{ latitude: '38.9326', longitude: '-77.1706', 'place name': 'Mc Lean', 'state abbreviation': 'VA' }] });
  }) as typeof fetch;
  expect((await lookupZip('22101', mock)).status).toBe(200);
});
