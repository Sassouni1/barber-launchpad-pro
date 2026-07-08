import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ModuleCompletion = { bestScore: number; passed: boolean };

/**
 * Returns a map of moduleId -> { bestScore, passed } based on the user's
 * best quiz attempt per module. A module is "completed" when the best
 * quiz score is >= 80%.
 */
export function useCompletedModules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["completed-modules", user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    queryFn: async () => {
      const map: Record<string, ModuleCompletion> = {};
      if (!user?.id) return map;

      const { data, error } = await supabase
        .from("user_quiz_attempts")
        .select("module_id, score, total_questions")
        .eq("user_id", user.id);

      if (error) throw error;

      for (const a of data || []) {
        if (!a.module_id || !a.total_questions) continue;
        const pct = Math.round((a.score / a.total_questions) * 100);
        const existing = map[a.module_id];
        if (!existing || pct > existing.bestScore) {
          map[a.module_id] = { bestScore: pct, passed: pct >= 80 };
        }
      }
      return map;
    },
  });
}
