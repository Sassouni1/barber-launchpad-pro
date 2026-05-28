import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://barber-launchpad-pro.lovable.app";
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
      refresh_token: currentRefreshToken,
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

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString();

  await supabase
    .from("ghl_oauth_tokens")
    .update({
      access_token_id: newAccessId,
      refresh_token_id: newRefreshId,
      expires_at: expiresAt,
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
  if (!encryptionKey) {
    throw new Error("GHL is not configured.");
  }

  const { data: tokenRecord, error } = await supabase
    .from("ghl_oauth_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !tokenRecord) throw new Error("No GHL OAuth connection found");

  if (new Date(tokenRecord.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const accessToken = await refreshToken(supabase, tokenRecord as GhlTokenRecord, encryptionKey);
    return { accessToken, locationId: tokenRecord.location_id };
  }

  const { data: accessToken, error: decErr } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.access_token_id,
    encryption_key: encryptionKey,
  });
  if (decErr || !accessToken) throw new Error("Failed to decrypt GHL access token");

  return { accessToken, locationId: tokenRecord.location_id };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { submissionId, eventType } = body as { submissionId: string; eventType?: "submitted" | "resolved" };
    if (!submissionId) throw new Error("submissionId is required");
    const kind = eventType === "resolved" ? "resolved" : "submitted";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: submission, error: submissionError } = await supabase
      .from("certification_photos")
      .select("id,user_id,course_id,file_name,uploaded_at,approved")
      .eq("id", submissionId)
      .single();
    if (submissionError || !submission) throw submissionError || new Error("Submission not found");

    const [{ data: profile }, { data: course }, { data: fulfillment }] = await Promise.all([
      supabase.from("profiles").select("full_name,email").eq("id", submission.user_id).maybeSingle(),
      supabase.from("courses").select("title").eq("id", submission.course_id).maybeSingle(),
      supabase.from("certification_fulfillment_requests")
        .select("id,status,address_line1,city,state,postal_code")
        .eq("user_id", submission.user_id)
        .eq("course_id", submission.course_id)
        .maybeSingle(),
    ]);

    const studentLabel = `${profile?.full_name || "Unknown"} <${profile?.email || "unknown"}>`;
    const courseLabel = course?.title || submission.course_id;
    const adminUrl = `${APP_URL}/admin/templates`;

    const message = kind === "resolved"
      ? [
          `CERTIFICATION_RESOLVED ${submissionId}`,
          "Barber Launch certification marked resolved/fulfilled",
          `Student: ${studentLabel}`,
          `Course: ${courseLabel}`,
          `Admin URL: ${adminUrl}`,
        ].join("\n")
      : [
          `CERTIFICATION_SUBMISSION ${submissionId}`,
          "Barber Launch certification submission needs review",
          `Student: ${studentLabel}`,
          `Course: ${courseLabel}`,
          `Admin URL: ${adminUrl}`,
          `Address: ${fulfillment?.address_line1 ? "complete" : "missing"}`,
        ].join("\n");


    const { accessToken, locationId } = await getAccessToken(supabase);
    const contactId = await resolveChrisContactId(accessToken, locationId);

    const smsRes = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: GHL_HEADERS(accessToken),
      body: JSON.stringify({ type: "SMS", contactId, message, phone: CHRIS_PHONE }),
    });

    if (!smsRes.ok) throw new Error(`GHL SMS failed: ${smsRes.status} ${await smsRes.text()}`);

    return new Response(
      JSON.stringify({ success: true, submissionId, sentTo: CHRIS_PHONE }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notify-certification-submission error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
