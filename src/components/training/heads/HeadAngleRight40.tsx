import { forwardRef } from 'react';

interface HeadAngleRight40Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  className?: string;
}

// Head turned 40 degrees to the right (we see mostly left side - 3/4 view)
export const HeadAngleRight40 = forwardRef<SVGSVGElement, HeadAngleRight40Props & React.SVGProps<SVGSVGElement>>(
  ({ eyebrowsLifted, showGuide, className, ...props }, ref) => {
    return (
      <svg ref={ref} viewBox="0 0 300 350" className={className} {...props}>
        <defs>
          <radialGradient id="skinR40" cx="40%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
        </defs>

        {/* Neck - shifted left significantly */}
        <path d="M 105 258 L 105 295 Q 105 305, 115 305 L 145 305 Q 155 305, 155 295 L 155 258" fill="#d4a574" />
        
        {/* Main face - 3/4 view, mostly left side visible */}
        <path 
          d="M 58 135 Q 52 100, 65 70 Q 85 40, 115 35 Q 145 38, 175 65 Q 195 95, 190 130 Q 195 165, 188 200 Q 182 238, 155 258 Q 135 270, 128 272 Q 122 272, 102 260 Q 75 242, 65 205 Q 55 170, 58 135"
          fill="url(#skinR40)"
        />

        {/* Bald top - heavily shifted left */}
        <ellipse cx="125" cy="68" rx="45" ry="26" fill="#ddb688" />

        {/* Left ear - very prominent with detail */}
        <ellipse cx="52" cy="148" rx="14" ry="22" fill="#c9956a" />
        <ellipse cx="55" cy="148" rx="9" ry="16" fill="#d4a574" />
        <path d="M 55 138 Q 52 148, 55 158" stroke="#b8956a" strokeWidth="1.5" fill="none" />
        
        {/* Right ear - barely visible, mostly hidden */}
        <ellipse cx="195" cy="152" rx="4" ry="8" fill="#c9956a" />

        {/* Hair left side - very full, wrapping around */}
        <path d="M 68 52 Q 38 62, 30 100 Q 25 145, 35 190 Q 42 215, 55 225 L 65 218 Q 50 200, 45 160 Q 42 115, 52 80 Q 62 58, 82 48 Z" fill="#2b2422" />
        
        {/* Hair right side - very thin sliver */}
        <path d="M 178 62 Q 192 75, 195 100 Q 197 125, 192 150 L 185 145 Q 190 125, 188 100 Q 185 78, 172 65 Z" fill="#2b2422" />

        {/* Hair texture */}
        <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
          <path d="M 38 78 Q 30 120, 38 175" />
          <path d="M 48 65 Q 35 110, 42 165" />
          <path d="M 58 55 Q 45 95, 50 150" />
        </g>

        {/* Beard - shifted left */}
        <path d="M 62 205 Q 75 242, 98 262 Q 113 272, 123 274 Q 133 272, 148 260 Q 168 242, 178 205 Q 165 222, 148 238 Q 130 252, 120 254 Q 110 252, 92 238 Q 75 222, 62 205" fill="#2b2422" />

        {/* Left eye - large and detailed */}
        <ellipse cx="95" cy="145" rx="16" ry="12" fill="#f5f5f0" />
        <circle cx="98" cy="146" r="7" fill="#4a3525" />
        <circle cx="99" cy="147" r="4" fill="#1a1210" />
        <circle cx="101" cy="144" r="1.8" fill="#fff" />
        
        {/* Right eye - very small, compressed, almost hidden */}
        <ellipse cx="162" cy="148" rx="7" ry="6" fill="#f5f5f0" />
        <circle cx="161" cy="148" r="4" fill="#4a3525" />
        <circle cx="160" cy="149" r="2" fill="#1a1210" />

        {/* Eyebrows */}
        <path d={eyebrowsLifted ? "M 70 123 Q 95 112, 115 122" : "M 70 128 Q 95 118, 115 128"} stroke="#2b2422" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d={eyebrowsLifted ? "M 150 133 Q 162 128, 172 132" : "M 150 137 Q 162 132, 172 136"} stroke="#2b2422" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g>
            <path d="M 72 108 Q 125 100, 172 112" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 75 95 Q 125 85, 168 98" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 80 82 Q 125 72, 162 85" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* Nose - profile angle, more prominent */}
        <path d="M 130 145 L 118 175 Q 122 184, 132 178" stroke="#c9956a" strokeWidth="1.5" fill="#d4a574" />

        {/* Mouth - shifted left */}
        <path d="M 95 212 Q 122 224, 148 212" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Shirt collar */}
        <path d="M 68 315 Q 95 298, 120 296 Q 142 298, 172 315" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Guide */}
        {showGuide && (
          <g>
            <path d="M 60 70 Q 125 60, 182 78" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" fill="none" />
            <text x="125" y="52" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngleRight40.displayName = 'HeadAngleRight40';
