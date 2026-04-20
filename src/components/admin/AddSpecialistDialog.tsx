import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Search, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface MemberRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

export const AddSpecialistDialog = ({ open, onClose }: Props) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"member" | "manual">("member");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zip, setZip] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["admin-members-search"],
    enabled: open,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as MemberRow[];
    },
  });

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return members.slice(0, 50);
    return members
      .filter(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [members, memberSearch]);

  const reset = () => {
    setTab("member");
    setMemberSearch("");
    setSelectedUserId(null);
    setBusinessName("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setCity("");
    setStateCode("");
    setZip("");
    setBookingUrl("");
    setInstagram("");
    setPhone("");
    setBio("");
    setHeroFile(null);
  };

  const handleSelectMember = (m: MemberRow) => {
    setSelectedUserId(m.id);
    const parts = (m.full_name || "").trim().split(/\s+/);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
    setEmail(m.email || "");
    setPhone(m.phone || "");
    setTab("manual");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !city || !stateCode || !zip) {
      toast.error("Business name, city, state, and ZIP are required");
      return;
    }
    if (!/^\d{5}$/.test(zip)) {
      toast.error("Enter a valid 5-digit ZIP");
      return;
    }

    setSaving(true);
    try {
      const geo = await supabase.functions.invoke("geocode-zip", { body: { zip } });
      if (geo.error) throw new Error("Could not validate ZIP code");
      const { latitude, longitude } = geo.data;

      // user_id is required & unique. If no member selected, generate a placeholder UUID.
      const userId = selectedUserId || crypto.randomUUID();

      let hero_photo_url: string | null = null;
      if (heroFile) {
        const ext = heroFile.name.split(".").pop();
        const path = `${userId}/hero-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("specialist-directory")
          .upload(path, heroFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("specialist-directory").getPublicUrl(path);
        hero_photo_url = pub.publicUrl;
      }

      const { error } = await supabase.from("specialist_directory").upsert(
        {
          user_id: userId,
          business_name: businessName,
          first_name: firstName || null,
          last_name: lastName || null,
          city,
          state: stateCode.toUpperCase(),
          zip_code: zip,
          latitude,
          longitude,
          booking_url: bookingUrl || null,
          instagram_handle: instagram || null,
          phone: phone || null,
          email: email || null,
          bio: bio || null,
          hero_photo_url,
          approved: true,
          approved_at: new Date().toISOString(),
          visible: true,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      toast.success("Specialist added and approved");
      qc.invalidateQueries({ queryKey: ["all-specialist-listings"] });
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add specialist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold" />
            Add Specialist
          </DialogTitle>
          <DialogDescription>
            Pick an existing member or enter details manually. Listings added here are auto-approved.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="member">From Members</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="member" className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
              {filteredMembers.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No members found.</p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMember(m)}
                    className="w-full text-left p-3 hover:bg-accent transition-colors"
                  >
                    <p className="font-medium text-sm">{m.full_name || "(no name)"}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </button>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Pick a member to pre-fill their info, then complete the listing details.
            </p>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4">
              {selectedUserId && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Linked to existing member account.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Business name *</Label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>City *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div>
                  <Label>State *</Label>
                  <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} maxLength={2} placeholder="CA" required />
                </div>
              </div>

              <div>
                <Label>ZIP code *</Label>
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  required
                />
              </div>

              <div>
                <Label>Booking link</Label>
                <Input value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div>
                <Label>Instagram</Label>
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
              </div>

              <div>
                <Label>Short bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Hero photo
                </Label>
                <Input type="file" accept="image/*" onChange={(e) => setHeroFile(e.target.files?.[0] || null)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Specialist
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
