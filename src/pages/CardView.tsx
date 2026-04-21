import { useParams, useSearchParams } from 'react-router-dom';
import { useBusinessCardByCode } from '@/hooks/useBusinessCard';
import { downloadVCard } from '@/lib/generateVCard';
import { Loader2, UserPlus, Calendar, Sparkles, Wallet, Instagram, Globe, Gift, Users } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export default function CardView() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [searchParams] = useSearchParams();
  const { data: card, isLoading } = useBusinessCardByCode(shortCode);
  const [walletLoading, setWalletLoading] = useState(false);
  const [googleWalletLoading, setGoogleWalletLoading] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const ios = useMemo(() => isIOS(), []);
  const android = useMemo(() => isAndroid(), []);

  // Log scan when card loads
  useEffect(() => {
    if (!card) return;
    const source = searchParams.get('src') || 'direct';
    (supabase as any)
      .from('card_scans')
      .insert({ card_id: card.id, user_id: card.user_id, source })
      .then(() => {});
  }, [card?.id]);

  const handleSaveContact = () => {
    if (!card) return;
    downloadVCard(card);
    setContactSaved(true);
    toast.success("Contact saved! We'll prompt you to add to Wallet shortly.");
  };

  // Auto-open the wallet prompt 10 seconds after the contact is saved
  useEffect(() => {
    if (!contactSaved) return;
    const t = setTimeout(() => setWalletPromptOpen(true), 10000);
    return () => clearTimeout(t);
  }, [contactSaved]);

  const handleAddToWallet = async () => {
    if (!card || walletLoading) return;
    setWalletLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-apple-pass`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ short_code: card.short_code }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate pass');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.business_name.replace(/\s+/g, '-')}.pkpass`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not generate Wallet pass');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleAddToGoogleWallet = async () => {
    if (!card || googleWalletLoading) return;
    setGoogleWalletLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-google-wallet-pass`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ short_code: card.short_code }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate pass');
      }
      const { saveUrl } = await resp.json();
      window.open(saveUrl, '_blank');
    } catch (err: any) {
      console.error(err);
      toast.error('Could not generate Google Wallet pass');
    } finally {
      setGoogleWalletLoading(false);
    }
  };

  const instagramUrl = card?.instagram_handle
    ? `https://instagram.com/${card.instagram_handle.replace(/^@/, '')}`
    : null;

  const rewardsJoinUrl = card ? `/rewards/join/${card.user_id}` : '#';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
        <h1 className="text-2xl font-bold mb-2">Card Not Found</h1>
        <p className="text-muted-foreground">This business card link is no longer active.</p>
      </div>
    );
  }

  const displayName = [card.first_name, card.last_name].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="cyber-grid fixed inset-0 pointer-events-none opacity-30" />
      <div className="cyber-grid-fade fixed inset-0 pointer-events-none" />
      
      <div className="w-full max-w-sm relative z-10">
        <div className="relative rounded-3xl overflow-hidden glass-card border border-primary/20 shadow-2xl shadow-primary/10">
          
          {/* Hero / Transformation image */}
          {card.hero_image_url ? (
            <div className="relative h-56 overflow-hidden">
              <img src={card.hero_image_url} alt="Transformation" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
            </div>
          ) : (
            <div className="relative h-56 overflow-hidden">
              <img src="/images/default-transformation.jpg" alt="Hair Transformation" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
            </div>
          )}

          <div className="px-6 pb-8 pt-4 space-y-6">
            {/* Identity */}
            <div className="text-center space-y-3">
              {card.logo_url && (
                <img src={card.logo_url} alt={card.business_name} className="h-14 mx-auto object-contain drop-shadow-lg" />
              )}
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
                {card.business_name}
              </h1>
              {displayName && (
                <p className="text-foreground/70 text-base font-medium">{displayName}</p>
              )}
              <p className="gold-text text-sm font-semibold tracking-[0.2em] uppercase">
                Hair Replacement
              </p>
            </div>

            {/* Divider */}
            <div className="neural-lines h-px" />

            {/* Action buttons */}
            <div className="space-y-3">
              {card.booking_url && (
                <a
                  href={card.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl gold-gradient text-primary-foreground font-semibold text-sm transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-primary/30"
                >
                  <Calendar className="w-5 h-5 shrink-0" />
                  Book Your Free Consultation
                </a>
              )}
              {card.gallery_url && (
                <a
                  href={card.gallery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-secondary/50 text-secondary-foreground font-semibold text-sm border border-primary/10 transition-all active:scale-[0.98] hover:bg-secondary/70 hover:border-primary/20"
                >
                  <Sparkles className="w-5 h-5 shrink-0 text-primary" />
                  See More Transformations
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-secondary/50 text-secondary-foreground font-semibold text-sm border border-primary/10 transition-all active:scale-[0.98] hover:bg-secondary/70 hover:border-primary/20"
                >
                  <Instagram className="w-5 h-5 shrink-0 text-pink-400" />
                  {card.instagram_handle}
                </a>
              )}
              {card.website_url && (
                <a
                  href={card.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-secondary/50 text-secondary-foreground font-semibold text-sm border border-primary/10 transition-all active:scale-[0.98] hover:bg-secondary/70 hover:border-primary/20"
                >
                  <Globe className="w-5 h-5 shrink-0 text-primary" />
                  Visit Website
                </a>
              )}
            </div>

            {/* Divider */}
            <div className="neural-lines h-px" />

            {/* Client Hub */}
            <div className="space-y-3">
              <a
                href={`/client/${card.user_id}`}
                className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-primary/10 text-foreground font-semibold text-sm border border-primary/20 transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md"
              >
                <Gift className="w-5 h-5 shrink-0 text-primary" />
                Rewards & Referrals
              </a>
            </div>

            {/* Save contact / Add to Wallet */}
            {!contactSaved ? (
              <button
                onClick={handleSaveContact}
                className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl gold-gradient text-primary-foreground font-bold text-sm transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-primary/30"
              >
                <UserPlus className="w-5 h-5" />
                Save Contact
              </button>
            ) : (
              <button
                onClick={ios ? handleAddToWallet : handleAddToGoogleWallet}
                disabled={walletLoading || googleWalletLoading}
                className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl gold-gradient text-primary-foreground font-bold text-sm transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-primary/30 disabled:opacity-60 animate-in fade-in duration-300"
              >
                {(walletLoading || googleWalletLoading) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wallet className="w-5 h-5" />
                )}
                {ios ? 'Add to Apple Wallet' : 'Add to Google Wallet'}
              </button>
            )}

            {/* Contact info */}
            {(card.phone || card.email) && (
              <div className="text-center space-y-1 pt-2">
                {card.phone && (
                  <a href={`tel:${card.phone}`} className="block text-muted-foreground text-sm hover:text-primary transition-colors">
                    {card.phone}
                  </a>
                )}
                {card.email && (
                  <a href={`mailto:${card.email}`} className="block text-muted-foreground text-sm hover:text-primary transition-colors">
                    {card.email}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-muted-foreground/40 text-xs mt-6 tracking-wider uppercase">
          Powered by Barber Launch
        </p>
      </div>
    </div>
  );
}
