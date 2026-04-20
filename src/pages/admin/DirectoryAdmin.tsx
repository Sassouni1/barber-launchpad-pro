import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAllListings, useApproveListing } from "@/hooks/useSpecialistDirectory";
import { Check, X, MapPin, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AddSpecialistDialog } from "@/components/admin/AddSpecialistDialog";

const DirectoryAdmin = () => {
  const { data: listings = [], isLoading } = useAllListings();
  const approve = useApproveListing();
  const [addOpen, setAddOpen] = useState(false);

  const pending = listings.filter((l) => !l.approved);
  const approved = listings.filter((l) => l.approved);

  const handleToggle = async (id: string, approved: boolean) => {
    try {
      await approve.mutateAsync({ id, approved });
      toast.success(approved ? "Listing approved" : "Listing unapproved");
    } catch {
      toast.error("Failed to update");
    }
  };

  const renderCard = (l: typeof listings[number]) => (
    <Card key={l.id} className="overflow-hidden">
      <div className="flex gap-4 p-4">
        {l.hero_photo_url ? (
          <img src={l.hero_photo_url} alt={l.business_name} className="w-24 h-24 rounded-lg object-cover" />
        ) : (
          <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
            <MapPin className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{l.business_name}</h3>
              <p className="text-sm text-muted-foreground">
                {[l.first_name, l.last_name].filter(Boolean).join(" ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {l.city}, {l.state} {l.zip_code}
              </p>
            </div>
            <Badge variant={l.approved ? "default" : "secondary"}>
              {l.approved ? "Live" : "Pending"}
            </Badge>
          </div>
          {l.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{l.bio}</p>}
          <div className="flex gap-2 mt-3">
            {l.approved ? (
              <Button size="sm" variant="outline" onClick={() => handleToggle(l.id, false)}>
                <X className="h-3 w-3 mr-1" /> Unapprove
              </Button>
            ) : (
              <Button size="sm" onClick={() => handleToggle(l.id, true)}>
                <Check className="h-3 w-3 mr-1" /> Approve
              </Button>
            )}
            {l.booking_url && (
              <Button size="sm" variant="ghost" asChild>
                <a href={l.booking_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> Booking
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Specialist Directory</h1>
            <p className="text-muted-foreground">Approve listings shown on find.menshairexpert.com</p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Specialist
          </Button>
        </div>

        <AddSpecialistDialog open={addOpen} onClose={() => setAddOpen(false)} />

        {isLoading && <p className="text-muted-foreground">Loading…</p>}

        <Card>
          <CardHeader>
            <CardTitle>Pending Approval ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending listings.</p>
            ) : (
              pending.map(renderCard)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Specialists ({approved.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approved.length === 0 ? (
              <p className="text-sm text-muted-foreground">No live specialists yet.</p>
            ) : (
              approved.map(renderCard)
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DirectoryAdmin;
