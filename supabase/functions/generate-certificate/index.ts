import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCanvas, loadImage } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Text configuration for positioning
const NAME_CONFIG = {
  yPercent: 0.52,       // 52% from top (centered on certificate)
  maxWidthPercent: 0.7, // Max 70% of image width
  baseFontSize: 120,    // Starting font size
  minFontSize: 48,      // Minimum font size
  color: '#D4AF37',     // Gold color
};

const DATE_CONFIG = {
  xPercent: 0.175,      // 17.5% from left
  yPercent: 0.815,      // 81.5% from top
  fontSize: 28,
  color: '#D4AF37',     // Gold color
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName } = await req.json();
    
    console.log('Generating certificate for:', { userId, courseId, certificateName });

    if (!userId || !courseId || !certificateName) {
      throw new Error('Missing required fields: userId, courseId, or certificateName');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Fetch the certificate template
    console.log('Fetching template...');
    const templatePath = 'template/certificate-template.png';
    const templateUrl = `${supabaseUrl}/storage/v1/object/public/certificates/${templatePath}`;
    
    const templateResponse = await fetch(templateUrl);
    console.log('Template fetch:', { path: templatePath, status: templateResponse.status });
    
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateResponse.status}`);
    }
    
    const templateBytes = await templateResponse.arrayBuffer();
    console.log('Template loaded:', { sizeKB: Math.round(templateBytes.byteLength / 1024) });

    // Load template into canvas
    console.log('Loading template into canvas...');
    const templateImage = await loadImage(new Uint8Array(templateBytes));
    const width = templateImage.width();
    const height = templateImage.height();
    console.log('Template dimensions:', { width, height });

    // Create canvas at exact template dimensions
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw the template (preserves all pixels exactly)
    ctx.drawImage(templateImage, 0, 0);
    console.log('Template drawn to canvas');

    // Format the date
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Draw the name (centered, gold, script-style)
    ctx.fillStyle = NAME_CONFIG.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Auto-size font to fit
    const maxWidth = width * NAME_CONFIG.maxWidthPercent;
    let fontSize = NAME_CONFIG.baseFontSize;
    
    // Use italic serif to simulate script font (canvas has limited built-in font support)
    ctx.font = `italic bold ${fontSize}px Georgia`;
    
    while (ctx.measureText(certificateName).width > maxWidth && fontSize > NAME_CONFIG.minFontSize) {
      fontSize -= 4;
      ctx.font = `italic bold ${fontSize}px Georgia`;
    }
    
    console.log('Name font size:', fontSize);
    
    // Draw name at center
    const nameX = width / 2;
    const nameY = height * NAME_CONFIG.yPercent;
    ctx.fillText(certificateName, nameX, nameY);
    console.log('Name drawn at:', { x: nameX, y: nameY });

    // Draw the date (bottom-left, gold)
    ctx.font = `${DATE_CONFIG.fontSize}px Georgia`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DATE_CONFIG.color;
    
    const dateX = width * DATE_CONFIG.xPercent;
    const dateY = height * DATE_CONFIG.yPercent;
    ctx.fillText(formattedDate, dateX, dateY);
    console.log('Date drawn at:', { x: dateX, y: dateY });

    // Export as PNG (lossless, full quality)
    console.log('Exporting PNG...');
    const pngData = canvas.toBuffer('image/png');
    console.log('PNG exported:', { sizeKB: Math.round(pngData.length / 1024) });

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const fileName = `${userId}/${courseId}/${timestamp}.png`;
    
    console.log('Uploading to storage:', fileName);
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, pngData, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload certificate: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);
    
    const certificateUrl = urlData.publicUrl;
    console.log('Certificate uploaded to:', certificateUrl);

    // Save certification record
    const { data: certData, error: certError } = await supabase
      .from('certifications')
      .upsert({
        user_id: userId,
        course_id: courseId,
        certificate_name: certificateName,
        certificate_url: certificateUrl,
        issued_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,course_id',
      })
      .select()
      .single();

    if (certError) {
      console.error('Certification save error:', certError);
      throw new Error(`Failed to save certification: ${certError.message}`);
    }

    console.log('Certification saved:', certData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        certificateUrl,
        dimensions: { width, height },
        message: 'Certificate generated with canvas rendering'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating certificate:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Certificate generation failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
