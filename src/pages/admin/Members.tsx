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
} from 'lucide-react';

export default function Members() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);

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

        {/* Empty State */}
        <div className="glass-card p-12 rounded-2xl text-center animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-xl mb-2">No Members Yet</h3>
          <p className="text-muted-foreground mb-4">
            Member management is coming soon. Use the buttons above to add members or generate invite codes.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
