const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Image dimensions
    const imgW = 1080;
    const imgH = isStory ? 1920 : 1080;

    // Calculate photo zone coordinates based on layout
    let photoZone: { x: number; y: number; width: number; height: number } | null = null;

    if (hasReference) {
      if (layoutIndex === 0) {
        // Split: right 75%
        const leftPanel = Math.round(imgW * 0.25);
        photoZone = { x: leftPanel, y: 0, width: imgW - leftPanel, height: imgH };
      } else if (layoutIndex === 1) {
        // Full-bleed: center 65% vertically
        const topReserve = Math.round(imgH * 0.15);
        const bottomReserve = Math.round(imgH * 0.20);
        photoZone = { x: 0, y: topReserve, width: imgW, height: imgH - topReserve - bottomReserve };
      } else {
        // Framed: centered rectangle with padding
        const padX = Math.round(imgW * 0.10);
        const padTop = Math.round(imgH * 0.20);
        const padBottom = Math.round(imgH * 0.22);
        photoZone = { x: padX, y: padTop, width: imgW - padX * 2, height: imgH - padTop - padBottom };
      }
    }

    // When we have a reference, generate DESIGN ONLY with a placeholder zone
    const layouts = hasReference
      ? [
          // Split: left 25% text panel, right 75% solid magenta placeholder
          `Split layout: The image has TWO zones. Left 25% is a DARK panel (${bgColor}) containing ALL text: headline at top, brand name in middle, CTA at bottom — stacked vertically. Right 75% is filled with a SOLID FLAT COLOR (#FF00FF magenta) — this is a PHOTO PLACEHOLDER. Do NOT draw any person, face, hair, or photography in the magenta zone. It must be a perfectly flat, uniform #FF00FF fill with NO gradients, patterns, or variation. Add a thin gold decorative border between the two panels.`,
          // Full-bleed: top 15% text, center 65% magenta placeholder, bottom 20% CTA
          `Full-bleed layout: The image has THREE horizontal bands. Top 15% is a DARK band (${bgColor}) with the headline and brand name — TEXT ONLY. Center 65% is filled with SOLID FLAT COLOR (#FF00FF magenta) — this is a PHOTO PLACEHOLDER. Do NOT draw any person, face, hair, or photography in the magenta zone. It must be a perfectly flat, uniform #FF00FF fill. Bottom 20% is a DARK band (${bgColor}) with the CTA — TEXT ONLY. No gradients bleeding into the magenta zone.`,
          // Framed: dark background, centered magenta rectangle, text above/below
          `Framed layout: Dark background (${bgColor}) fills the entire image. In the center, draw a rectangular area filled with SOLID FLAT COLOR (#FF00FF magenta) — this is a PHOTO PLACEHOLDER. The magenta rectangle should have a thin gold or white border frame around it. Do NOT draw any person, face, hair, or photography. The magenta must be perfectly flat, uniform #FF00FF with NO gradients. ALL text (headline, brand name) goes ABOVE the frame. CTA goes BELOW the frame. No text overlapping the magenta zone.`,
        ]
      : [
          'Split layout: left 40% is a dark solid panel with the headline and brand name stacked vertically (TEXT ONLY zone — no people). Right 60% features cinematic photography with no text overlay. Thin gold border around the entire image. Decorative dotted line divider between text and photo.',
          'Full-bleed cinematic photo as background. Top 15% reserved for text ONLY (dark overlay, no people). Center 65% shows the subject clearly with no text. Bottom 20% for CTA ONLY (dark overlay, no people). Headline in bold uppercase in the top zone. Brand name at top in smaller text.',
          'Framed composition: dark background with a centered rectangular photo inset (white or gold thin border). Headline ABOVE the photo in large bold text (dark background zone). Brand name and CTA BELOW the photo (dark background zone). No text overlapping the photo.',
        ];

    const layoutInstruction = layouts[layoutIndex];

    const referenceInstructions = hasReference
      ? `PHOTO PLACEHOLDER INSTRUCTIONS:
You are generating a DESIGN TEMPLATE, not a final photo. The magenta (#FF00FF) zone is where a real photo will be composited later.
- CRITICAL: Do NOT generate, draw, or include ANY person, face, hair, silhouette, or human figure ANYWHERE in the image.
- The magenta zone MUST be a perfectly flat, solid, uniform #FF00FF color — no gradients, no patterns, no shading, no variation.
- Do NOT attempt to "help" by adding a person or photo-like element. The magenta placeholder is intentional.
- All your creative energy goes into the TEXT, TYPOGRAPHY, DECORATIVE ELEMENTS, and DARK BACKGROUND panels.
- Make the design elements (headlines, brand name, CTA, borders, accents) look premium and polished.`
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
${hasReference ? `0. PLACEHOLDER ZONE: The #FF00FF magenta area MUST remain a perfectly flat, solid, uniform color. No people, no faces, no gradients, no patterns in it. This is non-negotiable.` : `0. TEXT PLACEMENT PRIORITY — ABSOLUTE RULES:
   - For SPLIT layouts: Text MUST be in the left 25-40% dark panel ONLY.
   - For FULL-BLEED layouts: Top 15% and Bottom 20% are RESERVED for text ONLY. Center 65% is TEXT-FREE.
   - For FRAMED layouts: Text goes ABOVE and BELOW the photo frame ONLY.
   - UNIVERSAL: Never place text over any person's face, hair, neck, body, or clothing.`}
1. The headline typography must be large and impactful. If a word does not fit on a single line, reduce the font size until it does. Never hyphenate or break a word across two lines. Bold, uppercase, impactful sans-serif or display font.
2. Background must be DARK (black, charcoal, or very dark version of brand colors). Never use bright, pastel, or white backgrounds.
3. Text must have extremely high contrast against the background. Use the brand accent color for emphasis on key words.
4. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames.
5. The overall feel should match a high-end Canva template or professional agency output — NOT generic AI art.
6. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
7. ${isStory ? 'VERTICAL 9:16 format — content stacked top to bottom, optimized for mobile full-screen viewing.' : 'SQUARE format — perfectly balanced composition.'}
8. Never display category labels, slugs, or metadata (like "hair-system") as visible text on the image.
${!hasReference ? `9. FACE PROTECTION: Never crop or cut off faces — if a person is in the image, their full face must be fully visible.
10. Never place text over faces — headlines, brand names, and decorative elements must not overlap with any person's face.
11. HAIR PROTECTION: Never place text or decorative elements over any hair areas.` : ''}

Make this look like something a premium brand would actually post on Instagram.`;

    console.log('Generating marketing image via Google AI Studio:', { index: layoutIndex, contentType, tone, brand: brandProfile.title, palette, size, hasReference, hasPhotoZone: !!photoZone });

    // Build request parts — NO reference image sent to Gemini when hasReference
    const parts: any[] = [{ text: prompt }];

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

    console.log('Marketing image generated successfully via Google AI Studio:', { index: layoutIndex, palette, size, hasReference, photoZone });
    return new Response(
      JSON.stringify({ success: true, imageUrl, ...(photoZone ? { photoZone } : {}) }),
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
