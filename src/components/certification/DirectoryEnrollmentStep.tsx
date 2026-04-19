import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useMyListing, useUpsertListing } from "@/hooks/useSpecialistDirectory";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Upload, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const DirectoryEnrollmentStep = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const { data: existing } = useMyListing(user?.id);
  const upsert = useUpsertListing();

  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existing) {
      setBusinessName(existing.business_name || "");
      setFirstName(existing.first_name || "");
      setLastName(existing.last_name || "");
      setCity(existing.city || "");
      setState(existing.state || "");
      setZip(existing.zip_code || "");
      setBookingUrl(existing.booking_url || "");
      setInstagram(existing.instagram_handle || "");
      setPhone(existing.phone || "");
      setBio(existing.bio || "");
    }
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!/^\d{5}$/.test(zip)) {
      toast.error("Enter a valid 5-digit ZIP code");
      return;
    }

    setUploading(true);
    try {
      // Geocode ZIP
      const geo = await supabase.functions.invoke("geocode-zip", { body: { zip } });
      if (geo.error) throw new Error("Could not validate ZIP code");
      const { latitude, longitude } = geo.data;

      // Upload hero photo if provided
      let hero_photo_url = existing?.hero_photo_url || null;
      if (heroFile) {
        const ext = heroFile.name.split(".").pop();
        const path = `${user.id}/hero-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("specialist-directory")
          .upload(path, heroFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("specialist-directory").getPublicUrl(path);
        hero_photo_url = pub.publicUrl;
      }

      await upsert.mutateAsync({
        user_id: user.id,
        business_name: businessName,
        first_name: firstName,
        last_name: lastName,
        city,
        state: state.toUpperCase(),
        zip_code: zip,
        latitude,
        longitude,
        booking_url: bookingUrl,
        instagram_handle: instagram,
        phone,
        bio,
        hero_photo_url,
        email: user.email || null,
      });

      toast.success("Listing submitted! We'll review it shortly.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit listing");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gold" />
            Join the Specialist Directory
          </DialogTitle>
          <DialogDescription>
            Now that you're certified, complete your public listing on find.menshairexpert.com so clients can find you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Business name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="CA" required />
            </div>
          </div>

          <div>
            <Label>ZIP code</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Instagram</Label>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourhandle" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
          </div>

          <div>
            <Label>Short bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} />
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Hero photo (recommended)
            </Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setHeroFile(e.target.files?.[0] || null)}
            />
            {existing?.hero_photo_url && !heroFile && (
              <p className="text-xs text-muted-foreground mt-1">Current photo will be kept unless replaced.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Later
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existing ? "Update Listing" : "Submit Listing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
