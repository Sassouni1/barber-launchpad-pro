import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBusinessCard, useSaveBusinessCard, useUploadCardAsset } from '@/hooks/useBusinessCard';
import { toast } from 'sonner';
import { Loader2, Save, Upload, CreditCard, QrCode, ExternalLink, Copy } from 'lucide-react';

const BASE_URL = 'https://barber-launchpad-pro.lovable.app';

export default function BusinessCardSetup() {
  const { data: card, isLoading } = useBusinessCard();
  const saveMutation = useSaveBusinessCard();
  const uploadMutation = useUploadCardAsset();

  const [businessName, setBusinessName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [galleryUrl, setGalleryUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (card) {
      setBusinessName(card.business_name);
      setFirstName(card.first_name || '');
      setLastName(card.last_name || '');
      setBookingUrl(card.booking_url);
      setGalleryUrl(card.gallery_url);
      setInstagramHandle(card.instagram_handle || '');
      setWebsiteUrl(card.website_url || '');
      setPhone(card.phone || '');
      setEmail(card.email || '');
      setLogoUrl(card.logo_url || '');
      setHeroImageUrl(card.hero_image_url || '');
    }
  }, [card]);

  const handleSave = async () => {
    if (!businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    try {
      await saveMutation.mutateAsync({
        ...(card ? { id: card.id } : {}),
        business_name: businessName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        booking_url: bookingUrl.trim(),
        gallery_url: galleryUrl.trim(),
        instagram_handle: instagramHandle.trim(),
        website_url: websiteUrl.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logo_url: logoUrl,
        hero_image_url: heroImageUrl,
      });
      toast.success('Business card saved!');
    } catch {
      toast.error('Failed to save card');
    }
  };

  const handleUpload = async (file: File, type: 'logo' | 'hero') => {
    try {
      const url = await uploadMutation.mutateAsync({ file, type });
      if (type === 'logo') setLogoUrl(url);
      else setHeroImageUrl(url);
      toast.success(`${type === 'logo' ? 'Logo' : 'Image'} uploaded!`);
    } catch {
      toast.error('Upload failed');
    }
  };

  const cardUrl = card ? `${BASE_URL}/card/${card.short_code}` : null;

  const copyLink = () => {
    if (cardUrl) {
      navigator.clipboard.writeText(cardUrl);
      toast.success('Link copied!');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" /> Digital Business Card
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a premium digital card your clients can save directly to their phone.
          </p>
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Card Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Business Name *</Label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your Business Name" className="bg-secondary/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Last Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className="bg-secondary/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Book Consultation Link <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} placeholder="https://booksy.com/your-link" className="bg-secondary/50" />
              <p className="text-xs text-muted-foreground">Booksy, Calendly, Square, Vagaro, StyleSeat, or any booking URL</p>
            </div>

            <div className="space-y-2">
              <Label>See More Transformations Link <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={galleryUrl} onChange={e => setGalleryUrl(e.target.value)} placeholder="https://instagram.com/yourbiz" className="bg-secondary/50" />
              <p className="text-xs text-muted-foreground">Instagram, gallery page, portfolio, or before/after page</p>
            </div>

            <div className="space-y-2">
              <Label>Instagram Handle <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@yourbusiness" className="bg-secondary/50" />
            </div>

            <div className="space-y-2">
              <Label>Website <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yourbusiness.com" className="bg-secondary/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="bg-secondary/50" />
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <Label>Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0], 'logo'); }} />
              <div className="flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain rounded" />}
                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadMutation.isPending}>
                  <Upload className="w-4 h-4 mr-1" /> {logoUrl ? 'Change' : 'Upload'}
                </Button>
              </div>
            </div>

            {/* Hero image upload */}
            <div className="space-y-2">
              <Label>Transformation / Hero Image</Label>
              <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0], 'hero'); }} />
              <div className="space-y-2">
                {heroImageUrl && <img src={heroImageUrl} alt="Hero" className="w-full max-h-40 object-cover rounded-xl" />}
                <Button type="button" variant="outline" size="sm" onClick={() => heroInputRef.current?.click()} disabled={uploadMutation.isPending}>
                  <Upload className="w-4 h-4 mr-1" /> {heroImageUrl ? 'Change Image' : 'Upload Image'}
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {card ? 'Update Card' : 'Create Card'}
            </Button>
          </CardContent>
        </Card>

        {/* QR & Share */}
        {card && cardUrl && (
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" /> Share Your Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl">
                  <QRCodeSVG value={cardUrl} size={200} level="M" />
                </div>
              </div>

              <div className="flex gap-2">
                <Input value={cardUrl} readOnly className="bg-secondary/50 text-sm" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Share this QR code or link. When scanned, clients can save your card directly to their phone contacts with tappable links.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
