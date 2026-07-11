import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isQuizPassed } from "@/lib/quizPass";
import {
  NEW_CERTIFICATION_MODULE_IDS,
  requiresNewCertificationQuizzes,
} from "@/lib/certificationRequirements";


export type ModuleCompletion = {
  bestScore?: number;
  passed: boolean;
  completionKind?: "quiz" | "video" | "photo" | "exempt";
};

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
 * best quiz attempt per module. A module is "completed" when the user
 * missed no more than 1 question on their best attempt (see @/lib/quizPass).
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

      // Track best raw score + total per module to keep the pass check exact
      // (miss-count based, not float-percentage based).
      const best: Record<string, { score: number; total: number; ratio: number }> = {};
      for (const a of data || []) {
        if (!a.module_id || !a.total_questions || a.total_questions <= 0) continue;
        const ratio = a.score / a.total_questions;
        const current = best[a.module_id];
        if (!current || ratio > current.ratio) {
          best[a.module_id] = { score: a.score, total: a.total_questions, ratio };
        }
      }
      for (const moduleId of Object.keys(best)) {
        const { score, total, ratio } = best[moduleId];
        map[moduleId] = {
          bestScore: Math.round(ratio * 100),
          passed: isQuizPassed(score, total),
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
              bestScore: existing?.bestScore,
              passed: true,
              completionKind: "photo",
            };
          }
        }
      }

      // Video-only modules (such as "Placing a Hair System Order") complete
      // through user_progress rather than a quiz attempt. Reflect those
      // completed lesson rows on the course cards as well.
      const { data: videoModules, error: videoModulesError } = await supabase
        .from("modules")
        .select("id, has_quiz")
        .eq("has_quiz", false);
      if (videoModulesError) throw videoModulesError;

      const { data: moduleLessons, error: moduleLessonsError } = await supabase
        .from("lessons")
        .select("id, module_id");
      if (moduleLessonsError) throw moduleLessonsError;

      const lessonIds = (moduleLessons || []).map((lesson) => lesson.id);
      if (lessonIds.length > 0 && (videoModules || []).length > 0) {
        const { data: completedVideoLessons, error: videoProgressError } =
          await supabase
            .from("user_progress")
            .select("lesson_id")
            .eq("user_id", user.id)
            .eq("completed", true)
            .in("lesson_id", lessonIds);
        if (videoProgressError) throw videoProgressError;

        const completedLessonIds = new Set(
          (completedVideoLessons || []).map((progress) => progress.lesson_id),
        );
        const lessonsByModule = new Map<string, string[]>();
        for (const lesson of moduleLessons || []) {
          const lessonsForModule = lessonsByModule.get(lesson.module_id) || [];
          lessonsForModule.push(lesson.id);
          lessonsByModule.set(lesson.module_id, lessonsForModule);
        }

        for (const videoModule of videoModules || []) {
          const lessonsForModule = lessonsByModule.get(videoModule.id) || [];
          if (
            lessonsForModule.length > 0 &&
            lessonsForModule.every((lessonId) => completedLessonIds.has(lessonId))
          ) {
            map[videoModule.id] = {
              passed: true,
              completionKind: "video",
            };
          }
        }
      }

      // Grandfather all four Live Client quizzes for members who joined before
      // June 1, 2026, and for anyone who already has a certification. This
      // keeps course cards from implying those members must complete newly
      // added quizzes just to finish their existing certification path.
      const { data: certRow } = await supabase
        .from("certifications")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const requiresNewQuizzes = requiresNewCertificationQuizzes(
        user.created_at,
        !!certRow,
      );
      if (!requiresNewQuizzes) {
        for (const moduleId of NEW_CERTIFICATION_MODULE_IDS) {
          if (!map[moduleId]?.passed) {
            map[moduleId] = { passed: true, completionKind: "exempt" };
        }
        }
      }

      writeCache(user.id, map);
      return map;

    },
  });
}
