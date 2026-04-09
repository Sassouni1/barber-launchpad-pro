import { useParams } from 'react-router-dom';
import { useBusinessCardByCode } from '@/hooks/useBusinessCard';
import { downloadVCard } from '@/lib/generateVCard';
import { Loader2, UserPlus, Calendar, Sparkles, Wallet, Instagram, Globe } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function CardView() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const { data: card, isLoading } = useBusinessCardByCode(shortCode);
  const [walletLoading, setWalletLoading] = useState(false);
  const ios = useMemo(() => isIOS(), []);

  const handleSave = () => {
    if (card) downloadVCard(card);
  };

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

  const instagramUrl = card?.instagram_handle
    ? `https://instagram.com/${card.instagram_handle.replace(/^@/, '')}`
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Card Not Found</h1>
        <p className="text-gray-400">This business card link is no longer active.</p>
      </div>
    );
  }

  const displayName = [card.first_name, card.last_name].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#1a1a1a] to-[#111] border border-amber-900/30 shadow-2xl shadow-amber-900/10">
          
          {/* Hero / Transformation image */}
          {card.hero_image_url ? (
            <div className="relative h-56 overflow-hidden">
              <img src={card.hero_image_url} alt="Transformation" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
            </div>
          ) : (
            <div className="relative h-56 overflow-hidden">
              <img src="/images/default-transformation.jpg" alt="Hair Transformation" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
            </div>
          )}

          <div className="px-6 pb-8 pt-4 space-y-6">
            <div className="text-center space-y-3">
              {card.logo_url && (
                <img src={card.logo_url} alt={card.business_name} className="h-14 mx-auto object-contain" />
              )}
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {card.business_name}
              </h1>
              {displayName && (
                <p className="text-white/70 text-base font-medium">{displayName}</p>
              )}
              <p className="text-amber-400/80 text-sm font-medium tracking-widest uppercase">
                Hair Restoration Specialist
              </p>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-amber-700/40 to-transparent" />

            <div className="space-y-3">
              {card.booking_url && (
                <a
                  href={card.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-amber-500 text-black font-semibold text-sm transition-all active:scale-[0.98] hover:bg-amber-400"
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
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-white/10 text-white font-semibold text-sm border border-white/10 transition-all active:scale-[0.98] hover:bg-white/15"
                >
                  <Sparkles className="w-5 h-5 shrink-0 text-amber-400" />
                  See More Transformations
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-white/10 text-white font-semibold text-sm border border-white/10 transition-all active:scale-[0.98] hover:bg-white/15"
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
                  className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-white/10 text-white font-semibold text-sm border border-white/10 transition-all active:scale-[0.98] hover:bg-white/15"
                >
                  <Globe className="w-5 h-5 shrink-0 text-blue-400" />
                  Visit Website
                </a>
              )}
            </div>

            {ios && (
              <button
                onClick={handleAddToWallet}
                disabled={walletLoading}
                className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl bg-black text-white font-bold text-sm border border-white/20 transition-all active:scale-[0.98] hover:bg-gray-900 disabled:opacity-60"
              >
                {walletLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                Add to Apple Wallet
              </button>
            )}

            <button
              onClick={handleSave}
              className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold text-sm transition-all active:scale-[0.98] hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-500/20"
            >
              <UserPlus className="w-5 h-5" />
              Save to Phone
            </button>

            {(card.phone || card.email) && (
              <div className="text-center space-y-1 pt-2">
                {card.phone && (
                  <a href={`tel:${card.phone}`} className="block text-gray-400 text-sm hover:text-white transition-colors">
                    {card.phone}
                  </a>
                )}
                {card.email && (
                  <a href={`mailto:${card.email}`} className="block text-gray-400 text-sm hover:text-white transition-colors">
                    {card.email}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Powered by Barber Launch
        </p>
      </div>
    </div>
  );
}
