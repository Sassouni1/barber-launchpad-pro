import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RewardClient {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  referred_by_client_id: string | null;
  referral_redeemed_count: number;
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

export interface ReferralTier {
  count: number;
  reward: string;
}

export interface ClientWithProgress extends RewardClient {
  visits: RewardVisit[];
  currentVisits: number;
  totalRedemptions: number;
  referralCount: number;
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

export function useReferralTiers() {
  return useQuery({
    queryKey: ['app-settings', 'referral_tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'referral_tiers')
        .maybeSingle();
      if (error) throw error;
      const value = data?.value as any;
      return (value?.tiers ?? []) as ReferralTier[];
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

      const clientsArr = clients as any[];

      return clientsArr.map((client): ClientWithProgress => {
        const clientVisits = (visits as any[]).filter((v) => v.client_id === client.id);
        
        let lastRedemptionIdx = -1;
        for (let i = clientVisits.length - 1; i >= 0; i--) {
          if (clientVisits[i].is_redemption) {
            lastRedemptionIdx = i;
            break;
          }
        }

        const visitsSinceRedemption = clientVisits
          .slice(lastRedemptionIdx + 1)
          .filter((v) => !v.is_redemption);

        const totalRedemptions = clientVisits.filter((v) => v.is_redemption).length;

        // Count how many clients this client referred
        const referralCount = clientsArr.filter(
          (c) => c.referred_by_client_id === client.id
        ).length;

        return {
          ...client,
          visits: clientVisits,
          currentVisits: visitsSinceRedemption.length,
          totalRedemptions,
          referralCount,
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
    mutationFn: async (data: {
      client_name?: string;
      client_phone: string;
      client_email?: string;
      referred_by_client_id?: string;
    }) => {
      const { error } = await supabase
        .from('reward_clients' as any)
        .insert({
          client_name: data.client_name || '',
          client_phone: data.client_phone,
          client_email: data.client_email || null,
          referred_by_client_id: data.referred_by_client_id || null,
          user_id: user!.id,
        });
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

export function useRedeemReferralReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, newCount }: { clientId: string; newCount: number }) => {
      const { error } = await supabase
        .from('reward_clients' as any)
        .update({ referral_redeemed_count: newCount })
        .eq('id', clientId);
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
