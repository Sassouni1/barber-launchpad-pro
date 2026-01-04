import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Certificate template hosted in storage
const TEMPLATE_URL = 'https://ynooatjtgstgwfssnira.supabase.co/storage/v1/object/public/certificates/template/certificate-template.png';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, courseId, certificateName } = await req.json();

    console.log('Generating certificate for:', { userId, courseId, certificateName });

    if (!userId || !courseId || !certificateName) {
      throw new Error('Missing required fields: userId, courseId, or certificateName');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Format the current date
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log('Using AI to edit certificate template with name:', certificateName, 'and date:', currentDate);

    // Use Lovable AI to edit the certificate template with the user's name and date
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
              text: `Edit this certificate template image by adding text DIRECTLY onto the image with NO background boxes or rectangles:

1. Add the name "${certificateName}" in OLDE ENGLISH / BLACKLETTER gothic font style:
   - Place it in the dark area below "This Certificate is Proudly Presented to"
   - IMPORTANT: DO NOT add any background box, rectangle, or white area behind the text
   - The text should be rendered DIRECTLY on the dark certificate background
   - Use a GOLDEN/BEIGE color (like #C4A35A or #D4AF37) that matches the gold decorative borders and accents on the certificate
   - Horizontally centered
   - Large and prominent size

2. Add the date "${currentDate}" at the bottom left where the DATE field is:
   - Use the same GOLDEN/BEIGE color as the name
   - NO background box or rectangle
   - Simple, elegant font
   - Smaller size appropriate for a date field

CRITICAL: The certificate has a dark charcoal/black background. All text you add must be golden/beige colored with NO white boxes, NO background rectangles, NO fill behind the text. The text should blend seamlessly with the existing gold decorative elements.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: TEMPLATE_URL
                }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI service payment required. Please check your account.');
      }
      throw new Error(`AI service error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the generated image from the response
    const generatedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error('No image in AI response:', JSON.stringify(aiData));
      throw new Error('Failed to generate certificate image');
    }

    console.log('Certificate image generated successfully');

    // Convert base64 to blob if it's a data URL
    let imageBlob: Blob;
    if (generatedImageUrl.startsWith('data:')) {
      const base64Data = generatedImageUrl.split(',')[1];
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      imageBlob = new Blob([binaryData], { type: 'image/png' });
    } else {
      // Fetch the image if it's a URL
      const imageResponse = await fetch(generatedImageUrl);
      imageBlob = await imageResponse.blob();
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${userId}/${courseId}/${timestamp}.png`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, imageBlob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload certificate: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    console.log('Certificate uploaded to:', publicUrl);

    // Save certification to database
    const { data: certification, error: dbError } = await supabase
      .from('certifications')
      .upsert({
        user_id: userId,
        course_id: courseId,
        certificate_name: certificateName,
        certificate_url: publicUrl,
        issued_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,course_id',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save certification: ${dbError.message}`);
    }

    console.log('Certification saved:', certification);

    return new Response(
      JSON.stringify({
        success: true,
        certificateUrl: publicUrl,
        certification,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating certificate:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
