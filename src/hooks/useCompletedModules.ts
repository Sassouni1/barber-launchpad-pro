import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ModuleCompletion = { bestScore: number; passed: boolean };

const cacheKey = (userId: string) => `completed-modules:${userId}`;

function readCache(userId: string | undefined): Record<string, ModuleCompletion> | undefined {
  if (!userId || typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return undefined;
    return JSON.parse(raw) as Record<string, ModuleCompletion>;
  } catch {
    return undefined;
  }
}

function writeCache(userId: string, map: Record<string, ModuleCompletion>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Returns a map of moduleId -> { bestScore, passed } based on the user's
 * best quiz attempt per module. A module is "completed" when the best
 * quiz score is >= 80%.
 *
 * Also marks certification-requirement photo modules as completed when the user
 * has uploaded photos for the corresponding course.
 */
export function useCompletedModules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["completed-modules", user?.id],
    enabled: !!user?.id,
    staleTime: 300000,
    // Hydrate immediately from localStorage so the course list doesn't flash
    // an "uncompleted" state on mount before the network request resolves.
    initialData: () => readCache(user?.id),
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const map: Record<string, ModuleCompletion> = {};
      if (!user?.id) return map;

      const { data, error } = await supabase
        .from("user_quiz_attempts")
        .select("module_id, score, total_questions")
        .eq("user_id", user.id);

      if (error) throw error;

      // Track the best raw ratio per module to avoid rounding errors when
      // picking the "best" attempt, then derive display % + pass from it.
      const bestRatio: Record<string, number> = {};
      for (const a of data || []) {
        if (!a.module_id || !a.total_questions || a.total_questions <= 0) continue;
        const ratio = a.score / a.total_questions;
        if (bestRatio[a.module_id] === undefined || ratio > bestRatio[a.module_id]) {
          bestRatio[a.module_id] = ratio;
        }
      }
      for (const moduleId of Object.keys(bestRatio)) {
        const ratio = bestRatio[moduleId];
        map[moduleId] = {
          bestScore: Math.round(ratio * 100),
          // Use raw ratio (with tiny epsilon for FP safety) so a true 80%
          // always passes and a 79.6% doesn't sneak through as "80% passed".
          passed: ratio + 1e-9 >= 0.8,
        };
      }

      // Mark certification photo modules as completed when the user has uploaded
      // photos for the module's course.
      const { data: certModules, error: certModulesError } = await supabase
        .from("modules")
        .select("id, course_id")
        .eq("is_certification_requirement", true);

      if (certModulesError) throw certModulesError;

      if (certModules && certModules.length > 0) {
        const { data: photos, error: photosError } = await supabase
          .from("certification_photos")
          .select("course_id")
          .eq("user_id", user.id);

        if (photosError) throw photosError;

        const coursesWithPhotos = new Set((photos || []).map((p) => p.course_id));

        for (const m of certModules) {
          if (m.course_id && coursesWithPhotos.has(m.course_id)) {
            const existing = map[m.id];
            map[m.id] = {
              bestScore: existing?.bestScore ?? 100,
              passed: true,
            };
          }
        }
      }

      writeCache(user.id, map);
      return map;
    },
  });
}
