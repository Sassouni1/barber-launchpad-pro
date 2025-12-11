import { forwardRef } from 'react';

interface HeadAngled40Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  direction: 'left' | 'right';
  className?: string;
}

export const HeadAngled40 = forwardRef<SVGSVGElement, HeadAngled40Props & React.SVGProps<SVGSVGElement>>(
  ({ eyebrowsLifted, showGuide, direction, className, ...props }, ref) => {
    const isLeft = direction === 'left';
    
    return (
      <svg 
        ref={ref}
        viewBox="0 0 300 350" 
        className={className}
        {...props}
      >
        <defs>
          <radialGradient id={`skinGradient40${direction}`} cx={isLeft ? "35%" : "65%"} cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
          <radialGradient id={`baldGradient40${direction}`} cx={isLeft ? "35%" : "65%"} cy="40%" r="50%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="70%" stopColor="#ddb688" />
            <stop offset="100%" stopColor="#d4a574" />
          </radialGradient>
        </defs>

        {/* Neck - more shifted */}
        <path 
          d={isLeft 
            ? "M 105 258 L 105 295 Q 105 305, 115 305 L 145 305 Q 155 305, 155 295 L 155 258" 
            : "M 145 258 L 145 295 Q 145 305, 155 305 L 185 305 Q 195 305, 195 295 L 195 258"
          } 
          fill="#d4a574" 
        />
        
        {/* Main face - turned 40 degrees, almost profile */}
        <path 
          d={isLeft ? `
            M 65 130
            Q 55 90, 70 60
            Q 92 35, 120 35
            Q 150 40, 175 70
            Q 192 100, 188 135
            Q 192 175, 182 205
            Q 172 242, 148 260
            Q 130 270, 125 270
            Q 120 270, 100 255
            Q 75 235, 68 198
            Q 58 165, 65 130
          ` : `
            M 112 135
            Q 108 100, 125 70
            Q 150 40, 180 35
            Q 208 35, 230 60
            Q 245 90, 235 130
            Q 242 165, 232 198
            Q 225 235, 200 255
            Q 180 270, 175 270
            Q 170 270, 152 260
            Q 128 242, 118 205
            Q 108 175, 112 130
          `}
          fill={`url(#skinGradient40${direction})`}
        />

        {/* Bald top - heavily shifted */}
        <ellipse 
          cx={isLeft ? "125" : "175"} 
          cy="70" 
          rx="45" 
          ry="28" 
          fill={`url(#baldGradient40${direction})`} 
        />

        {/* Near ear - very prominent */}
        {isLeft ? (
          <>
            <ellipse cx="58" cy="150" rx="14" ry="22" fill="#c9956a" />
            <ellipse cx="62" cy="150" rx="9" ry="16" fill="#d4a574" />
            {/* Inner ear detail */}
            <path d="M 62 140 Q 58 150, 62 160" stroke="#b8956a" strokeWidth="1.5" fill="none" />
          </>
        ) : (
          <>
            <ellipse cx="242" cy="150" rx="14" ry="22" fill="#c9956a" />
            <ellipse cx="238" cy="150" rx="9" ry="16" fill="#d4a574" />
            <path d="M 238 140 Q 242 150, 238 160" stroke="#b8956a" strokeWidth="1.5" fill="none" />
          </>
        )}

        {/* Hair on near side - very prominent, wrapping around */}
        <path 
          d={isLeft ? `
            M 68 52
            Q 42 62, 35 100
            Q 30 145, 40 190
            Q 48 215, 60 225
            L 70 218
            Q 55 200, 50 160
            Q 48 115, 58 80
            Q 68 58, 85 48
            Z
          ` : `
            M 232 52
            Q 258 62, 265 100
            Q 270 145, 260 190
            Q 252 215, 240 225
            L 230 218
            Q 245 200, 250 160
            Q 252 115, 242 80
            Q 232 58, 215 48
            Z
          `}
          fill="#2b2422"
        />
        
        {/* Hair on far side - barely visible, behind head */}
        <path 
          d={isLeft ? `
            M 182 62
            Q 192 75, 193 100
            Q 193 120, 190 140
            L 184 135
            Q 186 115, 184 95
            Q 182 78, 175 68
            Z
          ` : `
            M 118 62
            Q 108 75, 107 100
            Q 107 120, 110 140
            L 116 135
            Q 114 115, 116 95
            Q 118 78, 125 68
            Z
          `}
          fill="#2b2422"
        />

        {/* Hair texture on near side */}
        <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
          {isLeft ? (
            <>
              <path d="M 42 80 Q 35 125, 45 180" />
              <path d="M 55 65 Q 42 115, 50 170" />
              <path d="M 65 58 Q 52 100, 58 155" />
            </>
          ) : (
            <>
              <path d="M 258 80 Q 265 125, 255 180" />
              <path d="M 245 65 Q 258 115, 250 170" />
              <path d="M 235 58 Q 248 100, 242 155" />
            </>
          )}
        </g>

        {/* Beard - heavily shifted */}
        <path 
          d={isLeft ? `
            M 72 208
            Q 82 242, 100 260
            Q 115 270, 125 272
            Q 135 270, 150 258
            Q 168 240, 178 205
            Q 165 222, 148 238
            Q 132 252, 122 254
            Q 112 252, 98 238
            Q 85 222, 72 205
          ` : `
            M 122 205
            Q 132 240, 150 258
            Q 165 270, 175 272
            Q 185 270, 200 260
            Q 218 242, 228 208
            Q 215 222, 202 238
            Q 188 252, 178 254
            Q 168 252, 152 238
            Q 135 222, 122 208
          `}
          fill="#2b2422"
        />

        {/* Near eye - large and detailed */}
        {isLeft ? (
          <>
            <ellipse cx="92" cy="145" rx="16" ry="12" fill="#f5f5f0" />
            <circle cx="96" cy="146" r="7" fill="#4a3525" />
            <circle cx="97" cy="147" r="4" fill="#1a1210" />
            <circle cx="99" cy="144" r="1.8" fill="#fff" />
          </>
        ) : (
          <>
            <ellipse cx="208" cy="145" rx="16" ry="12" fill="#f5f5f0" />
            <circle cx="204" cy="146" r="7" fill="#4a3525" />
            <circle cx="203" cy="147" r="4" fill="#1a1210" />
            <circle cx="201" cy="144" r="1.8" fill="#fff" />
          </>
        )}

        {/* Far eye - very small, barely visible */}
        {isLeft ? (
          <>
            <ellipse cx="158" cy="148" rx="6" ry="6" fill="#f5f5f0" />
            <circle cx="156" cy="148" r="3.5" fill="#4a3525" />
            <circle cx="155" cy="149" r="1.5" fill="#1a1210" />
          </>
        ) : (
          <>
            <ellipse cx="142" cy="148" rx="6" ry="6" fill="#f5f5f0" />
            <circle cx="144" cy="148" r="3.5" fill="#4a3525" />
            <circle cx="145" cy="149" r="1.5" fill="#1a1210" />
          </>
        )}

        {/* Near eyebrow - prominent */}
        {isLeft ? (
          <path 
            d={eyebrowsLifted ? "M 72 123 Q 92 110, 112 122" : "M 72 128 Q 92 116, 112 128"} 
            stroke="#2b2422" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            fill="none" 
          />
        ) : (
          <path 
            d={eyebrowsLifted ? "M 188 122 Q 208 110, 228 123" : "M 188 128 Q 208 116, 228 128"} 
            stroke="#2b2422" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            fill="none"
          />
        )}

        {/* Far eyebrow - small */}
        {isLeft ? (
          <path 
            d={eyebrowsLifted ? "M 148 130 Q 156 126, 168 132" : "M 148 135 Q 156 130, 168 136"} 
            stroke="#2b2422" 
            strokeWidth="2" 
            strokeLinecap="round" 
            fill="none"
          />
        ) : (
          <path 
            d={eyebrowsLifted ? "M 132 132 Q 144 126, 152 130" : "M 132 136 Q 144 130, 152 135"} 
            stroke="#2b2422" 
            strokeWidth="2" 
            strokeLinecap="round" 
            fill="none" 
          />
        )}

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g className="animate-fade-in">
            {isLeft ? (
              <>
                <path d="M 78 108 Q 118 98, 170 112" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 82 95 Q 118 84, 165 100" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 88 82 Q 118 72, 160 88" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <path d="M 130 112 Q 182 98, 222 108" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 135 100 Q 182 84, 218 95" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 140 88 Q 182 72, 212 82" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            )}
          </g>
        )}

        {/* Nose - profile view, more pronounced */}
        <path 
          d={isLeft 
            ? "M 120 145 L 108 175 Q 100 182, 108 188 L 120 185" 
            : "M 180 145 L 192 175 Q 200 182, 192 188 L 180 185"
          } 
          stroke="#c9956a" 
          strokeWidth="1.5" 
          fill="#d4a574" 
        />

        {/* Mouth - shifted significantly */}
        <path 
          d={isLeft 
            ? "M 100 212 Q 118 224, 145 210" 
            : "M 155 210 Q 182 224, 200 212"
          } 
          stroke="#a06050" 
          strokeWidth="3" 
          strokeLinecap="round" 
          fill="none" 
        />

        {/* Forehead shine */}
        <ellipse 
          cx={isLeft ? "120" : "180"} 
          cy="65" 
          rx="25" 
          ry="12" 
          fill="rgba(255,255,255,0.08)" 
          opacity={eyebrowsLifted ? 0.3 : 1} 
        />

        {/* Shirt collar */}
        <path 
          d={isLeft 
            ? "M 75 315 Q 100 298, 128 296 Q 152 298, 178 315" 
            : "M 122 315 Q 148 298, 172 296 Q 200 298, 225 315"
          } 
          stroke="#374151" 
          strokeWidth="10" 
          fill="none" 
          strokeLinecap="round" 
        />

        {/* Guide line - curved for 3/4 view */}
        {showGuide && (
          <g className="animate-fade-in">
            <path 
              d={isLeft 
                ? "M 62 75 Q 115 60, 175 78" 
                : "M 125 78 Q 185 60, 238 75"
              }
              stroke="#22c55e" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeDasharray="6 6" 
              fill="none" 
            />
            <text x="150" y="52" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngled40.displayName = 'HeadAngled40';
