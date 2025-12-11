import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TodoCard } from '@/components/dashboard/TodoCard';
import { dailyTodos, weeklyTodos } from '@/data/mockData';
import { Calendar, Target, TrendingUp } from 'lucide-react';

export default function Todos() {
  const allTodos = [...dailyTodos, ...weeklyTodos];
  const completedCount = allTodos.filter((t) => t.completed).length;
  const courseTasksCompleted = allTodos.filter((t) => t.type === 'course' && t.completed).length;
  const personalTasksCompleted = allTodos.filter((t) => t.type === 'personal' && t.completed).length;

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
            { icon: Target, label: 'Total Completed', value: `${completedCount}/${allTodos.length}`, color: 'text-primary' },
            { icon: Calendar, label: 'Course Tasks Done', value: courseTasksCompleted, color: 'text-primary' },
            { icon: TrendingUp, label: 'Personal Goals Done', value: personalTasksCompleted, color: 'text-foreground' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 rounded-2xl text-center hover-lift">
              <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Todo Lists */}
        <div className="grid md:grid-cols-2 gap-6">
          <TodoCard title="Daily Goals" todos={dailyTodos} type="daily" />
          <TodoCard title="Weekly Goals" todos={weeklyTodos} type="weekly" />
        </div>
      </div>
    </DashboardLayout>
  );
}
