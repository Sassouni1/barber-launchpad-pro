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
    const { brandProfile, variationTitle, variationContent, contentType, tone, index, palette, size, referenceImageUrl } = await req.json();

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
      primaryColor = 'METALLIC GOLD GRADIENT (deep burnished bronze #8B6914 → rich gold #D4AF37 → bright luminous gold #F0D060)';
      secondaryColor = 'METALLIC GOLD GRADIENT (same as primary)';
      bgColor = '#0A0A0A (TRUE BLACK)';
      textColor = '#FFFFFF';
      accentColor = 'METALLIC GOLD GRADIENT (same as primary)';
    } else {
      primaryColor = colors.primary || colors.textPrimary || '#FFFFFF';
      secondaryColor = colors.secondary || colors.accent || '#D4AF37';
      bgColor = colors.background || '#1A1A1A';
      textColor = colors.textPrimary || '#FFFFFF';
      accentColor = colors.accent || colors.secondary || '#D4AF37';
    }

    const fontFamily = fonts.length > 0 ? fonts.map((f: any) => f.family).join(', ') : 'bold sans-serif';

    const brandColorBlock = useGold ? `
BRAND COLORS — METALLIC GOLD + TRUE BLACK PALETTE:
- Gold elements: METALLIC GOLD GRADIENT — transitions from deep burnished bronze (#8B6914) at edges/shadows, through rich gold (#D4AF37) in midtones, to bright luminous gold (#F0D060) at highlights. This creates a 3D metallic shimmer effect like polished gold foil or a luxury embossed business card. Every gold element (text, borders, CTA bars, dividers) MUST use this gradient treatment — never flat single-tone gold.
- Background: Dark and premium — deep black (#0D0D0D), rich charcoal (#1A1A1A), or other dark moody tones. The background should feel luxurious and cinematic. Avoid bright, light, or medium-toned backgrounds.
- Text: Alternate between WHITE (#FFFFFF) and METALLIC GOLD for visual punch.

Brand fonts: ${fontFamily}
` : `
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

    const hasBrandName = !!brandProfile.title;

    const layouts = [
      hasReference
        ? `Split layout: left 25% is a sophisticated dark panel with the headline stacked vertically in bold white and gold alternating words. Right 75% contains the reference photo — place it without any modifications so the entire photo is visible (including both sides if it is a before-and-after). The photo must fit fully within the right panel with no cropping on any edge. If the photo contains two people (before-and-after), scale it so that both heads occupy no more than 70% of the available panel height, leaving at least 15% padding above the tallest head. If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background. The surrounding area should seamlessly match the photo's own backdrop tone rather than defaulting to pure black. Thin gold border around the entire image. Decorative gold dotted-line divider between the text panel and photo.`
        : `Split layout: left 40% is a sophisticated dark panel with the headline${hasBrandName ? ' and brand name' : ''} stacked vertically in bold white and gold alternating words, right 60% features cinematic photography. Thin gold border around the entire image. Decorative gold dotted-line divider between text and photo.`,
      hasReference
        ? `Reference photo placed as a large background element that covers most of the canvas while keeping every person's full head, hair, and face visible with breathing room on all sides — without any modifications, preserving the original pixels. If the photo does not naturally fill the entire canvas without cropping any person's head, use the photo's own backdrop color extended outward as padding behind the photo, or if the photo has no clear backdrop, use a dark premium background (#0D0D0D). Let the photo sit within the frame at the largest size that keeps all heads fully visible. It is better to have matching-tone padding around the edges than to crop any part of a person's head or hair — scale the photo down 10-20% if needed to guarantee full head visibility. If the photo contains two people (before-and-after), scale it so that both heads occupy no more than 70% of the available panel height, leaving at least 15% padding above the tallest head. If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background. Headline in bold uppercase positioned in the upper-left or upper area with a subtle dark gradient behind the text for readability (max 40% opacity).${hasBrandName ? ' Brand name + CTA at bottom.' : ''} Thin gold outer frame border wrapping the entire composition.`
        : `Full-bleed cinematic photography background. Headline in bold uppercase positioned in the upper-left or upper area with a subtle dark gradient behind the text for readability (max 40% opacity).${hasBrandName ? ' Brand name + CTA at bottom.' : ''} Thin gold outer frame border wrapping the entire composition.`,
      hasReference
        ? `Dark background with the reference photo placed as a large centered element without any modifications, preserving original pixels, with a thin white or gold border around just the photo. Scale it so the entire photo is visible (including both sides if it is a before-and-after). If the photo contains two people (before-and-after), scale it so that both heads occupy no more than 70% of the available panel height, leaving at least 15% padding above the tallest head. If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background. The surrounding area should seamlessly match the photo's own backdrop tone rather than defaulting to pure black. Headline ABOVE the photo in large bold white and gold text.${hasBrandName ? ' Brand name and tagline BELOW the photo.' : ''} Clean, editorial layout. The photo should be prominent and large — the focal point of the composition.`
        : `Dark background with cinematic photography as a large centered element with a thin white or gold border around just the photo. Headline ABOVE the photo in large bold white and gold text.${hasBrandName ? ' Brand name and tagline BELOW the photo.' : ''} Clean, editorial layout.`,
    ];

    const layoutInstruction = layouts[layoutIndex];

    // Index-based headline rotation: each image gets a different subset
    const allHeadlines = [
      '"REAL HAIRLINE. REAL CONFIDENCE. ZERO SURGERY."',
      '"THINNING TO THICK. IN ONE SESSION."',
      '"SEAMLESS. CUSTOM. PRECISE."',
      '"ZERO PATCHY. ZERO OBVIOUS. ZERO COMPROMISE."',
      '"A HAIRLINE THAT HOLDS UP UNDER LIGHT."',
      '"BUILT TO BLEND. DESIGNED TO LAST."',
      '"NO SCARS. NO DOWNTIME. JUST RESULTS."',
      '"WHEN IT LOOKS THIS NATURAL, NO ONE ASKS."',
      '"ENGINEERED HAIRLINES. BARBER-FINISHED."',
      '"FROM RECEDING TO REDEFINED."',
      '"CLEAN HAIRCUT. FLAWLESS BLEND."',
      '"PRECISION INSTALLED. PROFESSIONALLY STYLED."',
      '"THE DIFFERENCE IS IN THE DETAILS."',
      '"PRECISION HAIR SYSTEMS INSTALLED DAILY"',
      '"INSTANT RESULTS. SEAMLESS BLEND. ZERO SURGERY."',
      '"FLAWLESS HAIRLINE, ZERO DETECTION."',
      '"INSTANT TRANSFORMATION. ZERO COMPROMISE."',
      '"FRESH LOOK. ZERO SURGERY. SAME-DAY RESULTS."',
    ];

    // Split into 3 pools of 6 headlines each
    const poolSize = 6;
    const poolIndex = layoutIndex % 3;
    const headlinePool = allHeadlines.slice(poolIndex * poolSize, poolIndex * poolSize + poolSize);
    const headlineExamples = headlinePool.map(h => `- ${h}`).join('\n');

    // Strip the first line of variationContent (it's usually the headline the AI copies)
    const contentLines = (variationContent || '').split('\n');
    const strippedContent = contentLines.length > 1 ? contentLines.slice(1).join('\n').trim() : variationContent;

    // Initialize parts array and fetch reference image data (attached AFTER prompt text)
    const parts: any[] = [];
    let referenceImageData: any = null;

    if (hasReference) {
      try {
        if (referenceImageUrl.startsWith('data:')) {
          const match = referenceImageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            referenceImageData = { inlineData: { data: match[2], mimeType: match[1] } };
          }
        } else {
          const { base64, mimeType } = await fetchImageAsBase64(referenceImageUrl);
          referenceImageData = { inlineData: { data: base64, mimeType } };
        }
        console.log('Reference image fetched and attached successfully');
      } catch (fetchErr) {
        console.error('Failed to fetch reference image:', fetchErr);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch reference image. Please try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Story-specific reference photo instructions
    const storyReferenceBlock = (isStory && hasReference) ? `
=== Story format (9:16) — reference photo placement ===
The reference photo should be placed as a large element within the vertical frame — it should occupy at least 50-60% of the canvas height.
Never regenerate or redraw the person to fit the vertical layout. If the photo does not naturally fill the vertical space, add dark premium background padding above and below the photo.
It is perfectly acceptable for the layout to be: headline text at top (15-20%), reference photo in the middle (50-60%), and CTA/brand at the bottom (15-20%).
The photo is a fixed asset — adapt the layout around it, never reshape or regenerate the person.
=== end story format ===
` : '';

    const stopAndReadPreamble = hasReference
      ? `Important — read before proceeding:
You are about to receive a real photograph of a real person. This photo is a provided photo layer — you cannot modify, redraw, repaint, re-imagine, or regenerate the pixels of this person. 

Your task: Design a marketing layout around this provided photo. The photo is a fixed input — treat it like a sticker being placed onto your design. You are a graphic designer compositing a layout, not a photographer generating new imagery.

What "provided photo layer" means:
- The person's face, hair, skin, clothing, pose, lighting, and background in the photo are all fixed
- You may only: resize the photo, position it within the frame, and add dark padding around it
- You may not: change the person's appearance, generate a "similar" person, improve the photo, change the lighting on the person, or create any new human imagery
- If the person in your output does not match the reference photo exactly, you have failed

Common failure mode: The AI generates a "similar looking" person with slightly different features, cleaner background, or better lighting. This is still a fake person and is a failure. The reference photo should appear in the final image exactly as provided — same pixels, same lighting, same background.

Do not render any instructional words as visible text on the image. The only text on the image should be the headline, brand name, and call-to-action.

`
      : '';

    const criticalRulesBlock = `=== The 3 most critical rules ===

Rule #1 — Full head visibility:
The entire head, all hair, the complete face, and the full forehead of every person in the image must be 100% visible at all times — in single photos and in before-and-after photos. This applies to every edge of the image (top, bottom, left, right). If any part of any person's head, hair, or face is cut off, cropped, or touches any edge, the image is a failure. Scale the photo down until every person's full head fits with visible breathing room on all sides. There are zero exceptions to this rule. This overrides all layout, composition, and framing decisions.

Rule #2 — Zero AI-generated people:
${hasReference ? `A reference photo has been provided. You are absolutely forbidden from generating, drawing, painting, or synthesizing any human face, head, hair, or body. The reference photo is the only source of human imagery — place it into the composition without any modifications. If you cannot include the reference photo, use no people at all — show barbershop tools, textures, or abstract patterns instead. Never create a "similar looking" person.` : `Generate original cinematic photography. Any people must look natural and authentic — professional barbershop/salon scenes.`}

Rule #3 — Before-and-after photos:
If the reference photo contains a before-and-after comparison, it shows two people (or two views of the same person). Both people's entire heads, all hair, and complete faces must be fully visible with breathing room on all sides. Rule #1 (full head visibility) applies to each person individually. Scale the entire photo down until both people fit completely within the frame with no cropping on any edge.

=== end critical rules ===
`;

    // When reference is present, use simplified compositing prompt (no photography generation language)
    const referencePhotoBlock = hasReference ? `=== Reference photo — provided photo layer instructions ===
This photo is a provided photo layer. You are placing it into your design without any modifications.
- Place the provided photo into the layout using its original pixels exactly as they are
- The photo is a fixed asset — do not redraw, repaint, enhance, or regenerate any part of it
- Design the background, text, headlines, borders, and decorative elements around this provided photo
- You may resize and reposition the photo within the frame
- You may add dark padding, borders, or frames around the photo
- You may not alter the person's face, hair, skin, clothing, lighting, or background
- Place text and design elements around or beside the photo, never over faces
- The final result must look like a professionally designed social media post with the real photo composited in
=== end provided photo layer instructions ===` : `Photography instructions:
Generate original cinematic photography that fits a barbershop/hair replacement business.
- Professional barbershop scenes, natural high-end studio lighting, shallow depth of field
- The photography should feel authentic and high-end`;

    const prompt = `${stopAndReadPreamble}${criticalRulesBlock}
${storyReferenceBlock}
You are a world-class graphic designer creating a premium marketing image for a barbershop/hair replacement business. ${aspectInstruction}

${brandColorBlock}

LAYOUT:
${layoutInstruction}

${referencePhotoBlock}

TEXT ON THE IMAGE:
Context/mood of the post (for design inspiration ONLY — do NOT copy any of this text onto the image): "${strippedContent.substring(0, 200)}"
${variationTitle ? `Variation style: "${variationTitle}" -- use this as creative direction, not as visible text.` : ''}

YOUR HEADLINE — pick ONE from this list and adapt it into a bold 5-8 word headline. Do NOT invent your own — use one of these as a base:
${headlineExamples}
Adapt and rephrase your chosen example. Do NOT default to generic "reclaim your confidence" phrasing. Do NOT copy any text from the context/mood above.
${brandProfile.title ? `Brand name: "${brandProfile.title}"` : '(No brand name provided — do NOT invent or display any brand name on the image.)'}
CALL TO ACTION: You MUST include a clear, visible call-to-action on the image (e.g., "BOOK A FREE CONSULTATION", "DM TO SCHEDULE", "LINK IN BIO", "CALL NOW"). Place it in a contrasting banner, button-style box, or prominent text area near the bottom of the image.

DESIGN RULES:
1. The headline typography must be large and impactful. If a word does not fit on a single line, reduce the font size until it does. Never hyphenate or break a word across two lines. Bold, uppercase, impactful sans-serif or display font.
2. Background should be DARK and PREMIUM — ranging from deep black (#0D0D0D) to rich charcoal (#1A1A1A). Dark moody tones are welcome. The overall feel should be luxurious and cinematic. Avoid any light, bright, or medium-toned backgrounds. When placing a reference photo, sample the dominant background color from the photo itself and use that tone (not pure black) as the canvas fill behind and around the photo — this prevents jarring color mismatches between the photo backdrop and the layout background. Extend or feather the photo's own backdrop outward so the transition is seamless.
3. Text must have extremely high contrast against the black background. Alternate between WHITE and GOLD (#D4AF37) text for visual punch — gold on key impactful words, white on the rest. This white-and-gold alternating pattern is MANDATORY for every headline.
4. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames. Use gold/metallic tones for these accents.
${hasReference ? '' : `5. COLOR GRADING: Apply subtle cinematic color grading — slightly warm highlights, slightly cool shadows, natural-looking contrast. The look should feel polished and editorial, NOT over-processed or heavy-handed. Avoid extreme teal-and-orange looks. The photo should still look natural and real. Never leave photos completely flat, but do NOT push contrast to extremes.
`}6. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
7. ${isStory ? 'VERTICAL 9:16 format — content stacked top to bottom, optimized for mobile full-screen viewing.' : 'SQUARE format — perfectly balanced composition.'}
8. Never display category labels, slugs, or metadata (like "hair-system") as visible text on the image. Category context should inform the design style, not appear as text.
9. Person framing: Never crop or cut off a person's head, hair, forehead, or face at any edge of the image — top, bottom, left, or right. The full head including all hair must be visible with breathing room on every side. Scale the photo smaller if needed to achieve this. In before-and-after photos, this applies to both the 'before' person and the 'after' person independently.
10. Never place text over faces — headlines, brand names, and decorative elements must be positioned in areas that do not overlap with any person's face.
${hasReference ? `11. The reference photo is a provided photo layer — preserve every pixel exactly as provided. Do not apply color grading, filters, or lighting changes to the person in the photo.` : `11. When generating photography: preserve natural lighting and skin tones.`}
12. Never invent, fabricate, or use placeholder business names. If no brand name was provided above, do not write any made-up name on the image. Leave the brand name area empty or omit it entirely. Only display a brand name if one was explicitly provided.
13. GOLD ACCENTS — MANDATORY: Every image MUST prominently feature METALLIC GOLD GRADIENT (transitioning from deep bronze #8B6914 through rich gold #D4AF37 to bright gold #F0D060) as a signature design element. Every gold element must have this gradient shimmer like polished gold foil — never flat single-tone gold. AT MINIMUM: (a) a thin metallic gold outer border/frame around the entire image, AND (b) metallic gold gradient text on at least 2-3 key headline words, AND (c) at least one additional metallic gold element such as a gold dotted-line divider, gold CTA button/banner, or gold decorative accent.

Make this look like something a premium brand would actually post on Instagram.

=== Final verification — do this before outputting ===
1. Does your image contain any human face or body? If yes, is it from the provided reference photo with the exact same pixels? If you generated a new person, remove them and redo with the reference photo only.
2. The reference photo is the only source of human imagery allowed. No exceptions. No "inspired by" versions. The actual photo pixels.
3. Check all four edges of the image (top, right, bottom, left). Is any person's head or hair touching or cut off at any edge? If yes, scale the photo smaller and reposition it with padding on all sides.
4. Does the reference photo show a before-and-after transformation (two people/views)? If yes, check each person's head separately — can you see the complete hair, forehead, and face of both people with space around them? If either person's head is cropped at any edge, scale the entire photo smaller and redo.
5. Pixel check: Compare every human face in your output to the reference photo. The face must be identical — same lighting, same angle, same skin texture, same background behind them. If any face looks "cleaner", "sharper", or "different" from the reference, you generated a fake person. Remove it and use the real photo.
6. Important: Do not render any instructional text, labels, or keywords as visible text on the image. The only visible text should be the headline, brand name (if provided), and the call-to-action.
7. If you failed any check above, do not output the image. Redo it from scratch.`;

    console.log('Generating marketing image via Google AI Studio:', { index: layoutIndex, contentType, tone, brand: brandProfile.title, palette, size, hasReference });

    // CRITICAL: Push text prompt FIRST, then reference image
    // This ensures the model reads instructions before seeing the photo
    parts.push({ text: prompt });
    if (referenceImageData) {
      parts.push(referenceImageData);
    }

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

      // Retry on rate limit OR transient server errors
      if (response.status === 429 || response.status === 503 || response.status === 500) {
        console.warn(`Got ${response.status} on attempt ${attempt + 1}, will retry...`);
        continue;
      }

      break; // Success or non-retryable error
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
