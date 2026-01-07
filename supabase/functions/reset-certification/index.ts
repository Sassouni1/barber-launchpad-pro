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
    const { userId, courseId } = await req.json();

    console.log('Resetting certification for:', { userId, courseId });

    if (!userId || !courseId) {
      throw new Error('Missing required fields: userId or courseId');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      },
    });

    // 1. Get certification to find the certificate file
    const { data: certification } = await supabase
      .from('certifications')
      .select('certificate_url')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    // 2. Delete certification photos from storage
    const { data: photos } = await supabase
      .from('certification_photos')
      .select('file_url')
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (photos && photos.length > 0) {
      // Extract file paths from URLs
      const photoFiles = photos
        .map(p => {
          const match = p.file_url?.match(/certification-photos\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

      if (photoFiles.length > 0) {
        const { error: photoStorageError } = await supabase.storage
          .from('certification-photos')
          .remove(photoFiles);
        
        if (photoStorageError) {
          console.warn('Failed to delete some photo files:', photoStorageError);
        } else {
          console.log('Deleted photo files:', photoFiles.length);
        }
      }
    }

    // 3. Delete certificate file from storage if exists
    if (certification?.certificate_url) {
      const match = certification.certificate_url.match(/certificates\/(.+)$/);
      if (match) {
        const { error: certStorageError } = await supabase.storage
          .from('certificates')
          .remove([match[1]]);
        
        if (certStorageError) {
          console.warn('Failed to delete certificate file:', certStorageError);
        } else {
          console.log('Deleted certificate file:', match[1]);
        }
      }
    }

    // 4. Delete certification photos from database
    const { error: photosError } = await supabase
      .from('certification_photos')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (photosError) {
      console.error('Failed to delete certification photos:', photosError);
      throw new Error(`Failed to delete photos: ${photosError.message}`);
    }
    console.log('Deleted certification photos from database');

    // 5. Delete certification from database
    const { error: certError } = await supabase
      .from('certifications')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (certError) {
      console.error('Failed to delete certification:', certError);
      throw new Error(`Failed to delete certification: ${certError.message}`);
    }
    console.log('Deleted certification from database');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Certification reset successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error resetting certification:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
