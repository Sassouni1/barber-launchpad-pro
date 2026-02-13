const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandProfile, variationTitle, variationContent, contentType, tone, size } = await req.json();

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

    const isStory = size === 'story';
    const aspectRatio = isStory ? '9:16 portrait (tall and narrow)' : '1:1 square';

    // Extract brand colors if available
    const colors = brandProfile.branding?.colors || {};
    const fonts = brandProfile.branding?.fonts || [];
    const primaryColor = colors.primary || colors.textPrimary || '#FFFFFF';
    const secondaryColor = colors.secondary || colors.accent || '#D4AF37';
    const bgColor = colors.background || '#1A1A1A';
    const textColor = colors.textPrimary || '#FFFFFF';
    const accentColor = colors.accent || colors.secondary || '#D4AF37';
    const fontFamily = fonts.length > 0 ? fonts.map((f: any) => f.family).join(', ') : 'bold sans-serif';

    // Extract brand images
    const brandImages: string[] = brandProfile.images || [];
    const screenshot: string | null = brandProfile.screenshot || null;

    const brandColorBlock = Object.keys(colors).length > 0
      ? `
BRAND COLORS (use these EXACT hex values throughout the design):
- Primary: ${primaryColor}
- Secondary/Accent: ${secondaryColor}
- Background base: ${bgColor}
- Text color: ${textColor}
- Accent highlight: ${accentColor}

Brand fonts: ${fontFamily}
`
      : `
COLOR PALETTE:
- Background: dark charcoal or black (#1A1A1A or #0D0D0D)
- Primary accent: gold (#D4AF37) or the brand's main color
- Text: white (#FFFFFF) with gold accents
- Use high contrast between text and background
`;

    // Layout variation — pick a random layout template
    const layoutSeed = Math.floor(Math.random() * 3);

    const squareLayouts = [
      'Split layout: left 40% is a dark solid panel with the headline and brand name stacked vertically, right 60% features the reference photo from the brand. Thin gold border around the entire image. Decorative dotted line divider between text and photo.',
      'Full-bleed reference photo as background with a heavy dark gradient overlay (70% opacity). Headline centered in bold uppercase. Brand name at top in smaller text. Thin decorative line separators above and below the headline.',
      'Framed composition: dark background with a centered rectangular photo inset from the brand (white or gold thin border around the photo). Headline ABOVE the photo in large bold text. Brand name and tagline BELOW the photo. Clean, editorial layout.',
    ];

    const storyLayouts = [
      'Full-bleed reference photo as background. Heavy dark gradient from top (90% opacity) fading to 30% in middle, then back to 90% at bottom. MASSIVE headline in the top third, all-caps, bold. Smaller supporting text in the bottom third. Clean middle section letting the photo breathe.',
      'Dark solid background top 35% with headline text, then the reference brand photo taking up the middle 40% with thin gold border, then dark solid bottom 25% with brand name and CTA text.',
      'Full-bleed reference photo with a dark overlay. Brand name at very top in small elegant text. Giant headline word stacked vertically down the center. Contact/CTA at the very bottom. Everything centered.',
    ];

    const layoutInstruction = isStory
      ? storyLayouts[layoutSeed % storyLayouts.length]
      : squareLayouts[layoutSeed % squareLayouts.length];

    const hasReferenceImages = brandImages.length > 0 || screenshot;

    const photoInstruction = hasReferenceImages
      ? `IMPORTANT: I am providing reference image(s) from the brand's actual website. Use the photography, people, and scenes from these reference images as the visual foundation of the marketing graphic. Incorporate them naturally into the layout — crop, overlay, and style them to fit the design. Do NOT ignore these images.`
      : `If using photography, it must look cinematic — professional barbershop scenes, men with fresh fades/haircuts, dramatic lighting, shallow depth of field. NO stock photo aesthetic.`;

    const prompt = `You are a world-class graphic designer creating a premium marketing image for a barbershop/hair replacement business. The output MUST be a ${aspectRatio} image.

${brandColorBlock}

${photoInstruction}

LAYOUT:
${layoutInstruction}

TEXT TO INCLUDE ON THE IMAGE (render this text directly as part of the graphic):
Headline: "${variationContent.substring(0, 120)}"
Brand: "${brandProfile.title || ''}"

CRITICAL DESIGN RULES:
1. The headline typography must be MASSIVE — taking up at least 30% of the image area. Bold, uppercase, impactful sans-serif or display font.
2. Background must be DARK (black, charcoal, or very dark version of brand colors). Never use bright, pastel, or white backgrounds.
3. ${hasReferenceImages ? 'USE THE PROVIDED REFERENCE IMAGES as the photography in the design. Style and crop them to fit professionally.' : 'If using photography, it must look cinematic with dramatic lighting.'}
4. Text must have extremely high contrast against the background. Use the brand accent color for emphasis on key words.
5. Include subtle decorative elements: thin line dividers, small geometric accents, or minimal border frames.
6. The overall feel should match a high-end Canva template or professional agency output — NOT generic AI art.
7. No watermarks, no placeholder text, no clip art, no illustrations, no cartoons.
8. ${isStory ? 'PORTRAIT orientation — the image must be tall and narrow. Text should be large enough to read on a phone screen.' : 'SQUARE format — perfectly balanced composition.'}

Make this look like something a premium barber brand would actually post on Instagram.`;

    // Build message content — include reference images if available
    const messageContent: any[] = [{ type: 'text', text: prompt }];

    // Add up to 2 brand images as reference (to keep payload reasonable)
    const imageUrls = brandImages.filter((url: string) => url.startsWith('http')).slice(0, 2);
    for (const imgUrl of imageUrls) {
      messageContent.push({
        type: 'image_url',
        image_url: { url: imgUrl },
      });
    }

    // Add screenshot as fallback if no content images
    if (imageUrls.length === 0 && screenshot) {
      const screenshotUrl = screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`;
      messageContent.push({
        type: 'image_url',
        image_url: { url: screenshotUrl },
      });
    }

    console.log('Generating marketing image:', { size, contentType, tone, brand: brandProfile.title, hasColors: Object.keys(colors).length > 0, refImages: imageUrls.length, hasScreenshot: !!screenshot && imageUrls.length === 0 });

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

    console.log('Marketing image generated successfully:', { size });
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
