import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GRAPH = 'https://graph.facebook.com/v19.0';
const SCOPES = 'pages_show_list,pages_read_engagement';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Action = 'getConnectUrl' | 'completeConnection' | 'listPages' | 'selectPage' | 'syncPage' | 'skipInstagram';
const ACTIONS: Action[] = ['getConnectUrl', 'completeConnection', 'listPages', 'selectPage', 'syncPage', 'skipInstagram'];


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

    // customerId comes ONLY from the verified JWT — never from the request body.
    const customerId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    if (!ACTIONS.includes(action)) return json({ error: 'Invalid action' }, 400);

    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) {
      return json({ error: 'Facebook connection is not configured yet.' }, 500);
    }
    // Must match the URI whitelisted in the Facebook app exactly.
    const redirectUri = 'https://member.thebarberlaunch.com/integrations/facebook/callback';

    // Service-role client: tokens live in a table with no anon/authenticated grants.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const fetchPages = async (userToken: string) => {
      const res = await fetch(
        `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id}&limit=100&access_token=${encodeURIComponent(userToken)}`,
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message || 'Facebook Page lookup failed');
      return (payload.data ?? []) as Array<{
        id: string;
        name: string;
        access_token?: string;
        instagram_business_account?: { id: string };
      }>;
    };

    if (action === 'getConnectUrl') {
      const state = crypto.randomUUID();
      await admin.from('ad_social_tokens').upsert(
        {
          customer_id: customerId,
          provider: 'facebook',
          scopes: SCOPES,
          oauth_state: state,
          oauth_state_created_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id' },
      );
      await admin.from('ad_social_connections').upsert(
        { customer_id: customerId, provider: 'facebook' },
        { onConflict: 'customer_id', ignoreDuplicates: true },
      );
      const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=${encodeURIComponent(SCOPES)}`;
      return json({ ok: true, url, state });
    }

    if (action === 'skipInstagram') {
      // Owner-scoped: customerId always comes from the verified JWT.
      const { error: skipError } = await admin
        .from('ad_social_connections')
        .update({ instagram_skipped_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .is('instagram_business_account_id', null);
      if (skipError) return json({ error: skipError.message }, 500);
      return json({ ok: true });
    }



    if (action === 'completeConnection') {
      const code = body?.code;
      if (typeof code !== 'string' || code.length < 4) return json({ error: 'Missing OAuth code' }, 400);

      // The state must be the one we issued to THIS authenticated member, and still fresh (30 min).
      const { data: pending } = await admin
        .from('ad_social_tokens')
        .select('oauth_state, oauth_state_created_at')
        .eq('customer_id', customerId)
        .maybeSingle();
      const state = typeof body?.state === 'string' ? body.state : '';
      const issuedAt = pending?.oauth_state_created_at ? Date.parse(pending.oauth_state_created_at) : 0;
      if (!pending?.oauth_state || !state || state !== pending.oauth_state) {
        return json({ error: 'This Facebook connection link is no longer valid. Please start the connection again.' }, 400);
      }
      if (!issuedAt || Date.now() - issuedAt > 30 * 60 * 1000) {
        return json({ error: 'This Facebook connection link expired. Please start the connection again.' }, 400);
      }

      const tokenRes = await fetch(
        `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
      );
      const tokenPayload = await tokenRes.json();
      if (!tokenRes.ok || !tokenPayload?.access_token) {
        await admin.from('ad_social_connections').upsert(
          { customer_id: customerId, provider: 'facebook', connection_status: 'error' },
          { onConflict: 'customer_id' },
        );
        return json({ error: tokenPayload?.error?.message || 'Facebook token exchange failed' }, 400);
      }

      // Upgrade to a long-lived user token when possible.
      let userToken: string = tokenPayload.access_token;
      let expiresIn: number | null = tokenPayload.expires_in ?? null;
      const longRes = await fetch(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userToken)}`,
      );
      const longPayload = await longRes.json().catch(() => null);
      if (longRes.ok && longPayload?.access_token) {
        userToken = longPayload.access_token;
        expiresIn = longPayload.expires_in ?? expiresIn;
      }

      await admin.from('ad_social_tokens').upsert(
        {
          customer_id: customerId,
          provider: 'facebook',
          user_access_token: userToken,
          user_token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
          scopes: SCOPES,
          // One-time use: the state cannot be replayed.
          oauth_state: null,
          oauth_state_created_at: null,
        },
        { onConflict: 'customer_id' },
      );

      const pages = await fetchPages(userToken);
      // Only public Page metadata is returned to the browser — never tokens.
      return json({
        ok: true,
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          instagram_business_account_id: p.instagram_business_account?.id ?? null,
        })),
      });
    }

    const { data: stored } = await admin
      .from('ad_social_tokens')
      .select('user_access_token')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!stored?.user_access_token) {
      await admin.from('ad_social_connections').upsert(
        { customer_id: customerId, provider: 'facebook', connection_status: 'reauth_required' },
        { onConflict: 'customer_id' },
      );
      return json({ error: 'Facebook connection required', reauth: true }, 401);
    }

    let pages: Awaited<ReturnType<typeof fetchPages>>;
    try {
      pages = await fetchPages(stored.user_access_token);
    } catch (e) {
      await admin.from('ad_social_connections').upsert(
        { customer_id: customerId, provider: 'facebook', connection_status: 'reauth_required' },
        { onConflict: 'customer_id' },
      );
      return json({ error: e instanceof Error ? e.message : 'Facebook lookup failed', reauth: true }, 401);
    }

    if (action === 'listPages') {
      return json({
        ok: true,
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          instagram_business_account_id: p.instagram_business_account?.id ?? null,
        })),
      });
    }

    if (action === 'syncPage') {
      const { data: connection } = await admin
        .from('ad_social_connections')
        .select('facebook_page_id')
        .eq('customer_id', customerId)
        .maybeSingle();
      if (!connection?.facebook_page_id) {
        return json({ error: 'No Facebook Page is selected yet. Connect a Page first.' }, 400);
      }
      const selected = pages.find((p) => p.id === connection.facebook_page_id);
      if (!selected) {
        return json({ error: 'Your selected Page is no longer available on your Facebook account.' }, 404);
      }
      const instagramId = selected.instagram_business_account?.id ?? null;
      const { error: syncError } = await admin
        .from('ad_social_connections')
        .update({
          facebook_page_name: selected.name,
          instagram_business_account_id: instagramId,
          // Connecting an Instagram account clears any earlier "skip" decision.
          ...(instagramId ? { instagram_skipped_at: null } : {}),
          last_synced_at: new Date().toISOString(),
        })

        .eq('customer_id', customerId);
      if (syncError) return json({ error: syncError.message }, 500);
      return json({
        ok: true,
        page: { id: selected.id, name: selected.name, instagram_business_account_id: instagramId },
      });
    }


    // selectPage — the Page must belong to this member's own Facebook account.
    const pageId = body?.facebookPageId;
    if (typeof pageId !== 'string' || !pageId) return json({ error: 'Missing facebookPageId' }, 400);
    const page = pages.find((p) => p.id === pageId);
    if (!page) return json({ error: 'That Page is not available on your Facebook account.' }, 403);

    if (page.access_token) {
      await admin
        .from('ad_social_tokens')
        .update({ page_access_token: page.access_token, facebook_page_id: page.id })
        .eq('customer_id', customerId);
    }

    const { error: upsertError } = await admin.from('ad_social_connections').upsert(
      {
        customer_id: customerId,
        provider: 'facebook',
        facebook_page_id: page.id,
        facebook_page_name: page.name,
        instagram_business_account_id: page.instagram_business_account?.id ?? null,
        connection_status: 'connected',
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id' },
    );
    if (upsertError) return json({ error: upsertError.message }, 500);

    return json({
      ok: true,
      facebookPageId: page.id,
      facebookPageName: page.name,
      instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
