import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileUrl = url.searchParams.get('url');
    const fileName = url.searchParams.get('name') || 'download';

    if (!fileUrl) {
      return new Response(JSON.stringify({ error: 'Missing file URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloading file: ${fileName} from ${fileUrl}`);

    // Fetch the file from the source URL
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      console.error(`Failed to fetch file: ${fileResponse.status}`);
      return new Response(JSON.stringify({ error: 'Failed to fetch file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileBlob = await fileResponse.blob();
    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';

    console.log(`File fetched successfully. Size: ${fileBlob.size}, Type: ${contentType}`);

    // Return the file with proper download headers
    return new Response(fileBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in download-file function:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
