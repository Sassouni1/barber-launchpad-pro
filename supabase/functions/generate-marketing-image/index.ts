const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch reference image: ${resp.status}`);
  const contentType = resp.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await resp.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  // Manual base64 encoding in chunks to avoid stack overflow
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return { base64, mimeType: contentType.split(';')[0] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandProfile, variationTitle, variationContent, contentType, tone, index, palette, size, referenceImageUrl, businessCategory } = await req.json();

    if (!brandProfile || !variationContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand profile and variation content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY');
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google AI Studio key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const layoutIndex = typeof index === 'number' ? index % 3 : 0;
    const isStory = size === 'story';
    const useGold = palette !== 'website';

    const colors = brandProfile.branding?.colors || {};
    const fonts = brandProfile.branding?.fonts || [];

    let primaryColor: string, secondaryColor: string, bgColor: string, textColor: string, accentColor: string;

    if (useGold) {
      primaryColor = '#D4AF37';
      secondaryColor = '#D4AF37';
      bgColor = '#1A1A1A';
      textColor = '#FFFFFF';
      accentColor = '#D4AF37';
    } else {
      primaryColor = colors.primary || colors.textPrimary || '#FFFFFF';
      secondaryColor = colors.secondary || colors.accent || '#D4AF37';
      bgColor = colors.background || '#1A1A1A';
      textColor = colors.textPrimary || '#FFFFFF';
      accentColor = colors.accent || colors.secondary || '#D4AF37';
    }

    const fontFamily = fonts.length > 0 ? fonts.map((f: any) => f.family).join(', ') : 'bold sans-serif';

    const brandColorBlock = `
BRAND COLORS (use these EXACT hex values throughout the design):
- Primary: ${primaryColor}
- Secondary/Accent: ${secondaryColor}
- Background base: ${bgColor}
- Text color: ${textColor}
- Accent highlight: ${accentColor}

Brand fonts: ${fontFamily}
`;

    const aspectInstruction = isStory
      ? 'The output MUST be a 9:16 vertical portrait image (1080x1920 pixels). Tall and narrow like an Instagram Story or TikTok.'
      : 'The output MUST be a 1:1 square image (1080x1080 pixels).';

    const hasReference = !!referenceImageUrl;

    const layouts = [
      hasReference
        ? 'Split layout: left 25% is a dark solid panel with the headline stacked vertically, right 75% features the reference photo at FULL width without any cropping. Thin gold border around the entire image. Decorative dotted line divider between text and photo. The reference photo MUST be shown completely — never crop either side of a before-and-after transformation.'
        : 'Split layout: left 40% is a dark solid panel with the headline and brand name stacked vertically, right 60% features cinematic photography. Thin gold border around the entire image. Decorative dotted line divider between text and photo.',
      hasReference
        ? 'Full-bleed: Use the provided reference photo as the full background. Apply a heavy dark gradient overlay (70% opacity) on areas where text will go, but keep the subject clearly visible. Headline centered in bold uppercase. Brand name at top in smaller text. Thin decorative line separators above and below the headline. The reference photo MUST be shown completely — never crop either side of a before-and-after transformation.'
        : 'Full-bleed cinematic photo as background with a heavy dark gradient overlay (70% opacity). Headline centered in bold uppercase. Brand name at top in smaller text. Thin decorative line separators above and below the headline.',
      hasReference
        ? 'Framed composition: dark background with the provided reference photo centered as a rectangular inset (white or gold thin border around the photo). Headline ABOVE the photo in large bold text. Brand name and tagline BELOW the photo. Clean, editorial layout. The reference photo MUST be shown completely — never crop either side of a before-and-after transformation.'
        : 'Framed composition: dark background with a centered rectangular photo inset (white or gold thin border around the photo). Headline ABOVE the photo in large bold text. Brand name and tagline BELOW the photo. Clean, editorial layout.',
    ];

    const layoutInstruction = layouts[layoutIndex];

    // hasReference moved above layouts array

    const referenceInstructions = hasReference
      ? `REFERENCE PHOTO INSTRUCTIONS:
You have been given a reference photo. This is the ONLY photo that should appear in the final image.
- You MUST use this EXACT photo as the main visual. Do NOT generate, replace, or recreate any part of it with AI-generated imagery.
- Do NOT generate new faces or people. The reference photo contains the real subject — use it exactly as provided.
- You may apply minor color grading to match the dark theme, but the photo content must remain unchanged.
- Place headline text and brand elements around or overlaid on the photo using gradients, but never obscure the subject.
- The result must look like a professionally designed social media post featuring this specific photo.`
      : `PHOTOGRAPHY INSTRUCTIONS:
Generate original cinematic photography that fits ${businessCategory ? ({
        'hair-system': 'a hair system / non-surgical hair replacement business',
        'haircut': 'a barbershop / men\'s grooming business',
        'salon': 'a hair salon',
        'extensions': 'a hair extensions business',
      } as Record<string, string>)[businessCategory] || 'the brand\'s industry and style' : 'the brand\'s industry and style'}.
- Professional scenes, dramatic lighting, shallow depth of field
- The photography should feel authentic and high-end`;

    const businessDesc = businessCategory ? ({
      'hair-system': 'a hair system / non-surgical hair replacement business',
      'haircut': 'a barbershop / men\'s grooming business',
      'salon': 'a hair salon',
      'extensions': 'a hair extensions business',
    } as Record<string, string>)[businessCategory] || 'a premium brand' : 'a premium brand';

    const headlineExamples = businessCategory ? ({
      'hair-system': '"Fresh Look. Zero Surgery.", "Same-Day Installs"',
      'haircut': '"Sharp Cuts. Clean Lines.", "Walk-Ins Welcome"',
      'salon': '"Your Best Hair Day.", "Color That Turns Heads"',
      'extensions': '"Length You\'ll Love.", "Seamless Blends"',
    } as Record<string, string>)[businessCategory] || '"See The Difference.", "Book Today", "Your Best Look Yet"' : '"See The Difference.", "Book Today", "Your Best Look Yet"';

    const prompt = `You are a world-class graphic designer creating a premium marketing image for ${businessDesc}. ${aspectInstruction}

${brandColorBlock}

LAYOUT:
${layoutInstruction}

${referenceInstructions}

TEXT ON THE IMAGE:
Theme/mood of the post: "${variationContent.substring(0, 200)}" -- Create your OWN bold, punchy headline of 5-8 words max inspired by this theme. Do NOT copy the theme text directly onto the image.

WEBSITE CONTENT CONTEXT (use this to understand what the brand ACTUALLY offers):
"${brandProfile.content?.substring(0, 500) || ''}"

Headline Strategy: Analyze BOTH the theme above AND the website content. Extract the brand's ACTUAL services, products, themes, or unique selling points from the website content. Create a headline that reflects what THIS specific brand offers. Do NOT default to generic hair/barber/salon topics unless the website content explicitly mentions those services.

${variationTitle ? `Variation style: "${variationTitle}" -- use this as creative direction, not as visible text.` : ''}
HEADLINE STYLE — rotate between these approaches: results-driven (${headlineExamples}), service-driven, lifestyle, urgency ("Book This Week"), social proof ("Trusted By Hundreds"). Pick the style that best fits the brand's actual offerings from the website content.
BANNED WORDS in headlines: Do NOT use "confidence", "reclaim", "journey", or "hair loss". Focus on the positive outcome, the service, or a call to action instead.
${brandProfile.title ? `Brand name: "${brandProfile.title}"` : '(No brand name provided — do NOT invent or display any brand name on the image.)'}
CALL TO ACTION: You MUST include a clear, visible call-to-action on the image (e.g., "BOOK A FREE CONSULTATION", "DM TO SCHEDULE", "LINK IN BIO", "CALL NOW"). Place it in a contrasting banner, button-style box, or prominent text area near the bottom of the image.

CRITICAL DESIGN RULES:
0. TEXT PLACEMENT PRIORITY: Before placing ANY text, scan the image and identify the largest empty areas (solid-color walls, ceilings, dark backgrounds, open negative space with no people). ALL headlines, brand names, CTAs, and decorative elements MUST be positioned in these empty zones. If a person occupies one side of the frame and empty space occupies the other, place 100% of the text on the empty side. Never place text over any part of a person — face, hair, body, or clothing.
1. The headline typography must be large and impactful. If a word does not fit on a single line, reduce the font size until it does. Never hyphenate or break a word across two lines. Bold, uppercase, impactful sans-serif or display font.
2. Background must be DARK (black, charcoal, or very dark version of brand colors). Never use bright, pastel, or white backgrounds.
3. Text must have extremely high contrast against the background. Use the brand accent color for emphasis on key words.
4. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames.
5. The overall feel should match a high-end Canva template or professional agency output — NOT generic AI art.
6. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
7. ${isStory ? 'VERTICAL 9:16 format — content stacked top to bottom, optimized for mobile full-screen viewing.' : 'SQUARE format — perfectly balanced composition.'}
11. Never display category labels, slugs, or metadata (like "hair-system") as visible text on the image. Category context should inform the design style, not appear as text.
8. FACE PROTECTION: Never crop or cut off faces — if a person is in the image, their full face (forehead to chin) must be fully visible within the frame.
9. Never place text over faces — headlines, brand names, and decorative elements must be positioned in areas that do not overlap with any person's face.
10. When using reference photos with people: preserve the subject's face completely; apply gradient overlays and text only to non-face regions.
11. HAIR PROTECTION: Never place text, headlines, or decorative elements over any hair areas. Keep all text placement in safe zones: dark background panels, top/bottom margins, side columns, or areas below the neck/jawline. Hair must always be fully visible and unobstructed to showcase the quality and style.

Make this look like something a premium brand would actually post on Instagram.`;

    console.log('Generating marketing image via Google AI Studio:', { index: layoutIndex, contentType, tone, brand: brandProfile.title, palette, size, hasReference });

    // Build request parts
    const parts: any[] = [];

    if (hasReference) {
      try {
        const { base64, mimeType } = await fetchImageAsBase64(referenceImageUrl);
        parts.push({
          inlineData: { mimeType, data: base64 },
        });
      } catch (e) {
        console.warn('Failed to fetch reference image, proceeding without it:', e);
      }
    }

    parts.push({ text: prompt });

    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`;

    const requestBody = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    let response: Response | null = null;
    const maxRetries = 3;
    const retryDelays = [0, 10000, 20000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt + 1} after ${retryDelays[attempt] / 1000}s delay...`);
        await new Promise(r => setTimeout(r, retryDelays[attempt]));
      }

      response = await fetch(googleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      if (response.status !== 429) break;
      console.warn(`Got 429 rate limit on attempt ${attempt + 1}`);
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded after retries. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = response ? await response.text() : 'No response';
      console.error('Google AI Studio error:', response?.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Image generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const candidates = aiData.candidates;

    if (!candidates || candidates.length === 0) {
      console.error('No candidates in response:', JSON.stringify(aiData).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'No image was generated. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the image part in the response
    const responseParts = candidates[0]?.content?.parts || [];
    let imageUrl: string | null = null;

    for (const part of responseParts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      console.error('No image in response parts:', JSON.stringify(responseParts).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'No image was generated. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Marketing image generated successfully via Google AI Studio:', { index: layoutIndex, palette, size, hasReference });
    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating marketing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
