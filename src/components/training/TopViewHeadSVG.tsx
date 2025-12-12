interface TopViewHeadSVGProps {
  hairColor?: string;
  thinningPattern?: 'crown' | 'temples' | 'diffuse' | 'frontal';
  className?: string;
}

// Anatomical head shape - wider at temples, narrower at back (occiput)
const HEAD_PATH = "M 150 40 C 80 40 50 100 50 150 C 50 200 80 240 150 250 C 220 240 250 200 250 150 C 250 100 220 40 150 40 Z";

export function TopViewHeadSVG({ 
  hairColor = '#2a1810', 
  thinningPattern = 'crown',
  className 
}: TopViewHeadSVGProps) {
  // Get the hair shape based on pattern - hair extends to back edge
  const getHairShape = () => {
    switch (thinningPattern) {
      case 'frontal':
        // Horseshoe of hair - only sides and back have hair, front is bald
        return (
          <path 
            d="M 60 150 
               C 60 200 90 240 150 250 
               C 210 240 240 200 240 150
               C 240 110 220 70 180 55
               L 170 75
               C 160 90 140 90 130 75
               L 120 55
               C 80 70 60 110 60 150
               Z"
            fill={hairColor}
          />
        );
      case 'crown':
        // Full hair with small irregular spot at back-crown area
        return (
          <path 
            d="M 150 40 C 80 40 50 100 50 150 C 50 200 80 240 150 250 C 220 240 250 200 250 150 C 250 100 220 40 150 40 Z
               M 150 190
               Q 170 188 172 205
               Q 170 220 150 218
               Q 130 216 132 205
               Q 134 192 150 190"
            fill={hairColor}
            fillRule="evenodd"
          />
        );
      case 'temples':
        // Hair with M-shaped front (temple recession)
        return (
          <path 
            d="M 60 150 
               C 60 200 90 240 150 250 
               C 210 240 240 200 240 150
               C 240 100 220 50 150 40
               C 80 50 60 100 60 150
               M 90 80
               Q 110 100 130 70
               Q 150 50 170 70
               Q 190 100 210 80
               L 210 65
               Q 180 45 150 45
               Q 120 45 90 65
               Z"
            fill={hairColor}
            fillRule="evenodd"
          />
        );
      case 'diffuse':
        // Crown hole + temple recession combined
        return (
          <path 
            d="M 60 150 
               C 60 200 90 240 150 250 
               C 210 240 240 200 240 150
               C 240 100 220 50 150 40
               C 80 50 60 100 60 150
               M 90 80
               Q 110 100 130 70
               Q 150 50 170 70
               Q 190 100 210 80
               L 210 65
               Q 180 45 150 45
               Q 120 45 90 65
               Z
               M 150 185
               Q 168 183 170 200
               Q 168 215 150 213
               Q 132 211 134 200
               Q 136 187 150 185"
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

      {/* BASE: Anatomical head shape (skin) */}
      <path 
        d={HEAD_PATH}
        fill="url(#scalpGradient)"
      />

      {/* HAIR: Drawn on top of scalp - extends to back edge */}
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