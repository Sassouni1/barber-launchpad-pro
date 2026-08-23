import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  renderTemplatePage,
  type EditorDraft,
  type FieldRule,
  type TemplatePage,
  type WebsiteTemplateConfig,
} from '@/lib/websiteEditor';

export type WebsiteEntitlement = {
  templateKey: string;
  /** The client's own existing website address, configured server-side. */
  customDomain: string | null;
};

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
    queryFn: async (): Promise<WebsiteEntitlement | null> => {
      const { data, error } = await supabase
        .from('website_editor_entitlements')
        .select('template_key, custom_domain')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { templateKey: data.template_key, customDomain: data.custom_domain ?? null };
    },
  });
}

/** Template/site configuration record — no host-specific values live in the UI. */
export function useWebsiteTemplate(templateKey: string | null | undefined) {
  return useQuery({
    queryKey: ['website-template', templateKey],
    enabled: !!templateKey,
    staleTime: 300000,
    queryFn: async (): Promise<WebsiteTemplateConfig | null> => {
      const { data, error } = await supabase
        .from('website_templates')
        .select('template_key, display_name, asset_origin, pages, field_rules')
        .eq('template_key', templateKey!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        templateKey: data.template_key,
        displayName: data.display_name,
        assetOrigin: data.asset_origin ?? null,
        pages: (data.pages as unknown as TemplatePage[]) ?? [],
        fieldRules: (data.field_rules as unknown as Record<string, FieldRule>) ?? {},
      };
    },
  });
}

const localKey = (templateKey: string) => `website-editor-draft:${templateKey}`;

export function readLocalDraft(templateKey: string): EditorDraft | null {
  try {
    const raw = localStorage.getItem(localKey(templateKey));
    return raw ? (JSON.parse(raw) as EditorDraft) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(templateKey: string, draft: EditorDraft) {
  try {
    localStorage.setItem(localKey(templateKey), JSON.stringify(draft));
  } catch {
    // Offline convenience only — ignore quota/private-mode failures.
  }
}

/** Cloud drafts live in the member's own member_websites row, keyed by template. */
export function useEditorDraft(templateKey: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['website-editor-draft', user?.id, templateKey],
    enabled: !!user?.id && !!templateKey,
    staleTime: 300000,
    queryFn: async (): Promise<EditorDraft> => {
      const { data, error } = await supabase
        .from('member_websites')
        .select('editor_drafts')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      const drafts = (data?.editor_drafts ?? {}) as Record<string, EditorDraft>;
      return drafts[templateKey!] ?? {};
    },
  });
}

async function persistDraft(userId: string, templateKey: string, draft: EditorDraft) {
  const { data: existing, error: readError } = await supabase
    .from('member_websites')
    .select('id, editor_drafts')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw readError;

  const nextDrafts = {
    ...((existing?.editor_drafts as Record<string, unknown>) ?? {}),
    [templateKey]: draft,
  };

  if (existing) {
    const { error } = await supabase
      .from('member_websites')
      .update({ editor_drafts: nextDrafts, template_key: templateKey })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('member_websites').insert([
    {
      user_id: userId,
      site_slug: `site-${userId.slice(0, 8)}`,
      deployment_status: 'draft',
      template_key: templateKey,
      editor_drafts: nextDrafts,
    },
  ]);
  if (error) throw error;
}

export function useSaveEditorDraft(templateKey: string | null | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: EditorDraft) => {
      if (!user || !templateKey) throw new Error('No website template is assigned to your account.');
      writeLocalDraft(templateKey, draft);
      await persistDraft(user.id, templateKey, draft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-editor-draft', user?.id, templateKey] });
    },
  });
}

export type PublishResult = {
  liveUrl: string;
  previewUrl: string;
  deploymentStatus: string;
  customDomain: string | null;
  customDomainStatus: string;
  customDomainError: string | null;
};

/**
 * The single Save & Publish implementation: it saves the draft, renders each
 * configured page and hands them to the shared `website-publish` endpoint,
 * which resolves the target domain from the member's own entitlement record.
 */
export function usePublishWebsite(template: WebsiteTemplateConfig | null | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: EditorDraft): Promise<PublishResult> => {
      if (!user || !template) throw new Error('No website template is assigned to your account.');

      writeLocalDraft(template.templateKey, draft);
      await persistDraft(user.id, template.templateKey, draft);

      const pages = await Promise.all(
        template.pages.map(async (page) => ({
          key: page.key,
          path: page.path,
          html: await renderTemplatePage(template, page, draft[page.key] ?? {}),
        })),
      );

      const { data, error } = await supabase.functions.invoke('website-publish', {
        body: { templateKey: template.templateKey, pages },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const parsed = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(parsed?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data as PublishResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-website', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['website-editor-draft', user?.id, template?.templateKey] });
    },
  });
}
