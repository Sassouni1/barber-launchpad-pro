import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Orientation = 'landscape' | 'portrait' | 'square';

const SIZES: Record<Orientation, { width: number; height: number; openaiSize: string }> = {
  landscape: { width: 1536, height: 1024, openaiSize: '1536x1024' },
  portrait: { width: 1024, height: 1536, openaiSize: '1024x1536' },
  square: { width: 1024, height: 1024, openaiSize: '1024x1024' },
};

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

const PROMPT = `Make sure you don't generate a brand new person, your only job to expand the size of the image through image generation. Make sure the background makes sense. And if you aren't sure what it is, make it look like a barbershop or salon.`;

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) return null;
  try {
    const bin = atob(match[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ success: false, error: 'You must be signed in to expand images.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) {
      return json({ success: false, error: 'You must be signed in to expand images.' }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'Invalid JSON body.' }, 400);
    }

    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const orientationRaw = typeof body.orientation === 'string' ? body.orientation : '';
    if (!['landscape', 'portrait', 'square'].includes(orientationRaw)) {
      return json({ success: false, error: 'orientation must be landscape, portrait, or square.' }, 400);
    }
    const orientation = orientationRaw as Orientation;

    if (!imageDataUrl) {
      return json({ success: false, error: 'imageDataUrl is required.' }, 400);
    }
    const decoded = decodeDataUrl(imageDataUrl);
    if (!decoded) {
      return json(
        { success: false, error: 'imageDataUrl must be a base64 data URL of type PNG, JPEG, or WebP.' },
        400,
      );
    }
    if (decoded.bytes.byteLength > MAX_BYTES) {
      return json({ success: false, error: 'Image is too large. Maximum size is 12 MB.' }, 413);
    }

    const maskDataUrl = typeof body.maskDataUrl === 'string' ? body.maskDataUrl : '';
    if (!maskDataUrl) {
      return json({ success: false, error: 'maskDataUrl is required.' }, 400);
    }
    const decodedMask = decodeDataUrl(maskDataUrl);
    if (!decodedMask) {
      return json(
        { success: false, error: 'maskDataUrl must be a base64 data URL of type PNG, JPEG, or WebP.' },
        400,
      );
    }
    if (decodedMask.bytes.byteLength > MAX_BYTES) {
      return json({ success: false, error: 'Mask is too large. Maximum size is 12 MB.' }, 413);
    }


    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return json({ success: false, error: 'Image expansion is not configured.' }, 503);
    }

    const { width, height, openaiSize } = SIZES[orientation];
    const ext = decoded.mime === 'image/png' ? 'png' : decoded.mime === 'image/webp' ? 'webp' : 'jpg';

    const toBytes = (b64: string) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    };

    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', PROMPT);
    form.append('size', openaiSize);
    form.append('n', '1');
    form.append(
      'image',
      new File([decoded.bytes as unknown as BlobPart], `source.${ext}`, { type: decoded.mime }),
    );
    form.append(
      'mask',
      new File([decodedMask.bytes as unknown as BlobPart], 'mask.png', { type: 'image/png' }),
    );


    const resp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenAI edits error:', resp.status, errText.slice(0, 500));
      if (resp.status === 429) {
        return json({ success: false, error: 'Image service is busy. Try again in a moment.' }, 429);
      }
      return json({ success: false, error: 'Image expansion failed. Please try again.' }, 502);
    }

    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error('OpenAI returned no image payload');
      return json({ success: false, error: 'No image was generated. Please try again.' }, 502);
    }
    const outBytes = toBytes(b64);


    const storagePath = `${user.id}/generated-expansions/${crypto.randomUUID()}.png`;
    const { error: uploadErr } = await admin.storage
      .from('website-assets')
      .upload(storagePath, outBytes, { contentType: 'image/png', upsert: false });
    if (uploadErr) {
      console.error('Upload failed:', uploadErr.message);
      return json({ success: false, error: 'Could not save the expanded image. Please try again.' }, 500);
    }

    const { data: pub } = admin.storage.from('website-assets').getPublicUrl(storagePath);
    let url = pub?.publicUrl ?? '';
    // Fall back to a signed URL if the bucket is not publicly readable.
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) {
        const { data: signed } = await admin.storage
          .from('website-assets')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) url = signed.signedUrl;
      }
    } catch {
      // keep public URL
    }

    return json({ success: true, url, path: storagePath, width, height, orientation });
  } catch (error) {
    console.error('website-image-expand error:', error instanceof Error ? error.message : error);
    return json({ success: false, error: 'Image expansion failed. Please try again.' }, 500);
  }
});
