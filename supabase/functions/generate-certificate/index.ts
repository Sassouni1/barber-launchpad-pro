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

const CERTIFICATION_QUIZ_CUTOFF_ISO = '2026-06-01T00:00:00.000Z';
const NEW_CERTIFICATION_MODULE_IDS = new Set([
  '582837c7-5a6e-4467-b0ff-36446de0e478', // Live Client Part 1
  '7c4808e9-0b1e-40e8-b188-016d4f9398a4', // Live Client Part 2
  'ef71fd79-972e-4aca-a6eb-771dfbb1b865', // Live Client Part 3
  'c8b69876-591a-41cc-82e4-755ad02efd4e', // Live Client Part 4
]);

function isQuizPassed(score: number, totalQuestions: number): boolean {
  return totalQuestions > 0 && totalQuestions - score <= 1;
}

function requiresNewCertificationQuizzes(
  createdAt: string | null | undefined,
  hasExistingCertification: boolean,
): boolean {
  if (hasExistingCertification || !createdAt) return false;

  const createdAtMs = Date.parse(createdAt);
  const cutoffMs = Date.parse(CERTIFICATION_QUIZ_CUTOFF_ISO);
  return Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs;
}

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

function getRenderedTextInkBounds(text: string, font: string, color: string) {
  const measurementWidth = 3000;
  const measurementHeight = 500;
  const originX = 1000;
  const originY = Math.round(measurementHeight / 2);
  const measurementCanvas = createCanvas(measurementWidth, measurementHeight);
  const measurementCtx = measurementCanvas.getContext('2d');

  measurementCtx.clearRect(0, 0, measurementWidth, measurementHeight);
  measurementCtx.font = font;
  measurementCtx.fillStyle = color;
  measurementCtx.textAlign = 'left';
  measurementCtx.textBaseline = 'middle';
  measurementCtx.fillText(text, originX, originY);

  const imageData = measurementCtx.getImageData(0, 0, measurementWidth, measurementHeight).data;
  let minX = measurementWidth;
  let maxX = -1;
  let minY = measurementHeight;
  let maxY = -1;

  for (let y = 0; y < measurementHeight; y++) {
    for (let x = 0; x < measurementWidth; x++) {
      const index = (y * measurementWidth + x) * 4;
      const alpha = imageData[index + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) {
    return null;
  }

  return {
    leftFromDrawX: minX - originX,
    rightFromDrawX: maxX - originX,
    topFromDrawY: minY - originY,
    bottomFromDrawY: maxY - originY,
    inkWidth: maxX - minX + 1,
    inkHeight: maxY - minY + 1,
    inkCenterFromDrawX: ((minX + maxX) / 2) - originX,
    inkCenterFromDrawY: ((minY + maxY) / 2) - originY,
  };

}

// Font URLs — prefer a custom uploaded certificate-name font, then use a clean script fallback.
const NAME_FONT_FALLBACK_URL = 'https://fonts.gstatic.com/s/pinyonscript/v24/6xKpdSJbL9-e9LuoeQiDRQR8aOI.ttf';
const DATE_FONT_URL = 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName, shippingAddress, debug = false, legacyResubmission = false } = await req.json();
    const normalizedShippingAddress = normalizeShippingAddress(shippingAddress);

    console.log('Generating certificate for:', { userId, courseId, certificateName, hasShippingAddress: !!normalizedShippingAddress, debug, legacyResubmission });

    if (!userId || !courseId || !certificateName) {
      throw new Error('Missing required fields: userId, courseId, or certificateName');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Keep the server-side certificate path aligned with the UI. Existing
    // certificates are grandfathered; otherwise, accounts created on/after
    // June 1, 2026 must pass every required quiz, including all four Live
    // Client quizzes. Legacy accounts still use the pre-existing quiz set.
    const { data: existingCertification, error: existingCertificationError } = await supabase
      .from('certifications')
      .select('id, created_at, certification_version')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (existingCertificationError) {
      throw new Error(`Failed to check existing certification: ${existingCertificationError.message}`);
    }

    if (!existingCertification) {
      const { data: authUserResult, error: authUserError } = await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUserResult.user) {
        throw new Error('Unable to verify the account creation date for certification.');
      }

      const requiresNewQuizzes = requiresNewCertificationQuizzes(
        authUserResult.user.created_at,
        false,
      );

      const { data: quizModules, error: quizModulesError } = await supabase
        .from('modules')
        .select('id, has_quiz, course:courses!inner(category)')
        .eq('courses.category', 'hair-system')
        .eq('has_quiz', true);

      if (quizModulesError) {
        throw new Error(`Failed to check certification quizzes: ${quizModulesError.message}`);
      }

      const requiredQuizModuleIds = (quizModules || [])
        .filter((module) => requiresNewQuizzes || !NEW_CERTIFICATION_MODULE_IDS.has(module.id))
        .map((module) => module.id);

      const { data: attempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('module_id, score, total_questions')
        .eq('user_id', userId)
        .in('module_id', requiredQuizModuleIds.length > 0 ? requiredQuizModuleIds : ['00000000-0000-0000-0000-000000000000']);

      if (attemptsError) {
        throw new Error(`Failed to check quiz attempts: ${attemptsError.message}`);
      }

      const allQuizzesPassed = requiredQuizModuleIds.length > 0 && requiredQuizModuleIds.every((moduleId) =>
        (attempts || []).some((attempt) =>
          attempt.module_id === moduleId && isQuizPassed(attempt.score, attempt.total_questions),
        ),
      );

      if (!allQuizzesPassed) {
        throw new Error('Complete all required quizzes before generating your Level 1 Certification.');
      }
    }

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

    // Try the uploaded custom certificate font first; use an elegant script fallback if missing.
    let nameFontFamily = 'serif';
    let dateFontFamily = 'sans-serif';
    try {
      const customNameFontUrl = `${supabaseUrl}/storage/v1/object/public/certificates/fonts/CertificateName.ttf`;
      let nameFontLoaded = false;
      try {
        const customNameFontRes = await fetch(customNameFontUrl);
        if (customNameFontRes.ok) {
          const data = await customNameFontRes.arrayBuffer();
          canvas.loadFont(new Uint8Array(data), { family: 'CertificateName' });
          nameFontFamily = 'CertificateName';
          nameFontLoaded = true;
          console.log('Custom certificate name font loaded from storage:', data.byteLength);
        }
      } catch (e) {
        console.log('Custom certificate name font not in storage, using fallback');
      }

      if (!nameFontLoaded) {
        const nameRes = await fetch(NAME_FONT_FALLBACK_URL);
        if (nameRes.ok) {
          const data = await nameRes.arrayBuffer();
          canvas.loadFont(new Uint8Array(data), { family: 'PinyonScript' });
          nameFontFamily = 'PinyonScript';
          console.log('Pinyon Script fallback loaded:', data.byteLength);
        } else {
          console.warn('Pinyon Script fetch failed:', nameRes.status);
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

    // Character-count based sizing — MUST match src/lib/certificateFontSize.ts.
    // Everyone starts at 170px; names longer than 15 chars shrink 3px/char, floor 90.
    const NAME_BASE = 170;
    const NAME_THRESHOLD = 15;
    const NAME_MIN = 90;
    const NAME_SHRINK_PER_CHAR = 3;
    const trimmedName = (certificateName || '').trim();
    const fontSize = trimmedName.length <= NAME_THRESHOLD
      ? NAME_BASE
      : Math.max(NAME_MIN, NAME_BASE - (trimmedName.length - NAME_THRESHOLD) * NAME_SHRINK_PER_CHAR);

    ctx.fillStyle = layout.name_color || DEFAULT_NAME_CONFIG.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px ${nameFontFamily}`;

    const nameFont = `${fontSize}px ${nameFontFamily}`;
    const nameTextWidth = ctx.measureText(certificateName).width;
    const inkBounds = getRenderedTextInkBounds(
      certificateName,
      nameFont,
      layout.name_color || DEFAULT_NAME_CONFIG.color,
    );
    const nameDrawX = Math.round(nameX - (inkBounds?.inkCenterFromDrawX ?? nameTextWidth / 2));
    const nameDrawY = Math.round(nameY - (inkBounds?.inkCenterFromDrawY ?? 0));

    console.log('Name font:', { family: nameFontFamily, size: fontSize, charCount: trimmedName.length });
    ctx.fillText(certificateName, nameDrawX, nameDrawY);
    console.log('Name drawn at:', {
      drawX: nameDrawX,
      drawY: nameDrawY,
      centerX: nameX,
      centerY: nameY,
      measuredWidth: nameTextWidth,
      inkBounds,
    });


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

    // Decide the certification_version marker. Any explicit legacy
    // resubmission on an existing certification escalates to version 2 (the
    // card state that opens the edit form is the authoritative trigger; we do
    // NOT gate on the record's created_at because some affected records were
    // regenerated after the June 1 cutoff). Preserve versions already >= 2.
    const existingVersion = Number((existingCertification as any)?.certification_version ?? 1) || 1;
    const shouldEscalateToV2 = !!existingCertification && legacyResubmission === true;
    const nextVersion = Math.max(existingVersion, shouldEscalateToV2 ? 2 : 1);
    console.log('Certification version resolution:', { existingVersion, legacyResubmission, shouldEscalateToV2, nextVersion });

    // Save certification record
    const { data: certData, error: certError } = await supabase
      .from('certifications')
      .upsert({
        user_id: userId,
        course_id: courseId,
        certificate_name: certificateName,
        certificate_url: certificateUrl,
        issued_at: new Date().toISOString(),
        downloaded_at: null,
        certification_version: nextVersion,
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
        textAlign: 'ink-center',
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
