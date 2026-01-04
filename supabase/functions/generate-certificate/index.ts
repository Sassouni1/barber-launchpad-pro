import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Canonical template path (PNG for quality)
const TEMPLATE_PATH = 'template/certificate-template.png';

// Dancing Script font from Google Fonts (base64 encoded subset would be ideal, but we'll use a CDN)
const FONT_URL = 'https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup8.woff2';

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      },
    });

    // Fetch the template image via public URL
    console.log('Fetching template via public URL...');
    const templateUrl = supabase.storage.from('certificates').getPublicUrl(TEMPLATE_PATH).data.publicUrl;
    
    // Also try fallback paths if primary doesn't work
    const candidatePaths = [
      TEMPLATE_PATH,
      'template/certificate-template.jpg',
      'template/certificate-template.jpeg',
    ];

    let templateResp: Response | null = null;
    let chosenPath: string | null = null;

    for (const path of candidatePaths) {
      const url = supabase.storage.from('certificates').getPublicUrl(path).data.publicUrl;
      const r = await fetch(url);
      console.log('Template fetch', { path, status: r.status });
      if (r.ok) {
        templateResp = r;
        chosenPath = path;
        break;
      }
    }

    if (!templateResp || !chosenPath) {
      throw new Error('Certificate template not found. Please upload it from Admin Dashboard first.');
    }

    const templateContentType = templateResp.headers.get('content-type') || 'image/png';
    const templateArrayBuffer = await templateResp.arrayBuffer();
    const templateBytes = new Uint8Array(templateArrayBuffer);
    
    console.log('Template ready', { 
      chosenPath, 
      contentType: templateContentType, 
      bytes: templateBytes.length,
      sizeKB: Math.round(templateBytes.length / 1024)
    });

    // Convert template to base64 for AI
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < templateBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...templateBytes.subarray(i, i + chunkSize));
    }
    const templateBase64 = btoa(binary);
    const templateBase64Url = `data:${templateContentType};base64,${templateBase64}`;

    // Format the current date
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log('Using AI to generate high-quality certificate with name:', certificateName, 'and date:', currentDate);

    // Use Lovable AI to generate the certificate
    // The prompt is designed to ensure maximum quality output
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
                text: `You are a precise certificate editor. Your ONLY job is to add text to this certificate template.

CRITICAL OUTPUT REQUIREMENTS:
1. Output the image at EXACTLY the same resolution as the input - DO NOT resize or downscale
2. Keep every pixel of the original template exactly as-is except where you add text
3. Output as high-quality PNG

RECIPIENT NAME TO ADD:
- Text: "${certificateName}"
- Position: Centered in the large dark/maroon area between "This Certificate is Proudly Presented to" and the paragraph starting "This certificate confirms..."
- Font: Elegant script/cursive font (like Edwardian Script or similar)
- Color: Golden/champagne color (#D4AF37 or similar warm gold)
- Size: ${certificateName.length > 25 ? 'Medium size - name is long, ensure it fits horizontally with margins' : certificateName.length > 15 ? 'Large size but leave margins on sides' : 'Large and prominent'}
- Must be horizontally centered

DATE TO ADD:
- Text: "${currentDate}"
- Position: Bottom left of certificate, above where it says "DATE"
- Font: Simple elegant serif font
- Color: Same golden color as name
- Size: Small, appropriate for date field

RULES:
- Do NOT add any boxes, backgrounds, or shapes behind the text
- Do NOT modify any existing elements (borders, decorations, title, body text, signature)
- Do NOT change colors, gradients, or any design elements
- ONLY add the name and date text as specified
- Maintain crystal-clear sharpness on all text and decorations`
              },
              {
                type: 'image_url',
                image_url: {
                  url: templateBase64Url
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
      console.error('No image in AI response:', JSON.stringify(aiData).substring(0, 500));
      throw new Error('Failed to generate certificate image');
    }

    console.log('Certificate image generated successfully');

    // Convert base64 to blob - always save as PNG for quality
    let imageBlob: Blob;
    const outputContentType = 'image/png';
    
    if (generatedImageUrl.startsWith('data:')) {
      const base64Data = generatedImageUrl.split(',')[1];
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      imageBlob = new Blob([binaryData], { type: outputContentType });
      console.log('Generated image size:', Math.round(binaryData.length / 1024), 'KB');
    } else {
      // Fetch the image if it's a URL
      const imageResponse = await fetch(generatedImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: outputContentType });
      console.log('Generated image size:', Math.round(imageBlob.size / 1024), 'KB');
    }

    // Generate unique filename - always PNG
    const timestamp = Date.now();
    const fileName = `${userId}/${courseId}/${timestamp}.png`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, imageBlob, {
        contentType: outputContentType,
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
