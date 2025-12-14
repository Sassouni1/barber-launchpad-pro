import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  UserPlus,
  Ticket,
  Mail,
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAdminMembers, useAdminMemberDetail, useAdminStats, MemberStats } from '@/hooks/useAdminMembers';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

function StatCard({ title, value, icon: Icon, subtitle }: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <div className="glass-card p-6 rounded-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function QuizBadge({ average }: { average: number }) {
  if (average >= 80) {
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{average}%</Badge>;
  } else if (average >= 60) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{average}%</Badge>;
  } else if (average > 0) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{average}%</Badge>;
  }
  return <Badge variant="secondary">No attempts</Badge>;
}

function MemberDetailPanel({ member, onClose }: { member: MemberStats; onClose: () => void }) {
  const { data: detail, isLoading } = useAdminMemberDetail(member.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={member.avatar_url || ''} />
          <AvatarFallback className="text-xl">
            {member.full_name?.charAt(0) || member.email?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-display text-xl font-semibold">{member.full_name || 'No Name'}</h3>
          <p className="text-muted-foreground">{member.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Joined {format(new Date(member.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-sm text-muted-foreground">Quiz Average</p>
          <p className="text-2xl font-bold">{member.quizAverage}%</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-sm text-muted-foreground">Lessons Completed</p>
          <p className="text-2xl font-bold">{member.lessonsCompleted}/{member.totalLessons}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-4">Loading details...</p>
      ) : (
        <>
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Quiz History
            </h4>
            {detail?.quizAttempts && detail.quizAttempts.length > 0 ? (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {detail.quizAttempts.map((attempt, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                      <div>
                        <p className="font-medium text-sm">{attempt.module_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(attempt.completed_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <Badge variant={attempt.score / attempt.total_questions >= 0.8 ? 'default' : 'secondary'}>
                        {attempt.score}/{attempt.total_questions}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground text-sm">No quiz attempts yet</p>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Completed Lessons
            </h4>
            {detail?.completedLessons && detail.completedLessons.length > 0 ? (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {detail.completedLessons.map((lesson, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                      <p className="font-medium text-sm">{lesson.lesson_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.completed_at ? format(new Date(lesson.completed_at), 'MMM d') : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground text-sm">No lessons completed yet</p>
            )}
          </div>
        </>
      )}

      <Button variant="outline" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

export default function Members() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: members, isLoading: membersLoading } = useAdminMembers();
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  const filteredMembers = members?.filter(m => 
    m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <DashboardLayout isAdmin>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2">Members</h1>
            <p className="text-muted-foreground text-lg">
              View member progress, quiz scores, and course completion.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddCode} onOpenChange={setShowAddCode}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Ticket className="w-4 h-4 mr-2" />
                  Generate Code
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">Generate Invite Code</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Code Name (optional)</Label>
                    <Input placeholder="e.g., VIP-2024" className="bg-secondary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiration (optional)</Label>
                    <Input type="date" className="bg-secondary/50" />
                  </div>
                  <Button className="w-full gold-gradient text-primary-foreground">
                    Generate Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-primary-foreground">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">Add New Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="John Smith" className="bg-secondary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" placeholder="john@example.com" className="bg-secondary/50" />
                  </div>
                  <Button className="w-full gold-gradient text-primary-foreground">
                    <Mail className="w-4 h-4 mr-2" />
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <StatCard 
            title="Total Members" 
            value={statsLoading ? '...' : stats?.totalMembers || 0} 
            icon={Users}
          />
          <StatCard 
            title="Avg Quiz Score" 
            value={statsLoading ? '...' : `${stats?.avgQuizScore || 0}%`}
            icon={GraduationCap}
          />
          <StatCard 
            title="Total Lessons" 
            value={statsLoading ? '...' : stats?.totalLessons || 0} 
            icon={BookOpen}
          />
          <StatCard 
            title="Lesson Completions" 
            value={statsLoading ? '...' : stats?.totalCompletions || 0} 
            icon={TrendingUp}
            subtitle="Across all members"
          />
        </div>

        {/* Search */}
        <div className="relative animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search members by name or email..." 
            className="pl-10 bg-secondary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Members Table */}
        <div className="glass-card rounded-xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
          {membersLoading ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">Loading members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-xl mb-2">No Members Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term.' : 'Members will appear here once they sign up.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Quiz Avg</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow 
                    key={member.id} 
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => setSelectedMember(member)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar_url || ''} />
                          <AvatarFallback>
                            {member.full_name?.charAt(0) || member.email?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name || 'No Name'}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <QuizBadge average={member.quizAverage} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={member.totalLessons > 0 ? (member.lessonsCompleted / member.totalLessons) * 100 : 0} 
                          className="w-20 h-2"
                        />
                        <span className="text-sm text-muted-foreground">
                          {member.lessonsCompleted}/{member.totalLessons}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.lastActive 
                        ? formatDistanceToNow(new Date(member.lastActive), { addSuffix: true })
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Member Detail Dialog */}
        <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
          <DialogContent className="glass-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Member Details</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <MemberDetailPanel member={selectedMember} onClose={() => setSelectedMember(null)} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
