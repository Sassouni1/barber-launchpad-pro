import { cn } from '@/lib/utils';

interface HairSwatchProps {
  color: string;
  label?: string;
  isCorrect?: boolean;
  isWrong?: boolean;
  className?: string;
}

export function HairSwatch({ 
  color, 
  label,
  isCorrect,
  isWrong,
  className = '' 
}: HairSwatchProps) {
  return (
    <div className={cn("relative", className)}>
      <svg 
        viewBox="0 0 120 80" 
        className="w-full h-full drop-shadow-lg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hair swatch shape - like a small hair piece/toupee sample */}
        <defs>
          <filter id="hairShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>
        
        {/* Main hair piece shape */}
        <path 
          d={`
            M 10 40
            Q 5 20, 20 10
            Q 40 2, 60 2
            Q 80 2, 100 10
            Q 115 20, 110 40
            Q 115 60, 100 70
            Q 80 78, 60 78
            Q 40 78, 20 70
            Q 5 60, 10 40
          `}
          fill={color}
          filter="url(#hairShadow)"
          className={cn(
            isCorrect && "stroke-green-500 stroke-[3]",
            isWrong && "stroke-destructive stroke-[3]"
          )}
        />
        
        {/* Hair texture lines */}
        <g stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none">
          <path d="M 25 20 Q 30 40, 25 60" />
          <path d="M 45 12 Q 48 40, 45 68" />
          <path d="M 60 8 Q 62 40, 60 72" />
          <path d="M 75 12 Q 72 40, 75 68" />
          <path d="M 95 20 Q 90 40, 95 60" />
        </g>
        
        {/* Darker texture lines */}
        <g stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" fill="none">
          <path d="M 35 15 Q 38 40, 35 65" />
          <path d="M 52 10 Q 55 40, 52 70" />
          <path d="M 68 10 Q 65 40, 68 70" />
          <path d="M 85 15 Q 82 40, 85 65" />
        </g>
        
        {/* Subtle shine */}
        <ellipse 
          cx="60" 
          cy="25" 
          rx="30" 
          ry="12" 
          fill="rgba(255,255,255,0.1)" 
        />
      </svg>
      
      {/* Label */}
      {label && (
        <div className={cn(
          "absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-medium bg-background/90 border",
          isCorrect && "border-green-500 text-green-500",
          isWrong && "border-destructive text-destructive",
          !isCorrect && !isWrong && "border-border text-foreground"
        )}>
          {label}
        </div>
      )}
    </div>
  );
}
