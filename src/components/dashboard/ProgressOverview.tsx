import { useCourses } from '@/hooks/useCourses';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Trophy, Clock, TrendingUp, Loader2 } from 'lucide-react';

export function ProgressOverview() {
  const { data: courses = [], isLoading } = useCourses();
  const { user } = useAuth();

  // Fetch user's completed lessons (maps to modules via lesson -> module_id)
  const { data: completedLessons = [] } = useQuery({
    queryKey: ['user-progress', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .eq('completed', true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch all lessons to map lesson_id -> module_id
  const { data: allLessons = [] } = useQuery({
    queryKey: ['all-lessons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, module_id');
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's quiz attempts to find passed modules
  const { data: quizAttempts = [] } = useQuery({
    queryKey: ['user-quiz-attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_quiz_attempts')
        .select('module_id, score, total_questions')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalModules = courses.reduce(
    (acc, course) => acc + (course.modules || []).length,
    0
  );

  // Build a map: lessonId -> moduleId
  const moduleIdByLessonId = new Map<string, string>();
  for (const lesson of allLessons) {
    moduleIdByLessonId.set(lesson.id, lesson.module_id);
  }

  // Find modules completed via user_progress (video watch)
  const completedModuleIdsFromProgress = new Set<string>();
  for (const l of completedLessons) {
    const modId = moduleIdByLessonId.get(l.lesson_id);
    if (modId) completedModuleIdsFromProgress.add(modId);
  }

  // Find modules completed via quiz pass (best score >= 80%)
  const bestScoreByModule = new Map<string, number>();
  for (const q of quizAttempts) {
    const pct = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
    const best = bestScoreByModule.get(q.module_id) || 0;
    bestScoreByModule.set(q.module_id, Math.max(best, pct));
  }
  const passedModuleIds = new Set<string>();
  bestScoreByModule.forEach((pct, modId) => {
    if (pct >= 80) passedModuleIds.add(modId);
  });

  // Calculate per-course completion (unit = module)
  const courseProgress = courses.map(course => {
    const moduleIds = (course.modules || []).map(m => m.id);
    const totalMods = moduleIds.length;
    let completedCount = 0;
    for (const mid of moduleIds) {
      if (completedModuleIdsFromProgress.has(mid) || passedModuleIds.has(mid)) {
        completedCount++;
      }
    }
    const pct = totalMods > 0 ? Math.round((completedCount / totalMods) * 100) : 0;
    return { ...course, totalLessons: totalMods, completedCount, pct };
  });

  const totalCompleted = courseProgress.reduce((s, c) => s + c.completedCount, 0);

  const stats = [
    { icon: BookOpen, label: 'Total Modules', value: totalModules, color: 'text-primary' },
    { icon: Trophy, label: 'Courses', value: courses.length, color: 'text-primary' },
    { icon: Clock, label: 'Lessons Done', value: totalCompleted, color: 'text-muted-foreground' },
  ];

  return (
    <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center gold-glow-subtle">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-xl tracking-tight">Progress Overview</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
            System Analytics
          </p>
        </div>
      </div>

      {/* Course progress */}
      {courses.length > 0 ? (
        <div className="space-y-5">
          {courseProgress.map((course) => (
            <div key={course.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{course.title}</span>
                <span className="text-muted-foreground text-sm">
                  {course.completedCount}/{course.totalLessons} lessons
                </span>
              </div>
              <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full gold-gradient rounded-full transition-all duration-500"
                  style={{ 
                    width: `${course.pct}%`,
                    boxShadow: course.pct > 0 ? '0 0 10px hsl(var(--gold) / 0.5)' : 'none'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No courses available yet</p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border/30">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center group">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-center group-hover:border-primary/30 group-hover:bg-primary/10 transition-all duration-300">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="text-xl font-bold gold-text">{stat.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
