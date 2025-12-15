import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export interface DynamicTodoStatus {
  listId: string;
  listTitle: string;
  dueDays: number | null;
  completedItems: number;
  totalItems: number;
  isComplete: boolean;
  isBehind: boolean;
  daysOverdue: number;
}

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
  dynamicTodosCompleted: number;
  dynamicTodosTotal: number;
  dynamicTodosBehind: number;
  dynamicTodoStatus: DynamicTodoStatus[];
  isAdmin: boolean;
  skipAgreement: boolean;
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
  dynamicTodoStatus: DynamicTodoStatus[];
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

      // Fetch admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

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

      // Fetch dynamic todo lists with items
      const { data: dynamicLists, error: listsError } = await supabase
        .from('dynamic_todo_lists')
        .select('*')
        .order('order_index');

      if (listsError) throw listsError;

      const { data: dynamicItems, error: itemsError } = await supabase
        .from('dynamic_todo_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Fetch all dynamic todo progress
      const { data: dynamicProgress, error: dynamicProgressError } = await supabase
        .from('user_dynamic_todo_progress')
        .select('*')
        .eq('completed', true);

      if (dynamicProgressError) throw dynamicProgressError;

      // Build items per list
      const itemsByList: Record<string, string[]> = {};
      dynamicItems?.forEach(item => {
        if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
        itemsByList[item.list_id].push(item.id);
      });

      const totalDynamicItems = dynamicItems?.length || 0;

      // Aggregate stats per member
      const memberStats: MemberStats[] = profiles.map((profile) => {
        const memberQuizzes = quizAttempts?.filter(q => q.user_id === profile.id) || [];
        const memberProgress = userProgress?.filter(p => p.user_id === profile.id) || [];
        const memberDynamicProgress = dynamicProgress?.filter(p => p.user_id === profile.id) || [];

        // Calculate quiz average
        let quizAverage = 0;
        if (memberQuizzes.length > 0) {
          const totalPercentage = memberQuizzes.reduce((sum, q) => {
            return sum + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0);
          }, 0);
          quizAverage = Math.round(totalPercentage / memberQuizzes.length);
        }

        // Calculate dynamic todo status per list
        const completedItemIds = new Set(memberDynamicProgress.map(p => p.item_id));
        const memberJoinDate = new Date(profile.created_at);
        const today = new Date();
        const daysSinceJoin = differenceInDays(today, memberJoinDate);

        let dynamicTodosBehind = 0;
        const dynamicTodoStatus: DynamicTodoStatus[] = (dynamicLists || []).map(list => {
          const listItems = itemsByList[list.id] || [];
          const completedItems = listItems.filter(id => completedItemIds.has(id)).length;
          const isComplete = completedItems >= listItems.length && listItems.length > 0;
          const dueDays = (list as any).due_days as number | null;
          
          let isBehind = false;
          let daysOverdue = 0;
          
          if (dueDays && !isComplete && daysSinceJoin > dueDays) {
            isBehind = true;
            daysOverdue = daysSinceJoin - dueDays;
            dynamicTodosBehind++;
          }

          return {
            listId: list.id,
            listTitle: list.title,
            dueDays,
            completedItems,
            totalItems: listItems.length,
            isComplete,
            isBehind,
            daysOverdue,
          };
        });

        // Find last active date
        const allDates = [
          ...memberQuizzes.map(q => q.completed_at),
          ...memberProgress.map(p => p.completed_at).filter(Boolean),
          ...memberDynamicProgress.map(p => p.completed_at).filter(Boolean),
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
          dynamicTodosCompleted: memberDynamicProgress.length,
          dynamicTodosTotal: totalDynamicItems,
          dynamicTodosBehind,
          dynamicTodoStatus,
          isAdmin: adminUserIds.has(profile.id),
          skipAgreement: !!profile.skip_agreement,
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

      // Fetch user profile for join date
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .maybeSingle();

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

      // Fetch dynamic todo lists and progress
      const { data: dynamicLists } = await supabase
        .from('dynamic_todo_lists')
        .select('*')
        .order('order_index');

      const { data: dynamicItems } = await supabase
        .from('dynamic_todo_items')
        .select('*');

      const { data: dynamicProgress } = await supabase
        .from('user_dynamic_todo_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true);

      // Build items per list
      const itemsByList: Record<string, string[]> = {};
      dynamicItems?.forEach(item => {
        if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
        itemsByList[item.list_id].push(item.id);
      });

      const completedItemIds = new Set(dynamicProgress?.map(p => p.item_id) || []);
      const memberJoinDate = profile?.created_at ? new Date(profile.created_at) : new Date();
      const daysSinceJoin = differenceInDays(new Date(), memberJoinDate);

      const dynamicTodoStatus: DynamicTodoStatus[] = (dynamicLists || []).map(list => {
        const listItems = itemsByList[list.id] || [];
        const completedItems = listItems.filter(id => completedItemIds.has(id)).length;
        const isComplete = completedItems >= listItems.length && listItems.length > 0;
        const dueDays = (list as any).due_days as number | null;

        let isBehind = false;
        let daysOverdue = 0;

        if (dueDays && !isComplete && daysSinceJoin > dueDays) {
          isBehind = true;
          daysOverdue = daysSinceJoin - dueDays;
        }

        return {
          listId: list.id,
          listTitle: list.title,
          dueDays,
          completedItems,
          totalItems: listItems.length,
          isComplete,
          isBehind,
          daysOverdue,
        };
      });

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
        dynamicTodoStatus,
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

      // Get dynamic todo stats
      const { count: totalDynamicItems } = await supabase
        .from('dynamic_todo_items')
        .select('*', { count: 'exact', head: true });

      const { count: totalDynamicCompletions } = await supabase
        .from('user_dynamic_todo_progress')
        .select('*', { count: 'exact', head: true })
        .eq('completed', true);

      return {
        totalMembers: totalMembers || 0,
        avgQuizScore,
        totalLessons: totalLessons || 0,
        totalCompletions: totalCompletions || 0,
        totalDynamicItems: totalDynamicItems || 0,
        totalDynamicCompletions: totalDynamicCompletions || 0,
      };
    },
  });
}
