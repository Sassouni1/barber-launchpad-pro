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
    const dimensions = isStory ? '1080x1920 (9:16 portrait/story)' : '1080x1080 (1:1 square)';

    const toneStyles: Record<string, string> = {
      'professional': 'Clean, modern design with neutral tones, sharp typography, and professional imagery.',
      'casual': 'Warm, inviting colors, friendly rounded fonts, lifestyle photography feel.',
      'luxury': 'Dark elegant backgrounds (black/deep navy), gold accents, serif typography, premium feel with subtle gradients.',
      'bold': 'Vibrant saturated colors, large impactful typography, high contrast, energetic and attention-grabbing.',
    };

    const contentTypeContext: Record<string, string> = {
      'instagram': 'Instagram post — eye-catching, scroll-stopping visual optimized for the Instagram feed.',
      'facebook': 'Facebook post — engaging visual designed for the Facebook feed with clear messaging.',
      'google-ad': 'Google Display Ad — clean, professional ad creative with prominent call-to-action.',
      'social': 'Social media post — versatile visual suitable for multiple platforms.',
    };

    const prompt = `Create a professional marketing graphic for social media. This is a ${dimensions} format image.

Brand: ${brandProfile.title || 'Business'}
Industry: Hair replacement, hair systems, and barber services

Content type: ${contentTypeContext[contentType] || contentTypeContext['social']}
Visual style: ${toneStyles[tone] || toneStyles['professional']}

The image MUST include this text overlaid directly on the graphic in an attractive, readable way:
"${variationContent.substring(0, 200)}"

Design requirements:
- The text must be part of the image, styled beautifully with proper hierarchy
- Use a visually striking background related to the hair/barber industry
- Brand name "${brandProfile.title || ''}" should appear prominently
- Professional quality, ready to post on social media
- No watermarks, no placeholder text, no lorem ipsum
- ${isStory ? 'Vertical story format — text should be centered and large enough to read on mobile' : 'Square format — balanced composition with text and visuals'}
- Make it look like a real, polished social media graphic that a professional agency would create`;

    console.log('Generating marketing image:', { size, contentType, tone, brand: brandProfile.title });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'user', content: prompt },
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
