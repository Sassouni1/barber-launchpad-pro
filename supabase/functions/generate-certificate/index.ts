import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image, decode } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Canonical template path
const TEMPLATE_PATH = 'template/certificate-template.png';

// Text positioning (these are approximate - adjust based on your template)
const NAME_CONFIG = {
  y: 0.42, // Percentage from top (42% down)
  maxWidth: 0.7, // Max width as percentage of image width
  color: 0xD4AF37FF, // Gold color (RGBA)
  baseFontSize: 72,
  minFontSize: 36,
};

const DATE_CONFIG = {
  x: 0.175, // Percentage from left (17.5%)
  y: 0.815, // Percentage from top (81.5%)
  color: 0xD4AF37FF, // Gold color
  fontSize: 20,
};

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      },
    });

    // Fetch the template image
    console.log('Fetching template...');
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

    const templateArrayBuffer = await templateResp.arrayBuffer();
    const templateBytes = new Uint8Array(templateArrayBuffer);
    console.log('Template loaded:', { 
      chosenPath, 
      sizeKB: Math.round(templateBytes.length / 1024)
    });

    // Decode the template image
    console.log('Decoding template image...');
    const image = await decode(templateBytes);
    
    if (!(image instanceof Image)) {
      throw new Error('Failed to decode template as Image');
    }

    console.log('Image decoded:', { width: image.width, height: image.height });

    // Format the date
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Since imagescript doesn't have built-in text rendering with custom fonts,
    // we'll use a simpler approach: create the certificate without text overlay
    // and rely on the AI for now, but with stricter instructions
    
    // For a production solution, we would need to:
    // 1. Use a different library that supports TTF fonts
    // 2. Or pre-render text as images and composite them
    // 3. Or use a service like Cloudinary or imgix
    
    // For now, let's use the Lovable AI with very strict instructions
    // to minimize quality loss and prevent artifacts
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    // Convert to base64 for AI
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < templateBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...templateBytes.subarray(i, i + chunkSize));
    }
    const templateBase64 = btoa(binary);
    const templateBase64Url = `data:image/png;base64,${templateBase64}`;

    console.log('Using AI to add text (strict mode)...');

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
                text: `CRITICAL: You are a TEXT OVERLAY tool only. Your job is to add text to this certificate.

ABSOLUTE REQUIREMENTS:
1. OUTPUT THE EXACT SAME IMAGE with ONLY text added
2. DO NOT change ANY colors, gradients, or backgrounds
3. DO NOT add any visual effects, shadows, or modifications
4. PRESERVE the exact resolution and quality
5. The background is dark brown/maroon - DO NOT add any purple, blue, or other colors

TEXT TO ADD:

NAME: "${certificateName}"
- Position: Centered horizontally, in the empty space below "This Certificate is Proudly Presented to"
- Color: GOLD (#D4AF37 or #C4A35A) - matching the existing gold elements
- Font: Elegant script/cursive style similar to the title
- Size: ${certificateName.length > 20 ? 'Medium (long name)' : 'Large'}

DATE: "${currentDate}"
- Position: Bottom left, above the "DATE" label
- Color: Same gold as name
- Font: Simple serif
- Size: Small

WARNINGS:
- If you change the background color, you have FAILED
- If you reduce the resolution, you have FAILED  
- If you add any colors other than gold text, you have FAILED
- The ONLY change should be adding gold text`
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

    const generatedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error('No image in AI response:', JSON.stringify(aiData).substring(0, 500));
      throw new Error('Failed to generate certificate image');
    }

    console.log('Certificate image generated');

    // Convert base64 to blob
    let imageBlob: Blob;
    const outputContentType = 'image/png';
    
    if (generatedImageUrl.startsWith('data:')) {
      const base64Data = generatedImageUrl.split(',')[1];
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      imageBlob = new Blob([binaryData], { type: outputContentType });
      console.log('Generated image size:', Math.round(binaryData.length / 1024), 'KB');
    } else {
      const imageResponse = await fetch(generatedImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: outputContentType });
    }

    // Upload to storage
    const timestamp = Date.now();
    const fileName = `${userId}/${courseId}/${timestamp}.png`;

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

    const { data: { publicUrl } } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);

    console.log('Certificate uploaded to:', publicUrl);

    // Save to database
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
