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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Gift, Plus, Star, Trash2, Users, QrCode, Copy, ChevronDown, Link } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  useRewardClients,
  useRewardVisitsRequired,
  useAddClient,
  useLogVisit,
  useRedeemReward,
  useDeleteClient,
} from '@/hooks/useRewards';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

function ShareSection() {
  const { user } = useAuth();
  const [showQR, setShowQR] = useState(false);
  const joinUrl = `${window.location.origin}/rewards/join/${user?.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    toast.success('Link copied!');
  };

  if (!user) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Link className="w-4 h-4" /> Share with Clients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Clients can sign themselves up using your personal link or QR code.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowQR(!showQR)}>
            <QrCode className="w-3.5 h-3.5" /> {showQR ? 'Hide QR' : 'Show QR'}
          </Button>
        </div>
        {showQR && (
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <QRCodeSVG value={joinUrl} size={180} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const addClient = useAddClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const handleAdd = async () => {
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
      setShowDetails(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to add client');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="client-name">Name *</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              autoFocus
            />
          </div>
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground px-0">
                <ChevronDown className={cn('w-4 h-4 transition-transform', showDetails && 'rotate-180')} />
                Add details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
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
            </CollapsibleContent>
          </Collapsible>
          <Button onClick={handleAdd} disabled={!name.trim() || addClient.isPending} className="w-full">
            {addClient.isPending ? 'Adding...' : 'Add Client'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Rewards() {
  const { data: clients = [], isLoading } = useRewardClients();
  const { data: visitsRequired = 10 } = useRewardVisitsRequired();
  const logVisit = useLogVisit();
  const redeemReward = useRedeemReward();
  const deleteClient = useDeleteClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalRedemptions = clients.reduce((sum, c) => sum + c.totalRedemptions, 0);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Rewards Tracker</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track client visits and reward loyal customers
            </p>
          </div>
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Add Client
          </Button>
          <AddClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>

        <ShareSection />

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
