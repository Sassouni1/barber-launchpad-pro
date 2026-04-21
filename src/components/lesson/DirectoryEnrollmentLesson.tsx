import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyListing, useUpsertListing } from "@/hooks/useSpecialistDirectory";
import {
  useDirectoryPhotos,
  uploadDirectoryPhoto,
  useDeleteDirectoryPhoto,
  useSetHeroPhoto,
  type DirectoryPhoto,
} from "@/hooks/useDirectoryPhotos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Award,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Star,
  Trash2,
  Upload,
  ImagePlus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import directoryProofExample from "@/assets/directory-proof-example.png";

type Step = "proof" | "details" | "gallery";

export function DirectoryEnrollmentLesson() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: existing, isLoading: loadingListing } = useMyListing(user?.id);
  const { data: photos = [], isLoading: loadingPhotos } = useDirectoryPhotos(user?.id);
  const upsert = useUpsertListing();
  const deletePhoto = useDeleteDirectoryPhoto();
  const setHero = useSetHeroPhoto();

  const proofPhoto = photos.find((p) => p.is_proof);
  const heroPhoto = photos.find((p) => p.is_hero) || proofPhoto;
  const galleryPhotos = photos.filter((p) => !p.is_proof);

  // Determine starting step
  const [step, setStep] = useState<Step>("proof");
  useEffect(() => {
    if (loadingListing || loadingPhotos) return;
    if (!proofPhoto) setStep("proof");
    else if (!existing) setStep("details");
    else setStep("gallery");
  }, [loadingListing, loadingPhotos, proofPhoto?.id, existing?.id]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Header step={step} />

      {step === "proof" && (
        <ProofStep
          userId={user.id}
          onUploaded={() => {
            qc.invalidateQueries({ queryKey: ["directory-photos", user.id] });
            setStep("details");
          }}
          existingProof={proofPhoto}
        />
      )}

      {step === "details" && (
        <DetailsStep
          userId={user.id}
          email={user.email}
          existing={existing}
          heroFromProof={heroPhoto?.file_url}
          onSaved={async (listingId) => {
            // Link any unlinked photos to the new listing
            await supabase
              .from("directory_photos")
              .update({ listing_id: listingId })
              .eq("user_id", user.id)
              .is("listing_id", null);
            qc.invalidateQueries({ queryKey: ["directory-photos", user.id] });
            qc.invalidateQueries({ queryKey: ["specialist-listing", user.id] });
            setStep("gallery");
          }}
          submitting={upsert.isPending}
          submit={upsert.mutateAsync}
        />
      )}

      {step === "gallery" && (
        <GalleryStep
          userId={user.id}
          listingId={existing?.id || null}
          photos={photos}
          galleryPhotos={galleryPhotos}
          heroPhoto={heroPhoto || null}
          onChanged={() => qc.invalidateQueries({ queryKey: ["directory-photos", user.id] })}
          deletePhoto={(p) => deletePhoto.mutate(p)}
          setHero={(photoId) => setHero.mutate({ userId: user.id, photoId })}
          onEditDetails={() => setStep("details")}
        />
      )}
    </div>
  );
}

/* ---------------- Header ---------------- */

function Header({ step }: { step: Step }) {
  const stepNum = step === "proof" ? 1 : step === "details" ? 2 : 3;
  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center">
          <MapPin className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold gold-text">
            Get Added to the Men's Hair Expert Search Database
          </h2>
          <p className="text-sm text-muted-foreground">
            Build your public profile on find.menshairexpert.com
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 1: Proof Photo ---------------- */

function ProofStep({
  userId,
  onUploaded,
  existingProof,
}: {
  userId: string;
  onUploaded: () => void;
  existingProof?: DirectoryPhoto;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      // Step 1: AI verification — make sure they're holding a certificate
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      toast.loading("Verifying your photo...", { id: "verify" });
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
        "verify-certification-photo",
        { body: { imageBase64: base64 } },
      );
      toast.dismiss("verify");

      if (verifyErr) {
        toast.error("Could not verify photo. Please try again.");
        return;
      }
      if (!verifyData?.valid) {
        toast.error(
          verifyData?.reason ||
            "We couldn't see you holding a certificate. Please retake the photo.",
        );
        return;
      }

      // Step 2: Upload to storage + DB
      await uploadDirectoryPhoto({
        userId,
        file,
        isProof: true,
        isHero: true,
      });
      toast.success("Verified! Photo uploaded.");
      onUploaded();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Award className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold">Take a photo holding your certification</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This is how you get listed on the public Men's Hair Expert directory at
            find.menshairexpert.com so new clients can find and book you.
          </p>
          <ol className="text-sm text-muted-foreground mt-3 space-y-2 list-decimal list-inside">
            <li>Print your certificate or pull it up on another screen.</li>
            <li>Hold it up next to your face so both you and the certificate are clearly visible.</li>
            <li>Snap a clear, well-lit photo and upload it below.</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            We'll use this photo as your default profile picture on the directory — you can swap it
            out or add more photos in the next steps.
          </p>
        </div>
      </div>

      {!existingProof && userId !== "f4d1104c-1f77-4c24-a936-5419462f9e92" && (
        <div className="flex items-center gap-3 pl-8">
          <div className="rounded-lg overflow-hidden border border-primary/40 ring-1 ring-primary/20 w-40 h-40 flex-shrink-0">
            <img
              src={directoryProofExample}
              alt="Example of someone holding their certification"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Example — take a photo like this
          </p>
        </div>
      )}
      {existingProof ? (
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden border border-primary/30">
            <img src={existingProof.file_url} alt="Holding certification" className="w-full" />
          </div>
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> Picture on file
          </div>
          <Button onClick={onUploaded} className="w-full gold-gradient">
            Continue to your listing details
          </Button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            className="w-full gold-gradient h-12"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" /> Upload picture holding certification
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Hold your printed or digital certificate visibly in the photo.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- Step 2: Details ---------------- */

function DetailsStep({
  userId,
  email,
  existing,
  heroFromProof,
  onSaved,
  submitting,
  submit,
}: {
  userId: string;
  email: string | undefined;
  existing: any;
  heroFromProof: string | undefined;
  onSaved: (listingId: string) => void | Promise<void>;
  submitting: boolean;
  submit: (payload: any) => Promise<any>;
}) {
  const [businessName, setBusinessName] = useState(existing?.business_name || "");
  const [firstName, setFirstName] = useState(existing?.first_name || "");
  const [lastName, setLastName] = useState(existing?.last_name || "");
  const [city, setCity] = useState(existing?.city || "");
  const [state, setState] = useState(existing?.state || "");
  const [zip, setZip] = useState(existing?.zip_code || "");
  const [bookingUrl, setBookingUrl] = useState(existing?.booking_url || "");
  const [instagram, setInstagram] = useState(existing?.instagram_handle || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [bio, setBio] = useState(existing?.bio || "");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      toast.error("Enter a valid 5-digit ZIP code");
      return;
    }
    setSaving(true);
    try {
      const geo = await supabase.functions.invoke("geocode-zip", { body: { zip } });
      if (geo.error) throw new Error("Could not validate ZIP code");
      const { latitude, longitude } = geo.data;

      const result = await submit({
        user_id: userId,
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
        hero_photo_url: existing?.hero_photo_url || heroFromProof || null,
        email: email || null,
        approved: true,
        approved_at: new Date().toISOString(),
        visible: true,
      });

      toast.success(existing ? "Listing updated!" : "You're on the directory! 🎉");
      await onSaved(result.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="glass-card rounded-xl p-6 space-y-4">
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
          <Input
            value={state}
            onChange={(e) => setState(e.target.value)}
            maxLength={2}
            placeholder="CA"
            required
          />
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
        <Input
          value={bookingUrl}
          onChange={(e) => setBookingUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Instagram</Label>
          <Input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@yourhandle"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </div>
      </div>

      <div>
        <Label>Short bio</Label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Tell potential clients about yourself..."
        />
      </div>

      <Button type="submit" className="w-full gold-gradient h-12" disabled={saving || submitting}>
        {(saving || submitting) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {existing ? "Update Listing" : "Publish My Listing"}
      </Button>
    </form>
  );
}

/* ---------------- Step 3: Gallery ---------------- */

function GalleryStep({
  userId,
  listingId,
  photos,
  galleryPhotos,
  heroPhoto,
  onChanged,
  deletePhoto,
  setHero,
  onEditDetails,
}: {
  userId: string;
  listingId: string | null;
  photos: DirectoryPhoto[];
  galleryPhotos: DirectoryPhoto[];
  heroPhoto: DirectoryPhoto | null;
  onChanged: () => void;
  deletePhoto: (p: DirectoryPhoto) => void;
  setHero: (photoId: string) => void;
  onEditDetails: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async (file: File) => {
    setUploading(true);
    try {
      await uploadDirectoryPhoto({
        userId,
        file,
        listingId,
        isProof: false,
        isHero: false,
      });
      toast.success("Photo added");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          <div>
            <p className="font-semibold">You're live on the directory! 🎉</p>
            <p className="text-sm text-muted-foreground">
              Clients can now find you on find.menshairexpert.com
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="https://find.menshairexpert.com" target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> View directory
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={onEditDetails}>
            Edit listing details
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Your photos</h3>
            <p className="text-sm text-muted-foreground">
              The starred photo is shown as your profile picture.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAdd(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4 mr-2" />
            )}
            Add photo
          </Button>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No photos yet. Add one above.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <div
                key={p.id}
                className={`relative group rounded-lg overflow-hidden border ${
                  p.is_hero ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <img src={p.file_url} alt="" className="w-full aspect-square object-cover" />
                {p.is_hero && (
                  <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Profile
                  </div>
                )}
                {p.is_proof && (
                  <div className="absolute top-1.5 right-1.5 bg-secondary/80 text-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    Proof
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex gap-1">
                  {!p.is_hero && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setHero(p.id)}
                    >
                      <Star className="w-3 h-3 mr-1" /> Use as profile
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2"
                    onClick={() => {
                      if (confirm("Delete this photo?")) deletePhoto(p);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
