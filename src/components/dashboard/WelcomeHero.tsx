import { currentUser } from '@/data/mockData';
import { Sparkles } from 'lucide-react';

export function WelcomeHero() {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="relative overflow-hidden glass-card p-8 rounded-2xl animate-fade-up">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Welcome Back</span>
        </div>
        
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
          {getGreeting()}, <span className="gold-text">{currentUser.name.split(' ')[0]}</span>
        </h1>
        
        <p className="text-muted-foreground text-lg max-w-2xl">
          Your transformation journey continues. Every lesson brings you closer to mastering the art of hair systems.
        </p>
      </div>
    </div>
  );
}
