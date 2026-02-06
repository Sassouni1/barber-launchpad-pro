import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = Deno.env.get('GHL_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');

    if (webhookSecret && providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const customerEmail = body.email || body.customer_email || body.Email || '';
    const customerName = body.name || body.customer_name || body.full_name || body.Name || '';

    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'Missing customer email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail.toLowerCase().trim())
      .maybeSingle();

    // Insert order
    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert({
        user_id: profile?.id || null,
        customer_email: customerEmail.toLowerCase().trim(),
        customer_name: customerName,
        order_details: body,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, order_id: order.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
