import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GroupCall {
  id: string;
  title: string;
  day_of_week: string;
  time_label: string;
  zoom_link: string;
  is_active: boolean;
  order_index: number;
  call_hour: number;
  call_minute: number;
  call_ampm: string;
  call_timezone: string;
  created_at: string;
  updated_at: string;
}

export function useGroupCalls() {
  return useQuery({
    queryKey: ['group-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_calls')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return data as GroupCall[];
    },
  });
}

export function useGroupCallsAdmin() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['group-calls-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_calls')
        .select('*')
        .order('order_index');
      if (error) throw error;
      return data as GroupCall[];
    },
  });

  const createCall = useMutation({
    mutationFn: async (call: Omit<GroupCall, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('group_calls').insert(call);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-calls'] }),
  });

  const updateCall = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GroupCall> & { id: string }) => {
      const { error } = await supabase.from('group_calls').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-calls'] }),
  });

  const deleteCall = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_calls').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-calls'] }),
  });

  return { ...query, createCall, updateCall, deleteCall };
}
