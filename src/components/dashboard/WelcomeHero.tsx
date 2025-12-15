import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'welcome-hero-collapsed';

export function WelcomeHero() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';

  // Collapsed mobile view
  if (isMobile && isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="w-full flex items-center justify-between glass-card p-3 rounded-xl animate-fade-up"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-2 h-2">
            <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75" />
            <div className="relative w-1.5 h-1.5 bg-primary rounded-full" />
          </div>
          <span className="text-sm font-medium">
            {getGreeting()}, <span className="gold-text">{displayName}</span>
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="relative overflow-hidden glass-card cyber-corners p-4 md:p-8 rounded-xl animate-fade-up spotlight-pulse">
      {/* Background decoration - hidden on mobile */}
      <div className="hidden md:block absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
      <div className="hidden md:block absolute bottom-0 left-0 w-60 h-60 bg-primary/5 rounded-full blur-[80px]" />
      
      {/* Grid lines decoration - hidden on mobile */}
      <div className="hidden md:block absolute inset-0 cyber-grid opacity-20" />
      
      <div className="relative z-10">
        {/* Status indicator with collapse button on mobile */}
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-2 h-2 md:w-3 md:h-3">
              <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75" />
              <div className="relative w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold uppercase tracking-cyber text-primary">
              Online
            </span>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <h1 className="font-display text-2xl md:text-5xl font-bold mb-1 md:mb-4 tracking-tight">
          {getGreeting()}, <span className="gold-text gold-glow-text">{displayName}</span>
        </h1>
        
        <p className="text-muted-foreground text-sm md:text-lg max-w-2xl leading-relaxed hidden md:block">
          Your transformation journey continues. Every lesson brings you closer to mastering the art of hair systems.
        </p>
      </div>
    </div>
  );
}
