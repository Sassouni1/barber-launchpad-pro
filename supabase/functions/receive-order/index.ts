import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

function parseName(body: Record<string, unknown>): { firstName: string; lastName: string; fullName: string } {
  const firstName = ((body.first_name || body.firstName || '') as string).toLowerCase().trim();
  const lastName = ((body.last_name || body.lastName || '') as string).toLowerCase().trim();
  let fullName = ((body.name || body.full_name || body.Name || body.customer_name || '') as string).toLowerCase().trim();

  if (!fullName && (firstName || lastName)) {
    fullName = `${firstName} ${lastName}`.trim();
  }

  // If we have fullName but not first/last, split it
  if (fullName && !firstName && !lastName) {
    const parts = fullName.split(/\s+/);
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      fullName,
    };
  }

  return { firstName, lastName, fullName };
}

function scoreNameMatch(
  profileName: string,
  orderFirstName: string,
  orderLastName: string,
  orderFullName: string
): number {
  const pName = profileName.toLowerCase().trim();
  if (!pName || (!orderLastName && !orderFullName)) return 0;

  // Exact full name match = 100
  if (orderFullName && pName === orderFullName) return 100;

  const pParts = pName.split(/\s+/);
  const pFirst = pParts[0] || '';
  const pLast = pParts.slice(1).join(' ') || '';

  // Both first + last match (with prefix support for first name) = 80
  if (orderFirstName && orderLastName) {
    const firstMatch = pFirst.startsWith(orderFirstName) || orderFirstName.startsWith(pFirst);
    const lastMatch = pLast === orderLastName || pName.includes(orderLastName);
    if (firstMatch && lastMatch) return 80;
  }

  // Last name only match = 40 (only if last name has 2+ chars)
  if (orderLastName && orderLastName.length >= 2 && pName.includes(orderLastName)) return 40;

  return 0;
}

// Extract a stable external order ID from the GHL payload for deduplication
function extractExternalOrderId(body: Record<string, unknown>): string | null {
  const order = body.order as Record<string, unknown> | undefined;
  if (order) {
    // Try line_items[0].meta.order_id (GHL order ID)
    const lineItems = order.line_items as Array<Record<string, unknown>> | undefined;
    if (lineItems && lineItems.length > 0) {
      const meta = lineItems[0].meta as Record<string, unknown> | undefined;
      if (meta?.order_id) return String(meta.order_id);
    }
    // Fallback: use created_at + source_id
    if (order.created_at && order.source_id) {
      return `${order.source_id}_${order.created_at}`;
    }
  }
  return null;
}

// Extract the actual client name from the GHL form fields
function extractClientName(body: Record<string, unknown>): string {
  // "Client Name" is the actual end-client; full_name/name is the GHL contact (barber)
  const clientName = (body['Client Name'] || '') as string;
  if (clientName.trim()) return clientName.trim();
  // Fallback to GHL contact name
  return ((body.name || body.full_name || body.customer_name || body.Name || '') as string).trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('GHL_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');

    if (webhookSecret && providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const customerEmail = (body.email || body.customer_email || body.Email || '') as string;
    const customerName = extractClientName(body);
    const utmUserId = (body.user_id || body.userId || body.source || '') as string;
    const externalOrderId = extractExternalOrderId(body);

    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'Missing customer email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Deduplication: if we have an external order ID, check if it already exists
    if (externalOrderId) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('external_order_id', externalOrderId)
        .maybeSingle();

      if (existing) {
        console.log(`Duplicate webhook skipped: external_order_id=${externalOrderId}`);
        return new Response(JSON.stringify({ success: true, order_id: existing.id, deduplicated: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let matchedUserId: string | null = null;
    let matchMethod = 'none';

    // Priority 1: UTM user_id (direct match)
    if (utmUserId) {
      const { data: utmProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', utmUserId)
        .maybeSingle();

      if (utmProfile) {
        matchedUserId = utmProfile.id;
        matchMethod = 'utm_user_id';
      }
    }

    // Priority 2: Email fallback
    if (!matchedUserId && customerEmail) {
      const { data: emailProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail.toLowerCase().trim())
        .maybeSingle();

      if (emailProfile) {
        matchedUserId = emailProfile.id;
        matchMethod = 'email';
      }
    }

    // Priority 3: Name-based fuzzy match (using GHL contact name, not Client Name)
    if (!matchedUserId) {
      const { firstName, lastName, fullName } = parseName(body);

      if (lastName) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .not('full_name', 'is', null);

        if (profiles && profiles.length > 0) {
          const scored = profiles
            .map((p) => ({
              id: p.id,
              score: scoreNameMatch(p.full_name || '', firstName, lastName, fullName),
            }))
            .filter((s) => s.score >= 40)
            .sort((a, b) => b.score - a.score);

          console.log(`Name matching candidates: ${JSON.stringify(scored.slice(0, 5))}`);

          // Only use if exactly one top scorer (no ties)
          if (scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score)) {
            matchedUserId = scored[0].id;
            matchMethod = `name_fuzzy(score=${scored[0].score})`;
          } else if (scored.length > 1) {
            console.log(`Name match skipped: ${scored.length} tied candidates`);
          }
        }
      } else {
        console.log('Name match skipped: no last name available');
      }
    }

    console.log(`Order matching: method=${matchMethod}, user_id=${matchedUserId}, email=${customerEmail}, external_id=${externalOrderId}`);

    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert({
        user_id: matchedUserId,
        customer_email: customerEmail.toLowerCase().trim(),
        customer_name: customerName,
        order_details: body,
        status: 'pending',
        external_order_id: externalOrderId,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint violation (duplicate external_order_id race condition)
      if (insertError.code === '23505' && externalOrderId) {
        console.log(`Duplicate insert caught by constraint: external_order_id=${externalOrderId}`);
        return new Response(JSON.stringify({ success: true, deduplicated: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, order_id: order.id, match_method: matchMethod }), {
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
