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
  // Define thinning areas based on pattern
  const getThinningArea = () => {
    switch (thinningPattern) {
      case 'crown':
        return (
          <ellipse 
            cx="150" 
            cy="160" 
            rx="35" 
            ry="40" 
            fill="#e8c4a0" 
            opacity="0.9"
          />
        );
      case 'temples':
        return (
          <>
            {/* Left temple recession */}
            <path 
              d="M 80 80 Q 95 100 85 130 Q 75 115 80 80" 
              fill="#e8c4a0" 
              opacity="0.9"
            />
            {/* Right temple recession */}
            <path 
              d="M 220 80 Q 205 100 215 130 Q 225 115 220 80" 
              fill="#e8c4a0" 
              opacity="0.9"
            />
            {/* Frontal recession connecting */}
            <path 
              d="M 100 75 Q 150 60 200 75 Q 150 85 100 75" 
              fill="#e8c4a0" 
              opacity="0.9"
            />
          </>
        );
      case 'diffuse':
        return (
          <ellipse 
            cx="150" 
            cy="130" 
            rx="55" 
            ry="65" 
            fill="#e8c4a0" 
            opacity="0.85"
          />
        );
      case 'frontal':
        return (
          <path 
            d="M 90 70 Q 100 90 110 100 Q 150 110 190 100 Q 200 90 210 70 Q 150 50 90 70" 
            fill="#e8c4a0" 
            opacity="0.9"
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
