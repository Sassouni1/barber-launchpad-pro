import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export interface DynamicTodoItemStatus {
  itemId: string;
  itemTitle: string;
  completed: boolean;
  completedAt: string | null;
}

export interface DynamicTodoStatus {
  listId: string;
  listTitle: string;
  dueDays: number | null;
  completedItems: number;
  totalItems: number;
  isComplete: boolean;
  isBehind: boolean;
  daysOverdue: number;
  items: DynamicTodoItemStatus[];
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

export interface QuizModuleStatus {
  module_id: string;
  module_title: string;
  course_id: string;
  course_title: string;
  bestScore: number | null;
  totalQuestions: number;
  passed: boolean;
  attempted: boolean;
  attemptCount: number;
}

export interface CourseQuizGroup {
  course_id: string;
  course_title: string;
  modules: QuizModuleStatus[];
  passedCount: number;
  totalCount: number;
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
  quizStatus: QuizModuleStatus[];
  quizByCoure: CourseQuizGroup[];
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

      // Fetch all modules as the unit of completion
      const { data: allModules, error: modulesError } = await supabase
        .from('modules')
        .select('id, course_id');

      if (modulesError) throw modulesError;

      const totalLessons = allModules?.length || 0;

      // Fetch all lessons (id + module_id) so user_progress can map to modules
      const { data: allLessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, module_id');

      if (lessonsError) throw lessonsError;

      // Build module_id lookup from lesson_id
      const moduleIdByLessonId: Record<string, string> = {};
      allLessons?.forEach(lesson => {
        moduleIdByLessonId[lesson.id] = lesson.module_id;
      });

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

        // Calculate quiz average (cap at 100% to handle legacy data issues)
        let quizAverage = 0;
        if (memberQuizzes.length > 0) {
          const totalPercentage = memberQuizzes.reduce((sum, q) => {
            const pct = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
            return sum + Math.min(pct, 100);
          }, 0);
          quizAverage = Math.round(totalPercentage / memberQuizzes.length);
        }

        // Find modules where user passed a quiz (best score >= 80%)
        const passedModuleIds = new Set<string>();
        const attemptsByMod = new Map<string, number>();
        memberQuizzes.forEach(q => {
          const pct = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
          const best = attemptsByMod.get(q.module_id) || 0;
          attemptsByMod.set(q.module_id, Math.max(best, pct));
        });
        attemptsByMod.forEach((bestPct, modId) => {
          if (bestPct >= 80) passedModuleIds.add(modId);
        });

        // Combine explicitly completed lessons + lessons from quiz-passed modules
        const completedLessonIds = new Set(memberProgress.map(p => p.lesson_id));
        passedModuleIds.forEach(modId => {
          (lessonIdsByModule[modId] || []).forEach(lid => completedLessonIds.add(lid));
        });
        const lessonsCompleted = completedLessonIds.size;

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
            items: [],
          };
        });

        // Find last active date
        const allDates = [
          profile.last_active_at,
          ...memberQuizzes.map(q => q.completed_at),
          ...memberProgress.map(p => p.completed_at).filter(Boolean),
          ...memberDynamicProgress.map(p => p.completed_at).filter(Boolean),
        ].filter(Boolean);
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
          lessonsCompleted,
          totalLessons,
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

      // Fetch all courses for grouping
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, title')
        .order('order_index');

      const courseMap = new Map((allCourses || []).map(c => [c.id, c.title]));

      // Fetch all modules with quizzes
      const { data: quizModules } = await supabase
        .from('modules')
        .select('id, title, order_index, course_id')
        .eq('has_quiz', true)
        .order('order_index');

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
        .select('*')
        .order('order_index');

      const { data: dynamicProgress } = await supabase
        .from('user_dynamic_todo_progress')
        .select('*')
        .eq('user_id', userId);

      // Build items per list with full item data
      const itemDataByList: Record<string, { id: string; title: string; order_index: number }[]> = {};
      dynamicItems?.forEach(item => {
        if (!itemDataByList[item.list_id]) itemDataByList[item.list_id] = [];
        itemDataByList[item.list_id].push({ id: item.id, title: item.title, order_index: item.order_index });
      });

      const itemsByList: Record<string, string[]> = {};
      dynamicItems?.forEach(item => {
        if (!itemsByList[item.list_id]) itemsByList[item.list_id] = [];
        itemsByList[item.list_id].push(item.id);
      });

      const completedItemIds = new Set(dynamicProgress?.filter(p => p.completed).map(p => p.item_id) || []);
      const progressByItemId = new Map(dynamicProgress?.map(p => [p.item_id, p]) || []);
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

        const listItemData = (itemDataByList[list.id] || []).sort((a, b) => a.order_index - b.order_index);
        const items: DynamicTodoItemStatus[] = listItemData.map(item => {
          const progress = progressByItemId.get(item.id);
          return {
            itemId: item.id,
            itemTitle: item.title,
            completed: progress?.completed || false,
            completedAt: progress?.completed_at || null,
          };
        });

        return {
          listId: list.id,
          listTitle: list.title,
          dueDays,
          completedItems,
          totalItems: listItems.length,
          isComplete,
          isBehind,
          daysOverdue,
          items,
        };
      });

      // Build quiz status per module
      const attemptsByModule = new Map<string, typeof quizAttempts>();
      quizAttempts?.forEach(a => {
        const list = attemptsByModule.get(a.module_id) || [];
        list.push(a);
        attemptsByModule.set(a.module_id, list);
      });

      const quizStatus: QuizModuleStatus[] = (quizModules || []).map(mod => {
        const attempts = attemptsByModule.get(mod.id) || [];
        let bestScore: number | null = null;
        let bestTotal = 0;
        attempts.forEach(a => {
          const pct = a.total_questions > 0 ? a.score / a.total_questions : 0;
          if (bestScore === null || pct > bestScore / (bestTotal || 1)) {
            bestScore = Math.round(Math.min(pct, 1) * 100);
            bestTotal = a.total_questions;
          }
        });
        return {
          module_id: mod.id,
          module_title: mod.title,
          course_id: mod.course_id,
          course_title: courseMap.get(mod.course_id) || 'Unknown Course',
          bestScore,
          totalQuestions: bestTotal,
          passed: bestScore !== null && bestScore >= 80,
          attempted: attempts.length > 0,
          attemptCount: attempts.length,
        };
      });

      // Group by course
      const courseGroups = new Map<string, CourseQuizGroup>();
      quizStatus.forEach(qs => {
        if (!courseGroups.has(qs.course_id)) {
          courseGroups.set(qs.course_id, {
            course_id: qs.course_id,
            course_title: qs.course_title,
            modules: [],
            passedCount: 0,
            totalCount: 0,
          });
        }
        const group = courseGroups.get(qs.course_id)!;
        group.modules.push(qs);
        group.totalCount++;
        if (qs.passed) group.passedCount++;
      });
      const quizByCourse = Array.from(courseGroups.values());

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
        quizStatus,
        quizByCoure: quizByCourse,
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
          const pct = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
          return sum + Math.min(pct, 100);
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
