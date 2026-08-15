import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SupportConversation {
  id: string;
  member_id: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  attachment_url?: string | null;
  read_by_member_at: string | null;
  read_by_admin_at: string | null;
}

export interface SupportMessageDraft {
  body: string;
  image?: File;
}

export interface SupportMessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

const SUPPORT_IMAGE_BUCKET = 'support-message-attachments';
const MAX_SUPPORT_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function validateSupportImage(image: File) {
  if (!allowedImageTypes.has(image.type)) throw new Error('Choose a JPG, PNG, WebP, or GIF image.');
  if (image.size > MAX_SUPPORT_IMAGE_BYTES) throw new Error('Images must be 10 MB or smaller.');
}

function safeImageName(image: File) {
  return image.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'image';
}

// These tables are introduced by the matching migration. Keeping this narrow cast here
// avoids overwriting the project's generated Supabase types while the schema is deployed.
const supportDb = supabase as any;

function useSupportRealtime(conversationId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`support-thread-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${conversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['support-messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['support-unread'] });
        queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_message_reactions', filter: `conversation_id=eq.${conversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['support-reactions', conversationId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);
}

export function useSupportReactions(conversationId?: string) {
  return useQuery({
    queryKey: ['support-reactions', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supportDb
        .from('support_message_reactions')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as SupportMessageReaction[];
    },
  });
}

export function useToggleSupportReaction(conversationId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!conversationId || !user) throw new Error('Support is not ready yet.');
      const { data: existing, error: findError } = await supportDb
        .from('support_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();
      if (findError) throw findError;

      const { error } = existing
        ? await supportDb.from('support_message_reactions').delete().eq('id', existing.id)
        : await supportDb.from('support_message_reactions').insert({ message_id: messageId, conversation_id: conversationId, user_id: user.id, emoji });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-reactions', conversationId] });
    },
  });
}

export function useMemberSupportConversation() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-conversation', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const { data: existing, error: existingError } = await supportDb
        .from('support_conversations')
        .select('*')
        .eq('member_id', user!.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return existing as SupportConversation;

      const { data: created, error: createError } = await supportDb
        .from('support_conversations')
        .insert({ member_id: user!.id })
        .select('*')
        .single();
      if (createError) throw createError;
      return created as SupportConversation;
    },
  });
}

export function useSupportMessages(conversationId?: string) {
  useSupportRealtime(conversationId);

  return useQuery({
    queryKey: ['support-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supportDb
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const messages = (data || []) as SupportMessage[];
      return Promise.all(messages.map(async (message) => {
        if (!message.attachment_path) return message;
        const { data: signed } = await supabase.storage
          .from(SUPPORT_IMAGE_BUCKET)
          .createSignedUrl(message.attachment_path, 60 * 60);
        return { ...message, attachment_url: signed?.signedUrl || null };
      }));
    },
  });
}

export function useSendSupportMessage(conversationId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ body, image }: SupportMessageDraft) => {
      if (!conversationId || !user) throw new Error('Support is not ready yet.');
      const message = body.trim();
      if (!message && !image) throw new Error('Write a message or attach an image before sending.');

      let attachment: Record<string, string | number> = {};
      if (image) {
        validateSupportImage(image);
        const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeImageName(image)}`;
        const { error: uploadError } = await supabase.storage
          .from(SUPPORT_IMAGE_BUCKET)
          .upload(path, image, { cacheControl: '31536000', contentType: image.type, upsert: false });
        if (uploadError) throw uploadError;
        attachment = {
          attachment_path: path,
          attachment_name: image.name,
          attachment_mime_type: image.type,
          attachment_size: image.size,
        };
      }

      const { error } = await supportDb
        .from('support_messages')
        .insert({ conversation_id: conversationId, sender_id: user.id, body: message, ...attachment });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
    },
  });
}

export function useEditSupportMessage(conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, body }: { messageId: string; body: string }) => {
      const message = body.trim();
      if (!message) throw new Error('A message cannot be blank.');
      const { error } = await supportDb.rpc('edit_support_message', {
        p_message_id: messageId,
        p_body: message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
    },
  });
}

export function useUnsendSupportMessage(conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supportDb.rpc('unsend_support_message', { p_message_id: messageId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['support-unread'] });
    },
  });
}

export function useMarkSupportMessagesRead(conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      const { error } = await supportDb.rpc('mark_support_messages_read', { p_conversation_id: conversationId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['support-unread'] });
    },
  });
}

export function useSupportUnreadCount() {
  const { user, isAdmin } = useAuth();

  const query = useQuery({
    queryKey: ['support-unread', user?.id],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { count, error } = await supportDb
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user!.id)
        .is('read_by_member_at', null);
      if (error) throw error;
      return count || 0;
    },
  });
  const { refetch } = query;

  useEffect(() => {
    if (!user || isAdmin) return;
    const channel = supabase
      .channel(`support-badge-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, refetch, user]);

  return query;
}
