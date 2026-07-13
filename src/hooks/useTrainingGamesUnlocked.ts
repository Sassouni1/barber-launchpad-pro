import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isQuizPassed } from '@/lib/quizPass';
import {
  isNewCertificationModule,
  requiresNewCertificationQuizzes,
} from '@/lib/certificationRequirements';

/**
 * Training Games unlock once the user passes every quiz attached to any
 * module belonging to a hair-system course. "Pass" = miss no more than 1
 * question (see @/lib/quizPass).
 */
export function useTrainingGamesUnlocked() {
  const { user, isAdmin } = useAuth();

  const query = useQuery({
    queryKey: ['training-games-unlocked', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { unlocked: false, totalQuizzes: 0, passedQuizzes: 0 };
      }

      const { data: hairCourse, error: courseError } = await supabase
        .from('courses')
        .select('id')
        .eq('category', 'hair-system')
        .limit(1)
        .maybeSingle();
      if (courseError) throw courseError;
      if (!hairCourse?.id) return { unlocked: true, totalQuizzes: 0, passedQuizzes: 0 };

      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id, has_quiz')
        .eq('course_id', hairCourse.id);

      if (modulesError) throw modulesError;

      // Legacy members (and anyone who already has a certificate) must not be
      // blocked by the post-cutoff Live Client / charging quizzes. New members
      // still see and must pass the full current quiz set.
      const { data: existingCertification, error: certificationError } =
        await supabase
          .from('certifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', hairCourse.id)
          .maybeSingle();

      if (certificationError) throw certificationError;

      const requiresNewQuizzes = requiresNewCertificationQuizzes(
        user.created_at,
        !!existingCertification,
      );
      const quizModules = (modules || []).filter(
        (m: any) =>
          m.has_quiz &&
          (requiresNewQuizzes || !isNewCertificationModule(m.id)),
      );
      if (quizModules.length === 0) {
        return { unlocked: true, totalQuizzes: 0, passedQuizzes: 0 };
      }

      const { data: attempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('module_id, score, total_questions')
        .eq('user_id', user.id)
        .in('module_id', quizModules.map((m: any) => m.id));

      if (attemptsError) throw attemptsError;

      let passedQuizzes = 0;
      for (const m of quizModules) {
        const ma = (attempts || []).filter((a) => a.module_id === m.id);
        const passedAny = ma.some((a) => isQuizPassed(a.score, a.total_questions));
        if (passedAny) passedQuizzes += 1;
      }

      return {
        unlocked: passedQuizzes >= quizModules.length,
        totalQuizzes: quizModules.length,
        passedQuizzes,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  return {
    isLoading: query.isLoading,
    unlocked: isAdmin ? true : (query.data?.unlocked ?? false),
    totalQuizzes: query.data?.totalQuizzes ?? 0,
    passedQuizzes: query.data?.passedQuizzes ?? 0,
  };
}
