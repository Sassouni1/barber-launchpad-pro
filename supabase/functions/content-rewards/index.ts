// Content Rewards: member submissions (before/after photos, install videos) and
// admin review. Approved, eligible rewards are written into the SAME earnings
// ledger the affiliate commissions use, so they flow through the automatic
// Stripe Connect payout pipeline. There is no separate manual release step.
//
// Nothing is ever awarded unless an admin has configured a reward amount and
// switched content rewards on. Files live in a private bucket; reviewers read
// them through short-lived signed URLs only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, isAdmin, json, newAffiliateCode, requireUser } from "../_shared/affiliate.ts";

const BUCKET = "content-rewards";
const KINDS = ["before_after", "install_video", "other"];
const SIGNED_URL_SECONDS = 600;

type ContentSettings = {
  enabled: boolean;
  reward_cents: number | null;
  eligibility: string | null;
  kinds: string[];
  max_pending_per_member: number | null;
};

const DEFAULTS: ContentSettings = {
  enabled: false,
  reward_cents: null,
  eligibility: "certified",
  kinds: KINDS,
  max_pending_per_member: 10,
};

async function loadContentSettings(db: ReturnType<typeof adminClient>): Promise<ContentSettings> {
  const { data } = await db.from("affiliate_settings").select("value").eq("key", "content_rewards").maybeSingle();
  return { ...DEFAULTS, ...((data?.value ?? {}) as Partial<ContentSettings>) };
}

function rewardsReady(s: ContentSettings) {
  return Boolean(s.enabled) && typeof s.reward_cents === "number" && s.reward_cents > 0;
}

function missingContentConfig(s: ContentSettings) {
  const missing: string[] = [];
  if (!(typeof s.reward_cents === "number" && s.reward_cents > 0)) missing.push("A reward amount per approved submission");
  if (!s.enabled) missing.push("Content rewards switched on");
  return missing;
}

async function signPaths(db: ReturnType<typeof adminClient>, paths: string[]) {
  const out: Array<{ path: string; url: string | null }> = [];
  for (const p of paths.slice(0, 20)) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_SECONDS);
    out.push({ path: p, url: data?.signedUrl ?? null });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const user = await requireUser(req, db);
    if (!user) return json({ error: "Please sign in." }, 401, h);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "summary");
    const admin = await isAdmin(db, user.id);
    const settings = await loadContentSettings(db);

    switch (action) {
      // ---------------- member ----------------
      case "summary": {
        const { data: subs } = await db
          .from("content_submissions")
          .select("id, kind, title, note, file_paths, status, reward_cents, review_note, reviewed_at, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);

        const withUrls = [];
        for (const s of subs ?? []) withUrls.push({ ...s, files: await signPaths(db, s.file_paths ?? []) });

        return json(
          {
            settings: {
              enabled: settings.enabled,
              rewardCents: settings.reward_cents,
              kinds: settings.kinds ?? KINDS,
              ready: rewardsReady(settings),
            },
            submissions: withUrls,
          },
          200,
          h,
        );
      }

      case "submit": {
        const kind = String(body.kind ?? "");
        if (!(settings.kinds ?? KINDS).includes(kind)) return json({ error: "Choose what kind of content this is." }, 400, h);

        const paths = Array.isArray(body.filePaths) ? (body.filePaths as unknown[]).map(String) : [];
        if (paths.length === 0) return json({ error: "Add at least one photo or video." }, 400, h);
        // Files must sit in the member's own folder — nothing else is accepted.
        if (!paths.every((p) => p.startsWith(`${user.id}/`))) return json({ error: "Those files are not yours." }, 400, h);

        if (body.consentUseContent !== true || body.consentSubjectPermission !== true) {
          return json({ error: "Both permissions must be confirmed before you can submit." }, 400, h);
        }

        const limit = settings.max_pending_per_member ?? 10;
        const { count } = await db
          .from("content_submissions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pending");
        if ((count ?? 0) >= limit) {
          return json({ error: `You already have ${limit} submissions waiting for review.` }, 400, h);
        }

        const { data: affiliate } = await db.from("affiliates").select("id").eq("user_id", user.id).maybeSingle();

        const { data, error } = await db
          .from("content_submissions")
          .insert({
            user_id: user.id,
            affiliate_id: affiliate?.id ?? null,
            kind,
            title: body.title ? String(body.title).slice(0, 200) : null,
            note: body.note ? String(body.note).slice(0, 2000) : null,
            file_paths: paths,
            consent_use_content: true,
            consent_subject_permission: true,
          })
          .select("id")
          .maybeSingle();
        if (error) return json({ error: "Could not save your submission." }, 400, h);
        return json({ ok: true, id: data?.id }, 200, h);
      }

      case "withdraw": {
        const { error } = await db
          .from("content_submissions")
          .update({ status: "withdrawn" })
          .eq("id", String(body.submissionId ?? ""))
          .eq("user_id", user.id)
          .eq("status", "pending");
        if (error) return json({ error: "Could not withdraw that submission." }, 400, h);
        return json({ ok: true }, 200, h);
      }

      // ---------------- admin ----------------
      case "admin_list": {
        if (!admin) return json({ error: "Admins only." }, 403, h);
        const status = body.status ? String(body.status) : null;
        let q = db
          .from("content_submissions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (status) q = q.eq("status", status);
        const { data: subs } = await q;

        const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
        const { data: profiles } = userIds.length
          ? await db.from("profiles").select("id, full_name, email").in("id", userIds)
          : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
        const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

        const withUrls = [];
        for (const s of subs ?? []) {
          withUrls.push({
            ...s,
            member: byId.get(s.user_id) ?? null,
            files: await signPaths(db, s.file_paths ?? []),
          });
        }
        return json(
          { submissions: withUrls, settings, missingContentConfig: missingContentConfig(settings) },
          200,
          h,
        );
      }

      case "admin_save_settings": {
        if (!admin) return json({ error: "Admins only." }, 403, h);
        const incoming = (body.settings ?? {}) as Partial<ContentSettings>;
        const next: ContentSettings = {
          enabled: Boolean(incoming.enabled),
          reward_cents:
            typeof incoming.reward_cents === "number" && incoming.reward_cents > 0
              ? Math.round(incoming.reward_cents)
              : null,
          eligibility: incoming.eligibility ? String(incoming.eligibility) : settings.eligibility,
          kinds: Array.isArray(incoming.kinds) && incoming.kinds.length ? incoming.kinds.map(String) : settings.kinds,
          max_pending_per_member:
            typeof incoming.max_pending_per_member === "number" ? incoming.max_pending_per_member : settings.max_pending_per_member,
        };
        await db.from("affiliate_settings").upsert({ key: "content_rewards", value: next }, { onConflict: "key" });
        await db.from("affiliate_admin_audit").insert({
          actor_id: user.id,
          action: "content_rewards_settings_saved",
          details: next,
        });
        return json({ ok: true, settings: next, missingContentConfig: missingContentConfig(next) }, 200, h);
      }

      case "admin_review": {
        if (!admin) return json({ error: "Admins only." }, 403, h);
        const id = String(body.submissionId ?? "");
        const decision = String(body.decision ?? "");
        const reviewNote = body.reviewNote ? String(body.reviewNote).slice(0, 2000) : null;
        if (!["approved", "rejected"].includes(decision)) return json({ error: "Choose approve or reject." }, 400, h);

        const { data: sub } = await db.from("content_submissions").select("*").eq("id", id).maybeSingle();
        if (!sub) return json({ error: "Submission not found." }, 404, h);
        if (sub.commission_id) return json({ error: "This submission was already rewarded." }, 400, h);
        if (sub.status !== "pending") return json({ error: "That submission is not waiting for review." }, 400, h);

        if (decision === "rejected") {
          await db
            .from("content_submissions")
            .update({ status: "rejected", review_note: reviewNote, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
            .eq("id", id)
            .eq("status", "pending");
          await db.from("affiliate_admin_audit").insert({
            actor_id: user.id,
            action: "content_submission_rejected",
            details: { submission_id: id, note: reviewNote },
          });
          return json({ ok: true, awarded: false }, 200, h);
        }

        // Approve. No reward is created until an amount is configured and rewards are on.
        if (!rewardsReady(settings)) {
          await db
            .from("content_submissions")
            .update({ status: "approved", review_note: reviewNote, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
            .eq("id", id)
            .eq("status", "pending");
          return json(
            {
              ok: true,
              awarded: false,
              message: "Approved. No reward was created because content rewards are not configured yet.",
            },
            200,
            h,
          );
        }

        // Earnings account: reuse the member's existing one, create it if needed.
        let affiliateId: string | null = sub.affiliate_id;
        if (!affiliateId) {
          const { data: existing } = await db.from("affiliates").select("id").eq("user_id", sub.user_id).maybeSingle();
          affiliateId = existing?.id ?? null;
        }
        if (!affiliateId) {
          const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", sub.user_id).maybeSingle();
          const { data: created } = await db
            .from("affiliates")
            .insert({
              user_id: sub.user_id,
              code: newAffiliateCode(profile?.full_name ?? profile?.email ?? "member"),
              display_name: profile?.full_name ?? null,
              contact_email: profile?.email ?? null,
            })
            .select("id")
            .maybeSingle();
          affiliateId = created?.id ?? null;
        }
        if (!affiliateId) return json({ error: "Could not open an earnings account for that member." }, 500, h);

        const amount = settings.reward_cents as number;
        const { data: commission, error: commissionError } = await db
          .from("affiliate_commissions")
          .insert({
            affiliate_id: affiliateId,
            entry_type: "earned",
            source: "content",
            amount_cents: amount,
            currency: "usd",
            status: "verified",
            note: `Content reward — ${sub.kind}`,
            source_event_id: `content_submission_${id}`,
            created_by: user.id,
          })
          .select("id")
          .maybeSingle();
        if (commissionError || !commission) return json({ error: "Could not record that reward." }, 500, h);

        // commission_id is unique: this is what prevents a second award for the same submission.
        const { error: linkError } = await db
          .from("content_submissions")
          .update({
            status: "approved",
            reward_cents: amount,
            commission_id: commission.id,
            review_note: reviewNote,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("status", "pending")
          .is("commission_id", null);
        if (linkError) {
          await db.from("affiliate_commissions").delete().eq("id", commission.id);
          return json({ error: "That submission changed while you were reviewing it. Reload and try again." }, 409, h);
        }

        await db.from("affiliate_admin_audit").insert({
          actor_id: user.id,
          action: "content_submission_approved",
          details: { submission_id: id, commission_id: commission.id, amount_cents: amount },
        });

        return json({ ok: true, awarded: true, amountCents: amount }, 200, h);
      }

      default:
        return json({ error: "Unknown action." }, 400, h);
    }
  } catch (e) {
    console.error("content-rewards error", e);
    return json({ error: "Something went wrong." }, 500, { ...corsHeaders });
  }
});
