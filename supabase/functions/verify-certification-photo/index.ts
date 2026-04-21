// Verifies that an uploaded photo shows a person holding a certificate.
// Returns { valid: boolean, reason: string }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const imageContent = imageBase64
      ? `data:image/jpeg;base64,${imageBase64}`
      : imageUrl;
    if (!imageContent) {
      return new Response(JSON.stringify({ error: "imageUrl or imageBase64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You verify proof-of-certification photos. Approve only if you can clearly see a real person AND a printed or screen-displayed certificate/diploma in the same photo. Reject screenshots of just a certificate, blurry photos, or photos with no certificate visible.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Does this photo show a person holding (or clearly posing with) a visible certificate, diploma, or training completion document? Be lenient on the certificate design but strict that BOTH a person's face/body AND a certificate are visible.",
              },
              { type: "image_url", image_url: { url: imageContent } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_verification",
              description: "Report whether the photo is a valid proof-of-certification photo.",
              parameters: {
                type: "object",
                properties: {
                  valid: { type: "boolean" },
                  reason: { type: "string", description: "Short explanation (1 sentence)." },
                },
                required: ["valid", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_verification" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      if (aiRes.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (aiRes.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: "AI verification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    const valid = !!args?.valid;
    const reason = args?.reason || (valid ? "Looks good." : "Could not verify certificate.");

    return new Response(JSON.stringify({ valid, reason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-certification-photo error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
