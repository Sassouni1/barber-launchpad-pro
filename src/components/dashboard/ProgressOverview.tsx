import { courses } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Trophy, Clock } from 'lucide-react';

export function ProgressOverview() {
  const totalProgress = Math.round(
    courses.reduce((acc, course) => acc + course.progress, 0) / courses.length
  );

  const totalLessons = courses.reduce(
    (acc, course) => acc + course.modules.reduce((m, mod) => m + mod.lessons.length, 0),
    0
  );

  const completedLessons = courses.reduce(
    (acc, course) =>
      acc + course.modules.reduce((m, mod) => m + mod.lessons.filter((l) => l.completed).length, 0),
    0
  );

  const stats = [
    { icon: BookOpen, label: 'Lessons Completed', value: `${completedLessons}/${totalLessons}`, color: 'text-primary' },
    { icon: Trophy, label: 'Overall Progress', value: `${totalProgress}%`, color: 'text-primary' },
    { icon: Clock, label: 'Est. Time Left', value: '12h 30m', color: 'text-muted-foreground' },
  ];

  return (
    <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
      <h2 className="font-display text-2xl font-semibold mb-6">Your Progress</h2>

      <div className="space-y-6">
        {courses.map((course) => (
          <div key={course.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm">{course.title}</span>
              <span className="text-primary font-semibold">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-2 bg-secondary" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border/30">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
