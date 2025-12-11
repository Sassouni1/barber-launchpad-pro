import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Calendar, Target, TrendingUp, ListTodo } from 'lucide-react';

export default function Todos() {
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
            { icon: Target, label: 'Total Completed', value: '0/0', color: 'text-primary' },
            { icon: Calendar, label: 'Course Tasks Done', value: 0, color: 'text-primary' },
            { icon: TrendingUp, label: 'Personal Goals Done', value: 0, color: 'text-foreground' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 rounded-2xl text-center hover-lift">
              <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        <div className="glass-card p-12 rounded-2xl text-center animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <ListTodo className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-xl mb-2">No Goals Yet</h3>
          <p className="text-muted-foreground">
            Your todo lists will appear here once you start tracking goals.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
