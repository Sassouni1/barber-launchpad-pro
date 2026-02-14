const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brandProfile, contentType, tone, businessCategory } = await req.json();

    if (!brandProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand profile is required' }),
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

    const contentTypeDescriptions: Record<string, string> = {
      'instagram': 'Instagram post caption with relevant hashtags (max 2200 chars, aim for 150-300 words). Include emoji where appropriate.',
      'facebook': 'Facebook post that encourages engagement and sharing (150-300 words). Conversational and relatable.',
      'google-ad': 'Google Ads copy with a compelling headline (max 30 chars), two description lines (max 90 chars each), and a display URL path.',
      'social': 'General social media post suitable for any platform (100-200 words). Versatile and shareable.',
    };

    const toneDescriptions: Record<string, string> = {
      'professional': 'Professional, authoritative, and trustworthy. Use industry terminology confidently.',
      'casual': 'Friendly, approachable, and conversational. Like talking to a friend.',
      'luxury': 'Elevated, premium, and aspirational. Emphasize exclusivity and quality.',
      'bold': 'Energetic, direct, and attention-grabbing. Use power words and strong calls to action.',
    };

    const categoryDescriptions: Record<string, string> = {
      'hair-system': `This business specializes in HAIR SYSTEM SERVICES (non-surgical hair replacement). Focus content on:
- Hair system installs, maintenance, and styling
- Transformations and results-driven messaging
- Free consultations — emphasize "DM to schedule" or "Click the link in my bio to book"
- Before & after transformations
- Target men dealing with hair loss who want a natural, full look without surgery
- Avoid mentioning wigs or toupees — use "hair system" or "unit"
- Do NOT default to generic "reclaim your confidence" phrasing. Instead use headline styles like:
  "REAL HAIRLINE. REAL CONFIDENCE. ZERO SURGERY." / "INSTANT DENSITY. UNDETECTABLE FINISH." / "THINNING TO THICK. IN ONE SESSION." / "SEAMLESS. CUSTOM. PRECISE." / "ZERO PATCHY. ZERO OBVIOUS. ZERO COMPROMISE." / "BUILT TO BLEND. DESIGNED TO LAST." / "NO SCARS. NO DOWNTIME. JUST RESULTS." / "ENGINEERED HAIRLINES. BARBER-FINISHED." / "FROM RECEDING TO REDEFINED." / "PRECISION INSTALLED. PROFESSIONALLY STYLED." / "THE DIFFERENCE IS IN THE DETAILS." / "FLAWLESS HAIRLINE, ZERO DETECTION." / "INSTANT TRANSFORMATION. ZERO COMPROMISE." / "FRESH LOOK. ZERO SURGERY. SAME-DAY RESULTS."
- Each of the 3 variations MUST use a completely different headline style. Never repeat the same phrasing across variations.`,
      'haircut': `This business focuses on HAIRCUT & BARBERING SERVICES. Focus content on:
- Fresh cuts, fades, tapers, beard trims, grooming
- Walk-ins welcome or booking availability
- "Book your next cut" or "DM to schedule"
- Men's grooming expertise and style trends`,
      'salon': `This business is a SALON offering full hair services. Focus content on:
- Color, styling, treatments, blowouts, keratin, etc.
- Luxury or self-care experience
- "Book your appointment" or "Treat yourself"
- Client transformations and testimonials`,
      'extensions': `This business specializes in HAIR EXTENSIONS. Focus content on:
- Length, volume, and transformation results
- Extension types (tape-in, sew-in, clip-in, fusion, etc.)
- "DM for a consultation" or "Book your install"
- Natural-looking, seamless blends`,
    };

    const categoryContext = categoryDescriptions[businessCategory] || '';

    const systemPrompt = `You are an expert marketing copywriter specializing in the hair replacement, hair systems, and barber industry. You create compelling, on-brand marketing content that drives engagement and conversions.

Your task: Generate exactly 3 unique variations of marketing content based on the brand information provided.

Content type: ${contentTypeDescriptions[contentType] || contentTypeDescriptions['social']}
Tone: ${toneDescriptions[tone] || toneDescriptions['professional']}
${categoryContext ? `\nBUSINESS CATEGORY FOCUS:\n${categoryContext}\n` : ''}
Rules:
- Each variation must be distinct in approach (e.g., one emotional, one educational, one promotional)
- Each of the 3 variations MUST use a completely different headline style from the category examples. Never repeat the same phrasing across variations.
- Use the brand's actual services, name, and unique selling points from the website content
- Include a clear call-to-action in each variation (prefer "DM to schedule", "Link in bio", or "Book a free consultation")
- Keep content authentic and avoid generic filler — do NOT default to "reclaim your confidence" style messaging
- If the business is related to hair systems/barber services, lean into that expertise
${categoryContext ? '- IMPORTANT: Stay laser-focused on the business category described above. Every variation must be about that specific service.' : ''}

Return your response as a JSON object with this exact structure:
{
  "variations": [
    { "title": "Brief label for this variation", "content": "The full marketing content" },
    { "title": "Brief label for this variation", "content": "The full marketing content" },
    { "title": "Brief label for this variation", "content": "The full marketing content" }
  ]
}

Return ONLY the JSON object, no other text.`;

    const userPrompt = `Brand: ${brandProfile.title || 'Unknown'}
Website: ${brandProfile.sourceUrl || 'N/A'}
Description: ${brandProfile.description || 'N/A'}

Website Content:
${brandProfile.content || 'No content available'}`;

    console.log('Generating marketing content:', { contentType, tone });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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
        JSON.stringify({ success: false, error: 'AI generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response (handle markdown code blocks)
    let parsed;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response:', rawContent);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Marketing content generated successfully');
    return new Response(
      JSON.stringify({ success: true, variations: parsed.variations || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating marketing content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
