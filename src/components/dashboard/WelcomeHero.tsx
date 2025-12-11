import { Zap, Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function WelcomeHero() {
  const { user } = useAuth();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.email?.split('@')[0] || 'there';

  return (
    <div className="relative overflow-hidden glass-card cyber-corners p-8 rounded-xl animate-fade-up spotlight-pulse">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-primary/5 rounded-full blur-[80px]" />
      
      {/* Grid lines decoration */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      
      <div className="relative z-10">
        {/* Status indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex items-center justify-center w-3 h-3">
            <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75" />
            <div className="relative w-2 h-2 bg-primary rounded-full" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-cyber text-primary">
            Neural Access Portal • Online
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider">Command Center Active</span>
        </div>
        
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          {getGreeting()}, <span className="gold-text gold-glow-text">{displayName}</span>
        </h1>
        
        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
          Your transformation journey continues. Every lesson brings you closer to mastering the art of hair systems.
        </p>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Session Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
