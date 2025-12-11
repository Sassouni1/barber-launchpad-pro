import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { members, inviteCodes } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  UserPlus,
  Ticket,
  Copy,
  MoreHorizontal,
  Mail,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

export default function Members() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copied!',
      description: `Invite code ${code} copied to clipboard.`,
    });
  };

  return (
    <DashboardLayout isAdmin>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2">Members</h1>
            <p className="text-muted-foreground text-lg">
              Manage your community members and invite codes.
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

        {/* Search */}
        <div className="relative max-w-md animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>

        {/* Members Table */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id} className="border-border/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-primary-foreground font-bold">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        member.status === 'active'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {member.status === 'active' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {member.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress value={member.progress} className="h-2 w-20 bg-secondary" />
                      <span className="text-sm text-primary font-medium">{member.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.joinedAt}</TableCell>
                  <TableCell className="text-muted-foreground">{member.lastActive}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Invite Codes Section */}
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="font-display text-xl font-semibold mb-4">Invite Codes</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {inviteCodes.map((code) => (
              <div
                key={code.id}
                className={cn(
                  'p-4 rounded-xl border transition-all duration-300',
                  code.used
                    ? 'border-border/30 bg-secondary/20'
                    : 'border-primary/30 bg-primary/5 hover:border-primary/50'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold">{code.code}</span>
                  {!code.used && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyCode(code.code)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {code.used ? (
                  <p className="text-xs text-muted-foreground">Used by {code.usedBy}</p>
                ) : (
                  <p className="text-xs text-primary">Available</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Created {code.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
