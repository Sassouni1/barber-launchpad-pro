import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { StayFadedDraft } from '@/lib/stayFadedEditor';

export type WebsiteTemplateKey = 'stay-faded';

/**
 * Entitlements are granted only by backend migrations — members have read-only
 * access to their own row and cannot self-assign a template.
 */
export function useWebsiteEditorEntitlement() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['website-editor-entitlement', user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    queryFn: async (): Promise<WebsiteTemplateKey | null> => {
      const { data, error } = await supabase
        .from('website_editor_entitlements')
        .select('template_key')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.template_key as WebsiteTemplateKey) ?? null;
    },
  });
}

const LOCAL_KEY = 'stay-faded-editor-draft';

export function readLocalDraft(): StayFadedDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as StayFadedDraft) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: StayFadedDraft) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(draft));
  } catch {
    // Offline convenience only — ignore quota/private-mode failures.
  }
}

/** Cloud drafts live in the member's own member_websites row. */
export function useEditorDrafts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['website-editor-drafts', user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    queryFn: async (): Promise<StayFadedDraft> => {
      const { data, error } = await supabase
        .from('member_websites')
        .select('editor_drafts')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      const drafts = (data?.editor_drafts ?? {}) as Record<string, unknown>;
      return ((drafts['stay-faded'] as StayFadedDraft) ?? {}) as StayFadedDraft;
    },
  });
}

export function useSaveEditorDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: StayFadedDraft) => {
      writeLocalDraft(draft);

      const { data: existing, error: readError } = await supabase
        .from('member_websites')
        .select('id, editor_drafts')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (readError) throw readError;

      const nextDrafts = {
        ...((existing?.editor_drafts as Record<string, unknown>) ?? {}),
        'stay-faded': draft,
      };

      if (existing) {
        const { error } = await supabase
          .from('member_websites')
          .update({ editor_drafts: nextDrafts })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('member_websites').insert([
        {
          user_id: user!.id,
          site_slug: `site-${user!.id.slice(0, 8)}`,
          deployment_status: 'draft',
          editor_drafts: nextDrafts,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-editor-drafts', user?.id] });
    },
  });
}
