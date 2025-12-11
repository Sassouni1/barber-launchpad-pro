interface FrontHeadSVGProps {
  hairColor?: string;
  className?: string;
}

export function FrontHeadSVG({ 
  hairColor = '#2b2422', 
  className = '' 
}: FrontHeadSVGProps) {
  const skinColor = '#d4a574';
  const skinShadow = '#c9956a';
  const skinHighlight = '#e0b88a';

  return (
    <svg 
      viewBox="0 0 300 350" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Definitions for gradients */}
      <defs>
        <radialGradient id="skinGradient" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="70%" stopColor={skinColor} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        <radialGradient id="baldGradient" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="60%" stopColor={skinColor} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
      </defs>

      {/* Neck */}
      <rect x="115" y="280" width="70" height="60" fill={skinColor} rx="5" />
      
      {/* Main face shape */}
      <ellipse 
        cx="150" 
        cy="160" 
        rx="95" 
        ry="115" 
        fill="url(#skinGradient)" 
      />

      {/* Bald top - lighter area */}
      <ellipse 
        cx="150" 
        cy="85" 
        rx="70" 
        ry="45" 
        fill="url(#baldGradient)" 
      />

      {/* Ear left */}
      <ellipse cx="52" cy="165" rx="14" ry="25" fill={skinShadow} />
      <ellipse cx="55" cy="165" rx="9" ry="18" fill={skinColor} />
      <ellipse cx="56" cy="165" rx="4" ry="10" fill={skinShadow} opacity="0.3" />
      
      {/* Ear right */}
      <ellipse cx="248" cy="165" rx="14" ry="25" fill={skinShadow} />
      <ellipse cx="245" cy="165" rx="9" ry="18" fill={skinColor} />
      <ellipse cx="244" cy="165" rx="4" ry="10" fill={skinShadow} opacity="0.3" />

      {/* Hair on sides - left - fuller and curved */}
      <path 
        d={`
          M 55 80
          Q 35 100, 38 140
          Q 40 180, 50 210
          Q 55 230, 65 240
          L 75 235
          Q 65 220, 60 200
          Q 52 170, 55 140
          Q 58 110, 68 85
          Q 75 70, 85 65
          L 75 60
          Q 60 65, 55 80
        `}
        fill={hairColor}
      />
      
      {/* Hair on sides - right - fuller and curved */}
      <path 
        d={`
          M 245 80
          Q 265 100, 262 140
          Q 260 180, 250 210
          Q 245 230, 235 240
          L 225 235
          Q 235 220, 240 200
          Q 248 170, 245 140
          Q 242 110, 232 85
          Q 225 70, 215 65
          L 225 60
          Q 240 65, 245 80
        `}
        fill={hairColor}
      />

      {/* Hair texture lines - left */}
      <g stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none">
        <path d="M 50 100 Q 42 140, 50 190" />
        <path d="M 58 90 Q 48 130, 55 180" />
        <path d="M 65 85 Q 55 120, 60 170" />
      </g>
      
      {/* Hair texture lines - right */}
      <g stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none">
        <path d="M 250 100 Q 258 140, 250 190" />
        <path d="M 242 90 Q 252 130, 245 180" />
        <path d="M 235 85 Q 245 120, 240 170" />
      </g>

      {/* Hair highlights - left */}
      <g stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none">
        <path d="M 62 95 Q 52 130, 58 175" />
      </g>
      
      {/* Hair highlights - right */}
      <g stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none">
        <path d="M 238 95 Q 248 130, 242 175" />
      </g>

      {/* Beard - chin area */}
      <path 
        d={`
          M 70 235
          Q 80 270, 110 290
          Q 130 300, 150 302
          Q 170 300, 190 290
          Q 220 270, 230 235
          Q 220 245, 200 255
          Q 175 268, 150 270
          Q 125 268, 100 255
          Q 80 245, 70 235
        `}
        fill={hairColor}
      />

      {/* Beard texture */}
      <g stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none">
        <path d="M 90 250 Q 100 270, 110 280" />
        <path d="M 110 255 Q 120 275, 130 285" />
        <path d="M 130 258 Q 140 278, 150 290" />
        <path d="M 150 258 Q 160 278, 170 285" />
        <path d="M 170 255 Q 180 275, 190 280" />
        <path d="M 190 250 Q 200 270, 210 280" />
      </g>

      {/* Sideburns connecting to beard - left */}
      <path 
        d={`
          M 65 200
          Q 68 220, 70 235
          Q 60 225, 55 210
          Q 52 195, 58 185
          L 65 200
        `}
        fill={hairColor}
      />

      {/* Sideburns connecting to beard - right */}
      <path 
        d={`
          M 235 200
          Q 232 220, 230 235
          Q 240 225, 245 210
          Q 248 195, 242 185
          L 235 200
        `}
        fill={hairColor}
      />

      {/* Eyes - white */}
      <ellipse cx="110" cy="165" rx="18" ry="12" fill="#f5f5f0" />
      <ellipse cx="190" cy="165" rx="18" ry="12" fill="#f5f5f0" />
      
      {/* Eyes - iris */}
      <circle cx="112" cy="166" r="8" fill="#4a3525" />
      <circle cx="188" cy="166" r="8" fill="#4a3525" />
      
      {/* Eyes - pupil */}
      <circle cx="113" cy="167" r="4" fill="#1a1210" />
      <circle cx="187" cy="167" r="4" fill="#1a1210" />
      
      {/* Eyes - highlight */}
      <circle cx="115" cy="164" r="2" fill="#fff" />
      <circle cx="189" cy="164" r="2" fill="#fff" />

      {/* Eyebrows */}
      <path 
        d="M 85 145 Q 110 135, 130 145" 
        stroke={hairColor} 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none" 
      />
      <path 
        d="M 170 145 Q 190 135, 215 145" 
        stroke={hairColor} 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none" 
      />

      {/* Nose */}
      <path 
        d="M 150 160 L 145 200 Q 150 210, 155 200 L 150 160" 
        stroke={skinShadow} 
        strokeWidth="2" 
        fill="none" 
      />
      <ellipse cx="142" cy="205" rx="6" ry="4" fill={skinShadow} opacity="0.3" />
      <ellipse cx="158" cy="205" rx="6" ry="4" fill={skinShadow} opacity="0.3" />

      {/* Mouth */}
      <path 
        d="M 120 240 Q 150 255, 180 240" 
        stroke="#a06050" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none" 
      />

      {/* Subtle forehead shine */}
      <ellipse 
        cx="150" 
        cy="80" 
        rx="40" 
        ry="20" 
        fill="rgba(255,255,255,0.08)" 
      />

      {/* Shirt collar hint */}
      <path 
        d="M 85 330 Q 115 315, 150 312 Q 185 315, 215 330" 
        stroke="#374151" 
        strokeWidth="12" 
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
