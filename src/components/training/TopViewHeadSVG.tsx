interface TopViewHeadSVGProps {
  hairColor?: string;
  thinningPattern?: 'crown' | 'temples' | 'diffuse' | 'frontal';
  className?: string;
}

export function TopViewHeadSVG({ 
  hairColor = '#2a1810', 
  thinningPattern = 'crown',
  className 
}: TopViewHeadSVGProps) {
  // Define thinning areas based on pattern - realistic Norwood patterns
  const getThinningArea = () => {
    switch (thinningPattern) {
      case 'crown':
        // Small circular bald spot at the crown/vertex area
        return (
          <ellipse 
            cx="150" 
            cy="175" 
            rx="25" 
            ry="28" 
            fill="#e8c4a0" 
            opacity="0.95"
          />
        );
      case 'temples':
        // M-shaped recession - receding temples with widow's peak preserved
        return (
          <>
            {/* Left temple deep recession */}
            <path 
              d="M 70 70 
                 Q 75 55 100 52 
                 Q 110 70 105 95 
                 Q 90 100 80 90 
                 Q 70 80 70 70" 
              fill="#e8c4a0" 
              opacity="0.95"
            />
            {/* Right temple deep recession */}
            <path 
              d="M 230 70 
                 Q 225 55 200 52 
                 Q 190 70 195 95 
                 Q 210 100 220 90 
                 Q 230 80 230 70" 
              fill="#e8c4a0" 
              opacity="0.95"
            />
          </>
        );
      case 'diffuse':
        // Crown AND temple - combination pattern (Norwood 4-5)
        return (
          <>
            {/* Left temple recession */}
            <path 
              d="M 70 65 
                 Q 80 50 110 50 
                 Q 120 75 110 100 
                 Q 85 105 75 85 
                 Q 68 75 70 65" 
              fill="#e8c4a0" 
              opacity="0.95"
            />
            {/* Right temple recession */}
            <path 
              d="M 230 65 
                 Q 220 50 190 50 
                 Q 180 75 190 100 
                 Q 215 105 225 85 
                 Q 232 75 230 65" 
              fill="#e8c4a0" 
              opacity="0.95"
            />
            {/* Crown spot */}
            <ellipse 
              cx="150" 
              cy="170" 
              rx="30" 
              ry="32" 
              fill="#e8c4a0" 
              opacity="0.95"
            />
          </>
        );
      case 'frontal':
        // Full top baldness - only horseshoe of hair remains on sides/back
        return (
          <path 
            d="M 75 75 
               Q 80 55 150 50 
               Q 220 55 225 75 
               Q 230 130 220 180 
               Q 200 200 150 205 
               Q 100 200 80 180 
               Q 70 130 75 75" 
            fill="#e8c4a0" 
            opacity="0.95"
          />
        );
      default:
        return null;
    }
  };

  return (
    <svg 
      viewBox="0 0 300 280" 
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Hair texture gradient */}
        <radialGradient id="hairGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={hairColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={hairColor} />
        </radialGradient>
        
        {/* Scalp gradient */}
        <radialGradient id="scalpGradient" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#f0d5b8" />
          <stop offset="100%" stopColor="#d4a574" />
        </radialGradient>

        {/* Ear gradient */}
        <linearGradient id="earGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8c4a0" />
          <stop offset="100%" stopColor="#d4a574" />
        </linearGradient>
      </defs>

      {/* Left ear */}
      <ellipse 
        cx="35" 
        cy="150" 
        rx="18" 
        ry="28" 
        fill="url(#earGradient)"
        stroke="#c9a07a"
        strokeWidth="1"
      />
      <ellipse 
        cx="38" 
        cy="150" 
        rx="10" 
        ry="18" 
        fill="#d4a574"
        opacity="0.5"
      />

      {/* Right ear */}
      <ellipse 
        cx="265" 
        cy="150" 
        rx="18" 
        ry="28" 
        fill="url(#earGradient)"
        stroke="#c9a07a"
        strokeWidth="1"
      />
      <ellipse 
        cx="262" 
        cy="150" 
        rx="10" 
        ry="18" 
        fill="#d4a574"
        opacity="0.5"
      />

      {/* Main head shape (top view - oval) */}
      <ellipse 
        cx="150" 
        cy="140" 
        rx="95" 
        ry="110" 
        fill="url(#hairGradient)"
      />

      {/* Hair fringe around the sides and back */}
      <path 
        d="M 55 140 
           Q 55 60 150 50 
           Q 245 60 245 140 
           Q 245 220 150 235 
           Q 55 220 55 140"
        fill="none"
        stroke={hairColor}
        strokeWidth="25"
        opacity="0.8"
      />

      {/* Inner scalp area (where hair is thinning/gone) */}
      <ellipse 
        cx="150" 
        cy="135" 
        rx="70" 
        ry="80" 
        fill="url(#scalpGradient)"
      />

      {/* Thinning pattern visible on scalp */}
      {getThinningArea()}

      {/* Hair texture lines on the sides */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30) * Math.PI / 180;
        const startX = 150 + Math.cos(angle) * 75;
        const startY = 135 + Math.sin(angle) * 85;
        const endX = 150 + Math.cos(angle) * 92;
        const endY = 135 + Math.sin(angle) * 107;
        return (
          <line 
            key={i}
            x1={startX} 
            y1={startY} 
            x2={endX} 
            y2={endY}
            stroke={hairColor}
            strokeWidth="1.5"
            opacity="0.4"
          />
        );
      })}

      {/* Nose indicator (showing "front" direction) */}
      <path 
        d="M 145 45 L 150 30 L 155 45"
        fill="#d4a574"
        stroke="#c9a07a"
        strokeWidth="1"
      />
      <text 
        x="150" 
        y="22" 
        textAnchor="middle" 
        fontSize="10" 
        fill="currentColor"
        opacity="0.5"
      >
        FRONT
      </text>
    </svg>
  );
}
