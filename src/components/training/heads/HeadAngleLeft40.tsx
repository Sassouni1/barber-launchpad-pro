import { forwardRef } from 'react';

interface HeadAngleLeft40Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  className?: string;
}

// Head turned 40 degrees to the left (we see mostly right side - 3/4 view)
export const HeadAngleLeft40 = forwardRef<SVGSVGElement, HeadAngleLeft40Props & React.SVGProps<SVGSVGElement>>(
  ({ eyebrowsLifted, showGuide, className, ...props }, ref) => {
    return (
      <svg ref={ref} viewBox="0 0 300 350" className={className} {...props}>
        <defs>
          <radialGradient id="skinL40" cx="60%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
        </defs>

        {/* Neck - shifted right significantly */}
        <path d="M 145 258 L 145 295 Q 145 305, 155 305 L 185 305 Q 195 305, 195 295 L 195 258" fill="#d4a574" />
        
        {/* Main face - 3/4 view, mostly right side visible */}
        <path 
          d="M 110 130 Q 105 95, 125 65 Q 155 38, 185 35 Q 215 40, 235 70 Q 248 100, 242 135 Q 245 175, 235 205 Q 225 242, 198 260 Q 178 272, 172 272 Q 165 270, 145 258 Q 118 238, 112 200 Q 105 165, 110 130"
          fill="url(#skinL40)"
        />

        {/* Bald top - heavily shifted right */}
        <ellipse cx="175" cy="68" rx="45" ry="26" fill="#ddb688" />

        {/* Left ear - barely visible, mostly hidden */}
        <ellipse cx="105" cy="152" rx="4" ry="8" fill="#c9956a" />
        
        {/* Right ear - very prominent with detail */}
        <ellipse cx="248" cy="148" rx="14" ry="22" fill="#c9956a" />
        <ellipse cx="245" cy="148" rx="9" ry="16" fill="#d4a574" />
        <path d="M 245 138 Q 248 148, 245 158" stroke="#b8956a" strokeWidth="1.5" fill="none" />

        {/* Hair left side - very thin sliver */}
        <path d="M 122 62 Q 108 75, 105 100 Q 103 125, 108 150 L 115 145 Q 110 125, 112 100 Q 115 78, 128 65 Z" fill="#2b2422" />
        
        {/* Hair right side - very full, wrapping around */}
        <path d="M 232 52 Q 262 62, 270 100 Q 275 145, 265 190 Q 258 215, 245 225 L 235 218 Q 250 200, 255 160 Q 258 115, 248 80 Q 238 58, 218 48 Z" fill="#2b2422" />

        {/* Hair texture */}
        <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
          <path d="M 262 78 Q 270 120, 262 175" />
          <path d="M 252 65 Q 265 110, 258 165" />
          <path d="M 242 55 Q 255 95, 250 150" />
        </g>

        {/* Beard - shifted right */}
        <path d="M 122 205 Q 135 242, 158 262 Q 173 272, 183 274 Q 193 272, 208 260 Q 228 242, 238 205 Q 225 222, 208 238 Q 190 252, 178 254 Q 168 252, 150 238 Q 135 222, 122 205" fill="#2b2422" />

        {/* Left eye - very small, compressed, almost hidden */}
        <ellipse cx="138" cy="148" rx="7" ry="6" fill="#f5f5f0" />
        <circle cx="139" cy="148" r="4" fill="#4a3525" />
        <circle cx="140" cy="149" r="2" fill="#1a1210" />
        
        {/* Right eye - large and detailed */}
        <ellipse cx="205" cy="145" rx="16" ry="12" fill="#f5f5f0" />
        <circle cx="202" cy="146" r="7" fill="#4a3525" />
        <circle cx="201" cy="147" r="4" fill="#1a1210" />
        <circle cx="199" cy="144" r="1.8" fill="#fff" />

        {/* Eyebrows */}
        <path d={eyebrowsLifted ? "M 128 132 Q 138 128, 150 133" : "M 128 136 Q 138 132, 150 137"} stroke="#2b2422" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d={eyebrowsLifted ? "M 185 122 Q 205 112, 230 123" : "M 185 128 Q 205 118, 230 128"} stroke="#2b2422" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g>
            <path d="M 128 112 Q 175 100, 228 108" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 132 98 Q 175 85, 225 95" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 138 85 Q 175 72, 220 82" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Nose - profile angle, more prominent */}
        <path d="M 170 145 L 182 175 Q 178 184, 168 178" stroke="#c9956a" strokeWidth="1.5" fill="#d4a574" />

        {/* Mouth - shifted right */}
        <path d="M 152 212 Q 178 224, 205 212" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Shirt collar */}
        <path d="M 128 315 Q 158 298, 180 296 Q 205 298, 232 315" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Guide */}
        {showGuide && (
          <g>
            <path d="M 118 78 Q 175 60, 240 70" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" fill="none" />
            <text x="175" y="52" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngleLeft40.displayName = 'HeadAngleLeft40';
