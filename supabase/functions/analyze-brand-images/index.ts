const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ImageAnalysis {
  url: string;
  isBeforeAfter: boolean;
  orientation: 'landscape' | 'portrait' | 'square';
  bestFit: 'story' | 'square' | 'both';
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'urls array is required' }),
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

    const analyses: ImageAnalysis[] = [];

    // Process images in parallel (max 6)
    const imagesToAnalyze = urls.slice(0, 6);

    const promises = imagesToAnalyze.map(async (imageUrl: string) => {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } },
                  {
                    type: 'text',
                    text: `Analyze this image for use in social media marketing templates. Respond with ONLY a JSON object, no markdown:

{
  "isBeforeAfter": true/false,
  "orientation": "landscape" | "portrait" | "square",
  "bestFit": "story" | "square" | "both",
  "description": "brief 10-word description"
}

Rules:
- isBeforeAfter: true if image shows side-by-side comparison (before/after transformation, two photos merged)
- orientation: based on content aspect ratio (landscape=wider than tall, portrait=taller than wide, square=roughly equal)
- bestFit: 
  - "story" if portrait orientation OR if it would look best in a tall 9:16 layout
  - "square" if landscape or square orientation AND it's a before/after (side-by-side comparisons need width to show both sides)
  - "square" if landscape and NOT before/after
  - "both" if it works well in either format (typically headshots, single subjects)
- IMPORTANT: Before/after images that are wide/square should be "square" bestFit since they need the width to display properly`
                  }
                ]
              }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'classify_image',
                  description: 'Classify an image for marketing template routing',
                  parameters: {
                    type: 'object',
                    properties: {
                      isBeforeAfter: { type: 'boolean', description: 'Whether image is a before/after comparison' },
                      orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
                      bestFit: { type: 'string', enum: ['story', 'square', 'both'] },
                      description: { type: 'string', description: 'Brief 10-word description' }
                    },
                    required: ['isBeforeAfter', 'orientation', 'bestFit', 'description'],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'classify_image' } }
          }),
        });

        if (!response.ok) {
          console.error('AI analysis failed for', imageUrl, response.status);
          return { url: imageUrl, isBeforeAfter: false, orientation: 'square' as const, bestFit: 'both' as const, description: 'Unknown image' };
        }

        const aiData = await response.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          console.log('Image analysis:', imageUrl.substring(0, 60), parsed);
          return { url: imageUrl, ...parsed } as ImageAnalysis;
        }

        // Fallback: try parsing from content
        const content = aiData.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return { url: imageUrl, ...parsed } as ImageAnalysis;
          }
        } catch {}

        return { url: imageUrl, isBeforeAfter: false, orientation: 'square' as const, bestFit: 'both' as const, description: 'Unknown image' };
      } catch (err) {
        console.error('Error analyzing image:', imageUrl, err);
        return { url: imageUrl, isBeforeAfter: false, orientation: 'square' as const, bestFit: 'both' as const, description: 'Analysis failed' };
      }
    });

    const results = await Promise.all(promises);

    console.log('Analyzed', results.length, 'images');
    return new Response(
      JSON.stringify({ success: true, analyses: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-brand-images:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
