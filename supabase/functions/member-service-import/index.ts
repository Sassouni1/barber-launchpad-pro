// Imports a member's services and prices from the booking page they saved in business setup.
// Same pipeline as Vlix onboarding: Vlix profile-research "import" (through the signed
// Barber Launch bridge), then Vlix's direct booking-page price pass (copied in ./vlix).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { enrichServicePrices } from './vlix/service-price-import.ts';
import { parseServicePrice, servicePriceLabel } from './vlix/service-price.ts';
import type { ImportedService } from './vlix/model.ts';
import { requireMemberContentAccess } from "../_shared/memberGate.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const bridgeUrl = 'https://jbnsjjeimwpkwxkwmqwl.supabase.co/functions/v1/barber-launch-booking-bridge';

const minutesLabel = (value: string) => {
  const total = Number(value);
  if (!Number.isFinite(total) || total <= 0) return value.trim().slice(0, 40);
  const hours = Math.floor(total / 60), mins = total % 60;
  return hours ? `${hours} hr${mins ? ` ${mins} min` : ''}` : `${mins} min`;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  // Member-only: verified purchase / admin grant, or pre-cutover account while the full check is off.
  const memberGate = await requireMemberContentAccess(request, cors);
  if (!memberGate.ok) return memberGate.response;
  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Please sign in.' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false }, global: { headers: { Authorization: authorization } },
    });
    const { data: auth, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return json({ error: 'Please sign in again.' }, 401);
    const { data: profile, error: profileError } = await db.from('member_onboarding_profiles')
      .select('booking_url').eq('user_id', auth.user.id).maybeSingle();
    if (profileError) return json({ error: 'Could not read your member profile.' }, 502);
    const bookingUrl = String(profile?.booking_url || '').trim();
    if (!bookingUrl) return json({ error: 'Save your booking page first.' }, 400);

    // Step 1: Vlix import (research) through the signed bridge.
    let found: ImportedService[] = [];
    let importWarning = '';
    try {
      const response = await fetch(bridgeUrl, {
        method: 'POST', signal: AbortSignal.timeout(150000),
        headers: { 'Content-Type': 'application/json', Authorization: authorization },
        body: JSON.stringify({ action: 'import_services' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) importWarning = String(result?.error || 'Vlix import did not finish.');
      else found = (Array.isArray(result?.services) ? result.services : []).map((service: Record<string, unknown>) => ({
        name: String(service.name || ''), description: String(service.description || ''),
        duration: String(service.duration || ''), source: String(service.source || bookingUrl),
        ...parseServicePrice(String(service.price || '')),
      }));
    } catch {
      importWarning = 'Vlix import did not finish.';
    }

    // Step 2: Vlix's direct price pass on the booking page (also recovers services the import missed).
    const audit = { checked: [] as string[], failed: [] as string[] };
    const priced = await enrichServicePrices(found, [bookingUrl], audit);
    const services = priced.slice(0, 60).map(service => ({
      name: service.name.slice(0, 120),
      price: (service.versions?.length ? servicePriceLabel(service.versions[0]) : servicePriceLabel(service))
        .replace('Price not found', '').slice(0, 40),
      duration: minutesLabel(service.duration || ''),
      description: (service.description || '').trim().slice(0, 207).trimEnd(),
    })).filter(service => service.name.trim());

    console.info('member service import', JSON.stringify({
      memberId: auth.user.id, imported: found.length, services: services.length,
      checked: audit.checked.length, failed: audit.failed.length, importWarning: !!importWarning,
    }));
    return json({ services, source: bookingUrl, warning: services.length ? '' : importWarning });
  } catch {
    return json({ error: 'Could not read your booking page. Please try again.' }, 502);
  }
});
