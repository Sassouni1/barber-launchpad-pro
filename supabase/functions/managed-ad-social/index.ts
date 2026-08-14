import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id?: string } | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function base64UrlEncode(value: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
}

function base64UrlBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function stateKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signState(payload: Record<string, unknown>, secret: string) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await stateKey(secret), new TextEncoder().encode(encoded));
  return `${encoded}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}

async function verifyState(state: string, secret: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("Invalid Facebook connection state.");
  const valid = await crypto.subtle.verify("HMAC", await stateKey(secret), base64UrlBytes(signature), new TextEncoder().encode(encoded));
  if (!valid) throw new Error("Invalid Facebook connection state.");
  const payload = JSON.parse(base64UrlDecode(encoded)) as { userId?: string; issuedAt?: number };
  if (!payload.userId || !payload.issuedAt || Math.abs(Date.now() - payload.issuedAt) > 10 * 60 * 1000) {
    throw new Error("This Facebook connection link expired. Please try again.");
  }
  return payload;
}

async function graph<T>(url: URL) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error?.message || "Facebook could not complete this request.");
  return data as T;
}

async function listPages(accessToken: string) {
  const url = new URL("https://graph.facebook.com/v24.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account{id}");
  url.searchParams.set("access_token", accessToken);
  const result = await graph<{ data?: FacebookPage[] }>(url);
  return result.data ?? [];
}

function publicPages(pages: FacebookPage[]) {
  return pages.map(({ id, name, instagram_business_account }) => ({
    id,
    name,
    instagram_business_account_id: instagram_business_account?.id ?? null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appId = Deno.env.get("FACEBOOK_APP_ID");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    const appUrl = Deno.env.get("APP_URL");
    if (!appId || !appSecret || !appUrl) return json({ error: "Facebook Page connection is not configured." }, 503);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice("Bearer ".length));
    const userId = claims?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body?.action as string;
    const redirectUri = `${appUrl.replace(/\/$/, "")}/integrations/facebook/callback`;

    if (action === "getConnectUrl") {
      const state = await signState({ userId, issuedAt: Date.now(), nonce: crypto.randomUUID() }, appSecret);
      const url = new URL("https://www.facebook.com/v24.0/dialog/oauth");
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      url.searchParams.set("scope", "pages_show_list,pages_read_engagement");
      return json({ url: url.toString() });
    }

    if (action === "completeConnection") {
      if (!body?.code || !body?.state) return json({ error: "Missing Facebook connection details." }, 400);
      const state = await verifyState(body.state, appSecret);
      if (state.userId !== userId) return json({ error: "This Facebook connection belongs to a different member." }, 403);

      const tokenUrl = new URL("https://graph.facebook.com/v24.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("code", body.code);
      const token = await graph<{ access_token: string; expires_in?: number }>(tokenUrl);
      const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
      const { error } = await admin.from("ad_social_credentials").upsert({
        customer_id: userId,
        facebook_user_access_token: token.access_token,
        facebook_user_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "customer_id" });
      if (error) throw error;
      return json({ pages: publicPages(await listPages(token.access_token)) });
    }

    if (action === "listPages" || action === "selectPage") {
      const { data: credentials, error } = await admin
        .from("ad_social_credentials")
        .select("facebook_user_access_token")
        .eq("customer_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!credentials?.facebook_user_access_token) return json({ error: "Connect Facebook before choosing a Page." }, 409);

      const pages = await listPages(credentials.facebook_user_access_token);
      if (action === "listPages") return json({ pages: publicPages(pages) });

      const page = pages.find((item) => item.id === body?.pageId);
      if (!page) return json({ error: "That Facebook Page is no longer available for this connection." }, 404);
      const { error: credentialError } = await admin.from("ad_social_credentials").upsert({
        customer_id: userId,
        facebook_page_access_token: page.access_token,
        updated_at: new Date().toISOString(),
      }, { onConflict: "customer_id" });
      if (credentialError) throw credentialError;
      const { error: connectionError } = await admin.from("ad_social_connections").upsert({
        customer_id: userId,
        facebook_page_id: page.id,
        facebook_page_name: page.name,
        instagram_business_account_id: page.instagram_business_account?.id ?? null,
        connection_status: "connected",
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "customer_id" });
      if (connectionError) throw connectionError;
      return json({ page: publicPages([page])[0] });
    }

    if (action === "syncPage") {
      const { data: connection, error: connectionError } = await admin
        .from("ad_social_connections")
        .select("facebook_page_id")
        .eq("customer_id", userId)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection?.facebook_page_id) return json({ error: "Connect a Facebook Page before checking Instagram." }, 409);

      const { data: credentials, error: credentialsError } = await admin
        .from("ad_social_credentials")
        .select("facebook_user_access_token")
        .eq("customer_id", userId)
        .maybeSingle();
      if (credentialsError) throw credentialsError;
      if (!credentials?.facebook_user_access_token) return json({ error: "Reconnect Facebook before checking Instagram." }, 409);

      const page = (await listPages(credentials.facebook_user_access_token)).find((item) => item.id === connection.facebook_page_id);
      if (!page) return json({ error: "That Facebook Page is no longer available for this connection." }, 404);
      const { error: updateError } = await admin.from("ad_social_connections").update({
        instagram_business_account_id: page.instagram_business_account?.id ?? null,
        last_synced_at: new Date().toISOString(),
      }).eq("customer_id", userId);
      if (updateError) throw updateError;
      return json({ page: publicPages([page])[0] });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("managed-ad-social", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
