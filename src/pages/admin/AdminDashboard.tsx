import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses } from '@/hooks/useCourses';
import { Users, BookOpen, Ticket, TrendingUp, ArrowUpRight, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const { data: courses = [], isLoading } = useCourses();

  const totalModules = courses.reduce(
    (acc, c) => acc + (c.modules || []).length,
    0
  );

  const stats = [
    { icon: Users, label: 'Active Members', value: '—', change: 'Coming soon', color: 'text-primary' },
    { icon: BookOpen, label: 'Total Modules', value: totalModules, change: `${courses.length} courses`, color: 'text-primary' },
    { icon: Ticket, label: 'Invite Codes', value: '—', change: 'Coming soon', color: 'text-foreground' },
    { icon: TrendingUp, label: 'Avg Progress', value: '—', change: 'Coming soon', color: 'text-primary' },
  ];

  if (isLoading) {
    return (
      <DashboardLayout isAdminView>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout isAdminView>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground text-lg">Manage your members and course content.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="glass-card p-6 rounded-2xl hover-lift animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-xs text-primary mt-2">{stat.change}</div>
            </div>
          ))}
        </div>

        {/* Course List */}
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="font-display text-xl font-semibold mb-4">Courses</h2>
          {courses.length > 0 ? (
            <div className="space-y-4">
              {courses.map((course) => {
                const moduleCount = (course.modules || []).length;

                return (
                  <div key={course.id} className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30">
                    <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-primary-foreground font-bold">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{course.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {moduleCount} modules
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No courses yet. Go to Course Builder to create one.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
