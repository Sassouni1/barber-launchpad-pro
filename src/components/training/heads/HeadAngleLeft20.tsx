import { forwardRef } from 'react';

interface HeadAngleLeft20Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  className?: string;
}

// Head turned 20 degrees to the left (we see more of right side of face)
export const HeadAngleLeft20 = forwardRef<SVGSVGElement, HeadAngleLeft20Props & React.SVGProps<SVGSVGElement>>(
  ({ eyebrowsLifted, showGuide, className, ...props }, ref) => {
    return (
      <svg ref={ref} viewBox="0 0 300 350" className={className} {...props}>
        <defs>
          <radialGradient id="skinL20" cx="55%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
        </defs>

        {/* Neck - shifted right */}
        <path d="M 135 260 L 135 295 Q 135 305, 145 305 L 175 305 Q 185 305, 185 295 L 185 260" fill="#d4a574" />
        
        {/* Main face - rotated, right side more visible */}
        <path 
          d="M 95 130 Q 90 90, 108 60 Q 138 35, 165 35 Q 190 38, 215 65 Q 232 95, 225 130 Q 228 170, 218 200 Q 208 240, 182 260 Q 162 272, 158 272 Q 152 270, 130 258 Q 105 238, 98 200 Q 90 170, 95 130"
          fill="url(#skinL20)"
        />

        {/* Bald top - shifted right */}
        <ellipse cx="160" cy="70" rx="48" ry="28" fill="#ddb688" />

        {/* Left ear - smaller, partially hidden */}
        <ellipse cx="88" cy="150" rx="6" ry="12" fill="#c9956a" />
        
        {/* Right ear - larger, more visible */}
        <ellipse cx="232" cy="150" rx="12" ry="20" fill="#c9956a" />
        <ellipse cx="230" cy="150" rx="8" ry="15" fill="#d4a574" />

        {/* Hair left side - thinner, going behind head */}
        <path d="M 105 58 Q 88 70, 85 100 Q 83 130, 88 160 L 95 155 Q 90 130, 92 100 Q 95 75, 108 62 Z" fill="#2b2422" />
        
        {/* Hair right side - fuller, more prominent */}
        <path d="M 218 55 Q 242 65, 248 100 Q 252 140, 245 180 Q 240 205, 230 215 L 222 210 Q 232 195, 235 160 Q 238 120, 230 85 Q 222 62, 205 52 Z" fill="#2b2422" />

        {/* Hair texture */}
        <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
          <path d="M 242 80 Q 248 120, 242 170" />
          <path d="M 232 68 Q 242 110, 238 160" />
        </g>

        {/* Beard - shifted right */}
        <path d="M 108 208 Q 118 243, 138 263 Q 153 273, 163 275 Q 173 273, 188 263 Q 208 245, 218 210 Q 205 225, 190 240 Q 172 253, 162 255 Q 152 253, 135 240 Q 120 225, 108 210" fill="#2b2422" />

        {/* Left eye - smaller, compressed */}
        <ellipse cx="125" cy="145" rx="10" ry="8" fill="#f5f5f0" />
        <circle cx="127" cy="146" r="5" fill="#4a3525" />
        <circle cx="128" cy="147" r="2.5" fill="#1a1210" />
        <circle cx="127" cy="144" r="1" fill="#fff" />
        
        {/* Right eye - larger, prominent */}
        <ellipse cx="190" cy="145" rx="15" ry="11" fill="#f5f5f0" />
        <circle cx="188" cy="146" r="6.5" fill="#4a3525" />
        <circle cx="187" cy="147" r="3.5" fill="#1a1210" />
        <circle cx="186" cy="144" r="1.5" fill="#fff" />

        {/* Eyebrows */}
        <path d={eyebrowsLifted ? "M 112 128 Q 122 122, 138 128" : "M 112 132 Q 122 126, 138 132"} stroke="#2b2422" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d={eyebrowsLifted ? "M 172 124 Q 190 114, 212 125" : "M 172 130 Q 190 120, 212 130"} stroke="#2b2422" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g>
            <path d="M 112 110 Q 160 100, 210 108" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 115 97 Q 160 86, 206 95" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 120 84 Q 160 74, 202 82" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Nose - angled right */}
        <path d="M 158 145 L 165 178 Q 162 186, 155 180" stroke="#c9956a" strokeWidth="1.5" fill="none" />

        {/* Mouth - shifted right */}
        <path d="M 138 210 Q 160 222, 185 212" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Shirt collar */}
        <path d="M 115 315 Q 145 300, 165 298 Q 188 300, 215 315" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Guide */}
        {showGuide && (
          <g>
            <path d="M 102 75 Q 160 62, 222 72" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" fill="none" />
            <text x="160" y="55" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngleLeft20.displayName = 'HeadAngleLeft20';
