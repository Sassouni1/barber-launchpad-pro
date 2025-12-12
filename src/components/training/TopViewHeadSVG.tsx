import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TopViewHeadSVGProps {
  hairColor?: string;
  thinningPattern?: "crown" | "temples" | "diffuse" | "frontal" | "fullTop";
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

        <pattern id="hairTexture" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
          <line x1="2" y1="0" x2="2" y2="4" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
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

      {/* Hair texture overlay */}
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
        fill="url(#hairTexture)"
        opacity="0.4"
      />

      {/* Dense hair strand lines */}
      <g stroke={hairColor} strokeWidth="0.6" opacity="0.2" fill="none">
        {/* Top section radiating from crown */}
        <path d="M 150,70 Q 148,100 145,130" />
        <path d="M 140,72 Q 135,100 130,130" />
        <path d="M 160,72 Q 165,100 170,130" />
        <path d="M 130,75 Q 120,100 115,135" />
        <path d="M 170,75 Q 180,100 185,135" />
        <path d="M 120,80 Q 108,110 100,145" />
        <path d="M 180,80 Q 192,110 200,145" />
        <path d="M 110,88 Q 95,120 88,160" />
        <path d="M 190,88 Q 205,120 212,160" />
        
        {/* Middle section */}
        <path d="M 85,140 Q 80,180 82,220" />
        <path d="M 215,140 Q 220,180 218,220" />
        <path d="M 95,130 Q 88,170 90,210" />
        <path d="M 205,130 Q 212,170 210,210" />
        
        {/* Lower section curving toward back */}
        <path d="M 100,200 Q 105,240 120,270" />
        <path d="M 200,200 Q 195,240 180,270" />
        <path d="M 120,220 Q 128,255 140,285" />
        <path d="M 180,220 Q 172,255 160,285" />
        <path d="M 140,240 Q 145,270 150,295" />
        <path d="M 160,240 Q 155,270 150,295" />
      </g>

      {/* Additional fine hair texture */}
      <g stroke={lighterHair} strokeWidth="0.4" opacity="0.15" fill="none">
        <path d="M 145,75 Q 142,105 138,140" />
        <path d="M 155,75 Q 158,105 162,140" />
        <path d="M 125,85 Q 115,115 108,150" />
        <path d="M 175,85 Q 185,115 192,150" />
        <path d="M 105,110 Q 92,145 88,185" />
        <path d="M 195,110 Q 208,145 212,185" />
        <path d="M 92,165 Q 88,200 95,240" />
        <path d="M 208,165 Q 212,200 205,240" />
        <path d="M 110,230 Q 120,260 135,285" />
        <path d="M 190,230 Q 180,260 165,285" />
        <path d="M 135,250 Q 142,275 148,298" />
        <path d="M 165,250 Q 158,275 152,298" />
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

      {/* FULL TOP RECESSION - Norwood 6-7 horseshoe pattern */}
      {thinningPattern === "temples" && (
        <g>
          {/* Single clean bald scalp area */}
          <ellipse 
            cx="150" 
            cy="155" 
            rx="75" 
            ry="95" 
            fill="#f0dcc8"
          />
          
          {/* Subtle scalp shine highlight */}
          <ellipse 
            cx="140" 
            cy="130" 
            rx="40" 
            ry="30" 
            fill="#f8ebe0"
            opacity="0.6"
          />
          
          {/* HORSESHOE HAIR - Left side */}
          <path
            d="M 58,135 
               C 52,165 52,210 60,250
               C 70,285 100,310 150,315
               L 150,295
               C 110,290 88,270 80,245
               C 72,215 73,180 78,150
               C 82,130 75,115 58,135"
            fill={hairColor}
          />
          
          {/* HORSESHOE HAIR - Right side */}
          <path
            d="M 242,135
               C 248,165 248,210 240,250
               C 230,285 200,310 150,315
               L 150,295
               C 190,290 212,270 220,245
               C 228,215 227,180 222,150
               C 218,130 225,115 242,135"
            fill={hairColor}
          />
          
          {/* HORSESHOE HAIR - Back connection */}
          <path
            d="M 80,255
               C 100,285 130,300 150,302
               C 170,300 200,285 220,255
               L 210,270
               C 190,290 170,300 150,302
               C 130,300 110,290 90,270
               Z"
            fill={hairColor}
          />
          
          {/* Hair texture on left side */}
          <g stroke={lighterHair} strokeWidth="0.8" opacity="0.4" fill="none">
            <path d="M 65,160 Q 68,180 70,200" />
            <path d="M 70,175 Q 72,195 75,215" />
            <path d="M 68,200 Q 72,220 78,240" />
            <path d="M 73,220 Q 80,245 90,265" />
            <path d="M 80,250 Q 95,275 115,290" />
            <path d="M 100,270 Q 120,288 140,298" />
          </g>
          
          {/* Hair texture on right side */}
          <g stroke={lighterHair} strokeWidth="0.8" opacity="0.4" fill="none">
            <path d="M 235,160 Q 232,180 230,200" />
            <path d="M 230,175 Q 228,195 225,215" />
            <path d="M 232,200 Q 228,220 222,240" />
            <path d="M 227,220 Q 220,245 210,265" />
            <path d="M 220,250 Q 205,275 185,290" />
            <path d="M 200,270 Q 180,288 160,298" />
          </g>
          
          {/* Hair texture on back */}
          <g stroke={lighterHair} strokeWidth="0.7" opacity="0.35" fill="none">
            <path d="M 120,285 Q 135,295 150,298" />
            <path d="M 180,285 Q 165,295 150,298" />
          </g>
          
          {/* FADING TRANSITION - Diffuse edge along horseshoe inner boundary */}
          {/* Left side fade */}
          <g stroke={hairColor} fill="none">
            <path d="M 82,145 Q 90,160 88,175" strokeWidth="1.2" opacity="0.5" />
            <path d="M 85,155 Q 95,175 93,195" strokeWidth="1" opacity="0.4" />
            <path d="M 88,170 Q 100,195 98,215" strokeWidth="0.8" opacity="0.3" />
            <path d="M 90,185 Q 105,210 103,230" strokeWidth="0.6" opacity="0.2" />
            <path d="M 95,210 Q 110,235 115,255" strokeWidth="0.5" opacity="0.15" />
          </g>
          {/* Right side fade */}
          <g stroke={hairColor} fill="none">
            <path d="M 218,145 Q 210,160 212,175" strokeWidth="1.2" opacity="0.5" />
            <path d="M 215,155 Q 205,175 207,195" strokeWidth="1" opacity="0.4" />
            <path d="M 212,170 Q 200,195 202,215" strokeWidth="0.8" opacity="0.3" />
            <path d="M 210,185 Q 195,210 197,230" strokeWidth="0.6" opacity="0.2" />
            <path d="M 205,210 Q 190,235 185,255" strokeWidth="0.5" opacity="0.15" />
          </g>
          
          {/* RANDOM SURVIVOR HAIRS - Scattered across bald area */}
          {/* Single survivor strands with varying opacity */}
          <g stroke={hairColor} strokeWidth="0.5" fill="none">
            <path d="M 130,120 Q 128,128 131,135" opacity="0.35" />
            <path d="M 165,115 Q 168,125 165,132" opacity="0.28" />
            <path d="M 145,140 Q 143,150 146,158" opacity="0.22" />
            <path d="M 175,145 Q 178,155 175,163" opacity="0.32" />
            <path d="M 120,165 Q 118,175 121,182" opacity="0.25" />
            <path d="M 185,170 Q 188,180 185,188" opacity="0.2" />
            <path d="M 155,185 Q 153,195 156,202" opacity="0.18" />
            <path d="M 138,200 Q 135,210 138,218" opacity="0.22" />
            <path d="M 168,195 Q 172,205 169,213" opacity="0.15" />
          </g>
          
          {/* ISLAND CLUSTERS - Groups of surviving follicles */}
          {/* Crown cluster */}
          <g stroke={hairColor} strokeWidth="0.6" opacity="0.3" fill="none">
            <path d="M 148,175 Q 146,183 149,190" />
            <path d="M 152,173 Q 155,182 152,189" />
            <path d="M 145,178 Q 142,186 145,193" />
            <path d="M 156,177 Q 159,185 156,192" />
          </g>
          {/* Mid-left cluster */}
          <g stroke={hairColor} strokeWidth="0.5" opacity="0.25" fill="none">
            <path d="M 115,145 Q 112,152 115,158" />
            <path d="M 120,143 Q 118,151 121,157" />
            <path d="M 117,148 Q 114,156 117,162" />
          </g>
          {/* Front-right cluster */}
          <g stroke={hairColor} strokeWidth="0.5" opacity="0.28" fill="none">
            <path d="M 178,125 Q 180,133 177,140" />
            <path d="M 182,128 Q 185,136 182,143" />
            <path d="M 175,130 Q 172,138 175,145" />
          </g>
          
          {/* VELLUS (PEACH FUZZ) HAIRS - Very fine miniaturized follicles */}
          <g stroke={hairColor} strokeWidth="0.3" fill="none">
            <path d="M 135,110 Q 134,115 136,120" opacity="0.1" />
            <path d="M 158,108 Q 160,114 158,119" opacity="0.08" />
            <path d="M 142,130 Q 140,136 143,141" opacity="0.12" />
            <path d="M 162,135 Q 165,141 162,146" opacity="0.09" />
            <path d="M 128,155 Q 126,161 129,166" opacity="0.11" />
            <path d="M 178,158 Q 181,164 178,169" opacity="0.08" />
            <path d="M 150,165 Q 148,171 151,176" opacity="0.1" />
            <path d="M 140,180 Q 138,186 141,191" opacity="0.07" />
            <path d="M 165,178 Q 168,184 165,189" opacity="0.09" />
            <path d="M 130,195 Q 128,201 131,206" opacity="0.08" />
            <path d="M 172,192 Q 175,198 172,203" opacity="0.1" />
            <path d="M 155,208 Q 153,214 156,219" opacity="0.06" />
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

      {/* FULL TOP BALDING (Norwood 6-7) */}
      {thinningPattern === "fullTop" && (
        <g>
          {/* Large bald area covering most of the top */}
          <ellipse 
            cx="150" 
            cy="165" 
            rx="85" 
            ry="115" 
            fill="url(#thinningGrad)" 
          />
          {/* Additional coverage to blend with remaining horseshoe hair */}
          <ellipse 
            cx="150" 
            cy="120" 
            rx="75" 
            ry="70" 
            fill="#f5e6d3"
            opacity="0.85"
          />
          <ellipse 
            cx="150" 
            cy="200" 
            rx="70" 
            ry="55" 
            fill="#f5e6d3"
            opacity="0.75"
          />
          {/* Sparse remaining hairs */}
          <g stroke={hairColor} strokeWidth="0.6" opacity="0.25">
            <line x1="90" y1="80" x2="88" y2="95" />
            <line x1="210" y1="80" x2="212" y2="95" />
            <line x1="75" y1="150" x2="72" y2="165" />
            <line x1="225" y1="150" x2="228" y2="165" />
            <line x1="80" y1="220" x2="78" y2="235" />
            <line x1="220" y1="220" x2="222" y2="235" />
            <line x1="100" y1="270" x2="102" y2="285" />
            <line x1="200" y1="270" x2="198" y2="285" />
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
