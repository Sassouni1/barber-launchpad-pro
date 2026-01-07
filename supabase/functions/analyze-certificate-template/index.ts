import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseId } = await req.json();

    if (!courseId) {
      throw new Error('courseId is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the template image
    const templatePath = 'template/certificate-template.png';
    const { data: templateData } = supabase.storage
      .from('certificates')
      .getPublicUrl(templatePath);

    if (!templateData?.publicUrl) {
      throw new Error('Could not get template URL');
    }

    console.log('Analyzing template:', templateData.publicUrl);

    // Call Lovable AI with vision to analyze the template
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
              {
                type: 'text',
                text: `Analyze this certificate template image carefully. I need the EXACT pixel coordinates for placing text.

The certificate has:
1. A name field - where the recipient's name goes (after "This Certificate is Proudly Presented to" or similar text)
2. A date field - where the issue date goes

For this certificate template, provide the following in JSON format:
{
  "name_x": <center X coordinate in pixels for the name>,
  "name_y": <Y coordinate in pixels for the name baseline>,
  "name_max_width": <maximum width in pixels the name can span>,
  "date_x": <X coordinate in pixels for the date>,
  "date_y": <Y coordinate in pixels for the date>,
  "template_width": <total width of the template in pixels>,
  "template_height": <total height of the template in pixels>
}

Be very precise. The name should be centered horizontally in the designated name area. Look for visual cues like lines, decorative elements, or blank spaces that indicate where text should go.

Return ONLY the JSON object, no other text.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: templateData.publicUrl
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    // Parse the JSON from the response
    let layoutData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        layoutData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('Parsed layout data:', layoutData);

    // Validate the response has required fields
    const requiredFields = ['name_x', 'name_y', 'name_max_width', 'date_x', 'date_y'];
    for (const field of requiredFields) {
      if (typeof layoutData[field] !== 'number') {
        throw new Error(`Missing or invalid field: ${field}`);
      }
    }

    // Store the layout in the database
    const { data: existingLayout } = await supabase
      .from('certificate_layouts')
      .select('id')
      .eq('course_id', courseId)
      .single();

    if (existingLayout) {
      // Update existing
      const { error: updateError } = await supabase
        .from('certificate_layouts')
        .update({
          name_x: Math.round(layoutData.name_x),
          name_y: Math.round(layoutData.name_y),
          name_max_width: Math.round(layoutData.name_max_width),
          date_x: Math.round(layoutData.date_x),
          date_y: Math.round(layoutData.date_y),
          updated_at: new Date().toISOString()
        })
        .eq('course_id', courseId);

      if (updateError) {
        console.error('Failed to update layout:', updateError);
        throw new Error('Failed to update layout in database');
      }
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('certificate_layouts')
        .insert({
          course_id: courseId,
          name_x: Math.round(layoutData.name_x),
          name_y: Math.round(layoutData.name_y),
          name_max_width: Math.round(layoutData.name_max_width),
          date_x: Math.round(layoutData.date_x),
          date_y: Math.round(layoutData.date_y)
        });

      if (insertError) {
        console.error('Failed to insert layout:', insertError);
        throw new Error('Failed to save layout to database');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        layout: {
          name_x: Math.round(layoutData.name_x),
          name_y: Math.round(layoutData.name_y),
          name_max_width: Math.round(layoutData.name_max_width),
          date_x: Math.round(layoutData.date_x),
          date_y: Math.round(layoutData.date_y),
          template_width: layoutData.template_width,
          template_height: layoutData.template_height
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in analyze-certificate-template:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
