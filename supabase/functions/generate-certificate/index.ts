import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCanvas, loadImage } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default configuration
const DEFAULT_NAME_CONFIG = {
  baseFontSize: 72,
  minFontSize: 48,
  color: '#CEA77C',
};

const DEFAULT_DATE_CONFIG = {
  fontSize: 24,
  color: '#CEA77C',
};

// TTF font URL (OFL license Old English font)
const FONT_URL = 'https://github.com/AltspaceVR/UnifrakturMaguntia/raw/refs/heads/master/UnifrakturMaguntia-Book.ttf';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName } = await req.json();
    
    console.log('Generating certificate for:', { userId, courseId, certificateName });

    if (!userId || !courseId || !certificateName) {
      throw new Error('Missing required fields: userId, courseId, or certificateName');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get stored layout from database (use maybeSingle to handle missing gracefully)
    console.log('Checking for stored layout...');
    const { data: layout, error: layoutError } = await supabase
      .from('certificate_layouts')
      .select('*')
      .eq('course_id', courseId)
      .maybeSingle();

    if (layoutError) {
      console.error('Layout fetch error:', layoutError);
      throw new Error('Failed to fetch certificate layout');
    }

    if (!layout) {
      throw new Error('No certificate layout configured for this course. Please configure coordinates in admin.');
    }

    console.log('Using stored layout:', layout);

    // Fetch the certificate template
    console.log('Fetching template...');
    const templatePath = layout.template_path || 'template/certificate-template.png';
    const templateUrl = `${supabaseUrl}/storage/v1/object/public/certificates/${templatePath}`;
    
    const templateResponse = await fetch(templateUrl);
    console.log('Template fetch:', { path: templatePath, status: templateResponse.status });
    
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateResponse.status}`);
    }
    
    const templateBytes = await templateResponse.arrayBuffer();
    console.log('Template loaded:', { sizeKB: Math.round(templateBytes.byteLength / 1024) });

    // Load template and create canvas
    const templateImage = await loadImage(new Uint8Array(templateBytes));
    const width = templateImage.width();
    const height = templateImage.height();
    console.log('Template dimensions:', { width, height });

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load custom TTF font
    let fontFamily = 'serif';
    try {
      console.log('Loading font from:', FONT_URL);
      const fontResponse = await fetch(FONT_URL);
      console.log('Font response:', { 
        status: fontResponse.status, 
        contentType: fontResponse.headers.get('content-type'),
      });
      
      if (fontResponse.ok) {
        const fontData = await fontResponse.arrayBuffer();
        console.log('Font bytes loaded:', fontData.byteLength);
        canvas.loadFont(new Uint8Array(fontData), { family: 'OldEnglish' });
        fontFamily = 'OldEnglish';
        console.log('Custom font loaded successfully: OldEnglish');
      } else {
        console.warn('Font fetch failed:', fontResponse.status);
      }
    } catch (fontError) {
      console.warn('Font loading failed, using fallback serif:', fontError);
    }

    // Draw template
    ctx.drawImage(templateImage, 0, 0);
    console.log('Template drawn to canvas');

    // Format date
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Use stored coordinates
    const nameX = layout.name_x;
    const nameY = layout.name_y;
    const nameMaxWidth = layout.name_max_width;
    const dateX = layout.date_x;
    const dateY = layout.date_y;

    console.log('Using pixel coordinates:', { nameX, nameY, nameMaxWidth, dateX, dateY });

    // Draw name with auto-sizing
    ctx.fillStyle = layout.name_color || DEFAULT_NAME_CONFIG.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let fontSize = layout.name_font_size || DEFAULT_NAME_CONFIG.baseFontSize;
    const minFontSize = layout.name_min_font_size || DEFAULT_NAME_CONFIG.minFontSize;
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    
    while (ctx.measureText(certificateName).width > nameMaxWidth && fontSize > minFontSize) {
      fontSize -= 4;
      ctx.font = `${fontSize}px ${fontFamily}`;
    }
    
    console.log('Name font:', { family: fontFamily, size: fontSize });
    
    ctx.fillText(certificateName, nameX, nameY);
    console.log('Name drawn at:', { x: nameX, y: nameY });

    // Draw date - ALSO use custom font
    const dateFontSize = layout.date_font_size || DEFAULT_DATE_CONFIG.fontSize;
    ctx.font = `${dateFontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = layout.date_color || DEFAULT_DATE_CONFIG.color;
    
    ctx.fillText(formattedDate, dateX, dateY);
    console.log('Date font:', { family: fontFamily, size: dateFontSize });
    console.log('Date drawn at:', { x: dateX, y: dateY });

    // Export as PNG
    console.log('Exporting PNG...');
    const pngData = canvas.toBuffer('image/png');
    console.log('PNG exported:', { sizeKB: Math.round(pngData.length / 1024) });

    // Upload to storage
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
        fontUsed: fontFamily,
        layoutUsed: { nameX, nameY, dateX, dateY },
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
