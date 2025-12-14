import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useToggleAdminRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        
        if (error && !error.message.includes('duplicate')) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        
        if (error) throw error;
      }
    },
    onSuccess: (_, { makeAdmin }) => {
      toast.success(makeAdmin ? 'User is now an admin' : 'Admin role removed');
      queryClient.invalidateQueries({ queryKey: ['adminMembers'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}
