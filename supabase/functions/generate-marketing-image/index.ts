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
    // Note: referenceAttached is set later after actual fetch; used for prompt selection

    const hasBrandName = !!brandProfile.title;

    const layouts = [
      hasReference
        ? `Split layout: left 25% is a sophisticated dark panel with the headline stacked vertically in bold white and gold alternating words. Right 75% is the reference photo used LARGE — it should fill most of the right side as the HERO element. Apply dramatic cinematic color grading to the photo: deep teal shadows, warm amber highlights, high contrast. Thin gold border around the entire image. Decorative gold dotted-line divider between the text panel and photo. High contrast between the dark text panel and the dramatically lit photo side.`
        : `Split layout: left 40% is a sophisticated dark panel with the headline${hasBrandName ? ' and brand name' : ''} stacked vertically in bold white and gold alternating words, right 60% features cinematic photography with dramatic color grading — deep shadows, warm highlights, high contrast. Thin gold border around the entire image. Decorative gold dotted-line divider between text and photo.`,
      `Reference photo as large full-bleed background filling the canvas. Apply dramatic cinematic color grading: deep teal/blue shadows, warm golden highlights, high contrast like a movie poster. Headline in bold uppercase positioned in the upper-left or upper area with a subtle dark gradient behind the text for readability (max 40% opacity).${hasBrandName ? ' Brand name + CTA at bottom.' : ''} Thin gold outer frame border wrapping the entire composition. The photo is the HERO — it should dominate the image.`,
      `Dark background with the reference photo as a large centered element with a thin white or gold border around just the photo. Apply dramatic color grading to the photo: rich contrast, cinematic tones, warm highlights against cool shadows. Headline ABOVE the photo in large bold white and gold text.${hasBrandName ? ' Brand name and tagline BELOW the photo.' : ''} Clean, editorial layout. The photo should be prominent and large — the focal point of the composition.`,
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

    const getReferenceInstructions = (attached: boolean) => attached
      ? `=== ABSOLUTE NON-NEGOTIABLE RULE — REFERENCE PHOTO ===
A reference photo has been provided as an input image. You are FORBIDDEN from generating, creating, drawing, or synthesizing ANY person, face, hair, or human subject.

DO NOT generate a new person. DO NOT create an AI face. DO NOT illustrate a human. The ONLY human imagery allowed in your output is the EXACT reference photo provided.

You must:
- EMBED the provided reference photo directly into your composition as the hero image
- Use the EXACT pixels — do not redraw, repaint, re-imagine, or "improve" the person
- You MAY crop, resize, apply color grading, lighting filters, or tonal shifts
- Place text and design elements AROUND or BESIDE the photo, never over faces
- The final result must look like a designed social media post featuring the REAL photo

If you cannot use the reference photo for any reason, output a design with NO PEOPLE AT ALL — use abstract textures, barbershop tools, or geometric patterns instead. NEVER substitute with an AI-generated person.

=== SELF-CHECK BEFORE FINALIZING ===
Look at your output. Does it contain a person that was NOT in the reference photo? If yes, you have FAILED. Remove that person and use ONLY the reference photo or no people at all.

=== ZERO TOLERANCE ===
If your final image contains ANY person who is not pixel-for-pixel from the provided reference photo, your output is a FAILURE. There are no exceptions. No stylized versions. No "similar looking" people. No AI-generated faces. ONLY the exact reference photo pixels.`
      : `PHOTOGRAPHY INSTRUCTIONS:
Generate original cinematic photography that fits a barbershop/hair replacement business.
- Professional barbershop scenes, natural high-end studio lighting, shallow depth of field
- The photography should feel authentic and high-end`;

    // Build request parts (fetch reference image first, then construct prompt)
    const parts: any[] = [];

    let referenceAttached = false;
    if (hasReference) {
      try {
        const { base64, mimeType } = await fetchImageAsBase64(referenceImageUrl);
        parts.push({
          inlineData: { mimeType, data: base64 },
        });
        referenceAttached = true;
      } catch (e) {
        console.error('Failed to fetch reference image, aborting generation:', e);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to load reference image. Please try again or use a different image.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const referenceInstructions = getReferenceInstructions(referenceAttached);


    const prompt = `You are a world-class graphic designer creating a premium marketing image for a barbershop/hair replacement business. ${aspectInstruction}

${brandColorBlock}

LAYOUT:
${layoutInstruction}

${referenceInstructions}

TEXT ON THE IMAGE:
Context/mood of the post (for design inspiration ONLY — do NOT copy any of this text onto the image): "${strippedContent.substring(0, 200)}"
${variationTitle ? `Variation style: "${variationTitle}" -- use this as creative direction, not as visible text.` : ''}

YOUR HEADLINE — pick ONE from this list and adapt it into a bold 5-8 word headline. Do NOT invent your own — use one of these as a base:
${headlineExamples}
Adapt and rephrase your chosen example. Do NOT default to generic "reclaim your confidence" phrasing. Do NOT copy any text from the context/mood above.
${brandProfile.title ? `Brand name: "${brandProfile.title}"` : '(No brand name provided — do NOT invent or display any brand name on the image.)'}
CALL TO ACTION: You MUST include a clear, visible call-to-action on the image (e.g., "BOOK A FREE CONSULTATION", "DM TO SCHEDULE", "LINK IN BIO", "CALL NOW"). Place it in a contrasting banner, button-style box, or prominent text area near the bottom of the image.

CRITICAL DESIGN RULES:
1. The headline typography must be large and impactful. If a word does not fit on a single line, reduce the font size until it does. Never hyphenate or break a word across two lines. Bold, uppercase, impactful sans-serif or display font.
2. Background should use rich, sophisticated tones (deep charcoal, dark navy, warm espresso). Maintain a premium feel without being overly heavy or flatly dark. Never use bright, pastel, or white backgrounds.
3. Text must have extremely high contrast against the background. Use the brand accent color for emphasis on key words. Alternate between white and gold text for visual punch.
4. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames. Use gold/metallic tones for these accents.
5. DRAMATIC COLOR GRADING: Apply cinematic color grading to ALL photography — deep teal or blue-toned shadows, warm amber/golden highlights, strong contrast. The look should feel like a high-end movie poster or premium editorial spread. Never leave photos flat or ungraded. Push the contrast hard.
6. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
7. ${isStory ? 'VERTICAL 9:16 format — content stacked top to bottom, optimized for mobile full-screen viewing.' : 'SQUARE format — perfectly balanced composition.'}
8. Never display category labels, slugs, or metadata (like "hair-system") as visible text on the image. Category context should inform the design style, not appear as text.
9. PERSON FRAMING: Never crop or cut off a person's head, hair, forehead, or face at ANY edge of the image — top, bottom, left, or right. The full head including ALL hair must be visible with breathing room on every side. Scale the photo smaller if needed to achieve this. It is better to have empty space around the photo than to cut off any hair. Shoulders, arms, and body may be cropped if needed.
10. Never place text over faces — headlines, brand names, and decorative elements must be positioned in areas that do not overlap with any person's face.
11. When using reference photos with people: preserve the subject's face completely; apply gradient overlays and text only to non-face regions.
12. NEVER invent, fabricate, or use placeholder business names. If no brand name was provided above, do NOT write "BARBERSHOP NAME", "YOUR BRAND", "STUDIO NAME", or ANY made-up name on the image. Leave the brand name area empty or omit it entirely. Only display a brand name if one was explicitly provided.
13. BEFORE-AND-AFTER PHOTOS: If the reference photo contains a before-and-after comparison (two sides showing a transformation), you MUST display BOTH sides completely — every pixel of both the "before" and "after" must be visible. Scale the entire photo DOWN until it fits completely within the frame with NO cropping on ANY edge. It is better to have the photo appear smaller with padding than to crop any part of either side. Showing only one side or cropping the top of either person's head/hair is strictly forbidden.
14. ZERO AI-GENERATED PEOPLE: When a reference photo is provided, you are absolutely forbidden from generating, drawing, painting, or synthesizing any human face, head, hair, or body. The reference photo is the ONLY source of human imagery. If you cannot embed the reference photo, use NO PEOPLE AT ALL — show barbershop tools, textures, or abstract patterns instead. NEVER create a "similar looking" person. This rule overrides all other creative decisions.

Make this look like something a premium brand would actually post on Instagram.

=== FINAL VERIFICATION — DO THIS BEFORE OUTPUTTING ===
1. Does your image contain any human face or body? If YES, is it from the provided reference photo? If you generated a new person, DELETE THEM and redo with the reference photo only.
2. The reference photo is the ONLY source of human imagery allowed. No exceptions. No "inspired by" versions. The actual photo pixels.
3. Check ALL FOUR edges of the image (top, right, bottom, left). Is any person's head or hair touching or cut off at ANY edge? If YES, scale the photo smaller and reposition it with padding on all sides.
4. Does the reference photo show a before-and-after transformation? If YES, are BOTH sides fully visible? If either side is cropped, scale down and reposition to show the complete transformation.
5. SECOND CHECK: Look at every person in your image one more time. Compare each face to the reference photo. If ANY face does not match the reference EXACTLY, remove it. An AI-generated face is NEVER acceptable.
6. If you failed any check above, DO NOT output the image. Redo it from scratch.`;

    console.log('Generating marketing image via Google AI Studio:', { index: layoutIndex, contentType, tone, brand: brandProfile.title, palette, size, hasReference, referenceAttached });

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
