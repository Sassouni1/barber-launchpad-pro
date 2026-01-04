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

// Font will be fetched from Supabase storage (uploaded by admin)
const FONT_PATH = 'fonts/OldeEnglish.ttf';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName, debug = false } = await req.json();
    
    console.log('Generating certificate for:', { userId, courseId, certificateName, debug });

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

    // Load custom TTF font from Supabase storage
    let fontFamily = 'serif';
    try {
      const fontUrl = `${supabaseUrl}/storage/v1/object/public/certificates/${FONT_PATH}`;
      console.log('Loading font from:', fontUrl);
      const fontResponse = await fetch(fontUrl);
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
    // Use LEFT align and manually center - DO NOT rely on textAlign='center'
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    let fontSize = layout.name_font_size || DEFAULT_NAME_CONFIG.baseFontSize;
    const minFontSize = layout.name_min_font_size || DEFAULT_NAME_CONFIG.minFontSize;
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    
    while (ctx.measureText(certificateName).width > nameMaxWidth && fontSize > minFontSize) {
      fontSize -= 4;
      ctx.font = `${fontSize}px ${fontFamily}`;
    }
    
    // Measure final text width
    const measuredTextWidth = ctx.measureText(certificateName).width;
    
    // MANUAL CENTERING: Calculate where to start drawing so text is centered on nameX
    const drawX = nameX - measuredTextWidth / 2;
    const textLeftEdge = drawX;
    const textRightEdge = drawX + measuredTextWidth;
    const imageCenterX = width / 2;

    // PIXEL DEBUG LOGGING (always log)
    console.log('=== PIXEL DEBUG START ===');
    console.log(`Template dimensions: ${width} x ${height}`);
    console.log(`Image center X: ${imageCenterX}`);
    console.log(`layout.name_x (target center): ${nameX}`);
    console.log(`layout.name_y: ${nameY}`);
    console.log(`Measured text width: ${Math.round(measuredTextWidth)}px`);
    console.log(`drawX (start position): ${Math.round(drawX)}`);
    console.log(`Text LEFT edge: ${Math.round(textLeftEdge)}`);
    console.log(`Text RIGHT edge: ${Math.round(textRightEdge)}`);
    console.log(`Text CENTER: ${Math.round((textLeftEdge + textRightEdge) / 2)}`);
    console.log(`Font size used: ${fontSize}px`);
    console.log(`textAlign: LEFT (manual centering)`);
    console.log('=== PIXEL DEBUG END ===');
    
    console.log('Name font:', { family: fontFamily, size: fontSize });
    
    // Draw at calculated position (left-aligned at drawX centers text on nameX)
    ctx.fillText(certificateName, drawX, nameY);
    console.log('Name drawn at:', { x: drawX, y: nameY });

    // Draw date - ALSO use custom font
    const dateFontSize = layout.date_font_size || DEFAULT_DATE_CONFIG.fontSize;
    ctx.font = `${dateFontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = layout.date_color || DEFAULT_DATE_CONFIG.color;
    
    ctx.fillText(formattedDate, dateX, dateY);
    console.log('Date font:', { family: fontFamily, size: dateFontSize });
    console.log('Date drawn at:', { x: dateX, y: dateY });

    // DEBUG MODE: Draw visual guide lines, labels, and watermark
    if (debug) {
      console.log('DEBUG MODE: Drawing guide lines, labels, and watermark');
      
      const generatedAt = new Date().toISOString();
      
      // Draw DEBUG MODE watermark at top
      ctx.save();
      ctx.font = 'bold 80px sans-serif';
      ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('DEBUG MODE', width / 2, 20);
      
      ctx.font = '30px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`Generated: ${generatedAt}`, width / 2, 110);
      ctx.restore();
      
      const lineWidth = 4;
      const labelFontSize = 36;
      ctx.font = `bold ${labelFontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      
      // Helper to draw vertical line with large, always-visible label
      const drawVerticalLine = (x: number, color: string, label: string, labelY: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Calculate label width and clamp position
        const labelWidth = ctx.measureText(label).width + 20;
        let labelX = x + 10;
        
        // If label would go off right edge, draw it to the left of the line
        if (labelX + labelWidth > width - 10) {
          labelX = x - labelWidth - 10;
        }
        // If that would go off left edge, clamp to left edge
        if (labelX < 10) {
          labelX = 10;
        }
        
        // Draw label background (solid black for visibility)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(labelX, labelY, labelWidth, labelFontSize + 16);
        
        // Draw border around label
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(labelX, labelY, labelWidth, labelFontSize + 16);
        
        // Draw label text
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(label, labelX + 10, labelY + 8);
      };
      
      // Helper to draw horizontal line with label
      const drawHorizontalLine = (y: number, color: string, label: string, labelX: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Draw label background
        const labelWidth = ctx.measureText(label).width + 20;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(labelX, y + 10, labelWidth, labelFontSize + 16);
        
        // Draw border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(labelX, y + 10, labelWidth, labelFontSize + 16);
        
        // Draw label text
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(label, labelX + 10, y + 18);
      };

      // Vertical guide lines with distinct colors and positions
      drawVerticalLine(imageCenterX, '#0066FF', `IMAGE CENTER x=${imageCenterX}`, 180);
      drawVerticalLine(nameX, '#00FF00', `name_x=${nameX}`, 240);
      drawVerticalLine(textLeftEdge, '#FFFF00', `TEXT LEFT x=${Math.round(textLeftEdge)}`, 300);
      drawVerticalLine(textRightEdge, '#FF00FF', `TEXT RIGHT x=${Math.round(textRightEdge)}`, 360);
      
      // Horizontal guide lines
      drawHorizontalLine(nameY, '#00FFFF', `name_y=${nameY}`, 50);
      drawHorizontalLine(dateY, '#FFA500', `date_y=${dateY}`, 50);
      
      // Draw large info box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fillRect(20, 420, 700, 340);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 420, 700, 340);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      
      const infoLines = [
        `Template: ${width} x ${height} px`,
        `Image Center X: ${imageCenterX}`,
        `name_x (target center): ${nameX}`,
        `name_y: ${nameY}`,
        `Measured Text Width: ${Math.round(measuredTextWidth)} px`,
        `drawX (start): ${Math.round(drawX)}`,
        `Text spans: ${Math.round(textLeftEdge)} → ${Math.round(textRightEdge)}`,
        `Text center: ${Math.round((textLeftEdge + textRightEdge) / 2)}`,
        `Font Size: ${fontSize}px`,
        `textAlign: LEFT (manual center)`,
      ];
      
      infoLines.forEach((line, i) => {
        ctx.fillText(line, 40, 455 + i * 32);
      });
    }

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

    // Build response
    const response: Record<string, unknown> = { 
      success: true, 
      certificateUrl,
      dimensions: { width, height },
      fontUsed: fontFamily,
      layoutUsed: { nameX, nameY, dateX, dateY },
    };

    // Include debug info in response if debug mode
    if (debug) {
      response.debug = {
        templateWidth: width,
        templateHeight: height,
        imageCenterX,
        nameAnchorX: nameX,
        nameAnchorY: nameY,
        drawX: Math.round(drawX),
        measuredTextWidth: Math.round(measuredTextWidth),
        textLeftEdge: Math.round(textLeftEdge),
        textRightEdge: Math.round(textRightEdge),
        textCenter: Math.round((textLeftEdge + textRightEdge) / 2),
        fontSizeUsed: fontSize,
        textAlign: 'left (manual centering)',
      };
    }

    return new Response(
      JSON.stringify(response),
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
