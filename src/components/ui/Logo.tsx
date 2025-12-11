import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className="w-10 h-10 gold-gradient rounded-lg flex items-center justify-center animate-pulse-gold">
          <span className="text-primary-foreground font-display font-bold text-lg">BL</span>
        </div>
      </div>
      <span className={cn('font-display font-bold gold-text', sizes[size])}>
        Barber Launch
      </span>
    </div>
  );
}
