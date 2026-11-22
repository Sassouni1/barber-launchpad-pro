import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BillingSummary } from '@/lib/memberBilling';

export async function memberBillingRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('member-billing', { body });
  if (error) {
    let message = 'Billing is unavailable right now.';
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => null);
      if (typeof details?.error === 'string') message = details.error;
    }
    throw new Error(message);
  }
  return data as T;
}

export function useMemberBilling(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['member-billing', user?.id],
    queryFn: () => memberBillingRequest<BillingSummary>({ action: 'summary' }),
    enabled: !!user && enabled,
    staleTime: 300000,
    retry: false,
  });
}
