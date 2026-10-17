import { lookupZip } from './lookup.ts';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { zip } = await req.json();
    const result = await lookupZip(zip);
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('ZIP lookup failed:', err instanceof Error ? err.message : 'Unknown error');
    return new Response(JSON.stringify({ error: 'ZIP lookup is temporarily unavailable. Your ZIP may be valid; please try again.' }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
