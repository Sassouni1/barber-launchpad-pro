import { forwardRef } from 'react';

interface HeadAngled20Props {
  eyebrowsLifted: boolean;
  showGuide: boolean;
  direction: 'left' | 'right';
  className?: string;
}

export const HeadAngled20 = forwardRef<SVGSVGElement, HeadAngled20Props & React.SVGProps<SVGSVGElement>>(
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
          <radialGradient id={`skinGradient20${direction}`} cx={isLeft ? "40%" : "60%"} cy="40%" r="55%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="50%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#c9956a" />
          </radialGradient>
          <radialGradient id={`baldGradient20${direction}`} cx={isLeft ? "40%" : "60%"} cy="40%" r="50%">
            <stop offset="0%" stopColor="#e8c49a" />
            <stop offset="70%" stopColor="#ddb688" />
            <stop offset="100%" stopColor="#d4a574" />
          </radialGradient>
        </defs>

        {/* Neck - slightly shifted */}
        <path 
          d={isLeft 
            ? "M 115 260 L 115 295 Q 115 305, 125 305 L 155 305 Q 165 305, 165 295 L 165 260" 
            : "M 135 260 L 135 295 Q 135 305, 145 305 L 175 305 Q 185 305, 185 295 L 185 260"
          } 
          fill="#d4a574" 
        />
        
        {/* Main face - turned 20 degrees */}
        <path 
          d={isLeft ? `
            M 75 130
            Q 68 90, 85 60
            Q 110 35, 135 35
            Q 160 38, 190 65
            Q 208 95, 205 130
            Q 210 170, 200 200
            Q 190 240, 165 260
            Q 145 270, 140 270
            Q 135 270, 115 258
            Q 88 238, 78 200
            Q 70 170, 75 130
          ` : `
            M 95 130
            Q 92 95, 110 65
            Q 140 38, 165 35
            Q 190 35, 215 60
            Q 232 90, 225 130
            Q 230 170, 222 200
            Q 212 240, 185 258
            Q 165 270, 160 270
            Q 155 270, 135 260
            Q 110 240, 100 200
            Q 90 170, 95 130
          `}
          fill={`url(#skinGradient20${direction})`}
        />

        {/* Bald top - shifted */}
        <ellipse 
          cx={isLeft ? "138" : "162"} 
          cy="70" 
          rx="48" 
          ry="30" 
          fill={`url(#baldGradient20${direction})`} 
        />

        {/* Near ear (more visible) */}
        {isLeft ? (
          <>
            <ellipse cx="68" cy="150" rx="12" ry="20" fill="#c9956a" />
            <ellipse cx="70" cy="150" rx="8" ry="15" fill="#d4a574" />
          </>
        ) : (
          <>
            <ellipse cx="232" cy="150" rx="12" ry="20" fill="#c9956a" />
            <ellipse cx="230" cy="150" rx="8" ry="15" fill="#d4a574" />
          </>
        )}

        {/* Far ear (less visible, partially hidden) */}
        {isLeft ? (
          <ellipse cx="212" cy="150" rx="5" ry="12" fill="#c9956a" />
        ) : (
          <ellipse cx="88" cy="150" rx="5" ry="12" fill="#c9956a" />
        )}

        {/* Hair on near side - more prominent */}
        <path 
          d={isLeft ? `
            M 82 55
            Q 58 65, 52 100
            Q 48 140, 55 180
            Q 60 205, 70 215
            L 78 210
            Q 68 195, 65 160
            Q 62 120, 70 85
            Q 78 62, 95 52
            Z
          ` : `
            M 218 55
            Q 242 65, 248 100
            Q 252 140, 245 180
            Q 240 205, 230 215
            L 222 210
            Q 232 195, 235 160
            Q 238 120, 230 85
            Q 222 62, 205 52
            Z
          `}
          fill="#2b2422"
        />
        
        {/* Hair on far side - smaller, receding behind head */}
        <path 
          d={isLeft ? `
            M 198 58
            Q 212 70, 215 100
            Q 216 130, 212 160
            L 205 155
            Q 208 130, 206 100
            Q 204 75, 192 62
            Z
          ` : `
            M 102 58
            Q 88 70, 85 100
            Q 84 130, 88 160
            L 95 155
            Q 92 130, 94 100
            Q 96 75, 108 62
            Z
          `}
          fill="#2b2422"
        />

        {/* Hair texture */}
        <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
          {isLeft ? (
            <>
              <path d="M 58 80 Q 52 120, 58 170" />
              <path d="M 68 68 Q 58 110, 62 160" />
            </>
          ) : (
            <>
              <path d="M 242 80 Q 248 120, 242 170" />
              <path d="M 232 68 Q 242 110, 238 160" />
            </>
          )}
        </g>

        {/* Beard - shifted */}
        <path 
          d={isLeft ? `
            M 82 210
            Q 92 245, 112 263
            Q 127 273, 137 275
            Q 147 273, 162 263
            Q 182 243, 192 208
            Q 180 225, 165 240
            Q 148 253, 138 255
            Q 128 253, 110 238
            Q 95 223, 82 208
          ` : `
            M 108 208
            Q 118 243, 138 263
            Q 153 273, 163 275
            Q 173 273, 188 263
            Q 208 245, 218 210
            Q 205 225, 190 240
            Q 172 253, 162 255
            Q 152 253, 135 240
            Q 120 225, 108 210
          `}
          fill="#2b2422"
        />

        {/* Eyes - near eye larger, far eye smaller and shifted */}
        {isLeft ? (
          <>
            {/* Near left eye - larger */}
            <ellipse cx="105" cy="145" rx="15" ry="11" fill="#f5f5f0" />
            <circle cx="108" cy="146" r="6.5" fill="#4a3525" />
            <circle cx="109" cy="147" r="3.5" fill="#1a1210" />
            <circle cx="110" cy="144" r="1.5" fill="#fff" />
            
            {/* Far right eye - smaller, compressed */}
            <ellipse cx="170" cy="145" rx="10" ry="9" fill="#f5f5f0" />
            <circle cx="168" cy="146" r="5" fill="#4a3525" />
            <circle cx="167" cy="147" r="2.5" fill="#1a1210" />
            <circle cx="168" cy="144" r="1" fill="#fff" />
          </>
        ) : (
          <>
            {/* Far left eye - smaller */}
            <ellipse cx="130" cy="145" rx="10" ry="9" fill="#f5f5f0" />
            <circle cx="132" cy="146" r="5" fill="#4a3525" />
            <circle cx="133" cy="147" r="2.5" fill="#1a1210" />
            <circle cx="132" cy="144" r="1" fill="#fff" />
            
            {/* Near right eye - larger */}
            <ellipse cx="195" cy="145" rx="15" ry="11" fill="#f5f5f0" />
            <circle cx="192" cy="146" r="6.5" fill="#4a3525" />
            <circle cx="191" cy="147" r="3.5" fill="#1a1210" />
            <circle cx="190" cy="144" r="1.5" fill="#fff" />
          </>
        )}

        {/* Eyebrows */}
        {isLeft ? (
          <>
            <path 
              d={eyebrowsLifted ? "M 88 125 Q 105 114, 122 124" : "M 88 130 Q 105 120, 122 130"} 
              stroke="#2b2422" 
              strokeWidth="3" 
              strokeLinecap="round" 
              fill="none" 
            />
            <path 
              d={eyebrowsLifted ? "M 158 127 Q 168 120, 182 128" : "M 158 132 Q 168 125, 182 132"} 
              stroke="#2b2422" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none"
            />
          </>
        ) : (
          <>
            <path 
              d={eyebrowsLifted ? "M 118 128 Q 132 120, 142 127" : "M 118 132 Q 132 125, 142 132"} 
              stroke="#2b2422" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none" 
            />
            <path 
              d={eyebrowsLifted ? "M 178 124 Q 195 114, 212 125" : "M 178 130 Q 195 120, 212 130"} 
              stroke="#2b2422" 
              strokeWidth="3" 
              strokeLinecap="round" 
              fill="none"
            />
          </>
        )}

        {/* Forehead wrinkles */}
        {eyebrowsLifted && (
          <g className="animate-fade-in">
            {isLeft ? (
              <>
                <path d="M 92 108 Q 135 100, 185 110" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 95 95 Q 135 86, 182 97" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 100 82 Q 135 74, 178 84" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <path d="M 115 110 Q 165 100, 208 108" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 118 97 Q 165 86, 205 95" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 122 84 Q 165 74, 200 82" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            )}
          </g>
        )}

        {/* Nose - angled */}
        <path 
          d={isLeft 
            ? "M 138 145 L 132 180 Q 136 188, 142 180" 
            : "M 162 145 L 168 180 Q 164 188, 158 180"
          } 
          stroke="#c9956a" 
          strokeWidth="1.5" 
          fill="none" 
        />

        {/* Mouth - shifted */}
        <path 
          d={isLeft 
            ? "M 115 210 Q 135 222, 158 208" 
            : "M 142 208 Q 165 222, 185 210"
          } 
          stroke="#a06050" 
          strokeWidth="3" 
          strokeLinecap="round" 
          fill="none" 
        />

        {/* Forehead shine */}
        <ellipse 
          cx={isLeft ? "135" : "165"} 
          cy="65" 
          rx="28" 
          ry="14" 
          fill="rgba(255,255,255,0.08)" 
          opacity={eyebrowsLifted ? 0.3 : 1} 
        />

        {/* Shirt collar */}
        <path 
          d={isLeft 
            ? "M 90 315 Q 115 300, 138 298 Q 160 300, 185 315" 
            : "M 115 315 Q 140 300, 162 298 Q 185 300, 210 315"
          } 
          stroke="#374151" 
          strokeWidth="10" 
          fill="none" 
          strokeLinecap="round" 
        />

        {/* Guide line */}
        {showGuide && (
          <g className="animate-fade-in">
            <path 
              d={isLeft 
                ? "M 78 72 Q 135 62, 195 75" 
                : "M 105 75 Q 165 62, 222 72"
              }
              stroke="#22c55e" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeDasharray="6 6" 
              fill="none" 
            />
            <text x="150" y="55" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
          </g>
        )}
      </svg>
    );
  }
);

HeadAngled20.displayName = 'HeadAngled20';
