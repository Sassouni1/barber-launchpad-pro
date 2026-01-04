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

    // Draw name with auto-sizing - INK-BOUNDS CENTERING
    ctx.fillStyle = layout.name_color || DEFAULT_NAME_CONFIG.color;
    ctx.textAlign = 'left';  // Always use left - we center manually
    ctx.textBaseline = 'middle';
    
    let fontSize = layout.name_font_size || DEFAULT_NAME_CONFIG.baseFontSize;
    const minFontSize = layout.name_min_font_size || DEFAULT_NAME_CONFIG.minFontSize;
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    
    while (ctx.measureText(certificateName).width > nameMaxWidth && fontSize > minFontSize) {
      fontSize -= 4;
      ctx.font = `${fontSize}px ${fontFamily}`;
    }
    
    // Measure text with both advance width and ink bounds
    const textMetrics = ctx.measureText(certificateName);
    const advanceWidth = textMetrics.width;
    const imageCenterX = width / 2;
    
    // Try to use actualBoundingBox metrics for true "ink" bounds
    // These give the actual painted pixels, not the advance width
    // With textAlign='left' and draw position x0:
    //   inkLeft  = x0 - bboxLeft
    //   inkRight = x0 + bboxRight
    //   inkCenter = x0 + (bboxRight - bboxLeft) / 2
    // To center ink on nameX: x0 = nameX - (bboxRight - bboxLeft) / 2
    const bboxLeft = textMetrics.actualBoundingBoxLeft ?? 0;
    const bboxRight = textMetrics.actualBoundingBoxRight ?? advanceWidth;
    const hasBboxMetrics = textMetrics.actualBoundingBoxLeft !== undefined;
    
    // Calculate draw position (x0) to center the INK on nameX
    let drawX: number;
    if (hasBboxMetrics) {
      // CORRECT FORMULA: center the ink bounds on nameX
      drawX = nameX - (bboxRight - bboxLeft) / 2;
    } else {
      // Fallback: center using advance width
      drawX = nameX - advanceWidth / 2;
    }
    
    // Safety margins - clamp so ink stays within margins
    const safeMargin = 40;
    let clampedDrawX: number;
    let minDrawX: number;
    let maxDrawX: number;
    
    if (hasBboxMetrics) {
      // Clamp based on ink bounds
      minDrawX = safeMargin + bboxLeft;  // so inkLeft >= safeMargin
      maxDrawX = width - safeMargin - bboxRight;  // so inkRight <= width - safeMargin
      clampedDrawX = Math.max(minDrawX, Math.min(drawX, maxDrawX));
    } else {
      // Fallback clamp using advance width
      minDrawX = safeMargin;
      maxDrawX = width - safeMargin - advanceWidth;
      clampedDrawX = Math.max(minDrawX, Math.min(drawX, maxDrawX));
    }
    
    // Calculate actual ink positions after clamping
    const inkLeft = clampedDrawX - bboxLeft;
    const inkRight = clampedDrawX + bboxRight;
    const inkCenter = (inkLeft + inkRight) / 2;
    const centerDelta = inkCenter - nameX;  // Should be ~0 if centered correctly

    // Debug logging
    console.log('=== CENTERING DEBUG ===');
    console.log(`Template: ${width} x ${height}`);
    console.log(`Image center X: ${imageCenterX}`);
    console.log(`Anchor (name_x): ${nameX}`);
    console.log(`Advance width: ${Math.round(advanceWidth)}px`);
    console.log(`BBox available: ${hasBboxMetrics}`);
    console.log(`BBox left: ${Math.round(bboxLeft)}, right: ${Math.round(bboxRight)}`);
    console.log(`Draw X (unclamped): ${Math.round(drawX)}`);
    console.log(`Clamp bounds: [${Math.round(minDrawX)}, ${Math.round(maxDrawX)}]`);
    console.log(`Draw X (clamped): ${Math.round(clampedDrawX)}`);
    console.log(`Ink spans: ${Math.round(inkLeft)} to ${Math.round(inkRight)}`);
    console.log(`Ink center: ${Math.round(inkCenter)} (delta from anchor: ${Math.round(centerDelta)})`);
    console.log(`Font size: ${fontSize}px`);
    console.log('=== CENTERING DEBUG END ===');
    
    console.log('Name font:', { family: fontFamily, size: fontSize });
    
    // Draw at the calculated position
    ctx.fillText(certificateName, clampedDrawX, nameY);
    console.log('Name drawn at:', { x: Math.round(clampedDrawX), y: nameY });

    // Draw date - ALSO use custom font
    const dateFontSize = layout.date_font_size || DEFAULT_DATE_CONFIG.fontSize;
    ctx.font = `${dateFontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = layout.date_color || DEFAULT_DATE_CONFIG.color;
    
    ctx.fillText(formattedDate, dateX, dateY);
    console.log('Date font:', { family: fontFamily, size: dateFontSize });
    console.log('Date drawn at:', { x: dateX, y: dateY });

    // DEBUG MODE: Draw visual guide lines and labels
    if (debug) {
      console.log('DEBUG MODE: Drawing guide lines and labels');
      
      const lineWidth = 3;
      const labelFontSize = 24;
      ctx.font = `${labelFontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      
      // Helper to draw vertical line with label
      const drawVerticalLine = (x: number, color: string, label: string, labelY: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Draw label background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const labelWidth = ctx.measureText(label).width + 10;
        ctx.fillRect(x + 5, labelY, labelWidth, labelFontSize + 8);
        
        // Draw label text
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 10, labelY + 4);
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const labelWidth = ctx.measureText(label).width + 10;
        ctx.fillRect(labelX, y + 5, labelWidth, labelFontSize + 8);
        
        // Draw label text
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(label, labelX + 5, y + 9);
      };

      // Vertical guide lines
      drawVerticalLine(0, '#FF0000', `x=0 (left edge)`, 50);
      drawVerticalLine(imageCenterX, '#0066FF', `x=${imageCenterX} (IMAGE CENTER)`, 100);
      drawVerticalLine(nameX, '#00FF00', `x=${nameX} (name_x anchor - TARGET)`, 150);
      drawVerticalLine(inkLeft, '#FFFF00', `x=${Math.round(inkLeft)} (INK left)`, 200);
      drawVerticalLine(inkCenter, '#00FFAA', `x=${Math.round(inkCenter)} (INK center)`, 250);
      drawVerticalLine(inkRight, '#FF00FF', `x=${Math.round(inkRight)} (INK right)`, 300);
      drawVerticalLine(width, '#FF6600', `x=${width} (right edge)`, 350);
      
      // Horizontal guide lines
      drawHorizontalLine(nameY, '#00FFFF', `y=${nameY} (name_y)`, 50);
      drawHorizontalLine(dateY, '#00FFFF', `y=${dateY} (date_y)`, 50);
      
      // Draw info box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(20, 400, 700, 320);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `20px sans-serif`;
      ctx.textAlign = 'left';
      
      const infoLines = [
        `Template: ${width} x ${height}`,
        `name_x (anchor): ${nameX}`,
        `Advance Width: ${Math.round(advanceWidth)}px`,
        `BBox Left/Right: ${Math.round(bboxLeft)} / ${Math.round(bboxRight)}`,
        `Draw X: ${Math.round(clampedDrawX)}`,
        `INK Left: ${Math.round(inkLeft)}`,
        `INK Right: ${Math.round(inkRight)}`,
        `INK Center: ${Math.round(inkCenter)}`,
        `CENTER DELTA: ${Math.round(centerDelta)}px (should be ~0)`,
        `Font Size: ${fontSize}px`,
      ];
      
      infoLines.forEach((line, i) => {
        ctx.fillText(line, 35, 420 + i * 28);
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
        nameAnchorX: nameX,
        nameAnchorY: nameY,
        advanceWidth: Math.round(advanceWidth),
        hasBboxMetrics,
        bboxLeft: Math.round(bboxLeft),
        bboxRight: Math.round(bboxRight),
        drawX: Math.round(clampedDrawX),
        inkLeft: Math.round(inkLeft),
        inkRight: Math.round(inkRight),
        inkCenter: Math.round(inkCenter),
        centerDelta: Math.round(centerDelta),
        fontSizeUsed: fontSize,
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
