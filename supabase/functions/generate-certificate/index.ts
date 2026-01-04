import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName } = await req.json();

    console.log('Generating certificate for:', { userId, courseId, certificateName });

    if (!userId || !courseId || !certificateName) {
      throw new Error('Missing required fields: userId, courseId, or certificateName');
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the certificate template from storage or use base64 embedded template
    // For now, we'll generate a simple certificate using canvas
    
    // Create certificate image using canvas (Deno compatible approach)
    // We'll use a simple SVG-based approach that can be converted to PNG
    
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create SVG certificate
    const svgContent = `
      <svg width="1200" height="850" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#D4AF37;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#F4D03F;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#D4AF37;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
          </linearGradient>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&amp;family=Playfair+Display:wght@400;700&amp;display=swap');
          </style>
        </defs>
        
        <!-- Background -->
        <rect width="1200" height="850" fill="url(#bgGradient)"/>
        
        <!-- Decorative border -->
        <rect x="20" y="20" width="1160" height="810" fill="none" stroke="url(#goldGradient)" stroke-width="3"/>
        <rect x="35" y="35" width="1130" height="780" fill="none" stroke="url(#goldGradient)" stroke-width="1"/>
        
        <!-- Corner decorations -->
        <circle cx="50" cy="50" r="8" fill="url(#goldGradient)"/>
        <circle cx="1150" cy="50" r="8" fill="url(#goldGradient)"/>
        <circle cx="50" cy="800" r="8" fill="url(#goldGradient)"/>
        <circle cx="1150" cy="800" r="8" fill="url(#goldGradient)"/>
        
        <!-- Certificate title -->
        <text x="600" y="120" text-anchor="middle" font-family="Playfair Display, serif" font-size="48" font-weight="700" fill="url(#goldGradient)">
          CERTIFICATE
        </text>
        <text x="600" y="170" text-anchor="middle" font-family="Playfair Display, serif" font-size="28" fill="#C9A962">
          OF ACHIEVEMENT
        </text>
        
        <!-- Decorative line -->
        <line x1="300" y1="200" x2="900" y2="200" stroke="url(#goldGradient)" stroke-width="2"/>
        
        <!-- Presented to text -->
        <text x="600" y="280" text-anchor="middle" font-family="Playfair Display, serif" font-size="22" fill="#888888">
          This Certificate is Proudly Presented to
        </text>
        
        <!-- Name -->
        <text x="600" y="380" text-anchor="middle" font-family="Dancing Script, cursive" font-size="72" font-weight="700" fill="url(#goldGradient)">
          ${certificateName}
        </text>
        
        <!-- Decorative flourish under name -->
        <path d="M400 410 Q600 450 800 410" fill="none" stroke="url(#goldGradient)" stroke-width="2"/>
        
        <!-- Achievement text -->
        <text x="600" y="490" text-anchor="middle" font-family="Playfair Display, serif" font-size="20" fill="#cccccc">
          For successfully completing the
        </text>
        <text x="600" y="540" text-anchor="middle" font-family="Playfair Display, serif" font-size="32" font-weight="700" fill="url(#goldGradient)">
          Hair System Mastery Training
        </text>
        <text x="600" y="590" text-anchor="middle" font-family="Playfair Display, serif" font-size="20" fill="#cccccc">
          demonstrating exceptional skill and knowledge in hair system application
        </text>
        
        <!-- Date -->
        <text x="600" y="680" text-anchor="middle" font-family="Playfair Display, serif" font-size="18" fill="#888888">
          Issued on ${currentDate}
        </text>
        
        <!-- Seal/Badge -->
        <circle cx="600" cy="760" r="35" fill="none" stroke="url(#goldGradient)" stroke-width="3"/>
        <text x="600" y="768" text-anchor="middle" font-family="Playfair Display, serif" font-size="14" font-weight="700" fill="url(#goldGradient)">
          CERTIFIED
        </text>
      </svg>
    `;

    // Convert SVG to PNG using a simple approach
    // For production, you might want to use a proper image generation service
    // For now, we'll store the SVG and reference it

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `${userId}/${courseId}/${timestamp}.svg`;

    // Upload SVG to storage
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, svgBlob, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload certificate: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    console.log('Certificate uploaded to:', publicUrl);

    // Save certification to database
    const { data: certification, error: dbError } = await supabase
      .from('certifications')
      .upsert({
        user_id: userId,
        course_id: courseId,
        certificate_name: certificateName,
        certificate_url: publicUrl,
        issued_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,course_id',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save certification: ${dbError.message}`);
    }

    console.log('Certification saved:', certification);

    return new Response(
      JSON.stringify({
        success: true,
        certificateUrl: publicUrl,
        certification,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating certificate:', errorMessage);
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
