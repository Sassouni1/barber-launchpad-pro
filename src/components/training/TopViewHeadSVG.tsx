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
        // Full hair with forehead showing at front, hair to back edge, small crown spot
        return (
          <path 
            d="M 150 75 
               C 90 80 60 110 55 150 
               C 50 200 80 240 150 250 
               C 220 240 250 200 245 150 
               C 240 110 210 80 150 75 
               Z
               M 150 195
               Q 165 193 167 207
               Q 165 218 150 216
               Q 135 214 137 207
               Q 139 195 150 195"
            fill={hairColor}
            fillRule="evenodd"
          />
        );
      case 'temples':
        // Hair with M-shaped front (temple recession), forehead showing
        return (
          <path 
            d="M 120 80 
               C 100 85 70 110 60 150 
               C 55 200 85 240 150 250 
               C 215 240 245 200 240 150
               C 230 110 200 85 180 80
               L 170 95
               C 160 105 140 105 130 95
               Z"
            fill={hairColor}
          />
        );
      case 'diffuse':
        // Temple recession + crown hole combined
        return (
          <path 
            d="M 120 80 
               C 100 85 70 110 60 150 
               C 55 200 85 240 150 250 
               C 215 240 245 200 240 150
               C 230 110 200 85 180 80
               L 170 95
               C 160 105 140 105 130 95
               Z
               M 150 195
               Q 165 193 167 207
               Q 165 218 150 216
               Q 135 214 137 207
               Q 139 195 150 195"
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