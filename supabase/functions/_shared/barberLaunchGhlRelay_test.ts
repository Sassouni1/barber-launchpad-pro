import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { __setRelayFetch, ghlOrderContact, RELAY_LOCATION_ID } from './barberLaunchGhlRelay.ts';

Deno.test('linked GHL contact phone is read only from the expected location', async () => {
  const previous = Deno.env.get('GHL_API_KEY');
  Deno.env.set('GHL_API_KEY', 'fixture-key');
  const id = 'WYSQw4kAYQxVIDtxit0w';
  try {
    __setRelayFetch((async (url: string | URL | Request, init?: RequestInit) => {
      assertEquals(String(url), `https://services.leadconnectorhq.com/contacts/${id}`);
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer fixture-key');
      return Response.json({ contact: { id, locationId: RELAY_LOCATION_ID, phone: '+13255550101', email: 'Buyer@example.com' } });
    }) as typeof fetch);
    assertEquals(await ghlOrderContact(id), { phone: '+13255550101', email: 'buyer@example.com' });
    __setRelayFetch((async () => Response.json({ contact: { id, locationId: 'wrong-location', phone: '+13255550101', email: 'buyer@example.com' } })) as typeof fetch);
    await assertRejects(() => ghlOrderContact(id), Error, 'ghl_contact_location_mismatch');
  } finally {
    __setRelayFetch(fetch);
    if (previous === undefined) Deno.env.delete('GHL_API_KEY'); else Deno.env.set('GHL_API_KEY', previous);
  }
});
