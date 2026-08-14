import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Aspect = 'square' | 'portrait' | 'landscape';

const DIMENSIONS: Record<Aspect, { width: number; height: number; openaiSize: string }> = {
  square: { width: 1024, height: 1024, openaiSize: '1024x1024' },
  portrait: { width: 1024, height: 1536, openaiSize: '1024x1536' },
  landscape: { width: 1536, height: 1024, openaiSize: '1536x1024' },
};

function buildEnhancedPrompt(prompt: string, aspect: Aspect): string {
  const { width, height } = DIMENSIONS[aspect];
  return `Create a polished, dignified, believable professional marketing image for a barber / hair-system business.

MEMBER REQUEST (this is the subject of the image):
${prompt}

QUALITY AND REALISM STANDARD:
- Photographic, high-end commercial quality. Realistic lighting, realistic skin texture and tones, natural depth of field.
- If the scene involves a hair system or hair replacement process, show an adult client and a trained professional working in a clean, real barbershop or studio.
- When the member asks for someone 'doing a hair system' or otherwise describes the installation process, make the scene unmistakably show a professional actively fitting or installing a non-surgical hair replacement system on a client's thinning or prepared crown. Show a credible system base, placement, fitting, or attachment step so the result cannot be mistaken for an ordinary haircut, combing, or styling photo.
- Hands, fingers, tools, clippers, shears, combs, tape, adhesive, and hair-system materials must be anatomically and physically correct, and used with credible, professional technique.
- The client must look dignified and respected — never embarrassed, comedic, exaggerated, or distressed.
- Composition should feel intentional and premium: clean background, tidy station, professional wardrobe.

STRICT CONTENT RULES:
- Do NOT add marketing claims, promises, prices, statistics, logos, watermarks, badges, captions, or random text of any kind unless the member explicitly supplied exact wording above. If exact wording was supplied, render only that wording, spelled exactly.
- Do NOT fabricate a before-and-after or split-panel comparison unless the member explicitly asked for one.
- No distorted anatomy, no extra limbs, no melted or duplicated hairlines, no impossible tool use.
- No text gibberish anywhere in the frame.

OUTPUT: a single image, approximately ${width}x${height} pixels (${aspect} orientation).`;
}

function detectAspect(value: unknown): Aspect {
  return value === 'portrait' || value === 'landscape' ? value : 'square';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // ---- Auth: manually validate the bearer JWT ----
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ success: false, error: 'You must be signed in to generate images.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return json({ success: false, error: 'You must be signed in to generate images.' }, 401);
    }

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const prompt: string = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const conversationId: string | null = typeof body?.conversationId === 'string' ? body.conversationId : null;
    const aspect = detectAspect(body?.aspect);

    if (prompt.length < 4 || prompt.length > 2000) {
      return json({ success: false, error: 'Describe the image in 4 to 2000 characters.' }, 400);
    }

    if (conversationId) {
      const { data: conv } = await admin
        .from('aion_conversations')
        .select('id, user_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (!conv || conv.user_id !== user.id) {
        return json({ success: false, error: 'Conversation not found.' }, 403);
      }
    }

    // ---- Rolling 24h rate limit ----
    const dailyLimit = Number(Deno.env.get('AION_IMAGE_DAILY_LIMIT') || '10') || 10;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('aion_generated_images')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if ((count ?? 0) >= dailyLimit) {
      return json(
        { success: false, error: `You've reached your limit of ${dailyLimit} images in 24 hours. Try again later.` },
        429,
      );
    }

    const enhancedPrompt = buildEnhancedPrompt(prompt, aspect);
    const { width, height, openaiSize } = DIMENSIONS[aspect];

    let bytes: Uint8Array | null = null;
    let extension = 'png';
    let contentType = 'image/png';
    let provider = '';
    let model = '';

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_KEY');

    const b64ToBytes = (b64: string) => {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };

    if (OPENAI_API_KEY) {
      provider = 'openai';
      model = 'gpt-image-2';
      const resp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt: enhancedPrompt,
          n: 1,
          size: openaiSize,
          quality: 'medium',
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('OpenAI image error:', resp.status, errText.slice(0, 500));
        if (resp.status === 429) return json({ success: false, error: 'Image service is busy. Try again in a moment.' }, 429);
        return json({ success: false, error: 'Image generation failed. Please try again.' }, 502);
      }
      const data = await resp.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) {
        console.error('OpenAI returned no image payload');
        return json({ success: false, error: 'No image was generated. Please try again.' }, 502);
      }
      bytes = b64ToBytes(b64);
    } else if (GOOGLE_API_KEY) {
      provider = 'google';
      model = 'gemini-3-pro-image-preview';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('Google image error:', resp.status, errText.slice(0, 500));
        if (resp.status === 429) return json({ success: false, error: 'Image service is busy. Try again in a moment.' }, 429);
        return json({ success: false, error: 'Image generation failed. Please try again.' }, 502);
      }
      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      let inline: { data: string; mimeType?: string } | null = null;
      for (const part of parts) {
        if (part?.inlineData?.data) { inline = part.inlineData; break; }
      }
      if (!inline) {
        console.error('Google returned no image part');
        return json({ success: false, error: 'No image was generated. Please try again.' }, 502);
      }
      contentType = inline.mimeType || 'image/png';
      extension = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
      bytes = b64ToBytes(inline.data);
    } else {
      return json({ success: false, error: 'Image generation is not configured.' }, 500);
    }

    if (!bytes) {
      return json({ success: false, error: 'No image was generated. Please try again.' }, 502);
    }

    // ---- Store ----
    const generatedId = crypto.randomUUID();
    const storagePath = `${user.id}/aion/${generatedId}.${extension}`;
    const { error: uploadErr } = await admin.storage
      .from('marketing-images')
      .upload(storagePath, bytes, { contentType, upsert: false });
    if (uploadErr) {
      console.error('Upload failed:', uploadErr.message);
      return json({ success: false, error: 'Could not save the generated image. Please try again.' }, 500);
    }

    const { data: pub } = admin.storage.from('marketing-images').getPublicUrl(storagePath);
    const publicUrl = pub.publicUrl;

    const { error: insertErr } = await admin.from('aion_generated_images').insert({
      id: generatedId,
      user_id: user.id,
      conversation_id: conversationId,
      prompt,
      enhanced_prompt: enhancedPrompt,
      provider,
      model,
      storage_path: storagePath,
      public_url: publicUrl,
      width,
      height,
    });
    if (insertErr) {
      console.error('Metadata insert failed:', insertErr.message);
      await admin.storage.from('marketing-images').remove([storagePath]);
      return json({ success: false, error: 'Could not save the generated image. Please try again.' }, 500);
    }

    return json({
      success: true,
      id: generatedId,
      url: publicUrl,
      prompt,
      provider,
      model,
      width,
      height,
    });
  } catch (error) {
    console.error('aion-generate-image error:', error instanceof Error ? error.message : error);
    return json({ success: false, error: 'Image generation failed. Please try again.' }, 500);
  }
});
