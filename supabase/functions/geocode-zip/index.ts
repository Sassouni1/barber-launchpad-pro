// Geocode a US ZIP code to lat/lng using Nominatim (OpenStreetMap)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { zip } = await req.json();
    if (!zip || !/^\d{5}$/.test(zip)) {
      return new Response(JSON.stringify({ error: "Invalid ZIP code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=USA&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BarberLaunch-Directory/1.0" },
    });
    const data = await res.json();

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "ZIP code not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lat, lon, display_name } = data[0];
    return new Response(
      JSON.stringify({
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        display_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
