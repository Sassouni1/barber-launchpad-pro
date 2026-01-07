import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || 'OldeEnglish.ttf';

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Uploading font:', { fileName, size: file.size, type: file.type });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to certificates bucket under fonts/
    const storagePath = `fonts/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(storagePath, uint8Array, {
        contentType: 'font/ttf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload font: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(storagePath);

    console.log('Font uploaded successfully:', urlData.publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        path: storagePath,
        url: urlData.publicUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error uploading font:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
