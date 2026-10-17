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