import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <span className={cn(
        'font-display font-bold gold-text tracking-tight',
        sizes[size]
      )}>
        Barber Launch
      </span>
    </div>
  );
}
