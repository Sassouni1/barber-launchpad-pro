import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

export interface MemberWebsite {
  id: string;
  site_slug: string;
  template_key: string | null;
  custom_domain: string | null;
  live_url: string | null;
  deployment_status: string;
  published_at: string | null;
  cloudflare_registration_status: string;
  cloudflare_attachment_status: string;
  cloudflare_worker_domain_id: string | null;
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
