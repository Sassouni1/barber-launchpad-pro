import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MemberStats {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  quizAverage: number;
  quizAttempts: number;
  lessonsCompleted: number;
  totalLessons: number;
  lastActive: string | null;
}

export interface MemberDetail {
  quizAttempts: {
    module_id: string;
    module_title: string;
    score: number;
    total_questions: number;
    completed_at: string;
  }[];
  completedLessons: {
    lesson_id: string;
    lesson_title: string;
    completed_at: string;
  }[];
}

export function useAdminMembers() {
  return useQuery({
    queryKey: ['admin-members'],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all quiz attempts
      const { data: quizAttempts, error: quizError } = await supabase
        .from('user_quiz_attempts')
        .select('*');

      if (quizError) throw quizError;

      // Fetch all user progress
      const { data: userProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('completed', true);

      if (progressError) throw progressError;

      // Fetch total lessons count
      const { count: totalLessons } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true });

      // Aggregate stats per member
      const memberStats: MemberStats[] = profiles.map((profile) => {
        const memberQuizzes = quizAttempts?.filter(q => q.user_id === profile.id) || [];
        const memberProgress = userProgress?.filter(p => p.user_id === profile.id) || [];

        // Calculate quiz average
        let quizAverage = 0;
        if (memberQuizzes.length > 0) {
          const totalPercentage = memberQuizzes.reduce((sum, q) => {
            return sum + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0);
          }, 0);
          quizAverage = Math.round(totalPercentage / memberQuizzes.length);
        }

        // Find last active date
        const allDates = [
          ...memberQuizzes.map(q => q.completed_at),
          ...memberProgress.map(p => p.completed_at).filter(Boolean),
        ];
        const lastActive = allDates.length > 0
          ? allDates.sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
          : null;

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          created_at: profile.created_at,
          quizAverage,
          quizAttempts: memberQuizzes.length,
          lessonsCompleted: memberProgress.length,
          totalLessons: totalLessons || 0,
          lastActive,
        };
      });

      return memberStats;
    },
  });
}

export function useAdminMemberDetail(userId: string | null) {
  return useQuery({
    queryKey: ['admin-member-detail', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Fetch quiz attempts with module info
      const { data: quizAttempts, error: quizError } = await supabase
        .from('user_quiz_attempts')
        .select('*, modules(title)')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (quizError) throw quizError;

      // Fetch completed lessons with lesson info
      const { data: lessonProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('*, lessons(title)')
        .eq('user_id', userId)
        .eq('completed', true)
        .order('completed_at', { ascending: false });

      if (progressError) throw progressError;

      return {
        quizAttempts: quizAttempts?.map(q => ({
          module_id: q.module_id,
          module_title: (q.modules as any)?.title || 'Unknown Module',
          score: q.score,
          total_questions: q.total_questions,
          completed_at: q.completed_at,
        })) || [],
        completedLessons: lessonProgress?.map(p => ({
          lesson_id: p.lesson_id,
          lesson_title: (p.lessons as any)?.title || 'Unknown Lesson',
          completed_at: p.completed_at,
        })) || [],
      } as MemberDetail;
    },
    enabled: !!userId,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Get total members
      const { count: totalMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get all quiz attempts for average calculation
      const { data: quizAttempts } = await supabase
        .from('user_quiz_attempts')
        .select('score, total_questions');

      let avgQuizScore = 0;
      if (quizAttempts && quizAttempts.length > 0) {
        const totalPercentage = quizAttempts.reduce((sum, q) => {
          return sum + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0);
        }, 0);
        avgQuizScore = Math.round(totalPercentage / quizAttempts.length);
      }

      // Get total lessons and completion stats
      const { count: totalLessons } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true });

      const { count: totalCompletions } = await supabase
        .from('user_progress')
        .select('*', { count: 'exact', head: true })
        .eq('completed', true);

      return {
        totalMembers: totalMembers || 0,
        avgQuizScore,
        totalLessons: totalLessons || 0,
        totalCompletions: totalCompletions || 0,
      };
    },
  });
}
