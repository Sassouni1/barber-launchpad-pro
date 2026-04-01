import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AionConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AionMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function useAionConversations() {
  const { user } = useAuth();

  const conversationsQuery = useQuery({
    queryKey: ['aion-conversations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aion_conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as AionConversation[];
    },
    enabled: !!user,
  });

  const queryClient = useQueryClient();

  const createConversation = useMutation({
    mutationFn: async (title: string = 'New Chat') => {
      const { data, error } = await supabase
        .from('aion_conversations')
        .insert({ user_id: user!.id, title })
        .select()
        .single();
      if (error) throw error;
      return data as AionConversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aion-conversations'] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('aion_conversations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aion-conversations'] });
    },
  });

  const updateTitle = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from('aion_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aion-conversations'] });
    },
  });

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    createConversation,
    deleteConversation,
    updateTitle,
  };
}

export function useAionMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['aion-messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aion_messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as AionMessage[];
    },
    enabled: !!conversationId,
  });
}

export async function saveAionMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
  const { error } = await supabase
    .from('aion_messages')
    .insert({ conversation_id: conversationId, role, content });
  if (error) throw error;

  // Touch conversation updated_at
  await supabase
    .from('aion_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}
