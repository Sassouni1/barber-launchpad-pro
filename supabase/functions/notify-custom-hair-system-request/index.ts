import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://member.thebarberlaunch.com";
const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const CHRIS_PHONE = "7276374672";

const GHL_HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  Version: "2021-07-28",
});

type SupabaseClient = ReturnType<typeof createClient>;

type GhlTokenRecord = {
  id: string;
  access_token_id: string;
  refresh_token_id: string;
  expires_at: string;
  location_id: string;
};

async function refreshToken(supabase: SupabaseClient, tokenRecord: GhlTokenRecord, encryptionKey: string): Promise<string> {
  const clientId = Deno.env.get("GHL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GHL_CLIENT_SECRET")!;

  const { data: currentRefreshToken } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.refresh_token_id,
    encryption_key: encryptionKey,
  });

  const tokenRes = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken as string,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GHL refresh failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json();

  await supabase.from("app_secrets").delete().eq("id", tokenRecord.access_token_id);
  await supabase.from("app_secrets").delete().eq("id", tokenRecord.refresh_token_id);

  const { data: newAccessId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.access_token,
    encryption_key: encryptionKey,
  });
  const { data: newRefreshId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.refresh_token,
    encryption_key: encryptionKey,
  });

  await supabase
    .from("ghl_oauth_tokens")
    .update({
      access_token_id: newAccessId,
      refresh_token_id: newRefreshId,
      expires_at: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRecord.id);

  return tokenData.access_token;
}

async function getAccessToken(supabase: SupabaseClient): Promise<{ accessToken: string; locationId: string }> {
  const directToken =
    Deno.env.get("GHL_ACCESS_TOKEN") ||
    Deno.env.get("GHL_PRIVATE_INTEGRATION_TOKEN") ||
    Deno.env.get("GHL_API_KEY");
  const directLocationId = Deno.env.get("GHL_LOCATION_ID");
  if (directToken && directLocationId) {
    return { accessToken: directToken, locationId: directLocationId };
  }

  const encryptionKey = Deno.env.get("GHL_ENCRYPTION_KEY");
  if (!encryptionKey) throw new Error("GHL is not configured.");

  const { data: tokenRecord, error } = await supabase
    .from("ghl_oauth_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !tokenRecord) throw new Error("No GHL OAuth connection found");

  if (new Date(tokenRecord.expires_at as string).getTime() - Date.now() < 5 * 60 * 1000) {
    const accessToken = await refreshToken(supabase, tokenRecord as unknown as GhlTokenRecord, encryptionKey);
    return { accessToken, locationId: tokenRecord.location_id as string };
  }

  const { data: accessToken, error: decErr } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.access_token_id,
    encryption_key: encryptionKey,
  });
  if (decErr || !accessToken) throw new Error("Failed to decrypt GHL access token");

  return { accessToken: accessToken as string, locationId: tokenRecord.location_id as string };
}

async function resolveChrisContactId(accessToken: string, locationId: string): Promise<string> {
  const configured = Deno.env.get("GHL_CHRIS_CONTACT_ID");
  if (configured) return configured;

  const searchUrl = `${GHL_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(CHRIS_PHONE)}`;
  const searchRes = await fetch(searchUrl, { headers: GHL_HEADERS(accessToken) });
  if (searchRes.ok) {
    const data = await searchRes.json();
    const contact = Array.isArray(data.contacts) ? data.contacts[0] : null;
    if (contact?.id) return contact.id;
  }

  const createRes = await fetch(`${GHL_BASE}/contacts/`, {
    method: "POST",
    headers: GHL_HEADERS(accessToken),
    body: JSON.stringify({ locationId, firstName: "Chris", lastName: "Sassouni", phone: CHRIS_PHONE }),
  });
  if (!createRes.ok) throw new Error(`Failed to create/find Chris contact: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json();
  const contactId = created.contact?.id || created.id;
  if (!contactId) throw new Error("GHL create contact response missing id");
  return contactId;
}

async function sendSms(supabase: SupabaseClient, message: string) {
  const { accessToken, locationId } = await getAccessToken(supabase);
  const contactId = await resolveChrisContactId(accessToken, locationId);
  const smsRes = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: GHL_HEADERS(accessToken),
    body: JSON.stringify({ type: "SMS", contactId, message, phone: CHRIS_PHONE }),
  });
  if (!smsRes.ok) throw new Error(`GHL SMS failed: ${smsRes.status} ${await smsRes.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requestId } = (await req.json()) as { requestId?: string };
    if (!requestId) throw new Error("requestId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify the caller from their own JWT; never trust the body for identity.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData } = await supabase.auth.getUser(token);
    const callerId = userData.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: request, error: reqErr } = await supabase
      .from("custom_hair_system_requests")
      .select("id,user_id,request_type,hair_length,base_details,color,curl_or_wave,needed_by,description,contact_name,contact_email,contact_phone")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !request) throw reqErr || new Error("Request not found");
    if (request.user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", callerId)
      .maybeSingle();

    const lines = [
      "CUSTOM_HAIR_SYSTEM_REQUEST",
      "Member requested a custom/special hair system",
      `Member: ${profile?.full_name || request.contact_name || "Unknown"} <${profile?.email || request.contact_email || "unknown"}>`,
      `Type: ${request.request_type}`,
      request.hair_length ? `Length: ${request.hair_length}` : null,
      request.base_details ? `Base/size: ${request.base_details}` : null,
      request.color ? `Color: ${request.color}` : null,
      request.curl_or_wave ? `Curl/wave: ${request.curl_or_wave}` : null,
      request.needed_by ? `Needed by: ${request.needed_by}` : null,
      request.contact_phone ? `Phone: ${request.contact_phone}` : null,
      `Details: ${request.description}`,
      `Admin URL: ${APP_URL}/admin/members`,
    ].filter(Boolean) as string[];

    await sendSms(supabase, lines.join("\n"));

    return new Response(JSON.stringify({ success: true, requestId, sentTo: CHRIS_PHONE }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-custom-hair-system-request error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
