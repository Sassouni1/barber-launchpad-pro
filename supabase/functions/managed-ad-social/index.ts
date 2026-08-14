import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Action = 'getConnectUrl' | 'completeConnection' | 'listPages' | 'selectPage';
const ACTIONS: Action[] = ['getConnectUrl', 'completeConnection', 'listPages', 'selectPage'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

    // customerId is derived ONLY from the verified JWT. Never from the request body.
    const customerId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    if (!ACTIONS.includes(action)) return json({ error: 'Invalid action' }, 400);

    const brokerUrl = Deno.env.get('COMMANDIQ_FACEBOOK_PAGES_URL');
    const brokerSecret = Deno.env.get('COMMANDIQ_FACEBOOK_PAGES_SECRET');
    const appUrl = Deno.env.get('APP_URL');
    if (!brokerUrl || !brokerSecret || !appUrl) {
      return json({ error: 'Facebook connection is not configured yet.' }, 500);
    }

    const redirectUri = `${appUrl.replace(/\/$/, '')}/integrations/facebook/callback`;

    const payload: Record<string, unknown> = { action, customerId, redirectUri };
    if (action === 'completeConnection') {
      if (typeof body.code !== 'string' || body.code.length < 4) {
        return json({ error: 'Missing OAuth code' }, 400);
      }
      payload.code = body.code;
      payload.state = typeof body.state === 'string' ? body.state : undefined;
    }
    if (action === 'selectPage') {
      if (typeof body.facebookPageId !== 'string' || !body.facebookPageId) {
        return json({ error: 'Missing facebookPageId' }, 400);
      }
      payload.facebookPageId = body.facebookPageId;
    }

    const brokerRes = await fetch(brokerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-barber-launch-ads-secret': brokerSecret,
      },
      body: JSON.stringify(payload),
    });

    const brokerText = await brokerRes.text();
    let broker: any = {};
    try { broker = brokerText ? JSON.parse(brokerText) : {}; } catch { broker = { raw: brokerText }; }

    if (!brokerRes.ok) {
      return json({ error: broker?.error || 'CommandIQ broker request failed' }, brokerRes.status);
    }

    if (action === 'selectPage') {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      // Only public Page metadata is persisted here — never access tokens.
      const { error: upsertError } = await admin
        .from('ad_social_connections')
        .upsert({
          customer_id: customerId,
          provider: 'facebook',
          facebook_page_id: String(broker.facebookPageId ?? body.facebookPageId),
          facebook_page_name: broker.facebookPageName ?? null,
          instagram_business_account_id: broker.instagramBusinessAccountId ?? null,
          connection_status: 'connected',
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'customer_id' });
      if (upsertError) return json({ error: upsertError.message }, 500);
    }

    return json({ ok: true, ...broker });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
