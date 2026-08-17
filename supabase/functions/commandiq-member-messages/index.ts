import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const requireString = (value: unknown, label: string) => {
  const result = String(value || "").trim();
  if (!result) throw Object.assign(new Error(`${label} is required.`), { status: 400 });
  return result;
};

async function verifyCommandIqOperator(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const commandIqUrl = Deno.env.get("COMMANDIQ_SUPABASE_URL");
  const commandIqKey = Deno.env.get("COMMANDIQ_SUPABASE_PUBLISHABLE_KEY");
  const allowedOrganizationId = Deno.env.get("COMMANDIQ_ALLOWED_ORGANIZATION_ID");
  if (!commandIqUrl || !commandIqKey || !allowedOrganizationId) {
    throw Object.assign(new Error("The CommandIQ membership bridge is not configured yet."), { status: 503 });
  }
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    console.log("stage=bearer-header result=missing-or-malformed");
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const sharedHeaders = { Authorization: authorization, apikey: commandIqKey };
  const userResponse = await fetch(`${commandIqUrl}/auth/v1/user`, { headers: sharedHeaders });
  if (!userResponse.ok) {
    console.log("stage=auth-user result=failed status=" + userResponse.status);
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const user = await userResponse.json();
  if (!user?.id) {
    console.log("stage=auth-user result=no-user-id");
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const profileResponse = await fetch(
    `${commandIqUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,organization_id,email&limit=1`,
    { headers: { ...sharedHeaders, Accept: "application/json" } },
  );
  if (!profileResponse.ok) {
    console.log("stage=profiles-query result=failed status=" + profileResponse.status);
    throw Object.assign(new Error("CommandIQ operator verification failed."), { status: 403 });
  }
  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    console.log("stage=profiles-query result=no-profile-row");
    throw Object.assign(new Error("This CommandIQ workspace is not authorized for Barber Launch member messages."), { status: 403 });
  }
  if (profile.organization_id !== allowedOrganizationId) {
    console.log("stage=org-check result=org-mismatch");
    throw Object.assign(new Error("This CommandIQ workspace is not authorized for Barber Launch member messages."), { status: 403 });
  }
  console.log("stage=verify result=ok");
  return { user, profile };
}

async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user: any) => String(user.email || "").toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function pullConversations(admin: any) {
  const { data: conversations, error: conversationError } = await admin
    .from("support_conversations")
    .select("id, member_id, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (conversationError) throw conversationError;
  const conversationRows = conversations || [];
  if (!conversationRows.length) return [];

  const memberIds = [...new Set(conversationRows.map((conversation: any) => conversation.member_id))];
  const conversationIds = conversationRows.map((conversation: any) => conversation.id);
  const [{ data: profiles, error: profileError }, { data: messages, error: messageError }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, phone").in("id", memberIds),
    admin.from("support_messages")
      .select("id, conversation_id, sender_id, body, read_by_member_at, read_by_admin_at, created_at, edited_at, deleted_at, attachment_path, attachment_name, attachment_mime_type, attachment_size")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true }),
  ]);
  if (profileError) throw profileError;
  if (messageError) throw messageError;

  const profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const messagesByConversation = new Map<string, any[]>();
  for (const message of messages || []) {
    messagesByConversation.set(message.conversation_id, [
      ...(messagesByConversation.get(message.conversation_id) || []),
      message,
    ]);
  }
  return conversationRows.map((conversation: any) => ({
    ...conversation,
    member: profilesById.get(conversation.member_id) || { id: conversation.member_id },
    messages: messagesByConversation.get(conversation.id) || [],
  }));
}

async function sendAdminReply(admin: any, conversationId: string, body: string) {
  if (body.length > 4000) throw Object.assign(new Error("A member message cannot exceed 4,000 characters."), { status: 400 });
  const { data: conversation, error: conversationError } = await admin
    .from("support_conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw Object.assign(new Error("Membership conversation not found."), { status: 404 });

  const { data: adminRole, error: adminRoleError } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (adminRoleError) throw adminRoleError;
  if (!adminRole?.user_id) throw new Error("No Barber Launch admin sender is configured.");

  const { data: message, error: messageError } = await admin.from("support_messages").insert({
    conversation_id: conversationId,
    sender_id: adminRole.user_id,
    body,
    read_by_admin_at: new Date().toISOString(),
  }).select("*").single();
  if (messageError) throw messageError;
  return message;
}

async function ensureMember(admin: any, email: string, password: string, fullName: string) {
  let authUser = await findAuthUserByEmail(admin, email);
  let created = false;
  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    authUser = data.user;
    created = true;
  }
  if (!authUser?.id) throw new Error("The membership account could not be created.");

  if (created) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: authUser.id,
      email,
      full_name: fullName,
    }, { onConflict: "id" });
    if (profileError) throw profileError;
  }
  const { error: roleError } = await admin.from("user_roles").upsert({
    user_id: authUser.id,
    role: "member",
  }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;

  const { data: conversation, error: conversationError } = await admin.from("support_conversations").upsert({
    member_id: authUser.id,
  }, { onConflict: "member_id" }).select("id, member_id, created_at, updated_at").single();
  if (conversationError) throw conversationError;
  const { data: profile } = await admin.from("profiles").select("id, full_name, email, phone").eq("id", authUser.id).single();
  return { created, user: profile, conversation };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    await verifyCommandIqOperator(request);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "pull");

    if (action === "pull") return json({ conversations: await pullConversations(admin) });
    if (action === "send") {
      const conversationId = requireString(body.conversationId, "conversationId");
      const messageBody = requireString(body.body, "body");
      return json({ message: await sendAdminReply(admin, conversationId, messageBody) });
    }
    if (action === "ensure-member") {
      const email = requireString(body.email, "email").toLowerCase();
      const password = requireString(body.password, "password");
      const fullName = requireString(body.fullName || "Chris Sassouni 2", "fullName");
      return json(await ensureMember(admin, email, password, fullName));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error: any) {
    console.error("commandiq-member-messages error", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "Unknown member bridge error" }, Number(error?.status || 500));
  }
});
