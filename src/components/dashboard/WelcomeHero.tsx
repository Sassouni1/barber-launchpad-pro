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
    <div className="relative overflow-hidden glass-card cyber-corners p-4 md:p-8 rounded-xl animate-fade-up spotlight-pulse">
      {/* Background decoration - hidden on mobile */}
      <div className="hidden md:block absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
      <div className="hidden md:block absolute bottom-0 left-0 w-60 h-60 bg-primary/5 rounded-full blur-[80px]" />
      
      {/* Grid lines decoration - hidden on mobile */}
      <div className="hidden md:block absolute inset-0 cyber-grid opacity-20" />
      
      <div className="relative z-10">
        {/* Status indicator - simplified on mobile */}
        <div className="flex items-center gap-2 mb-2 md:mb-4">
          <div className="relative flex items-center justify-center w-2 h-2 md:w-3 md:h-3">
            <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75" />
            <div className="relative w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full" />
          </div>
          <span className="text-[10px] md:text-xs font-semibold uppercase tracking-cyber text-primary">
            Online
          </span>
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
