interface FrontalThinningHeadSVGProps {
  hairColor?: string;
  className?: string;
}

export function FrontalThinningHeadSVG({ 
  hairColor = '#2b2422', 
  className = '' 
}: FrontalThinningHeadSVGProps) {
  const skinColor = '#d4a574';
  const skinShadow = '#c9956a';
  const skinHighlight = '#e0b88a';
  const scalpColor = '#dbb896';

  return (
    <svg 
      viewBox="0 0 300 360" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Definitions for gradients */}
      <defs>
        <radialGradient id="frontalSkinGradient" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="70%" stopColor={skinColor} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        <radialGradient id="frontalScalpGradient" cx="50%" cy="20%" r="80%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="50%" stopColor={scalpColor} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        {/* Hair texture pattern */}
        <pattern id="frontalHairTexture" patternUnits="userSpaceOnUse" width="8" height="8">
          <line x1="0" y1="0" x2="4" y2="8" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          <line x1="4" y1="0" x2="8" y2="8" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Neck */}
      <rect x="115" y="290" width="70" height="60" fill={skinColor} rx="5" />
      
      {/* Main face shape */}
      <ellipse 
        cx="150" 
        cy="175" 
        rx="95" 
        ry="115" 
        fill="url(#frontalSkinGradient)" 
      />

      {/* Ear left */}
      <ellipse cx="52" cy="180" rx="14" ry="25" fill={skinShadow} />
      <ellipse cx="55" cy="180" rx="9" ry="18" fill={skinColor} />
      <ellipse cx="56" cy="180" rx="4" ry="10" fill={skinShadow} opacity="0.3" />
      
      {/* Ear right */}
      <ellipse cx="248" cy="180" rx="14" ry="25" fill={skinShadow} />
      <ellipse cx="245" cy="180" rx="9" ry="18" fill={skinColor} />
      <ellipse cx="244" cy="180" rx="4" ry="10" fill={skinShadow} opacity="0.3" />

      {/* M-shaped/W-shaped receding hairline - the thinning area */}
      {/* This creates the widow's peak with recession at temples */}
      <path 
        d={`
          M 55 90
          Q 55 50, 100 45
          L 120 50
          Q 130 75, 150 80
          Q 170 75, 180 50
          L 200 45
          Q 245 50, 245 90
          Q 248 130, 240 170
          L 230 165
          Q 235 130, 232 100
          Q 228 70, 200 65
          L 175 70
          Q 155 100, 150 100
          Q 145 100, 125 70
          L 100 65
          Q 72 70, 68 100
          Q 65 130, 70 165
          L 60 170
          Q 52 130, 55 90
        `}
        fill="url(#frontalScalpGradient)"
      />

      {/* Main hair mass with M-shaped cutout */}
      {/* Left side hair */}
      <path 
        d={`
          M 55 90
          Q 35 100, 38 150
          Q 40 200, 50 240
          Q 55 260, 70 275
          L 80 270
          Q 65 250, 60 220
          Q 52 180, 55 150
          Q 58 120, 68 100
          Q 72 70, 100 65
          L 125 70
          Q 145 100, 150 100
          Q 155 100, 175 70
          L 100 65
          Q 72 70, 68 100
          Q 60 115, 55 90
        `}
        fill={hairColor}
      />
      
      {/* Right side hair */}
      <path 
        d={`
          M 245 90
          Q 265 100, 262 150
          Q 260 200, 250 240
          Q 245 260, 230 275
          L 220 270
          Q 235 250, 240 220
          Q 248 180, 245 150
          Q 242 120, 232 100
          Q 228 70, 200 65
          L 175 70
          Q 155 100, 150 100
          Q 145 100, 125 70
          L 200 65
          Q 228 70, 232 100
          Q 240 115, 245 90
        `}
        fill={hairColor}
      />

      {/* Top hair connecting the sides with widow's peak (M-shape) */}
      <path 
        d={`
          M 55 90
          Q 55 50, 100 45
          L 120 50
          Q 130 75, 150 80
          Q 170 75, 180 50
          L 200 45
          Q 245 50, 245 90
          Q 240 75, 220 60
          L 200 55
          L 175 60
          Q 160 85, 150 88
          Q 140 85, 125 60
          L 100 55
          L 80 60
          Q 60 75, 55 90
        `}
        fill={hairColor}
      />

      {/* Hair texture overlay */}
      <path 
        d={`
          M 55 90 Q 35 100, 38 150 Q 40 200, 50 240 Q 55 260, 70 275
          L 80 270 Q 65 250, 60 220 Q 52 180, 55 150 Q 58 120, 68 100
          Z
        `}
        fill="url(#frontalHairTexture)"
      />
      <path 
        d={`
          M 245 90 Q 265 100, 262 150 Q 260 200, 250 240 Q 245 260, 230 275
          L 220 270 Q 235 250, 240 220 Q 248 180, 245 150 Q 242 120, 232 100
          Z
        `}
        fill="url(#frontalHairTexture)"
      />

      {/* Hair texture lines - left */}
      <g stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" fill="none">
        <path d="M 50 110 Q 42 150, 50 200" />
        <path d="M 58 100 Q 48 140, 55 190" />
        <path d="M 65 95 Q 55 130, 60 180" />
      </g>
      
      {/* Hair texture lines - right */}
      <g stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" fill="none">
        <path d="M 250 110 Q 258 150, 250 200" />
        <path d="M 242 100 Q 252 140, 245 190" />
        <path d="M 235 95 Q 245 130, 240 180" />
      </g>

      {/* Hair highlights */}
      <g stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none">
        <path d="M 62 105 Q 52 140, 58 185" />
        <path d="M 238 105 Q 248 140, 242 185" />
      </g>

      {/* Scalp texture in receding area */}
      <g stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" fill="none">
        <path d="M 100 60 Q 110 75, 125 80" />
        <path d="M 115 55 Q 130 70, 140 80" />
        <path d="M 160 80 Q 170 70, 185 55" />
        <path d="M 175 80 Q 190 75, 200 60" />
      </g>

      {/* Eyes - white */}
      <ellipse cx="110" cy="195" rx="18" ry="12" fill="#f5f5f0" />
      <ellipse cx="190" cy="195" rx="18" ry="12" fill="#f5f5f0" />
      
      {/* Eyes - iris */}
      <circle cx="112" cy="196" r="8" fill="#4a3525" />
      <circle cx="188" cy="196" r="8" fill="#4a3525" />
      
      {/* Eyes - pupil */}
      <circle cx="113" cy="197" r="4" fill="#1a1210" />
      <circle cx="187" cy="197" r="4" fill="#1a1210" />
      
      {/* Eyes - highlight */}
      <circle cx="115" cy="194" r="2" fill="#fff" />
      <circle cx="189" cy="194" r="2" fill="#fff" />

      {/* Eyebrows */}
      <path 
        d="M 85 175 Q 110 165, 130 175" 
        stroke={hairColor} 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none" 
      />
      <path 
        d="M 170 175 Q 190 165, 215 175" 
        stroke={hairColor} 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none" 
      />

      {/* Nose */}
      <path 
        d="M 150 190 L 145 230 Q 150 240, 155 230 L 150 190" 
        stroke={skinShadow} 
        strokeWidth="2" 
        fill="none" 
      />
      <ellipse cx="142" cy="235" rx="6" ry="4" fill={skinShadow} opacity="0.3" />
      <ellipse cx="158" cy="235" rx="6" ry="4" fill={skinShadow} opacity="0.3" />

      {/* Mouth */}
      <path 
        d="M 120 255 Q 150 265, 180 255" 
        stroke="#a06050" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none" 
      />

      {/* Subtle forehead shine in receding area */}
      <ellipse 
        cx="150" 
        cy="75" 
        rx="35" 
        ry="18" 
        fill="rgba(255,255,255,0.06)" 
      />

      {/* Shirt collar hint */}
      <path 
        d="M 85 345 Q 115 330, 150 327 Q 185 330, 215 345" 
        stroke="#374151" 
        strokeWidth="12" 
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
