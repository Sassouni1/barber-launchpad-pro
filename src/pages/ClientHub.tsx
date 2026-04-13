import { useParams } from 'react-router-dom';
import { Gift, Users, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function ClientHub() {
  const { userId } = useParams<{ userId: string }>();

  const { data: card, isLoading } = useQuery({
    queryKey: ['client-hub-card', userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_cards')
        .select('business_name, logo_url, first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as { business_name: string; logo_url: string | null; first_name: string | null; last_name: string | null } | null;
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = card
    ? [card.first_name, card.last_name].filter(Boolean).join(' ') || card.business_name
    : '';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="cyber-grid fixed inset-0 pointer-events-none opacity-30" />
      <div className="cyber-grid-fade fixed inset-0 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <div className="rounded-3xl overflow-hidden glass-card border border-primary/20 shadow-2xl shadow-primary/10 px-6 py-8 space-y-6">
          {/* Branding */}
          <div className="text-center space-y-3">
            {card?.logo_url && (
              <img src={card.logo_url} alt={card.business_name} className="h-14 mx-auto object-contain drop-shadow-lg" />
            )}
            {card?.business_name && (
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-display">
                {card.business_name}
              </h1>
            )}
            {displayName && displayName !== card?.business_name && (
              <p className="text-foreground/70 text-base font-medium">{displayName}</p>
            )}
            <p className="text-muted-foreground text-sm">
              Welcome! Choose an option below.
            </p>
          </div>

          <div className="neural-lines h-px" />

          {/* Options */}
          <div className="space-y-3">
            <a
              href={`/rewards/join/${userId}`}
              className="flex items-center gap-3 w-full px-5 py-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-primary/10 text-foreground font-semibold text-base border border-primary/20 transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md"
            >
              <Gift className="w-6 h-6 shrink-0 text-primary" />
              <div>
                <div>Rewards Program</div>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  Earn points with every visit
                </p>
              </div>
            </a>

            <a
              href={`/rewards/join/${userId}?ref=true`}
              className="flex items-center gap-3 w-full px-5 py-5 rounded-2xl bg-secondary/50 text-secondary-foreground font-semibold text-base border border-primary/10 transition-all active:scale-[0.98] hover:bg-secondary/70 hover:border-primary/20"
            >
              <Users className="w-6 h-6 shrink-0 text-primary" />
              <div>
                <div>Refer a Friend</div>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  Share the love & earn rewards
                </p>
              </div>
            </a>
          </div>
        </div>

        <p className="text-center text-muted-foreground/40 text-xs tracking-wider uppercase">
          Powered by Barber Launch
        </p>
      </div>
    </div>
  );
}
