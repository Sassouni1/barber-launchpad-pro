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
  // Get the hair shape based on pattern - hair is drawn ON TOP of scalp
  const getHairShape = () => {
    switch (thinningPattern) {
      case 'frontal':
        // Horseshoe of hair - only sides and back have hair
        return (
          <path 
            d="M 55 140 
               Q 55 220 150 235 
               Q 245 220 245 140
               Q 245 60 150 50
               Q 55 60 55 140
               M 80 130
               Q 80 60 150 55
               Q 220 60 220 130
               Q 220 180 150 190
               Q 80 180 80 130"
            fill={hairColor}
            fillRule="evenodd"
          />
        );
      case 'crown':
        // Full hair with circular hole at crown
        return (
          <path 
            d="M 55 140 
               Q 55 220 150 235 
               Q 245 220 245 140
               Q 245 60 150 50
               Q 55 60 55 140
               M 150 200
               Q 180 200 180 170
               Q 180 145 150 145
               Q 120 145 120 170
               Q 120 200 150 200"
            fill={hairColor}
            fillRule="evenodd"
          />
        );
      case 'temples':
        // Hair with M-shaped front (temple recession)
        return (
          <path 
            d="M 55 140 
               Q 55 220 150 235 
               Q 245 220 245 140
               L 245 100
               Q 245 70 220 55
               L 200 70
               Q 180 85 150 55
               Q 120 85 100 70
               L 80 55
               Q 55 70 55 100
               Z"
            fill={hairColor}
          />
        );
      case 'diffuse':
        // Crown hole + temple recession combined
        return (
          <path 
            d="M 55 140 
               Q 55 220 150 235 
               Q 245 220 245 140
               L 245 100
               Q 245 70 220 55
               L 200 70
               Q 180 85 150 55
               Q 120 85 100 70
               L 80 55
               Q 55 70 55 100
               Z
               M 150 195
               Q 185 195 185 165
               Q 185 135 150 135
               Q 115 135 115 165
               Q 115 195 150 195"
            fill={hairColor}
            fillRule="evenodd"
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

      {/* BASE: Full scalp (skin color) - this is always visible where there's no hair */}
      <ellipse 
        cx="150" 
        cy="140" 
        rx="95" 
        ry="110" 
        fill="url(#scalpGradient)"
      />

      {/* HAIR: Drawn on top of scalp - shape changes per pattern */}
      {getHairShape()}

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
