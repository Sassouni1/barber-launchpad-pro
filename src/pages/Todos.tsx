import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DynamicTodoList } from '@/components/dashboard/DynamicTodoList';
import { TodoList } from '@/components/dashboard/TodoList';
import { useDynamicTodos } from '@/hooks/useDynamicTodos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Target, TrendingUp, Lock } from 'lucide-react';

export default function Todos() {
  const { allListsCompleted, completedListsCount, totalLists, isLoading } = useDynamicTodos();
  const { user } = useAuth();

  // Fetch real user_todos completion joined with todo type
  const { data: todoStats } = useQuery({
    queryKey: ['todo-stats', user?.id],
    queryFn: async () => {
      if (!user) return { courseDone: 0, personalDone: 0 };

      // Get completed user_todos
      const { data: userTodos, error: utErr } = await supabase
        .from('user_todos')
        .select('todo_id')
        .eq('user_id', user.id)
        .eq('completed', true);
      if (utErr) throw utErr;

      if (!userTodos || userTodos.length === 0) return { courseDone: 0, personalDone: 0 };

      const completedIds = userTodos.map(ut => ut.todo_id);

      // Get types for those todos
      const { data: todos, error: tErr } = await supabase
        .from('todos')
        .select('id, type')
        .in('id', completedIds);
      if (tErr) throw tErr;

      let courseDone = 0;
      let personalDone = 0;
      for (const t of todos || []) {
        if (t.type === 'course') courseDone++;
        else if (t.type === 'daily' || t.type === 'weekly') personalDone++;
      }

      return { courseDone, personalDone };
    },
    enabled: !!user,
  });

  const courseDone = todoStats?.courseDone ?? 0;
  const personalDone = todoStats?.personalDone ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-2">Your Goals</h1>
          <p className="text-muted-foreground text-lg">
            Track your daily and weekly progress to stay on course.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {[
            { icon: Target, label: 'Lists Completed', value: `${completedListsCount}/${totalLists}`, color: 'text-primary' },
            { icon: Calendar, label: 'Course Tasks Done', value: courseDone, color: 'text-primary' },
            { icon: TrendingUp, label: 'Personal Goals Done', value: personalDone, color: 'text-foreground' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 rounded-2xl text-center hover-lift">
              <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Dynamic Todo List */}
        <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <DynamicTodoList />
        </div>

        {/* Daily/Weekly Tasks - Only show after dynamic todos complete */}
        <div className="animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {!isLoading && totalLists > 0 && !allListsCompleted ? (
            <div className="border border-border/30 bg-muted/20 p-6 rounded-xl text-center opacity-50">
              <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/60" />
              <p className="text-muted-foreground/80 text-sm">
                Complete dynamic lists to unlock daily & weekly tasks
              </p>
            </div>
          ) : (
            <TodoList />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
