import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type GameType = 'color-match' | 'hairline' | 'ceran-wrap';

interface TrainingProgress {
  id: string;
  user_id: string;
  game_type: GameType;
  completed: boolean;
  score: number | null;
  completed_at: string | null;
  created_at: string;
}

export function useTrainingProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['training-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_training_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as TrainingProgress[];
    },
    enabled: !!user?.id,
  });
}

export function useMarkGameComplete() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gameType, score }: { gameType: GameType; score: number }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_training_progress')
        .upsert({
          user_id: user.id,
          game_type: gameType,
          completed: true,
          score,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,game_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-progress', user?.id] });
    },
  });
}

export function useTrainingGamesCompleted() {
  const { data: progress, isLoading } = useTrainingProgress();
  
  const requiredGames: GameType[] = ['color-match', 'hairline', 'ceran-wrap'];
  
  const completedGames = progress?.filter(p => p.completed).map(p => p.game_type as GameType) || [];
  const completedCount = completedGames.length;
  const allComplete = requiredGames.every(game => completedGames.includes(game));

  return {
    completed: allComplete,
    completedCount,
    totalCount: requiredGames.length,
    completedGames,
    isLoading,
  };
}
