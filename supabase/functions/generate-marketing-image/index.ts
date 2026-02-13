const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
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

    const layouts = [
      'Split layout: left 40% is a dark solid panel with the headline and brand name stacked vertically, right 60% features cinematic photography. Thin gold border around the entire image. Decorative dotted line divider between text and photo.',
      'Full-bleed cinematic photo as background with a heavy dark gradient overlay (70% opacity). Headline centered in bold uppercase. Brand name at top in smaller text. Thin decorative line separators above and below the headline.',
      'Framed composition: dark background with a centered rectangular photo inset (white or gold thin border around the photo). Headline ABOVE the photo in large bold text. Brand name and tagline BELOW the photo. Clean, editorial layout.',
    ];

    const layoutInstruction = layouts[layoutIndex];

    // Build different prompts for reference-image vs pure-AI variations
    const hasReference = !!referenceImageUrl;

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

TEXT TO INCLUDE ON THE IMAGE (render this text directly as part of the graphic):
Headline: "${variationContent.substring(0, 120)}"
Brand: "${brandProfile.title || ''}"

CRITICAL DESIGN RULES:
1. The headline typography must be MASSIVE — taking up at least 30% of the image area. Bold, uppercase, impactful sans-serif or display font.
2. Background must be DARK (black, charcoal, or very dark version of brand colors). Never use bright, pastel, or white backgrounds.
3. Text must have extremely high contrast against the background. Use the brand accent color for emphasis on key words.
4. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames.
5. The overall feel should match a high-end Canva template or professional agency output — NOT generic AI art.
6. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
7. ${isStory ? 'VERTICAL 9:16 format — content stacked top to bottom, optimized for mobile full-screen viewing.' : 'SQUARE format — perfectly balanced composition.'}
8. FACE PROTECTION: Never crop or cut off faces — if a person is in the image, their full face (forehead to chin) must be fully visible within the frame.
9. Never place text over faces — headlines, brand names, and decorative elements must be positioned in areas that do not overlap with any person's face. Safe text zones: top 20%, bottom 20%, or on a solid-color panel/overlay that does not cover a face.
10. When using reference photos with people: preserve the subject's face completely; apply gradient overlays and text only to non-face regions (dark gradient from edges inward, leaving the face clear). For split layouts: ensure the photo side shows the full face uncropped; text stays on the solid panel side.

Make this look like something a premium brand would actually post on Instagram.`;

    console.log('Generating marketing image:', { index: layoutIndex, contentType, tone, brand: brandProfile.title, palette, size, hasReference });

    // Build message content — multimodal if reference image provided
    const messageContent: any[] = [];
    if (hasReference) {
      messageContent.push({
        type: 'image_url',
        image_url: { url: referenceImageUrl },
      });
    }
    messageContent.push({
      type: 'text',
      text: prompt,
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [
          { role: 'user', content: messageContent },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Image generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const images = aiData.choices?.[0]?.message?.images;

    if (!images || images.length === 0) {
      console.error('No images in response:', JSON.stringify(aiData).substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'No image was generated. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageUrl = images[0]?.image_url?.url;
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid image data received.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Marketing image generated successfully:', { index: layoutIndex, palette, size, hasReference });
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
