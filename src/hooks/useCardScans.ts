import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ScanRow {
  id: string;
  scanned_at: string;
  source: string;
}

interface ScanData {
  totalScans: number;
  last7Days: number;
  last30Days: number;
  recentScans: ScanRow[];
}

export function useCardScans(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card-scans', cardId],
    queryFn: async (): Promise<ScanData> => {
      const { data, error } = await (supabase as any)
        .from('card_scans')
        .select('id, scanned_at, source')
        .eq('card_id', cardId)
        .order('scanned_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const scans = (data || []) as ScanRow[];

      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000);
      const d30 = new Date(now.getTime() - 30 * 86400000);

      return {
        totalScans: scans.length,
        last7Days: scans.filter(s => new Date(s.scanned_at) >= d7).length,
        last30Days: scans.filter(s => new Date(s.scanned_at) >= d30).length,
        recentScans: scans.slice(0, 20),
      };
    },
    enabled: !!cardId,
  });
}
