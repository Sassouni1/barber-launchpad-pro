import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Action = 'listCampaigns' | 'createCampaign' | 'setDesiredStatus';
const ACTIONS: Action[] = ['listCampaigns', 'createCampaign', 'setDesiredStatus'];

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (action === 'listCampaigns') {
      const { data, error } = await admin
        .from('ad_campaigns')
        .select('id,name,status,desired_status,daily_budget_cents,funded_cents,spent_cents,currency,landing_page_url,created_at')
        .eq('customer_id', customerId)
        .eq('member_visible', true)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ campaigns: data ?? [] });
    }

    if (action === 'createCampaign') {
      const { data: template } = await admin
        .from('ad_campaign_templates')
        .select('id,name,objective,meta_ad_account_id,default_daily_budget_cents')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!template) {
        return json({ error: 'No active Barber Launch campaign template is configured' }, 409);
      }

      const requested = Number(body?.daily_budget_cents ?? template.default_daily_budget_cents);
      const dailyBudget = Number.isFinite(requested) ? Math.round(requested) : 0;
      if (dailyBudget < 1000) {
        return json({ error: 'Daily budget must be at least $10.00 per day.' }, 400);
      }

      const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : template.name;

      const { data, error } = await admin
        .from('ad_campaigns')
        .insert({
          customer_id: customerId,
          name,
          objective: template.objective,
          meta_ad_account_id: template.meta_ad_account_id,
          daily_budget_cents: dailyBudget,
          status: 'payment_required',
          desired_status: 'paused',
          member_visible: true,
        })
        .select('id,name,status,desired_status,daily_budget_cents,funded_cents,spent_cents')
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ campaign: data });
    }

    // setDesiredStatus — intent only, no Meta call. Unfunded campaigns can never go active.
    const campaignId = String(body?.campaign_id ?? '');
    const desired = body?.desired_status === 'active' ? 'active' : 'paused';
    if (!campaignId) return json({ error: 'campaign_id is required' }, 400);

    const { data: campaign, error: loadError } = await admin
      .from('ad_campaigns')
      .select('id,funded_cents,spent_cents,status')
      .eq('id', campaignId)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (loadError) return json({ error: loadError.message }, 400);
    if (!campaign) return json({ error: 'Campaign not found' }, 404);

    const balance = (campaign.funded_cents ?? 0) - (campaign.spent_cents ?? 0);
    if (desired === 'active' && balance <= 0) {
      return json({ error: 'This campaign has no media balance, so it cannot be turned on.' }, 402);
    }

    const { data, error } = await admin
      .from('ad_campaigns')
      .update({
        desired_status: desired,
        paused_at: desired === 'paused' ? new Date().toISOString() : null,
      })
      .eq('id', campaignId)
      .eq('customer_id', customerId)
      .select('id,desired_status,status')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ campaign: data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
