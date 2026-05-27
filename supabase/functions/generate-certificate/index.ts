import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import { createCanvas, loadImage } from "https://deno.land/x/canvas@v1.4.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default configuration
const DEFAULT_NAME_CONFIG = {
  baseFontSize: 72,
  minFontSize: 48,
  color: '#1A1A1A',
};

const DEFAULT_DATE_CONFIG = {
  fontSize: 24,
  color: '#1A1A1A',
};

const FALLBACK_LAYOUT_RATIOS = {
  nameX: 0.5,
  nameY: 0.485,
  nameMaxWidth: 0.52,
  dateX: 0.24,
  dateY: 0.825,
};

type ShippingAddress = {
  recipientName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeShippingAddress(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const address = value as ShippingAddress;
  const normalized = {
    recipientName: cleanString(address.recipientName),
    phone: cleanString(address.phone),
    addressLine1: cleanString(address.addressLine1),
    addressLine2: cleanString(address.addressLine2),
    city: cleanString(address.city),
    state: cleanString(address.state),
    postalCode: cleanString(address.postalCode),
    countryCode: cleanString(address.countryCode || 'US').toUpperCase(),
  };
  const missing = Object.entries(normalized)
    .filter(([key, v]) => key !== 'addressLine2' && !v)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required shipping address fields: ${missing.join(', ')}`);
  }
  return normalized;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isCoordinateVisible(value: number | null, limit: number): value is number {
  return value !== null && value > 0 && value < limit;
}

function resolveCertificateLayout(layout: Record<string, unknown>, width: number, height: number) {
  const storedNameX = numberOrNull(layout.name_x);
  const storedNameY = numberOrNull(layout.name_y);
  const storedNameMaxWidth = numberOrNull(layout.name_max_width);
  const storedDateX = numberOrNull(layout.date_x);
  const storedDateY = numberOrNull(layout.date_y);

  const nameVisible = isCoordinateVisible(storedNameX, width) && isCoordinateVisible(storedNameY, height);
  const dateVisible = isCoordinateVisible(storedDateX, width) && isCoordinateVisible(storedDateY, height);

  const nameX = nameVisible ? storedNameX! : Math.round(width * FALLBACK_LAYOUT_RATIOS.nameX);
  const nameY = nameVisible ? storedNameY! : Math.round(height * FALLBACK_LAYOUT_RATIOS.nameY);
  const dateX = dateVisible ? storedDateX! : Math.round(width * FALLBACK_LAYOUT_RATIOS.dateX);
  const dateY = dateVisible ? storedDateY! : Math.round(height * FALLBACK_LAYOUT_RATIOS.dateY);

  const fallbackNameMaxWidth = Math.round(width * FALLBACK_LAYOUT_RATIOS.nameMaxWidth);
  const nameMaxWidth =
    storedNameMaxWidth && storedNameMaxWidth > 0 && storedNameMaxWidth <= width
      ? storedNameMaxWidth
      : fallbackNameMaxWidth;

  return {
    nameX, nameY, nameMaxWidth, dateX, dateY,
    usedFallback: !nameVisible || !dateVisible || nameMaxWidth !== storedNameMaxWidth,
    stored: { nameX: storedNameX, nameY: storedNameY, nameMaxWidth: storedNameMaxWidth, dateX: storedDateX, dateY: storedDateY },
  };
}

// Font URLs — prefer the uploaded Old English certificate font in storage, fallback only if missing.
const NAME_FONT_FALLBACK_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf';
const DATE_FONT_URL = 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName, shippingAddress, debug = false } = await req.json();
    const normalizedShippingAddress = normalizeShippingAddress(shippingAddress);

    console.log('Generating certificate for:', { userId, courseId, certificateName, hasShippingAddress: !!normalizedShippingAddress, debug });

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

    // Try the uploaded Old English font first; this is the configured certificate font.
    let nameFontFamily = 'serif';
    let dateFontFamily = 'sans-serif';
    try {
      const oldEnglishUrl = `${supabaseUrl}/storage/v1/object/public/certificates/fonts/OldeEnglish.ttf`;
      let nameFontLoaded = false;
      try {
        const oldEnglishRes = await fetch(oldEnglishUrl);
        if (oldEnglishRes.ok) {
          const data = await oldEnglishRes.arrayBuffer();
          canvas.loadFont(new Uint8Array(data), { family: 'OldeEnglish' });
          nameFontFamily = 'OldeEnglish';
          nameFontLoaded = true;
          console.log('Old English loaded from storage:', data.byteLength);
        }
      } catch (e) {
        console.log('Old English not in storage, using fallback');
      }

      if (!nameFontLoaded) {
        const nameRes = await fetch(NAME_FONT_FALLBACK_URL);
        if (nameRes.ok) {
          const data = await nameRes.arrayBuffer();
          canvas.loadFont(new Uint8Array(data), { family: 'EBGaramond' });
          nameFontFamily = 'EBGaramond';
          console.log('EB Garamond fallback loaded:', data.byteLength);
        } else {
          console.warn('EB Garamond fetch failed:', nameRes.status);
        }
      }

      const dateRes = await fetch(DATE_FONT_URL);
      if (dateRes.ok) {
        const data = await dateRes.arrayBuffer();
        canvas.loadFont(new Uint8Array(data), { family: 'Montserrat' });
        dateFontFamily = 'Montserrat';
        console.log('Montserrat Medium loaded:', data.byteLength);
      } else {
        console.warn('Montserrat fetch failed:', dateRes.status);
      }
    } catch (fontError) {
      console.warn('Font loading failed, using fallbacks:', fontError);
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

    const resolvedLayout = resolveCertificateLayout(layout, width, height);
    const { nameX, nameY, nameMaxWidth, dateX, dateY } = resolvedLayout;

    console.log('Using pixel coordinates:', { nameX, nameY, nameMaxWidth, dateX, dateY, usedFallback: resolvedLayout.usedFallback, stored: resolvedLayout.stored, template: { width, height } });

    // Draw name with auto-sizing - LET CANVAS CENTER IT
    ctx.fillStyle = layout.name_color || DEFAULT_NAME_CONFIG.color;
    ctx.textAlign = 'center';  // Canvas handles centering
    ctx.textBaseline = 'middle';
    
    let fontSize = layout.name_font_size || DEFAULT_NAME_CONFIG.baseFontSize;
    const minFontSize = layout.name_min_font_size || DEFAULT_NAME_CONFIG.minFontSize;
    
    ctx.font = `${fontSize}px ${nameFontFamily}`;
    
    // Auto-size font to fit within max width (single-pass measure)
    while (ctx.measureText(certificateName).width > nameMaxWidth && fontSize > minFontSize) {
      fontSize -= 2;
      ctx.font = `${fontSize}px ${nameFontFamily}`;
    }

    console.log('Name font:', { family: nameFontFamily, size: fontSize });

    // Draw the whole name as a single centered string (no per-char hacks)
    ctx.fillText(certificateName, nameX, nameY);
    console.log('Name drawn at:', { x: nameX, y: nameY });

    // Draw date - default to using the name font/color when configured as 'name'
    const dateFontSize = layout.date_font_size || DEFAULT_DATE_CONFIG.fontSize;
    const dateFamilyChoice = layout.date_font_family || 'name';
    const resolvedDateFamily = dateFamilyChoice === 'name' ? nameFontFamily : dateFontFamily;
    const resolvedDateColor = dateFamilyChoice === 'name'
      ? (layout.name_color || DEFAULT_NAME_CONFIG.color)
      : (layout.date_color || DEFAULT_DATE_CONFIG.color);

    ctx.font = `${dateFontSize}px ${resolvedDateFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = resolvedDateColor;

    ctx.fillText(formattedDate, dateX, dateY);
    console.log('Date font:', { family: resolvedDateFamily, size: dateFontSize, color: resolvedDateColor });
    console.log('Date drawn at:', { x: dateX, y: dateY });

    // DEBUG MODE: Draw ONE vertical line at name_x
    if (debug) {
      console.log('DEBUG MODE: Drawing reference line at name_x');
      
      // Draw bright green vertical line at nameX
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(nameX, 0);
      ctx.lineTo(nameX, height);
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(nameX + 10, nameY - 60, 200, 40);
      ctx.fillStyle = '#00FF00';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`name_x = ${nameX}`, nameX + 20, nameY - 35);
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

    let fulfillmentRequest = null;
    if (normalizedShippingAddress) {
      const { data: latestPhoto } = await supabase
        .from('certification_photos')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: fulfillmentData, error: fulfillmentError } = await supabase
        .from('certification_fulfillment_requests')
        .upsert({
          user_id: userId,
          course_id: courseId,
          certification_id: certData.id,
          certification_photo_id: latestPhoto?.id ?? null,
          certificate_name: certificateName,
          certificate_url: certificateUrl,
          recipient_name: normalizedShippingAddress.recipientName,
          phone: normalizedShippingAddress.phone,
          address_line1: normalizedShippingAddress.addressLine1,
          address_line2: normalizedShippingAddress.addressLine2 || null,
          city: normalizedShippingAddress.city,
          state: normalizedShippingAddress.state,
          postal_code: normalizedShippingAddress.postalCode,
          country_code: normalizedShippingAddress.countryCode,
          status: 'pending_review',
          provider: 'printful',
          provider_variant_id: '20256',
          estimated_base_cost: 35.70,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,course_id' })
        .select()
        .single();

      if (fulfillmentError) {
        console.error('Fulfillment request save error:', fulfillmentError);
      } else {
        fulfillmentRequest = fulfillmentData;
      }
    }

    const response: Record<string, unknown> = {
      success: true,
      certificateUrl,
      fulfillmentRequest,
      dimensions: { width, height },
      fontUsed: nameFontFamily,
      layoutUsed: { nameX, nameY, dateX, dateY },
    };

    if (debug) {
      response.debug = {
        templateWidth: width,
        templateHeight: height,
        nameX, nameY, dateX, dateY,
        usedFallbackLayout: resolvedLayout.usedFallback,
        storedLayout: resolvedLayout.stored,
        fontSizeUsed: fontSize,
        textAlign: 'center',
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
