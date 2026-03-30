import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const GHL_LOCATION_URL = "https://services.leadconnectorhq.com/locations";

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function getGhlCredentials() {
  const clientId = Deno.env.get("GHL_CLIENT_ID");
  const clientSecret = Deno.env.get("GHL_CLIENT_SECRET");
  const encryptionKey = Deno.env.get("GHL_ENCRYPTION_KEY");
  if (!clientId || !clientSecret || !encryptionKey) {
    throw new Error("Missing GHL OAuth configuration");
  }
  return { clientId, clientSecret, encryptionKey };
}

async function getAuthUrl(redirectUri: string) {
  const { clientId } = getGhlCredentials();
  const scopes = [
    "contacts.readonly",
    "contacts.write",
    "conversations/message.write",
    "locations.readonly",
  ].join(" ");

  const url = new URL("https://marketplace.gohighlevel.com/oauth/chooselocation");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);

  return url.toString();
}

async function exchangeToken(code: string, redirectUri: string) {
  const { clientId, clientSecret, encryptionKey } = getGhlCredentials();
  const supabase = getSupabase();

  // Exchange code for tokens
  const tokenRes = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${err}`);
  }

  const tokenData = await tokenRes.json();
  const {
    access_token,
    refresh_token,
    expires_in,
    locationId,
    userId: _userId,
  } = tokenData;

  if (!access_token || !refresh_token || !locationId) {
    throw new Error("Missing token data from GHL response");
  }

  // Fetch location name
  let locationName = locationId;
  try {
    const locRes = await fetch(`${GHL_LOCATION_URL}/${locationId}`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Version: "2021-07-28",
      },
    });
    if (locRes.ok) {
      const locData = await locRes.json();
      locationName = locData.location?.name || locationId;
    }
  } catch {
    // Keep locationId as name fallback
  }

  // Encrypt and store tokens
  const { data: accessTokenId, error: atErr } = await supabase.rpc(
    "store_encrypted_token",
    { token_value: access_token, encryption_key: encryptionKey }
  );
  if (atErr) throw atErr;

  const { data: refreshTokenId, error: rtErr } = await supabase.rpc(
    "store_encrypted_token",
    { token_value: refresh_token, encryption_key: encryptionKey }
  );
  if (rtErr) throw rtErr;

  const expiresAt = new Date(Date.now() + (expires_in || 86400) * 1000).toISOString();

  // Delete existing token for this location if any
  const { data: existing } = await supabase
    .from("ghl_oauth_tokens")
    .select("id, access_token_id, refresh_token_id")
    .eq("location_id", locationId)
    .maybeSingle();

  if (existing) {
    await supabase.from("ghl_oauth_tokens").delete().eq("id", existing.id);
    await supabase.from("app_secrets").delete().eq("id", existing.access_token_id);
    await supabase.from("app_secrets").delete().eq("id", existing.refresh_token_id);
  }

  // Insert new token record
  const { error: insertErr } = await supabase.from("ghl_oauth_tokens").insert({
    location_id: locationId,
    location_name: locationName,
    organization_id: tokenData.companyId || null,
    access_token_id: accessTokenId,
    refresh_token_id: refreshTokenId,
    expires_at: expiresAt,
  });

  if (insertErr) throw insertErr;

  return { locationId, locationName };
}

async function refreshToken(tokenRecord: any) {
  const { clientId, clientSecret, encryptionKey } = getGhlCredentials();
  const supabase = getSupabase();

  // Decrypt current refresh token
  const { data: currentRefreshToken, error: decErr } = await supabase.rpc(
    "decrypt_token",
    { token_id: tokenRecord.refresh_token_id, encryption_key: encryptionKey }
  );
  if (decErr) throw decErr;

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
    const err = await tokenRes.text();
    throw new Error(`Token refresh failed: ${tokenRes.status} ${err}`);
  }

  const tokenData = await tokenRes.json();

  // Delete old secrets
  await supabase.from("app_secrets").delete().eq("id", tokenRecord.access_token_id);
  await supabase.from("app_secrets").delete().eq("id", tokenRecord.refresh_token_id);

  // Store new encrypted tokens
  const { data: newAccessId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.access_token,
    encryption_key: encryptionKey,
  });
  const { data: newRefreshId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.refresh_token,
    encryption_key: encryptionKey,
  });

  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in || 86400) * 1000
  ).toISOString();

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

async function disconnect(locationId: string) {
  const supabase = getSupabase();

  const { data: token } = await supabase
    .from("ghl_oauth_tokens")
    .select("id, access_token_id, refresh_token_id")
    .eq("location_id", locationId)
    .maybeSingle();

  if (!token) throw new Error("No connection found for this location");

  await supabase.from("ghl_oauth_tokens").delete().eq("id", token.id);
  await supabase.from("app_secrets").delete().eq("id", token.access_token_id);
  await supabase.from("app_secrets").delete().eq("id", token.refresh_token_id);

  return { success: true };
}

async function getConnectedLocations() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ghl_oauth_tokens")
    .select("location_id, location_name, expires_at, updated_at");

  if (error) throw error;
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    let result: any;

    switch (action) {
      case "getAuthUrl":
        result = { url: await getAuthUrl(params.redirectUri) };
        break;
      case "exchangeToken":
        result = await exchangeToken(params.code, params.redirectUri);
        break;
      case "disconnect":
        result = await disconnect(params.locationId);
        break;
      case "getConnectedLocations":
        result = await getConnectedLocations();
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ghl-oauth error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
