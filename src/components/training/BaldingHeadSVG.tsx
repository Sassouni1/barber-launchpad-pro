interface BaldingHeadSVGProps {
  hairColor: string;
  greyPercentage?: number; // 0, 10, 20, 30, 40, etc.
  className?: string;
}

export function BaldingHeadSVG({ 
  hairColor = '#3b2717', 
  greyPercentage = 0,
  className = ''
}: BaldingHeadSVGProps) {
  // Generate many tiny grey strand paths based on percentage
  const greyStrands = [];
  const strandCount = greyPercentage * 2; // Many more strands: 10% = 20, 30% = 60, 40% = 80
  
  for (let i = 0; i < strandCount; i++) {
    // Spread strands across the entire hair area
    const xOffset = 30 + ((i * 17 + i * i * 3) % 140);
    const yStart = 15 + ((i * 11) % 35);
    const curve1 = 45 + ((i * 7) % 50);
    const curve2 = 95 + ((i * 13) % 55);
    const yEnd = 145 + ((i * 5) % 40);
    
    greyStrands.push(
      <path 
        key={`grey-${i}`}
        d={`M ${xOffset} ${yStart} Q ${xOffset + 3} ${curve1}, ${xOffset - 2} ${curve2} Q ${xOffset + 1} ${curve2 + 25}, ${xOffset} ${yEnd}`}
        stroke="#a0a0a0"
        strokeWidth="0.8"
        fill="none"
        opacity={0.6 + (i % 4) * 0.1}
      />
    );
  }

  return (
    <svg 
      viewBox="0 0 200 220" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Back of head - skin/scalp tone */}
      <ellipse 
        cx="100" 
        cy="100" 
        rx="80" 
        ry="85" 
        fill="#d4a574" 
      />
      
      {/* Neck */}
      <rect x="70" y="170" width="60" height="50" fill="#d4a574" rx="10" />
      
      {/* Ear left (seen from behind) */}
      <ellipse cx="22" cy="100" rx="10" ry="18" fill="#c9956a" />
      <ellipse cx="24" cy="100" rx="6" ry="12" fill="#d4a574" />
      
      {/* Ear right (seen from behind) */}
      <ellipse cx="178" cy="100" rx="10" ry="18" fill="#c9956a" />
      <ellipse cx="176" cy="100" rx="6" ry="12" fill="#d4a574" />
      
      {/* Hair - full coverage on back of head */}
      {/* Main hair mass */}
      <path 
        d={`
          M 25 90
          Q 20 50, 50 25
          Q 80 5, 100 5
          Q 120 5, 150 25
          Q 180 50, 175 90
          Q 180 130, 170 160
          Q 155 185, 130 190
          Q 100 195, 70 190
          Q 45 185, 30 160
          Q 20 130, 25 90
        `}
        fill={hairColor}
      />
      
      {/* Hair texture - wavy lines */}
      <g stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none">
        <path d="M 50 40 Q 60 60, 55 90 Q 50 120, 55 150" />
        <path d="M 75 25 Q 80 50, 75 85 Q 70 120, 75 160" />
        <path d="M 100 15 Q 105 45, 100 80 Q 95 115, 100 155" />
        <path d="M 125 25 Q 120 50, 125 85 Q 130 120, 125 160" />
        <path d="M 150 40 Q 140 60, 145 90 Q 150 120, 145 150" />
      </g>
      
      {/* Grey strands overlay */}
      {greyPercentage > 0 && (
        <g>{greyStrands}</g>
      )}
      
      {/* Subtle highlight on hair */}
      <ellipse 
        cx="100" 
        cy="60" 
        rx="40" 
        ry="25" 
        fill="rgba(255,255,255,0.08)" 
      />
      
      {/* Shirt collar hint */}
      <path 
        d="M 55 210 Q 70 195, 100 195 Q 130 195, 145 210" 
        stroke="#374151" 
        strokeWidth="8" 
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
