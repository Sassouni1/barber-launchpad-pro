import { requireMemberContentAccess } from "../_shared/memberGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

type Difficulty = "easy" | "medium" | "difficult";

const difficultyDirections: Record<Difficulty, string> = {
  easy: "You are open and friendly. You answer questions directly, explain your main concern when asked, and are willing to consider a free consultation after a clear invitation.",
  medium: "You are interested but cautious. You wonder whether a hair system will look natural and what maintenance involves. Ask one genuine question at a time, and agree to a consultation only after the caller listens and answers your concern.",
  difficult: "You are guarded because a previous hair-loss consultation felt pushy. You worry about privacy, cost, and whether a system will look obvious. Do not accept a rushed pitch. Become more receptive if the caller listens, responds honestly, and offers a low-pressure next step. Respectfully decline if they keep pushing.",
};

function response(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function safetyIdentifier(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const gate = await requireMemberContentAccess(req, corsHeaders);
  if (!gate.ok) return gate.response;

  let difficulty: Difficulty;
  try {
    const body = await req.json();
    if (!body || !Object.hasOwn(difficultyDirections, body.difficulty)) {
      return response({ error: "Choose a difficulty level" }, 400);
    }
    difficulty = body.difficulty as Difficulty;
  } catch {
    return response({ error: "Invalid request" }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return response({ error: "Voice practice is not configured" }, 503);

  const instructions = `You are Mark, a realistic prospective client in a Barber Launch appointment-setting practice call. You are about 40, you have visible thinning hair, and you recently requested information about nonsurgical hair replacement, but you have not booked a consultation. The user is a barber or stylist calling you back. Stay in character as Mark throughout the call. Wait for the caller to greet you; do not begin with a sales pitch or coaching. Speak naturally in short conversational turns, usually one or two sentences. Reveal your concerns gradually in response to questions. Do not sound like a scripted objection list. Your underlying concern is whether a hair system will look natural and fit your everyday life. ${difficultyDirections[difficulty]} Do not act as the barber, train the user, score the call, or explain the exercise while the roleplay is active. If the caller offers a specific appointment time that works for you, you may agree to that time in the simulation, but never claim a real calendar booking or confirmation occurred. If asked directly whether this is a simulation, answer honestly and return to the roleplay. If the caller ends the call, say a brief natural goodbye.`;

  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": await safetyIdentifier(gate.userId),
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1",
          instructions,
          output_modalities: ["audio"],
          audio: {
            input: { turn_detection: { type: "server_vad" } },
            output: { voice: "cedar" },
          },
        },
      }),
    });
    if (!upstream.ok) {
      console.error("appointment-practice-session provider error", upstream.status, (await upstream.text()).slice(0, 300));
      return response({ error: "Voice practice could not start" }, 502);
    }
    const data = await upstream.json();
    if (typeof data.value !== "string" || !data.value) {
      return response({ error: "Voice practice could not start" }, 502);
    }
    return response({ clientSecret: data.value }, 200);
  } catch (error) {
    console.error("appointment-practice-session error", error);
    return response({ error: "Voice practice could not start" }, 502);
  }
});
