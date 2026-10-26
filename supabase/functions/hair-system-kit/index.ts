import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { relayProbe } from '../_shared/barberLaunchGhlRelay.ts';

// Deliberately NO processor binding, send action or guessed GHL read action.
// Workflow activation is blocked until a real provider contract and end-to-end
// manufacturer visibility are established. Setting a DB flag cannot bypass it.
const Body = z.object({ action: z.enum(['diagnostics','dry_run']), order_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional() }).strict();
Deno.serve(async req => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return reply({ error: 'backend_unavailable' }, 503);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401);
  const userClient = createClient(url, anon);
  const { data: user, error: authError } = await userClient.auth.getUser(auth.slice(7));
  if (authError || !user.user) return reply({ error: 'unauthorized' }, 401);
  const db = createClient(url, service);
  const { data: admin, error: roleError } = await db.rpc('has_role', { _user_id: user.user.id, _role: 'admin' });
  if (roleError || admin !== true) return reply({ error: 'forbidden' }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (parsed.data.action === 'dry_run' && !parsed.data.order_id)) return reply({ error: 'invalid_request' }, 400);
  const { data: gate, error } = await db.from('hair_system_kit_activation').select('enabled,activation_cutoff').eq('singleton', true).maybeSingle();
  if (error) return reply({ active: false, reason: 'activation_state_unavailable' }, 503);
  const relay = await relayProbe();
  return reply({ active: false, configured_enabled: gate?.enabled === true, activation_cutoff: gate?.activation_cutoff ?? null,
    relay, fresh_payment_reads: 'unavailable', reason: 'verified_GHL_order_transaction_payment_read_contract_unavailable',
    writes: 0, outbound_messages: 0, order_id: parsed.data.order_id ?? null });
});