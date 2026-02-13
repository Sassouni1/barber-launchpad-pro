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

    const layouts = [
      hasReference
        ? 'Split layout: left 25% is a dark solid panel with the headline stacked vertically, right 75% features the reference photo at FULL width without any cropping. Thin gold border around the entire image. Decorative dotted line divider between text and photo. The reference photo MUST be shown completely — never crop either side of a before-and-after transformation.'
        : 'Split layout: left 40% is a dark solid panel with the headline and brand name stacked vertically, right 60% features cinematic photography. Thin gold border around the entire image. Decorative dotted line divider between text and photo.',
      'Full-bleed cinematic photo as background with a heavy dark gradient overlay (70% opacity). Headline centered in bold uppercase. Brand name at top in smaller text. Thin decorative line separators above and below the headline. If the reference photo shows a before-and-after transformation, you MUST display the FULL photo without cropping either side.',
      'Framed composition: dark background with a centered rectangular photo inset (white or gold thin border around the photo). Headline ABOVE the photo in large bold text. Brand name and tagline BELOW the photo. Clean, editorial layout. If the reference photo shows a before-and-after transformation, you MUST display the FULL photo without cropping either side.',
    ];

    const layoutInstruction = layouts[layoutIndex];

    // hasReference moved above layouts array

    const referenceInstructions = hasReference
      ? `REFERENCE PHOTO INSTRUCTIONS:
You have been given a reference photo from the brand's website. You MUST use this photo as the hero/featured image in your composition.
- Incorporate the reference photo prominently — it should be the main visual element
- Apply cinematic color grading and dramatic lighting to the photo
- Overlay the headline text in bold typography ON TOP of or alongside the photo
- The result must look like a professionally designed social media post, NOT a raw photo
- Blend the photo seamlessly with the dark background and brand elements`
      : `PHOTOGRAPHY INSTRUCTIONS:
Generate original cinematic photography that fits a barbershop/hair replacement business.
- Professional barbershop scenes, dramatic lighting, shallow depth of field
- The photography should feel authentic and high-end`;

    const prompt = `You are a world-class graphic designer creating a premium marketing image for a barbershop/hair replacement business. ${aspectInstruction}

${brandColorBlock}

LAYOUT:
${layoutInstruction}

${referenceInstructions}

TEXT ON THE IMAGE:
Theme/mood of the post: "${variationContent.substring(0, 200)}" -- Create your OWN bold, punchy headline of 5-8 words max inspired by this theme. Do NOT copy the theme text directly onto the image.
${variationTitle ? `Variation style: "${variationTitle}" -- use this as creative direction, not as visible text.` : ''}
${brandProfile.title ? `Brand name: "${brandProfile.title}"` : '(No brand name provided — do NOT invent or display any brand name on the image.)'}

CRITICAL DESIGN RULES:
1. The headline typography must be MASSIVE — taking up at least 30% of the image area. Bold, uppercase, impactful sans-serif or display font.
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
