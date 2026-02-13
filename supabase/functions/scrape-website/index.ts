const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured. Please connect Firecrawl in settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping URL:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'links', 'branding', 'screenshot'],
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Scrape failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract brand profile from scraped data
    const markdown = data.data?.markdown || data.markdown || '';
    const metadata = data.data?.metadata || data.metadata || {};
    const branding = data.data?.branding || data.branding || null;
    const screenshot = data.data?.screenshot || data.screenshot || null;

    // Extract image URLs from markdown content (![alt](url) patterns)
    const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const markdownImages: string[] = [];
    let match;
    while ((match = imageRegex.exec(markdown)) !== null) {
      const imgUrl = match[1];
      // Filter for likely hero/product images (skip tiny icons, svgs, tracking pixels)
      if (imgUrl && !imgUrl.includes('.svg') && !imgUrl.includes('tracking') && !imgUrl.includes('pixel') && !imgUrl.includes('favicon')) {
        markdownImages.push(imgUrl);
      }
    }

    // Collect best images: og:image, logo, and top content images
    const collectedImages: string[] = [];
    if (metadata.ogImage) collectedImages.push(metadata.ogImage);
    if (branding?.images?.ogImage) collectedImages.push(branding.images.ogImage);
    if (branding?.logo) collectedImages.push(branding.logo);
    if (branding?.images?.logo) collectedImages.push(branding.images.logo);
    // Add first few unique content images
    for (const img of markdownImages) {
      if (!collectedImages.includes(img) && collectedImages.length < 6) {
        collectedImages.push(img);
      }
    }

    console.log('Extracted images:', collectedImages.length);

    const brandProfile = {
      title: metadata.title || '',
      description: metadata.description || '',
      content: markdown.substring(0, 3000),
      sourceUrl: formattedUrl,
      branding: branding ? {
        colors: branding.colors || {},
        fonts: branding.fonts || [],
        logo: branding.logo || branding.images?.logo || null,
      } : null,
      images: collectedImages,
      screenshot: screenshot || null,
    };

    console.log('Scrape successful, brand profile extracted');
    return new Response(
      JSON.stringify({ success: true, brandProfile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape website';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
