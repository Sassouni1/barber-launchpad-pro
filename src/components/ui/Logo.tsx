import { cn } from '@/lib/utils';
import barberLaunchLogo from '@/assets/barber-launch-logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { img: 'h-8', text: 'text-lg' },
    md: { img: 'h-10', text: 'text-xl' },
    lg: { img: 'h-14', text: 'text-2xl' },
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img 
        src={barberLaunchLogo} 
        alt="Barber Launch" 
        className={cn(sizes[size].img, 'w-auto object-contain')}
      />
      {showText && (
        <span className={cn(
          'font-display font-bold gold-text tracking-tight',
          sizes[size].text
        )}>
          Barber Launch
        </span>
      )}
    </div>
  );
}
