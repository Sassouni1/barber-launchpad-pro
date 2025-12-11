import { useCourses } from '@/hooks/useCourses';
import { BookOpen, Trophy, Clock, TrendingUp, Loader2 } from 'lucide-react';

export function ProgressOverview() {
  const { data: courses = [], isLoading } = useCourses();

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

  const stats = [
    { icon: BookOpen, label: 'Total Modules', value: totalModules, color: 'text-primary' },
    { icon: Trophy, label: 'Courses', value: courses.length, color: 'text-primary' },
    { icon: Clock, label: 'Keep Learning', value: '—', color: 'text-muted-foreground' },
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
          {courses.map((course) => {
            const moduleCount = (course.modules || []).length;
            return (
              <div key={course.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{course.title}</span>
                  <span className="text-muted-foreground text-sm">{moduleCount} modules</span>
                </div>
                <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full gold-gradient rounded-full transition-all duration-500"
                    style={{ 
                      width: '0%',
                      boxShadow: '0 0 10px hsl(var(--gold) / 0.5)'
                    }}
                  />
                </div>
              </div>
            );
          })}
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
