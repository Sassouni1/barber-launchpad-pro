// Batch English -> Spanish translator backed by Lovable AI Gateway.
// Used by the in-app DOM auto-translator to handle dynamic strings
// (lesson titles, course descriptions, toasts, etc.) that aren't in
// the static dictionary.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface Body {
  texts: string[];
  target?: "es" | "en";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { texts, target = "es" } = (await req.json()) as Body;
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate + trim and cap batch size.
    const unique = Array.from(new Set(texts.map((t) => String(t).trim()).filter(Boolean))).slice(0, 200);

    const system = target === "es"
      ? `You are translating UI strings for a barber/hair-system training platform called Barber Launch Academy from English to Latin American Spanish.
Rules:
- Keep brand names in English: Barber Launch Academy, Aion, GHL, Stripe, Klarna, Apple Pay, Printful, Vimeo, Zoom, Lovable.
- Keep proper names of people unchanged.
- Preserve punctuation, emoji, %, $, numbers, and inline markdown/HTML exactly.
- Translate naturally for a professional barber audience, not literally.
- Return ONLY a JSON object mapping each original English string to its Spanish translation. No prose, no code fences.`
      : `Translate the given strings to English. Return only a JSON object mapping originals to translations.`;

    const userPrompt = `Translate these strings. Return JSON like {"Hello":"Hola"}.\n\n${JSON.stringify(unique)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: errText }), {
        status: aiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let translations: Record<string, string> = {};
    try {
      translations = JSON.parse(content);
    } catch {
      // Try to extract JSON from a code-fenced response just in case.
      const match = content.match(/\{[\s\S]*\}/);
      if (match) translations = JSON.parse(match[0]);
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
