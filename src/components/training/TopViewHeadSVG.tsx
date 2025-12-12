import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TopViewHeadSVGProps {
  hairColor?: string;
  thinningPattern?: "crown" | "temples" | "diffuse" | "frontal";
  className?: string;
}

// SVG-only component for use inside other SVGs
export function TopViewHeadSVGContent({
  hairColor = "#2a1810",
  thinningPattern = "crown",
}: Omit<TopViewHeadSVGProps, 'className'>) {
  const lighterHair = `${hairColor}dd`;
  
  return (
    <g>
      <defs>
        <radialGradient id="scalpGrad" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#f5e6d3" />
          <stop offset="60%" stopColor="#e8d4be" />
          <stop offset="100%" stopColor="#d4baa0" />
        </radialGradient>
        
        <radialGradient id="hairDepth" cx="50%" cy="40%">
          <stop offset="0%" stopColor={lighterHair} />
          <stop offset="50%" stopColor={hairColor} />
          <stop offset="100%" stopColor="#1a1108" />
        </radialGradient>
        
        <radialGradient id="thinningGrad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#f5e6d3" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#e8d4be" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#d4baa0" stopOpacity="0.3" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Dense hair strand pattern */}
        <pattern id="hairStrands" x="0" y="0" width="6" height="8" patternUnits="userSpaceOnUse">
          <line x1="1" y1="0" x2="0.5" y2="8" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
          <line x1="3" y1="0" x2="2.5" y2="8" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
          <line x1="5" y1="0" x2="4.5" y2="8" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        </pattern>

        {/* Finer hair texture */}
        <pattern id="hairTextureFine" x="0" y="0" width="3" height="5" patternUnits="userSpaceOnUse">
          <line x1="0.5" y1="0" x2="0.3" y2="5" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
          <line x1="1.5" y1="0" x2="1.3" y2="5" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
          <line x1="2.5" y1="0" x2="2.3" y2="5" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
        </pattern>
      </defs>

      {/* HEAD OUTLINE */}
      <ellipse 
        cx="150" 
        cy="180" 
        rx="95" 
        ry="130" 
        fill="url(#scalpGrad)"
      />

      {/* Ears */}
      <ellipse cx="55" cy="180" rx="8" ry="25" fill="#d4baa0" opacity="0.8" />
      <ellipse cx="245" cy="180" rx="8" ry="25" fill="#d4baa0" opacity="0.8" />
      
      {/* Base hair mass */}
      <path
        d="
          M 150,60
          C 105,62 70,90 58,135
          C 50,165 52,200 60,245
          C 70,280 100,305 150,310
          C 200,305 230,280 240,245
          C 248,200 250,165 242,135
          C 230,90 195,62 150,60
        "
        fill="url(#hairDepth)"
      />

      {/* Hair strand pattern overlay */}
      <path
        d="
          M 150,60
          C 105,62 70,90 58,135
          C 50,165 52,200 60,245
          C 70,280 100,305 150,310
          C 200,305 230,280 240,245
          C 248,200 250,165 242,135
          C 230,90 195,62 150,60
        "
        fill="url(#hairStrands)"
      />

      {/* Fine texture overlay */}
      <path
        d="
          M 150,60
          C 105,62 70,90 58,135
          C 50,165 52,200 60,245
          C 70,280 100,305 150,310
          C 200,305 230,280 240,245
          C 248,200 250,165 242,135
          C 230,90 195,62 150,60
        "
        fill="url(#hairTextureFine)"
      />

      {/* Dense visible hair strands - Front section */}
      <g stroke={hairColor} strokeWidth="1" opacity="0.35" fill="none">
        <path d="M 150,65 Q 148,85 146,105" />
        <path d="M 145,66 Q 142,86 139,106" />
        <path d="M 155,66 Q 158,86 161,106" />
        <path d="M 140,68 Q 135,88 130,108" />
        <path d="M 160,68 Q 165,88 170,108" />
        <path d="M 135,70 Q 128,90 122,112" />
        <path d="M 165,70 Q 172,90 178,112" />
        <path d="M 130,73 Q 120,95 112,118" />
        <path d="M 170,73 Q 180,95 188,118" />
        <path d="M 125,77 Q 112,100 102,125" />
        <path d="M 175,77 Q 188,100 198,125" />
        <path d="M 120,82 Q 105,108 94,135" />
        <path d="M 180,82 Q 195,108 206,135" />
        <path d="M 115,88 Q 98,115 86,145" />
        <path d="M 185,88 Q 202,115 214,145" />
        <path d="M 110,95 Q 92,125 80,158" />
        <path d="M 190,95 Q 208,125 220,158" />
      </g>

      {/* Dense visible hair strands - Middle section */}
      <g stroke={hairColor} strokeWidth="0.9" opacity="0.3" fill="none">
        <path d="M 78,130 Q 72,160 70,190" />
        <path d="M 222,130 Q 228,160 230,190" />
        <path d="M 82,140 Q 75,170 73,200" />
        <path d="M 218,140 Q 225,170 227,200" />
        <path d="M 86,150 Q 78,180 76,210" />
        <path d="M 214,150 Q 222,180 224,210" />
        <path d="M 75,170 Q 70,200 72,230" />
        <path d="M 225,170 Q 230,200 228,230" />
        <path d="M 72,190 Q 68,220 74,250" />
        <path d="M 228,190 Q 232,220 226,250" />
      </g>

      {/* Dense visible hair strands - Back/Crown section */}
      <g stroke={hairColor} strokeWidth="0.9" opacity="0.3" fill="none">
        <path d="M 80,220 Q 88,250 105,275" />
        <path d="M 220,220 Q 212,250 195,275" />
        <path d="M 90,230 Q 100,258 118,282" />
        <path d="M 210,230 Q 200,258 182,282" />
        <path d="M 100,240 Q 112,265 130,288" />
        <path d="M 200,240 Q 188,265 170,288" />
        <path d="M 115,250 Q 125,272 140,292" />
        <path d="M 185,250 Q 175,272 160,292" />
        <path d="M 130,258 Q 138,278 148,296" />
        <path d="M 170,258 Q 162,278 152,296" />
        <path d="M 145,262 Q 148,280 150,298" />
        <path d="M 155,262 Q 152,280 150,298" />
      </g>

      {/* Lighter highlight strands */}
      <g stroke={lighterHair} strokeWidth="0.7" opacity="0.25" fill="none">
        <path d="M 148,68 Q 145,90 142,112" />
        <path d="M 152,68 Q 155,90 158,112" />
        <path d="M 138,72 Q 130,95 124,118" />
        <path d="M 162,72 Q 170,95 176,118" />
        <path d="M 128,80 Q 115,105 105,132" />
        <path d="M 172,80 Q 185,105 195,132" />
        <path d="M 118,90 Q 102,118 90,148" />
        <path d="M 182,90 Q 198,118 210,148" />
        <path d="M 85,155 Q 78,185 80,215" />
        <path d="M 215,155 Q 222,185 220,215" />
        <path d="M 95,235 Q 105,262 125,285" />
        <path d="M 205,235 Q 195,262 175,285" />
      </g>

      {/* Extra fine detail strands for realism */}
      <g stroke={hairColor} strokeWidth="0.5" opacity="0.2" fill="none">
        <path d="M 147,70 Q 144,92 140,115" />
        <path d="M 153,70 Q 156,92 160,115" />
        <path d="M 143,72 Q 138,94 133,117" />
        <path d="M 157,72 Q 162,94 167,117" />
        <path d="M 133,78 Q 123,102 115,128" />
        <path d="M 167,78 Q 177,102 185,128" />
        <path d="M 123,86 Q 110,112 100,140" />
        <path d="M 177,86 Q 190,112 200,140" />
        <path d="M 112,96 Q 96,125 85,156" />
        <path d="M 188,96 Q 204,125 215,156" />
        <path d="M 80,165 Q 74,195 78,225" />
        <path d="M 220,165 Q 226,195 222,225" />
        <path d="M 85,240 Q 98,268 120,290" />
        <path d="M 215,240 Q 202,268 180,290" />
        <path d="M 138,255 Q 144,276 149,294" />
        <path d="M 162,255 Q 156,276 151,294" />
      </g>


      {/* CROWN THINNING */}
      {thinningPattern === "crown" && (
        <g>
          <ellipse 
            cx="150" 
            cy="235" 
            rx="45" 
            ry="38" 
            fill="url(#thinningGrad)" 
          />
          <g stroke={hairColor} strokeWidth="0.7" opacity="0.35">
            <line x1="125" y1="215" x2="126" y2="228" />
            <line x1="130" y1="218" x2="129" y2="232" />
            <line x1="135" y1="220" x2="137" y2="235" />
            <line x1="140" y1="222" x2="138" y2="236" />
            <line x1="145" y1="225" x2="143" y2="238" />
            <line x1="150" y1="223" x2="151" y2="237" />
            <line x1="155" y1="228" x2="158" y2="242" />
            <line x1="160" y1="226" x2="159" y2="240" />
            <line x1="165" y1="232" x2="164" y2="245" />
            <line x1="170" y1="230" x2="171" y2="244" />
            <line x1="175" y1="228" x2="174" y2="241" />
            <line x1="128" y1="235" x2="127" y2="248" />
            <line x1="133" y1="238" x2="134" y2="251" />
            <line x1="138" y1="240" x2="136" y2="253" />
            <line x1="143" y1="242" x2="144" y2="255" />
            <line x1="148" y1="245" x2="147" y2="258" />
            <line x1="153" y1="243" x2="154" y2="256" />
            <line x1="158" y1="246" x2="157" y2="259" />
            <line x1="163" y1="248" x2="164" y2="260" />
            <line x1="168" y1="245" x2="169" y2="257" />
            <line x1="172" y1="242" x2="171" y2="254" />
            <line x1="132" y1="227" x2="133" y2="240" />
            <line x1="147" y1="232" x2="146" y2="245" />
            <line x1="162" y1="237" x2="163" y2="250" />
            <line x1="141" y1="252" x2="142" y2="264" />
            <line x1="156" y1="254" x2="155" y2="266" />
          </g>
        </g>
      )}

      {/* TEMPLE THINNING */}
      {thinningPattern === "temples" && (
        <g>
          <ellipse 
            cx="85" 
            cy="110" 
            rx="35" 
            ry="45" 
            fill="url(#thinningGrad)"
            transform="rotate(-15 85 110)"
          />
          <ellipse 
            cx="215" 
            cy="110" 
            rx="35" 
            ry="45" 
            fill="url(#thinningGrad)"
            transform="rotate(15 215 110)"
          />
          <g stroke={hairColor} strokeWidth="0.7" opacity="0.35">
            <line x1="78" y1="100" x2="76" y2="115" />
            <line x1="88" y1="108" x2="85" y2="122" />
            <line x1="222" y1="100" x2="224" y2="115" />
            <line x1="212" y1="108" x2="215" y2="122" />
          </g>
        </g>
      )}

      {/* DIFFUSE THINNING */}
      {thinningPattern === "diffuse" && (
        <g>
          <ellipse 
            cx="150" 
            cy="180" 
            rx="80" 
            ry="110" 
            fill="url(#thinningGrad)"
            opacity="0.5"
          />
        </g>
      )}

      {/* FRONTAL THINNING */}
      {thinningPattern === "frontal" && (
        <g>
          <ellipse 
            cx="150" 
            cy="90" 
            rx="70" 
            ry="45" 
            fill="url(#thinningGrad)"
          />
          <g stroke={hairColor} strokeWidth="0.7" opacity="0.3">
            <line x1="125" y1="72" x2="123" y2="85" />
            <line x1="140" y1="68" x2="138" y2="82" />
            <line x1="160" y1="68" x2="162" y2="82" />
            <line x1="175" y1="72" x2="177" y2="85" />
          </g>
        </g>
      )}

      {/* FRONT indicator */}
      <g>
        <path 
          d="M 145,48 L 150,28 L 155,48" 
          fill="#9ca3af" 
          opacity="0.6"
        />
        <text 
          x="150" 
          y="22" 
          textAnchor="middle" 
          fontSize="12" 
          fill="#6b7280"
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          FRONT
        </text>
      </g>

      {/* Hair directional flow lines */}
      <g stroke={hairColor} strokeWidth="0.5" opacity="0.12" fill="none">
        <path d="M 100,80 Q 110,120 120,160" />
        <path d="M 120,75 Q 125,115 130,155" />
        <path d="M 140,70 Q 145,110 148,150" />
        <path d="M 160,70 Q 155,110 152,150" />
        <path d="M 180,75 Q 175,115 170,155" />
        <path d="M 200,80 Q 190,120 180,160" />
      </g>
    </g>
  );
}

// Full standalone component with optional ceran wrap button
interface TopViewHeadSVGWithWrapProps extends TopViewHeadSVGProps {
  showWrapButton?: boolean;
}

export function TopViewHeadSVGWithWrap({
  hairColor = "#2a1810",
  thinningPattern = "crown",
  className,
  showWrapButton = false
}: TopViewHeadSVGWithWrapProps) {
  const [showWrap, setShowWrap] = useState(false);
  const lighterHair = `${hairColor}dd`;
  
  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 300 360"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Ceran wrap gradients */}
          <radialGradient id="wrapShineStandalone" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
          
          <pattern id="wrapTextureStandalone" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="rgba(200, 220, 255, 0.08)" />
            <path d="M 0 5 Q 5 3 10 5 Q 15 7 20 5" fill="none" stroke="white" strokeWidth="0.2" opacity="0.15" />
          </pattern>
        </defs>

        <TopViewHeadSVGContent 
          hairColor={hairColor} 
          thinningPattern={thinningPattern} 
        />

        {/* CERAN WRAP OVERLAY - slides from top */}
        <g 
          style={{
            transform: showWrap ? 'translateY(0)' : 'translateY(-400px)',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <ellipse
            cx="150"
            cy="180"
            rx="95"
            ry="130"
            fill="url(#wrapShineStandalone)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="150"
            cy="180"
            rx="95"
            ry="130"
            fill="url(#wrapTextureStandalone)"
          />
          {/* Wrap highlight streaks */}
          <path
            d="M 80 120 Q 120 100 160 110 Q 200 120 220 150"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 70 200 Q 100 180 140 190"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      {showWrapButton && (
        <Button 
          onClick={() => setShowWrap(!showWrap)}
          variant="outline"
          className="transition-all duration-200"
        >
          {showWrap ? 'Remove Ceran Wrap' : 'Add Ceran Wrap'}
        </Button>
      )}
    </div>
  );
}

// Default export - returns SVG content wrapped in <g> for embedding in other SVGs
export function TopViewHeadSVG({
  hairColor = "#2a1810",
  thinningPattern = "crown",
  className
}: TopViewHeadSVGProps) {
  return (
    <TopViewHeadSVGContent 
      hairColor={hairColor} 
      thinningPattern={thinningPattern} 
    />
  );
}
