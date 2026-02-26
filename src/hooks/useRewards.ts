import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RewardClient {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  created_at: string;
}

interface RewardVisit {
  id: string;
  client_id: string;
  user_id: string;
  visited_at: string;
  is_redemption: boolean;
  created_at: string;
}

interface ClientWithProgress extends RewardClient {
  visits: RewardVisit[];
  currentVisits: number;
  totalRedemptions: number;
}

export function useRewardVisitsRequired() {
  return useQuery({
    queryKey: ['app-settings', 'reward_visits_required'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'reward_visits_required')
        .maybeSingle();
      if (error) throw error;
      const value = data?.value as any;
      return value?.count ?? 10;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useRewardClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['reward-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: clients, error: clientsError } = await supabase
        .from('reward_clients' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      const { data: visits, error: visitsError } = await supabase
        .from('reward_visits' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('visited_at', { ascending: true });

      if (visitsError) throw visitsError;

      return (clients as any[]).map((client): ClientWithProgress => {
        const clientVisits = (visits as any[]).filter((v) => v.client_id === client.id);
        
        // Find the last redemption index
        let lastRedemptionIdx = -1;
        for (let i = clientVisits.length - 1; i >= 0; i--) {
          if (clientVisits[i].is_redemption) {
            lastRedemptionIdx = i;
            break;
          }
        }

        // Count visits since last redemption (excluding redemption rows)
        const visitsSinceRedemption = clientVisits
          .slice(lastRedemptionIdx + 1)
          .filter((v) => !v.is_redemption);

        const totalRedemptions = clientVisits.filter((v) => v.is_redemption).length;

        return {
          ...client,
          visits: clientVisits,
          currentVisits: visitsSinceRedemption.length,
          totalRedemptions,
        };
      });
    },
    enabled: !!user?.id,
  });
}

export function useAddClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { client_name: string; client_phone?: string; client_email?: string }) => {
      const { error } = await supabase
        .from('reward_clients' as any)
        .insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-clients'] });
    },
  });
}

export function useLogVisit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('reward_visits' as any)
        .insert({ client_id: clientId, user_id: user!.id, is_redemption: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-clients'] });
    },
  });
}

export function useRedeemReward() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('reward_visits' as any)
        .insert({ client_id: clientId, user_id: user!.id, is_redemption: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-clients'] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('reward_clients' as any)
        .delete()
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-clients'] });
    },
  });
}
