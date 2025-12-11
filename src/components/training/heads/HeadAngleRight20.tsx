import { forwardRef } from 'react';

interface HeadAngleRight20Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  className?: string;
}

// Head turned 20 degrees to the right (we see more of left side of face)
export const HeadAngleRight20 = forwardRef<SVGSVGElement, HeadAngleRight20Props & React.SVGProps<SVGSVGElement>>(
  ({ eyebrowsLifted, showGuide, className, ...props }, ref) => {
    return (
      <svg ref={ref} viewBox="0 0 300 350" className={className} {...props}>
        <defs>
          <radialGradient id="skinR20" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
        </defs>

        {/* Neck - shifted left */}
        <path d="M 115 260 L 115 295 Q 115 305, 125 305 L 155 305 Q 165 305, 165 295 L 165 260" fill="#d4a574" />
        
        {/* Main face - rotated, left side more visible */}
        <path 
          d="M 75 130 Q 68 90, 85 60 Q 110 35, 135 35 Q 162 38, 192 65 Q 210 95, 205 130 Q 210 170, 202 200 Q 195 238, 170 258 Q 148 270, 142 272 Q 138 272, 118 260 Q 92 240, 82 200 Q 72 170, 75 130"
          fill="url(#skinR20)"
        />

        {/* Bald top - shifted left */}
        <ellipse cx="140" cy="70" rx="48" ry="28" fill="#ddb688" />

        {/* Left ear - larger, more visible */}
        <ellipse cx="68" cy="150" rx="12" ry="20" fill="#c9956a" />
        <ellipse cx="70" cy="150" rx="8" ry="15" fill="#d4a574" />
        
        {/* Right ear - smaller, partially hidden */}
        <ellipse cx="212" cy="150" rx="6" ry="12" fill="#c9956a" />

        {/* Hair left side - fuller, more prominent */}
        <path d="M 82 55 Q 58 65, 52 100 Q 48 140, 55 180 Q 60 205, 70 215 L 78 210 Q 68 195, 65 160 Q 62 120, 70 85 Q 78 62, 95 52 Z" fill="#2b2422" />
        
        {/* Hair right side - thinner, going behind head */}
        <path d="M 195 58 Q 212 70, 215 100 Q 217 130, 212 160 L 205 155 Q 210 130, 208 100 Q 205 75, 192 62 Z" fill="#2b2422" />

        {/* Hair texture */}
        <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
          <path d="M 58 80 Q 52 120, 58 170" />
          <path d="M 68 68 Q 58 110, 62 160" />
        </g>

        {/* Beard - shifted left */}
        <path d="M 82 210 Q 92 245, 112 263 Q 127 273, 137 275 Q 147 273, 162 263 Q 182 245, 192 208 Q 180 225, 165 240 Q 148 253, 138 255 Q 128 253, 110 238 Q 95 223, 82 208" fill="#2b2422" />

        {/* Left eye - larger, prominent */}
        <ellipse cx="110" cy="145" rx="15" ry="11" fill="#f5f5f0" />
        <circle cx="112" cy="146" r="6.5" fill="#4a3525" />
        <circle cx="113" cy="147" r="3.5" fill="#1a1210" />
        <circle cx="114" cy="144" r="1.5" fill="#fff" />
        
        {/* Right eye - smaller, compressed */}
        <ellipse cx="175" cy="145" rx="10" ry="8" fill="#f5f5f0" />
        <circle cx="173" cy="146" r="5" fill="#4a3525" />
        <circle cx="172" cy="147" r="2.5" fill="#1a1210" />
        <circle cx="173" cy="144" r="1" fill="#fff" />

        {/* Eyebrows */}
        <path d={eyebrowsLifted ? "M 88 125 Q 108 114, 128 124" : "M 88 130 Q 108 120, 128 130"} stroke="#2b2422" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={eyebrowsLifted ? "M 162 128 Q 175 122, 188 128" : "M 162 132 Q 175 126, 188 132"} stroke="#2b2422" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g>
            <path d="M 90 108 Q 140 100, 188 110" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 94 95 Q 140 86, 185 97" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 98 82 Q 140 74, 180 84" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Nose - angled left */}
        <path d="M 142 145 L 135 178 Q 138 186, 145 180" stroke="#c9956a" strokeWidth="1.5" fill="none" />

        {/* Mouth - shifted left */}
        <path d="M 115 212 Q 140 222, 162 210" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Shirt collar */}
        <path d="M 85 315 Q 112 300, 135 298 Q 155 300, 185 315" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Guide */}
        {showGuide && (
          <g>
            <path d="M 78 72 Q 140 62, 198 75" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" fill="none" />
            <text x="140" y="55" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngleRight20.displayName = 'HeadAngleRight20';
