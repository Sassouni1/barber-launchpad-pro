import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

export interface WebsitePageDocument {
  headline: string;
  subheadline: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
}

export const emptyPage = (): WebsitePageDocument => ({
  headline: "",
  subheadline: "",
  body: "",
  imageUrl: null,
  ctaLabel: "",
  ctaUrl: "",
});

export interface MemberWebsite {
  id: string;
  site_slug: string;
  custom_domain: string | null;
  live_url: string | null;
  deployment_status: string;
  published_at: string | null;
  cloudflare_registration_status: string;
  cloudflare_attachment_status: string;
  cloudflare_worker_domain_id: string | null;
  home_document: WebsitePageDocument;
  hair_system_document: WebsitePageDocument;
}

export function useMemberWebsite() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-website", user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    queryFn: async (): Promise<MemberWebsite | null> => {
      const { data, error } = await supabase
        .from("member_websites")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MemberWebsite) ?? null;
    },
  });
}

/** Uploads into the member's own folder and returns a long-lived readable URL. */
export async function uploadWebsiteImage(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("website-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from("website-assets")
    .createSignedUrl(path, TEN_YEARS_SECONDS);
  if (signError) throw signError;
  return data.signedUrl;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPageHtml(title: string, page: WebsitePageDocument) {
  const paragraphs = (page.body || "")
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  const hero = page.imageUrl
    ? `<img class="hero" src="${escapeHtml(page.imageUrl)}" alt="${escapeHtml(page.headline || title)}"/>`
    : "";

  const cta = page.ctaLabel && page.ctaUrl
    ? `<a class="cta" href="${escapeHtml(page.ctaUrl)}">${escapeHtml(page.ctaLabel)}</a>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(page.headline || title)}</title>
<meta name="description" content="${escapeHtml((page.subheadline || page.body || title).slice(0, 155))}"/>
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b0b0c;color:#f5f1e6;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6}
main{max-width:820px;margin:0 auto;padding:48px 20px 72px}
h1{font-size:clamp(2rem,5vw,3rem);margin:0 0 12px;color:#d4af37}
h2{font-weight:500;font-size:1.15rem;margin:0 0 28px;color:#cfc9b8}
.hero{width:100%;border-radius:16px;margin:0 0 32px;display:block}
.cta{display:inline-block;margin-top:28px;padding:14px 28px;border-radius:999px;background:#d4af37;color:#0b0b0c;font-weight:700;text-decoration:none}
</style>
</head>
<body>
<main>
${hero}
<h1>${escapeHtml(page.headline || title)}</h1>
${page.subheadline ? `<h2>${escapeHtml(page.subheadline)}</h2>` : ""}
${paragraphs}
${cta}
</main>
</body>
</html>`;
}

export function usePublishWebsite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { home: WebsitePageDocument; hairSystem: WebsitePageDocument }) => {
      const { data, error } = await supabase.functions.invoke("website-publish", {
        body: {
          homeHtml: renderPageHtml("Home", input.home),
          hairSystemHtml: renderPageHtml("Hair Systems", input.hairSystem),
          homeDocument: input.home,
          hairSystemDocument: input.hairSystem,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        liveUrl: string;
        previewUrl: string;
        siteSlug: string;
        deploymentStatus: string;
        customDomainStatus: string;
        customDomainError: string | null;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-website", user?.id] });
    },
  });
}

/** Saves page content only — never publishes or changes the live site. */
export function useSaveWebsiteDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { home: WebsitePageDocument; hairSystem: WebsitePageDocument }) => {
      const { data: existing } = await supabase
        .from("member_websites")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      const documents = {
        home_document: input.home as unknown as never,
        hair_system_document: input.hairSystem as unknown as never,
      };

      if (existing) {
        const { error } = await supabase
          .from("member_websites")
          .update(documents)
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("member_websites").insert([{
        user_id: user!.id,
        site_slug: `site-${user!.id.slice(0, 8)}`,
        deployment_status: "draft",
        ...documents,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-website", user?.id] });
    },
  });
}
