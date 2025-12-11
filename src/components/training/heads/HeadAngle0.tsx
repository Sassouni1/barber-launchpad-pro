import { forwardRef } from 'react';

interface HeadAngle0Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  className?: string;
}

// Front view - 0 degrees
export const HeadAngle0 = forwardRef<SVGSVGElement, HeadAngle0Props & React.SVGProps<SVGSVGElement>>(
  ({ eyebrowsLifted, showGuide, className, ...props }, ref) => {
    return (
      <svg ref={ref} viewBox="0 0 300 350" className={className} {...props}>
        <defs>
          <radialGradient id="skin0" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
        </defs>

        {/* Neck */}
        <path d="M 125 260 L 125 295 Q 125 305, 135 305 L 165 305 Q 175 305, 175 295 L 175 260" fill="#d4a574" />
        
        {/* Main face - symmetric front view */}
        <path 
          d="M 85 130 Q 80 90, 100 60 Q 130 35, 150 35 Q 170 35, 200 60 Q 220 90, 215 130 Q 218 170, 210 200 Q 200 240, 175 260 Q 155 272, 150 272 Q 145 272, 125 260 Q 100 240, 90 200 Q 82 170, 85 130"
          fill="url(#skin0)"
        />

        {/* Bald top */}
        <ellipse cx="150" cy="70" rx="50" ry="30" fill="#ddb688" />

        {/* Both ears equal */}
        <ellipse cx="78" cy="150" rx="10" ry="18" fill="#c9956a" />
        <ellipse cx="80" cy="150" rx="7" ry="13" fill="#d4a574" />
        <ellipse cx="222" cy="150" rx="10" ry="18" fill="#c9956a" />
        <ellipse cx="220" cy="150" rx="7" ry="13" fill="#d4a574" />

        {/* Hair sides - symmetric */}
        <path d="M 95 55 Q 75 65, 70 100 Q 68 140, 75 180 Q 78 200, 85 210 L 92 205 Q 85 190, 83 160 Q 82 120, 88 85 Q 92 65, 105 55 Z" fill="#2b2422" />
        <path d="M 205 55 Q 225 65, 230 100 Q 232 140, 225 180 Q 222 200, 215 210 L 208 205 Q 215 190, 217 160 Q 218 120, 212 85 Q 208 65, 195 55 Z" fill="#2b2422" />

        {/* Beard */}
        <path d="M 95 210 Q 105 245, 125 265 Q 140 275, 150 277 Q 160 275, 175 265 Q 195 245, 205 210 Q 195 225, 180 240 Q 160 255, 150 257 Q 140 255, 120 240 Q 105 225, 95 210" fill="#2b2422" />

        {/* Eyes - equal size */}
        <ellipse cx="120" cy="145" rx="14" ry="10" fill="#f5f5f0" />
        <ellipse cx="180" cy="145" rx="14" ry="10" fill="#f5f5f0" />
        <circle cx="122" cy="146" r="6" fill="#4a3525" />
        <circle cx="178" cy="146" r="6" fill="#4a3525" />
        <circle cx="123" cy="147" r="3" fill="#1a1210" />
        <circle cx="177" cy="147" r="3" fill="#1a1210" />
        <circle cx="124" cy="144" r="1.5" fill="#fff" />
        <circle cx="178" cy="144" r="1.5" fill="#fff" />

        {/* Eyebrows */}
        <path d={eyebrowsLifted ? "M 100 125 Q 120 115, 135 125" : "M 100 130 Q 120 122, 135 130"} stroke="#2b2422" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={eyebrowsLifted ? "M 165 125 Q 180 115, 200 125" : "M 165 130 Q 180 122, 200 130"} stroke="#2b2422" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g>
            <path d="M 105 108 Q 150 102, 195 108" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 108 95 Q 150 88, 192 95" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 112 82 Q 150 76, 188 82" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Nose - centered */}
        <path d="M 150 145 L 147 180 Q 150 188, 153 180" stroke="#c9956a" strokeWidth="1.5" fill="none" />

        {/* Mouth - centered */}
        <path d="M 130 210 Q 150 222, 170 210" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Shirt collar */}
        <path d="M 105 315 Q 130 300, 150 298 Q 170 300, 195 315" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Guide */}
        {showGuide && (
          <g>
            <path d="M 95 70 Q 150 62, 205 70" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" fill="none" />
            <text x="150" y="55" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngle0.displayName = 'HeadAngle0';
