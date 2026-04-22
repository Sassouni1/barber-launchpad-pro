import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAllListings, useApproveListing } from "@/hooks/useSpecialistDirectory";
import { Check, X, MapPin, ExternalLink, Plus, Award } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddSpecialistDialog } from "@/components/admin/AddSpecialistDialog";

interface ProofPhotoRow {
  id: string;
  user_id: string;
  file_url: string;
  created_at: string;
  caption: string | null;
  full_name: string | null;
  email: string | null;
}

function useProofPhotos() {
  return useQuery({
    queryKey: ["admin-proof-photos"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: photos, error } = await supabase
        .from("directory_photos")
        .select("id, user_id, file_url, created_at, caption")
        .eq("is_proof", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((photos || []).map((p) => p.user_id)));
      if (ids.length === 0) return [] as ProofPhotoRow[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const byId = new Map((profiles || []).map((p) => [p.id, p]));
      return (photos || []).map((p) => {
        const prof = byId.get(p.user_id);
        return {
          ...p,
          full_name: prof?.full_name ?? null,
          email: prof?.email ?? null,
        } as ProofPhotoRow;
      });
    },
  });
}

const DirectoryAdmin = () => {
  const { data: listings = [], isLoading } = useAllListings();
  const { data: proofPhotos = [], isLoading: loadingProofs } = useProofPhotos();
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
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Certification Proof Photos ({proofPhotos.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Every photo a member uploads holding their certification.
            </p>
          </CardHeader>
          <CardContent>
            {loadingProofs ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : proofPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proof photos yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {proofPhotos.map((p) => (
                  <a
                    key={p.id}
                    href={p.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img
                      src={p.file_url}
                      alt={p.full_name || "Certification proof"}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    <div className="p-2 text-xs">
                      <p className="font-medium truncate">
                        {p.full_name || p.email || "Unknown member"}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
