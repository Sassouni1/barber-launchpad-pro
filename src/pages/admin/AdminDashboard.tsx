import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { members, inviteCodes, courses } from '@/data/mockData';
import { Users, BookOpen, Ticket, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function AdminDashboard() {
  const activeMembers = members.filter((m) => m.status === 'active').length;
  const unusedCodes = inviteCodes.filter((c) => !c.used).length;
  const totalLessons = courses.reduce(
    (acc, c) => acc + c.modules.reduce((m, mod) => m + mod.lessons.length, 0),
    0
  );
  const avgProgress = Math.round(members.reduce((acc, m) => acc + m.progress, 0) / members.length);

  const stats = [
    { icon: Users, label: 'Active Members', value: activeMembers, change: '+3 this month', color: 'text-primary' },
    { icon: BookOpen, label: 'Total Lessons', value: totalLessons, change: '2 courses', color: 'text-primary' },
    { icon: Ticket, label: 'Unused Codes', value: unusedCodes, change: `${inviteCodes.length} total`, color: 'text-foreground' },
    { icon: TrendingUp, label: 'Avg Progress', value: `${avgProgress}%`, change: '+5% this week', color: 'text-primary' },
  ];

  return (
    <DashboardLayout isAdmin>
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

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Members */}
          <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <h2 className="font-display text-xl font-semibold mb-4">Recent Members</h2>
            <div className="space-y-4">
              {members.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                  <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-primary-foreground font-bold">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.name}</div>
                    <div className="text-sm text-muted-foreground">Joined {member.joinedAt}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-primary">{member.progress}%</div>
                    <div className="text-xs text-muted-foreground">progress</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Course Progress */}
          <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <h2 className="font-display text-xl font-semibold mb-4">Course Engagement</h2>
            <div className="space-y-6">
              {courses.map((course) => {
                const lessons = course.modules.flatMap((m) => m.lessons);
                const completedByAll = lessons.filter((l) => l.completed).length;

                return (
                  <div key={course.id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{course.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {lessons.length} lessons
                      </span>
                    </div>
                    <Progress value={course.progress} className="h-2 bg-secondary" />
                    <div className="text-xs text-muted-foreground">
                      Average completion: {course.progress}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Invite Codes */}
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.6s' }}>
          <h2 className="font-display text-xl font-semibold mb-4">Recent Invite Codes</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {inviteCodes.map((code) => (
              <div
                key={code.id}
                className={`p-4 rounded-lg border ${
                  code.used ? 'border-border/30 bg-secondary/20' : 'border-primary/30 bg-primary/5'
                }`}
              >
                <div className="font-mono font-bold text-sm mb-2">{code.code}</div>
                {code.used ? (
                  <div className="text-xs text-muted-foreground">Used by {code.usedBy}</div>
                ) : (
                  <div className="text-xs text-primary">Available</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
