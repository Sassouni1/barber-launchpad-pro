interface BaldingHeadSVGProps {
  hairColor?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  className?: string;
}

export function BaldingHeadSVG({ 
  hairColor = '#3b2717', 
  overlayColor,
  overlayOpacity = 0.85,
  className = ''
}: BaldingHeadSVGProps) {
  return (
    <svg 
      viewBox="0 0 200 240" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head shape - skin tone */}
      <ellipse 
        cx="100" 
        cy="120" 
        rx="75" 
        ry="90" 
        fill="#d4a574" 
      />
      
      {/* Ear left */}
      <ellipse cx="28" cy="130" rx="12" ry="20" fill="#c9956a" />
      <ellipse cx="30" cy="130" rx="8" ry="14" fill="#d4a574" />
      
      {/* Ear right */}
      <ellipse cx="172" cy="130" rx="12" ry="20" fill="#c9956a" />
      <ellipse cx="170" cy="130" rx="8" ry="14" fill="#d4a574" />
      
      {/* Balding area - top of head (lighter skin showing through) */}
      <ellipse 
        cx="100" 
        cy="55" 
        rx="50" 
        ry="35" 
        fill="#dbb896" 
      />
      
      {/* Existing hair on sides - base layer */}
      <path 
        d={`
          M 30 100
          Q 25 80, 40 60
          Q 50 45, 60 50
          Q 55 70, 45 90
          Q 35 110, 30 130
          Q 28 145, 30 100
        `}
        fill={hairColor}
      />
      <path 
        d={`
          M 170 100
          Q 175 80, 160 60
          Q 150 45, 140 50
          Q 145 70, 155 90
          Q 165 110, 170 130
          Q 172 145, 170 100
        `}
        fill={hairColor}
      />
      
      {/* Hair at the back - visible from front view */}
      <path 
        d={`
          M 35 140
          Q 30 160, 35 180
          Q 45 200, 70 205
          Q 100 210, 130 205
          Q 155 200, 165 180
          Q 170 160, 165 140
          Q 160 160, 150 175
          Q 130 190, 100 192
          Q 70 190, 50 175
          Q 40 160, 35 140
        `}
        fill={hairColor}
      />
      
      {/* Hair texture lines on sides */}
      <g stroke={hairColor} strokeWidth="2" opacity="0.7" fill="none">
        <path d="M 38 70 Q 45 85, 40 105" />
        <path d="M 45 65 Q 52 82, 48 100" />
        <path d="M 162 70 Q 155 85, 160 105" />
        <path d="M 155 65 Q 148 82, 152 100" />
      </g>
      
      {/* Hair overlay - the color being compared */}
      {overlayColor && (
        <>
          <path 
            d={`
              M 30 100
              Q 25 80, 40 60
              Q 50 45, 60 50
              Q 55 70, 45 90
              Q 35 110, 30 130
              Q 28 145, 30 100
            `}
            fill={overlayColor}
            opacity={overlayOpacity}
          />
          <path 
            d={`
              M 170 100
              Q 175 80, 160 60
              Q 150 45, 140 50
              Q 145 70, 155 90
              Q 165 110, 170 130
              Q 172 145, 170 100
            `}
            fill={overlayColor}
            opacity={overlayOpacity}
          />
          <path 
            d={`
              M 35 140
              Q 30 160, 35 180
              Q 45 200, 70 205
              Q 100 210, 130 205
              Q 155 200, 165 180
              Q 170 160, 165 140
              Q 160 160, 150 175
              Q 130 190, 100 192
              Q 70 190, 50 175
              Q 40 160, 35 140
            `}
            fill={overlayColor}
            opacity={overlayOpacity}
          />
        </>
      )}
      
      {/* Face features */}
      {/* Eyebrows */}
      <path 
        d="M 60 100 Q 75 95, 85 100" 
        stroke="#4a3520" 
        strokeWidth="3" 
        fill="none" 
        strokeLinecap="round"
      />
      <path 
        d="M 115 100 Q 125 95, 140 100" 
        stroke="#4a3520" 
        strokeWidth="3" 
        fill="none" 
        strokeLinecap="round"
      />
      
      {/* Eyes */}
      <ellipse cx="72" cy="115" rx="10" ry="6" fill="white" />
      <ellipse cx="128" cy="115" rx="10" ry="6" fill="white" />
      <circle cx="72" cy="115" r="4" fill="#4a3520" />
      <circle cx="128" cy="115" r="4" fill="#4a3520" />
      <circle cx="73" cy="114" r="1.5" fill="white" />
      <circle cx="129" cy="114" r="1.5" fill="white" />
      
      {/* Nose */}
      <path 
        d="M 100 110 Q 100 130, 95 145 Q 100 148, 105 145 Q 100 130, 100 110" 
        stroke="#c9956a" 
        strokeWidth="2" 
        fill="none"
      />
      
      {/* Mouth */}
      <path 
        d="M 80 170 Q 100 180, 120 170" 
        stroke="#b07060" 
        strokeWidth="3" 
        fill="none" 
        strokeLinecap="round"
      />
      
      {/* Subtle smile lines */}
      <path d="M 75 165 Q 72 170, 75 175" stroke="#c9956a" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 125 165 Q 128 170, 125 175" stroke="#c9956a" strokeWidth="1" fill="none" opacity="0.5" />
    </svg>
  );
}
