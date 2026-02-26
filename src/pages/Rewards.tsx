import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Gift, Plus, Star, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  useRewardClients,
  useRewardVisitsRequired,
  useAddClient,
  useLogVisit,
  useRedeemReward,
  useDeleteClient,
} from '@/hooks/useRewards';
import { cn } from '@/lib/utils';

export default function Rewards() {
  const { data: clients = [], isLoading } = useRewardClients();
  const { data: visitsRequired = 10 } = useRewardVisitsRequired();
  const addClient = useAddClient();
  const logVisit = useLogVisit();
  const redeemReward = useRedeemReward();
  const deleteClient = useDeleteClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const totalRedemptions = clients.reduce((sum, c) => sum + c.totalRedemptions, 0);

  const handleAddClient = async () => {
    if (!name.trim()) return;
    try {
      await addClient.mutateAsync({
        client_name: name.trim(),
        client_phone: phone.trim() || undefined,
        client_email: email.trim() || undefined,
      });
      toast.success('Client added!');
      setName('');
      setPhone('');
      setEmail('');
      setDialogOpen(false);
    } catch {
      toast.error('Failed to add client');
    }
  };

  const handleLogVisit = async (clientId: string, clientName: string) => {
    try {
      await logVisit.mutateAsync(clientId);
      toast.success(`Visit logged for ${clientName}`);
    } catch {
      toast.error('Failed to log visit');
    }
  };

  const handleRedeem = async (clientId: string, clientName: string) => {
    try {
      await redeemReward.mutateAsync(clientId);
      toast.success(`🎉 Reward redeemed for ${clientName}!`);
    } catch {
      toast.error('Failed to redeem reward');
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      await deleteClient.mutateAsync(clientId);
      toast.success('Client removed');
    } catch {
      toast.error('Failed to delete client');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Rewards Tracker</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track client visits and reward loyal customers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="client-name">Name *</Label>
                  <Input
                    id="client-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Client name"
                  />
                </div>
                <div>
                  <Label htmlFor="client-phone">Phone</Label>
                  <Input
                    id="client-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="client-email">Email</Label>
                  <Input
                    id="client-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <Button onClick={handleAddClient} disabled={!name.trim() || addClient.isPending} className="w-full">
                  {addClient.isPending ? 'Adding...' : 'Add Client'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gift className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalRedemptions}</p>
                <p className="text-xs text-muted-foreground">Rewards Given</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client List */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : clients.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No clients yet</h3>
              <p className="text-sm text-muted-foreground">Add your first client to start tracking visits</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => {
              const isFull = client.currentVisits >= visitsRequired;
              return (
                <Card key={client.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-foreground">
                        {client.client_name}
                      </CardTitle>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {client.client_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the client and all their visit history. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(client.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {(client.client_phone || client.client_email) && (
                      <p className="text-xs text-muted-foreground">
                        {[client.client_phone, client.client_email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Punch Card */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from({ length: visitsRequired }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all',
                            i < client.currentVisits
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/30 bg-transparent'
                          )}
                        >
                          {i < client.currentVisits && (
                            <Star className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {isFull
                          ? '🎉 FREE SERVICE EARNED!'
                          : `${client.currentVisits} / ${visitsRequired} visits`}
                        {client.totalRedemptions > 0 && ` · ${client.totalRedemptions} redeemed`}
                      </p>
                      <div className="flex gap-2">
                        {isFull ? (
                          <Button
                            size="sm"
                            onClick={() => handleRedeem(client.id, client.client_name)}
                            disabled={redeemReward.isPending}
                            className="gap-1"
                          >
                            <Gift className="w-3.5 h-3.5" /> Redeem
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLogVisit(client.id, client.client_name)}
                            disabled={logVisit.isPending}
                          >
                            + Visit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
