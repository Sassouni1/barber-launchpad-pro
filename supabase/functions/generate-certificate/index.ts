import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCanvas, loadImage } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default configuration (used only if no AI-detected layout exists)
const DEFAULT_NAME_CONFIG = {
  baseFontSize: 72,
  minFontSize: 48,
  color: '#C9A227',
};

const DEFAULT_DATE_CONFIG = {
  fontSize: 24,
  color: '#C9A227',
};

// Font for certificate name
const FONT_URL = 'https://fonts.gstatic.com/s/unifrakturmaguntia/v20/WWXPlieVYwiGNomYU-ciRLRvEmGZZ.woff2';

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

    // Try to get AI-detected layout from database
    console.log('Checking for stored layout...');
    const { data: storedLayout, error: layoutError } = await supabase
      .from('certificate_layouts')
      .select('*')
      .eq('course_id', courseId)
      .single();

    let layout = storedLayout;

    // If no layout exists, call AI to analyze the template
    if (!layout || layoutError) {
      console.log('No stored layout found, calling AI to analyze template...');
      
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY is not configured');
      }

      // Get template URL
      const templatePath = 'template/certificate-template.png';
      const { data: templateUrlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(templatePath);

      if (!templateUrlData?.publicUrl) {
        throw new Error('Could not get template URL');
      }

      console.log('Calling AI vision to analyze template...');
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this certificate template image. I need EXACT pixel coordinates for placing:
1. The recipient's NAME - in the blank area designated for the name
2. The DATE - in the date field area

Return ONLY a JSON object with these exact fields:
{
  "name_x": <center X coordinate in pixels for name>,
  "name_y": <Y coordinate in pixels for name>,
  "name_max_width": <max width in pixels for name>,
  "date_x": <X coordinate in pixels for date>,
  "date_y": <Y coordinate in pixels for date>
}

Be precise - look for blank lines, underscores, or designated areas for text placement.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: templateUrlData.publicUrl
                  }
                }
              ]
            }
          ]
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        throw new Error(`AI analysis failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      console.log('AI response:', content);

      // Parse JSON from AI response
      let detectedLayout;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          detectedLayout = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON in response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        throw new Error('Failed to parse AI layout detection');
      }

      console.log('AI detected layout:', detectedLayout);

      // Store the detected layout for future use
      const { error: insertError } = await supabase
        .from('certificate_layouts')
        .upsert({
          course_id: courseId,
          name_x: Math.round(detectedLayout.name_x),
          name_y: Math.round(detectedLayout.name_y),
          name_max_width: Math.round(detectedLayout.name_max_width),
          date_x: Math.round(detectedLayout.date_x),
          date_y: Math.round(detectedLayout.date_y),
          name_font_size: DEFAULT_NAME_CONFIG.baseFontSize,
          name_min_font_size: DEFAULT_NAME_CONFIG.minFontSize,
          name_color: DEFAULT_NAME_CONFIG.color,
          date_font_size: DEFAULT_DATE_CONFIG.fontSize,
          date_color: DEFAULT_DATE_CONFIG.color,
        }, {
          onConflict: 'course_id'
        });

      if (insertError) {
        console.warn('Failed to store layout, continuing anyway:', insertError);
      } else {
        console.log('Stored AI-detected layout for future use');
      }

      layout = {
        name_x: Math.round(detectedLayout.name_x),
        name_y: Math.round(detectedLayout.name_y),
        name_max_width: Math.round(detectedLayout.name_max_width),
        date_x: Math.round(detectedLayout.date_x),
        date_y: Math.round(detectedLayout.date_y),
        name_font_size: DEFAULT_NAME_CONFIG.baseFontSize,
        name_min_font_size: DEFAULT_NAME_CONFIG.minFontSize,
        name_color: DEFAULT_NAME_CONFIG.color,
        date_font_size: DEFAULT_DATE_CONFIG.fontSize,
        date_color: DEFAULT_DATE_CONFIG.color,
      };
    } else {
      console.log('Using stored layout:', layout);
    }

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

    // Try to load custom font
    let fontFamily = 'serif';
    try {
      const fontResponse = await fetch(FONT_URL);
      if (fontResponse.ok) {
        const fontData = await fontResponse.arrayBuffer();
        canvas.loadFont(new Uint8Array(fontData), { family: 'UnifrakturMaguntia' });
        fontFamily = 'UnifrakturMaguntia';
        console.log('Custom font loaded');
      }
    } catch (fontError) {
      console.warn('Font loading failed, using fallback:', fontError);
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

    // Use AI-detected coordinates (exact pixels, not percentages!)
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
    console.log('Name drawn at exact pixel:', { x: nameX, y: nameY });

    // Draw date
    ctx.font = `${layout.date_font_size || DEFAULT_DATE_CONFIG.fontSize}px Georgia`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = layout.date_color || DEFAULT_DATE_CONFIG.color;
    
    ctx.fillText(formattedDate, dateX, dateY);
    console.log('Date drawn at exact pixel:', { x: dateX, y: dateY });

    // Export as high-quality PNG
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
        layoutUsed: {
          nameX,
          nameY,
          dateX,
          dateY,
          source: storedLayout ? 'database' : 'ai-detected'
        },
        message: 'Certificate generated with AI-detected coordinates'
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
