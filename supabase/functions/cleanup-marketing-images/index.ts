import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find images older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: oldImages, error: fetchError } = await supabase
      .from('marketing_images')
      .select('id, storage_path')
      .lt('created_at', cutoff);

    if (fetchError) throw fetchError;
    if (!oldImages || oldImages.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Delete from storage
    const paths = oldImages.map(img => img.storage_path);
    await supabase.storage.from('marketing-images').remove(paths);

    // Delete from DB
    const ids = oldImages.map(img => img.id);
    await supabase.from('marketing_images').delete().in('id', ids);

    console.log(`Cleaned up ${oldImages.length} marketing images`);
    return new Response(
      JSON.stringify({ deleted: oldImages.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
