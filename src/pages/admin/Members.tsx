import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListTodo,
  Shield,
  ShieldOff,
  FileSignature,
  Download,
  FileText,
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
import { useToggleAdminRole } from '@/hooks/useAdminRoles';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

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
  const cappedAverage = Math.min(average, 100); // Cap at 100% to handle legacy data
  if (cappedAverage >= 80) {
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{cappedAverage}%</Badge>;
  } else if (cappedAverage >= 60) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{cappedAverage}%</Badge>;
  } else if (cappedAverage > 0) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{cappedAverage}%</Badge>;
  }
  return <Badge variant="secondary">No attempts</Badge>;
}

function BehindBadge({ behind }: { behind: number }) {
  if (behind === 0) {
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">On Track</Badge>;
  }
  return (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {behind} behind
    </Badge>
  );
}

function MemberDetailPanel({ member, onClose, refetch }: { member: MemberStats; onClose: () => void; refetch: () => void }) {
  const { data: detail, isLoading } = useAdminMemberDetail(member.id);
  const toggleAdminRole = useToggleAdminRole();
  const [updatingSkip, setUpdatingSkip] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementData, setAgreementData] = useState<{ signedAt: string | null; signatureData: string | null } | null>(null);
  const [loadingAgreement, setLoadingAgreement] = useState(false);
  const agreementRef = useRef<HTMLDivElement>(null);

  const handleToggleAdmin = () => {
    toggleAdminRole.mutate({ userId: member.id, makeAdmin: !member.isAdmin });
  };

  const handleToggleSkipAgreement = async () => {
    setUpdatingSkip(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ skip_agreement: !member.skipAgreement })
        .eq('id', member.id);
      
      if (!error) {
        await refetch();
      }
    } finally {
      setUpdatingSkip(false);
    }
  };

  const handleViewAgreement = async () => {
    setLoadingAgreement(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('agreement_signed_at, signature_data')
        .eq('id', member.id)
        .single();

      if (!error && data) {
        setAgreementData({
          signedAt: data.agreement_signed_at,
          signatureData: data.signature_data,
        });
        setShowAgreement(true);
      }
    } finally {
      setLoadingAgreement(false);
    }
  };

  const handleDownloadAgreement = () => {
    if (!agreementRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Agreement - ${member.full_name || member.email}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
            h1 { text-align: center; margin-bottom: 30px; }
            h2 { margin-top: 24px; margin-bottom: 12px; }
            p { line-height: 1.6; margin-bottom: 12px; }
            ul { margin-left: 20px; }
            li { margin-bottom: 8px; }
            .signature-section { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
            .signature-img { max-width: 300px; border: 1px solid #ddd; padding: 10px; background: #fafafa; }
            .meta { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          ${agreementRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={member.avatar_url || ''} />
          <AvatarFallback className="text-xl">
            {member.full_name?.charAt(0) || member.email?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl font-semibold">{member.full_name || 'No Name'}</h3>
            {member.isAdmin && <Badge className="bg-primary/20 text-primary border-primary/30">Admin</Badge>}
          </div>
          <p className="text-muted-foreground">{member.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Joined {format(new Date(member.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Admin Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50">
        <div className="flex items-center gap-3">
          {member.isAdmin ? <Shield className="w-5 h-5 text-primary" /> : <ShieldOff className="w-5 h-5 text-muted-foreground" />}
          <div>
            <p className="font-medium">Admin Access</p>
            <p className="text-sm text-muted-foreground">Allow access to admin panel</p>
          </div>
        </div>
        <Switch 
          checked={member.isAdmin} 
          onCheckedChange={handleToggleAdmin}
          disabled={toggleAdminRole.isPending}
        />
      </div>

      {/* Skip Agreement Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50">
        <div className="flex items-center gap-3">
          <FileSignature className={`w-5 h-5 ${member.skipAgreement ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium">Skip Agreement</p>
            <p className="text-sm text-muted-foreground">Bypass the agreement signing requirement</p>
          </div>
        </div>
        <Switch 
          checked={member.skipAgreement} 
          onCheckedChange={handleToggleSkipAgreement}
          disabled={updatingSkip}
        />
      </div>

      {/* View Agreement Button */}
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={handleViewAgreement}
        disabled={loadingAgreement}
      >
        <FileText className="w-4 h-4 mr-2" />
        {loadingAgreement ? 'Loading...' : 'View Signed Agreement'}
      </Button>

      {/* Agreement Dialog */}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-display text-2xl flex items-center justify-between">
              <span>Signed Agreement</span>
              <Button variant="outline" size="sm" onClick={handleDownloadAgreement}>
                <Download className="w-4 h-4 mr-2" />
                Print / Download
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-4" style={{ maxHeight: 'calc(90vh - 120px)' }}>
            <div ref={agreementRef} className="space-y-6 text-sm pb-6">
              <h1 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                SERVICE AGREEMENT
              </h1>
              <p className="text-muted-foreground italic">
                This Agreement ("Agreement") is entered into as of {agreementData?.signedAt ? format(new Date(agreementData.signedAt), 'MMMM d, yyyy') : 'N/A'}, by and between Sassouni Digital Media, 
                also known as "Barber Launch" (the "Service Provider"), and {member.full_name || member.email || 'Client'} (the "Client").
              </p>

              <h2 style={{ fontWeight: 'bold', marginTop: '16px' }}>1. SERVICES</h2>
              <p>The Service Provider agrees to provide the Client with access to educational and support services related to hair system installation and client management (the "Services").</p>

              <h2 style={{ fontWeight: 'bold', marginTop: '16px' }}>2. PAYMENT TERMS</h2>
              <p>The Client agrees to pay the agreed-upon fees for the Services as specified in the payment plan selected at the time of enrollment.</p>

              <h2 style={{ fontWeight: 'bold', marginTop: '16px' }}>3. REFUND POLICY</h2>
              <p><strong>No Refunds:</strong> All payments made for the Services are non-refundable. Once payment is made, the Client is not entitled to any refund, regardless of circumstances.</p>

              <h2 style={{ fontWeight: 'bold', marginTop: '16px' }}>4. CLIENT RESPONSIBILITIES</h2>
              <ul style={{ marginLeft: '20px', listStyleType: 'disc' }}>
                <li>Complete all required training modules and coursework</li>
                <li>Attend scheduled sessions and meetings</li>
                <li>Maintain professional conduct at all times</li>
                <li>Not share access credentials or course materials with third parties</li>
              </ul>

              <h2 style={{ fontWeight: 'bold', marginTop: '16px' }}>5. INTELLECTUAL PROPERTY</h2>
              <p>All materials provided are the intellectual property of the Service Provider. Unauthorized reproduction, distribution, or sharing is prohibited.</p>

              <h2 style={{ fontWeight: 'bold', marginTop: '16px' }}>6. LIMITATION OF LIABILITY</h2>
              <p>The Service Provider shall not be liable for any indirect, incidental, or consequential damages arising from the use of Services.</p>

              <div className="signature-section" style={{ marginTop: '32px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
                <h2 style={{ fontWeight: 'bold' }}>CLIENT ACCEPTANCE</h2>
                {agreementData?.signedAt ? (
                  <div>
                    {agreementData.signatureData && agreementData.signatureData.startsWith('data:image') ? (
                      <img 
                        src={agreementData.signatureData} 
                        alt="Client Signature" 
                        className="signature-img"
                        style={{ maxWidth: '300px', border: '1px solid #ddd', padding: '10px', background: '#fafafa' }}
                      />
                    ) : (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ fontSize: '14px', marginBottom: '12px', fontStyle: 'italic' }}>
                          By accepting electronically, the undersigned agrees to be bound by all terms and conditions set forth in this agreement.
                        </p>
                        <p style={{ fontSize: '16px', marginBottom: '4px' }}>
                          <strong>Name:</strong> {member.full_name || member.email}
                        </p>
                        <p style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '16px' }}>☑</span> <em>I have read, understand, and agree to the terms of this agreement.</em>
                        </p>
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                          Electronic acceptance pursuant to the Electronic Signatures in Global and National Commerce Act (E-SIGN Act), 15 U.S.C. § 7001 et seq.
                        </p>
                      </div>
                    )}
                    <p className="meta" style={{ marginTop: '8px', color: '#666' }}>
                      Date: {format(new Date(agreementData.signedAt), 'MMMM d, yyyy \'at\' h:mm a')}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No acceptance on file</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-sm text-muted-foreground">Quiz Avg</p>
          <p className="text-2xl font-bold">{member.quizAverage}%</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-sm text-muted-foreground">Lessons</p>
          <p className="text-2xl font-bold">{member.lessonsCompleted}/{member.totalLessons}</p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <p className="text-sm text-muted-foreground">Tasks</p>
          <p className="text-2xl font-bold">{member.dynamicTodosCompleted}/{member.dynamicTodosTotal}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-4">Loading details...</p>
      ) : (
        <>
          {/* Dynamic Todo Status */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> Task List Progress
            </h4>
            {detail?.dynamicTodoStatus && detail.dynamicTodoStatus.length > 0 ? (
              <div className="space-y-2">
                {detail.dynamicTodoStatus.map((status) => (
                  <div 
                    key={status.listId} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      status.isBehind ? 'bg-red-500/10 border border-red-500/30' : 'bg-secondary/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {status.isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : status.isBehind ? (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{status.listTitle}</p>
                        {status.dueDays && (
                          <p className="text-xs text-muted-foreground">
                            Due within {status.dueDays} days
                            {status.isBehind && <span className="text-red-400 ml-1">({status.daysOverdue} days overdue)</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={status.isComplete ? 'default' : 'secondary'}>
                      {status.completedItems}/{status.totalItems}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No task lists configured</p>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Quiz History
            </h4>
            {detail?.quizAttempts && detail.quizAttempts.length > 0 ? (
              <ScrollArea className="h-36">
                <div className="space-y-2">
                  {detail.quizAttempts.map((attempt, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                      <div>
                        <p className="font-medium text-sm">{attempt.module_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(attempt.completed_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <Badge variant={Math.min(attempt.score / attempt.total_questions, 1) >= 0.8 ? 'default' : 'secondary'}>
                        {Math.min(attempt.score, attempt.total_questions)}/{attempt.total_questions}
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
              <ScrollArea className="h-36">
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

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = useAdminMembers();
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  const filteredMembers = members?.filter(m => 
    m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Sort to show members behind first
  const sortedMembers = [...filteredMembers].sort((a, b) => b.dynamicTodosBehind - a.dynamicTodosBehind);

  return (
    <DashboardLayout isAdminView>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2">Members</h1>
            <p className="text-muted-foreground text-lg">
              View member progress, quiz scores, and task completion.
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
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
            title="Lesson Done" 
            value={statsLoading ? '...' : stats?.totalCompletions || 0} 
            icon={TrendingUp}
            subtitle="All members"
          />
          <StatCard 
            title="Tasks Done" 
            value={statsLoading ? '...' : stats?.totalDynamicCompletions || 0} 
            icon={ListTodo}
            subtitle="All members"
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
          ) : sortedMembers.length === 0 ? (
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
                  <TableHead>Lessons</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((member) => (
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.full_name || 'No Name'}</p>
                            {member.isAdmin && <Badge variant="outline" className="text-xs py-0">Admin</Badge>}
                          </div>
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
                          className="w-16 h-2"
                        />
                        <span className="text-sm text-muted-foreground">
                          {member.lessonsCompleted}/{member.totalLessons}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={member.dynamicTodosTotal > 0 ? (member.dynamicTodosCompleted / member.dynamicTodosTotal) * 100 : 0} 
                          className="w-16 h-2"
                        />
                        <span className="text-sm text-muted-foreground">
                          {member.dynamicTodosCompleted}/{member.dynamicTodosTotal}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BehindBadge behind={member.dynamicTodosBehind} />
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
          <DialogContent className="glass-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Member Details</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <MemberDetailPanel 
                member={members?.find(m => m.id === selectedMember.id) || selectedMember} 
                onClose={() => setSelectedMember(null)} 
                refetch={refetchMembers} 
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
