import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useChecklistLists() {
  return useQuery({
    queryKey: ['checklist-lists-nav'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dynamic_todo_lists')
        .select('id, title, order_index')
        .ilike('title', '%checklist%')
        .order('order_index');
      if (error) throw error;
      return data || [];
    },
  });
}
