import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

// RSA-sign a JWT using the service account private key
async function createSignedJWT(
  serviceAccount: { client_email: string; private_key: string },
  payload: Record<string, unknown>
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    aud: "google",
    iat: now,
    exp: now + 3600,
    ...payload,
  };

  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const claimsB64 = b64url(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  // Import PEM private key
  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBuf = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(signingInput)
  );

  return `${signingInput}.${b64url(signature)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { short_code } = await req.json();
    if (!short_code) {
      return new Response(JSON.stringify({ error: "short_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");
    const serviceAccountJson = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");

    if (!issuerId || !serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "Google Wallet not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    // Fetch business card
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: card, error } = await supabase
      .from("business_cards")
      .select("*")
      .eq("short_code", short_code)
      .single();

    if (error || !card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = [card.first_name, card.last_name].filter(Boolean).join(" ");
    const objectId = `${issuerId}.barberlaunch_card_${card.short_code}`;
    const classId = `${issuerId}.barberlaunch_generic`;

    // Build the Generic pass object
    const genericObject: Record<string, unknown> = {
      id: objectId,
      classId: classId,
      cardTitle: {
        defaultValue: { language: "en", value: card.business_name },
      },
      subheader: {
        defaultValue: { language: "en", value: "Hair Replacement" },
      },
      header: {
        defaultValue: { language: "en", value: displayName || card.business_name },
      },
      hexBackgroundColor: "#1a1a2e",
      heroImage: card.hero_image_url
        ? {
            sourceUri: { uri: card.hero_image_url },
            contentDescription: {
              defaultValue: { language: "en", value: "Transformation" },
            },
          }
        : undefined,
      logo: card.logo_url
        ? {
            sourceUri: { uri: card.logo_url },
            contentDescription: {
              defaultValue: { language: "en", value: card.business_name },
            },
          }
        : undefined,
      linksModuleData: {
        uris: [
          ...(card.booking_url
            ? [
                {
                  uri: card.booking_url,
                  description: "Book Free Consultation",
                  id: "booking",
                },
              ]
            : []),
          ...(card.gallery_url
            ? [
                {
                  uri: card.gallery_url,
                  description: "See Transformations",
                  id: "gallery",
                },
              ]
            : []),
          ...(card.instagram_handle
            ? [
                {
                  uri: `https://instagram.com/${card.instagram_handle.replace(/^@/, "")}`,
                  description: card.instagram_handle,
                  id: "instagram",
                },
              ]
            : []),
          ...(card.website_url
            ? [
                {
                  uri: card.website_url,
                  description: "Visit Website",
                  id: "website",
                },
              ]
            : []),
        ],
      },
      textModulesData: [
        ...(card.phone
          ? [{ id: "phone", header: "Phone", body: card.phone }]
          : []),
        ...(card.email
          ? [{ id: "email", header: "Email", body: card.email }]
          : []),
      ],
    };

    // Remove undefined fields
    Object.keys(genericObject).forEach((k) => {
      if (genericObject[k] === undefined) delete genericObject[k];
    });

    // Build the JWT payload with embedded class + object
    const genericClass = {
      id: classId,
    };

    const jwtPayload = {
      typ: "savetowallet",
      origins: ["https://barber-launchpad-pro.lovable.app"],
      payload: {
        genericClasses: [genericClass],
        genericObjects: [genericObject],
      },
    };

    const token = await createSignedJWT(serviceAccount, jwtPayload);
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return new Response(JSON.stringify({ saveUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Google Wallet pass error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
