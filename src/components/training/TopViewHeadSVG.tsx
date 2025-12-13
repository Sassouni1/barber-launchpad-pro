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

        <radialGradient id="fullTopGrad" cx="50%" cy="45%">
          <stop offset="0%" stopColor="#f5e6d3" stopOpacity="1" />
          <stop offset="50%" stopColor="#e8d4be" stopOpacity="0.95" />
          <stop offset="75%" stopColor="#d4baa0" stopOpacity="0.7" />
          <stop offset="90%" stopColor="#d4baa0" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Softer scalp gradient just for temples pattern */}
        <radialGradient id="templesGrad" cx="50%" cy="45%">
          <stop offset="0%" stopColor="#f5e6d3" stopOpacity="1" />
          <stop offset="55%" stopColor="#f0dcc8" stopOpacity="1" />
          <stop offset="75%" stopColor="#e8d4be" stopOpacity="0.8" />
          <stop offset="88%" stopColor="#d4baa0" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Very subtle ring to soften scalp-to-hair edge on temples */}
        <radialGradient id="templesBlendGrad" cx="50%" cy="45%">
          <stop offset="78%" stopColor="transparent" stopOpacity="0" />
          <stop offset="88%" stopColor={hairColor} stopOpacity="0.22" />
          <stop offset="94%" stopColor={hairColor} stopOpacity="0.12" />
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
          {/* Organic irregular bald scalp area */}
          <path 
            d="M 150,62
               C 102,68 84,88 79,118
               C 71,155 68,190 74,222
               C 81,248 98,252 118,254
               C 138,256 162,255 182,252
               C 206,248 221,240 226,214
               C 232,180 229,142 221,108
               C 214,80 196,66 150,62"
            fill="url(#templesGrad)"
          />
          
          {/* Subtle matte scalp highlight */}
          <ellipse 
            cx="138" 
            cy="135" 
            rx="28" 
            ry="20" 
            fill="#efe0d0"
            opacity="0.25"
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

          {/* Subtle edge blend ring to soften hairline transition */}
          <ellipse
            cx="150"
            cy="155"
            rx="82"
            ry="102"
            fill="url(#templesBlendGrad)"
            opacity="0.8"
          />
          
          {/* Hair texture on left side - scattered */}
          <g stroke={lighterHair} fill="none">
            <path d="M 63,158 Q 66,168 68,178" strokeWidth="0.7" opacity="0.35" />
            <path d="M 68,162 Q 71,174 72,184" strokeWidth="0.6" opacity="0.32" />
            <path d="M 72,170 Q 74,182 76,192" strokeWidth="0.75" opacity="0.38" />
            <path d="M 66,178 Q 69,191 71,203" strokeWidth="0.65" opacity="0.34" />
            <path d="M 71,185 Q 73,198 75,210" strokeWidth="0.7" opacity="0.36" />
            <path d="M 75,193 Q 77,207 79,220" strokeWidth="0.6" opacity="0.30" />
            <path d="M 69,202 Q 72,217 76,232" strokeWidth="0.75" opacity="0.38" />
            <path d="M 74,215 Q 78,232 82,248" strokeWidth="0.65" opacity="0.33" />
            <path d="M 78,228 Q 83,246 88,262" strokeWidth="0.7" opacity="0.35" />
            <path d="M 82,245 Q 90,265 100,280" strokeWidth="0.6" opacity="0.31" />
            <path d="M 88,258 Q 98,276 110,288" strokeWidth="0.7" opacity="0.36" />
            <path d="M 95,268 Q 108,283 122,293" strokeWidth="0.65" opacity="0.33" />
            <path d="M 104,275 Q 118,288 134,296" strokeWidth="0.6" opacity="0.30" />
            <path d="M 67,168 Q 70,180 72,191" strokeWidth="0.55" opacity="0.28" />
            <path d="M 76,205 Q 79,221 83,236" strokeWidth="0.7" opacity="0.37" />
            <path d="M 85,252 Q 94,270 106,284" strokeWidth="0.65" opacity="0.34" />
          </g>
          
          {/* Hair texture on right side - scattered */}
          <g stroke={lighterHair} fill="none">
            <path d="M 237,158 Q 234,168 232,178" strokeWidth="0.7" opacity="0.35" />
            <path d="M 232,162 Q 229,174 228,184" strokeWidth="0.6" opacity="0.32" />
            <path d="M 228,170 Q 226,182 224,192" strokeWidth="0.75" opacity="0.38" />
            <path d="M 234,178 Q 231,191 229,203" strokeWidth="0.65" opacity="0.34" />
            <path d="M 229,185 Q 227,198 225,210" strokeWidth="0.7" opacity="0.36" />
            <path d="M 225,193 Q 223,207 221,220" strokeWidth="0.6" opacity="0.30" />
            <path d="M 231,202 Q 228,217 224,232" strokeWidth="0.75" opacity="0.38" />
            <path d="M 226,215 Q 222,232 218,248" strokeWidth="0.65" opacity="0.33" />
            <path d="M 222,228 Q 217,246 212,262" strokeWidth="0.7" opacity="0.35" />
            <path d="M 218,245 Q 210,265 200,280" strokeWidth="0.6" opacity="0.31" />
            <path d="M 212,258 Q 202,276 190,288" strokeWidth="0.7" opacity="0.36" />
            <path d="M 205,268 Q 192,283 178,293" strokeWidth="0.65" opacity="0.33" />
            <path d="M 196,275 Q 182,288 166,296" strokeWidth="0.6" opacity="0.30" />
            <path d="M 233,168 Q 230,180 228,191" strokeWidth="0.55" opacity="0.28" />
            <path d="M 224,205 Q 221,221 217,236" strokeWidth="0.7" opacity="0.37" />
            <path d="M 215,252 Q 206,270 194,284" strokeWidth="0.65" opacity="0.34" />
          </g>
          
          {/* Hair texture on back */}
          <g stroke={lighterHair} strokeWidth="0.7" opacity="0.35" fill="none">
            <path d="M 120,285 Q 135,295 150,298" />
            <path d="M 180,285 Q 165,295 150,298" />
          </g>
          
          {/* DISPERSED FADE ZONE - Left side scattered hairs */}
          <g stroke={hairColor} fill="none">
            <path d="M 79,142 Q 84,150 81,158" strokeWidth="0.6" opacity="0.28" />
            <path d="M 86,148 Q 92,157 89,164" strokeWidth="0.5" opacity="0.22" />
            <path d="M 82,156 Q 88,166 85,173" strokeWidth="0.55" opacity="0.25" />
            <path d="M 91,153 Q 98,163 95,171" strokeWidth="0.45" opacity="0.19" />
            <path d="M 78,165 Q 84,176 80,184" strokeWidth="0.6" opacity="0.30" />
            <path d="M 88,168 Q 95,180 92,188" strokeWidth="0.5" opacity="0.23" />
            <path d="M 83,177 Q 90,189 86,197" strokeWidth="0.55" opacity="0.26" />
            <path d="M 95,172 Q 103,185 99,193" strokeWidth="0.4" opacity="0.18" />
            <path d="M 80,188 Q 87,201 83,210" strokeWidth="0.65" opacity="0.32" />
            <path d="M 90,195 Q 98,209 94,218" strokeWidth="0.5" opacity="0.24" />
            <path d="M 85,205 Q 93,220 89,229" strokeWidth="0.55" opacity="0.27" />
            <path d="M 97,200 Q 106,216 102,225" strokeWidth="0.45" opacity="0.20" />
            <path d="M 82,218 Q 91,234 87,243" strokeWidth="0.6" opacity="0.29" />
            <path d="M 93,225 Q 102,242 98,251" strokeWidth="0.5" opacity="0.22" />
            <path d="M 88,238 Q 97,255 93,264" strokeWidth="0.55" opacity="0.25" />
            <path d="M 100,232 Q 110,250 106,259" strokeWidth="0.4" opacity="0.17" />
            <path d="M 84,250 Q 94,268 90,277" strokeWidth="0.5" opacity="0.21" />
            <path d="M 96,245 Q 106,263 102,272" strokeWidth="0.45" opacity="0.19" />
            <path d="M 76,160 Q 82,172 78,180" strokeWidth="0.5" opacity="0.24" />
            <path d="M 94,162 Q 101,175 97,183" strokeWidth="0.4" opacity="0.16" />
            <path d="M 81,193 Q 89,208 85,217" strokeWidth="0.55" opacity="0.26" />
            <path d="M 99,208 Q 108,225 104,234" strokeWidth="0.45" opacity="0.18" />
            <path d="M 87,228 Q 96,246 92,255" strokeWidth="0.5" opacity="0.23" />
            <path d="M 77,175 Q 84,189 80,198" strokeWidth="0.6" opacity="0.28" />
            <path d="M 92,182 Q 100,197 96,206" strokeWidth="0.5" opacity="0.21" />
          </g>
          {/* DISPERSED FADE ZONE - Right side scattered hairs */}
          <g stroke={hairColor} fill="none">
            <path d="M 221,142 Q 216,150 219,158" strokeWidth="0.6" opacity="0.28" />
            <path d="M 214,148 Q 208,157 211,164" strokeWidth="0.5" opacity="0.22" />
            <path d="M 218,156 Q 212,166 215,173" strokeWidth="0.55" opacity="0.25" />
            <path d="M 209,153 Q 202,163 205,171" strokeWidth="0.45" opacity="0.19" />
            <path d="M 222,165 Q 216,176 220,184" strokeWidth="0.6" opacity="0.30" />
            <path d="M 212,168 Q 205,180 208,188" strokeWidth="0.5" opacity="0.23" />
            <path d="M 217,177 Q 210,189 214,197" strokeWidth="0.55" opacity="0.26" />
            <path d="M 205,172 Q 197,185 201,193" strokeWidth="0.4" opacity="0.18" />
            <path d="M 220,188 Q 213,201 217,210" strokeWidth="0.65" opacity="0.32" />
            <path d="M 210,195 Q 202,209 206,218" strokeWidth="0.5" opacity="0.24" />
            <path d="M 215,205 Q 207,220 211,229" strokeWidth="0.55" opacity="0.27" />
            <path d="M 203,200 Q 194,216 198,225" strokeWidth="0.45" opacity="0.20" />
            <path d="M 218,218 Q 209,234 213,243" strokeWidth="0.6" opacity="0.29" />
            <path d="M 207,225 Q 198,242 202,251" strokeWidth="0.5" opacity="0.22" />
            <path d="M 212,238 Q 203,255 207,264" strokeWidth="0.55" opacity="0.25" />
            <path d="M 200,232 Q 190,250 194,259" strokeWidth="0.4" opacity="0.17" />
            <path d="M 216,250 Q 206,268 210,277" strokeWidth="0.5" opacity="0.21" />
            <path d="M 204,245 Q 194,263 198,272" strokeWidth="0.45" opacity="0.19" />
            <path d="M 224,160 Q 218,172 222,180" strokeWidth="0.5" opacity="0.24" />
            <path d="M 206,162 Q 199,175 203,183" strokeWidth="0.4" opacity="0.16" />
            <path d="M 219,193 Q 211,208 215,217" strokeWidth="0.55" opacity="0.26" />
            <path d="M 201,208 Q 192,225 196,234" strokeWidth="0.45" opacity="0.18" />
            <path d="M 213,228 Q 204,246 208,255" strokeWidth="0.5" opacity="0.23" />
            <path d="M 223,175 Q 216,189 220,198" strokeWidth="0.6" opacity="0.28" />
            <path d="M 208,182 Q 200,197 204,206" strokeWidth="0.5" opacity="0.21" />
          </g>
          
          {/* 125+ SCATTERED SURVIVOR HAIRS - Truly random positions */}
          <g stroke={hairColor} fill="none">
            {/* Row 1: Very front of scalp - sparse */}
            <path d="M 127,108 Q 124,114 128,119" strokeWidth="0.4" opacity="0.12" />
            <path d="M 156,105 Q 159,112 155,118" strokeWidth="0.5" opacity="0.18" />
            <path d="M 171,109 Q 168,116 172,121" strokeWidth="0.35" opacity="0.14" />
            <path d="M 139,112 Q 142,119 138,125" strokeWidth="0.45" opacity="0.21" />
            <path d="M 183,113 Q 180,120 184,126" strokeWidth="0.4" opacity="0.16" />
            <path d="M 114,115 Q 117,122 113,128" strokeWidth="0.5" opacity="0.19" />
            <path d="M 162,107 Q 165,114 161,120" strokeWidth="0.38" opacity="0.13" />
            <path d="M 147,110 Q 144,117 148,123" strokeWidth="0.42" opacity="0.22" />
            
            {/* Scattered across upper-mid zone */}
            <path d="M 108,122 Q 111,130 107,137" strokeWidth="0.5" opacity="0.25" />
            <path d="M 134,118 Q 131,126 135,133" strokeWidth="0.45" opacity="0.2" />
            <path d="M 152,121 Q 156,129 151,136" strokeWidth="0.55" opacity="0.28" />
            <path d="M 177,119 Q 174,127 178,134" strokeWidth="0.4" opacity="0.17" />
            <path d="M 192,124 Q 189,132 193,139" strokeWidth="0.48" opacity="0.23" />
            <path d="M 121,127 Q 118,135 122,142" strokeWidth="0.52" opacity="0.26" />
            <path d="M 165,123 Q 168,131 164,138" strokeWidth="0.44" opacity="0.19" />
            <path d="M 143,126 Q 140,134 144,141" strokeWidth="0.5" opacity="0.24" />
            <path d="M 188,121 Q 185,129 189,136" strokeWidth="0.38" opacity="0.15" />
            <path d="M 112,131 Q 115,139 111,146" strokeWidth="0.46" opacity="0.21" />
            <path d="M 159,128 Q 162,136 158,143" strokeWidth="0.53" opacity="0.27" />
            <path d="M 175,126 Q 172,134 176,141" strokeWidth="0.41" opacity="0.18" />
            
            {/* Dense mid-scalp scatter */}
            <path d="M 105,138 Q 108,147 104,155" strokeWidth="0.55" opacity="0.29" />
            <path d="M 128,135 Q 125,144 129,152" strokeWidth="0.48" opacity="0.23" />
            <path d="M 147,132 Q 150,141 146,149" strokeWidth="0.52" opacity="0.26" />
            <path d="M 168,137 Q 165,146 169,154" strokeWidth="0.45" opacity="0.2" />
            <path d="M 189,134 Q 192,143 188,151" strokeWidth="0.5" opacity="0.24" />
            <path d="M 115,142 Q 112,151 116,159" strokeWidth="0.47" opacity="0.22" />
            <path d="M 138,139 Q 141,148 137,156" strokeWidth="0.54" opacity="0.28" />
            <path d="M 157,143 Q 154,152 158,160" strokeWidth="0.43" opacity="0.19" />
            <path d="M 181,138 Q 178,147 182,155" strokeWidth="0.49" opacity="0.21" />
            <path d="M 198,141 Q 195,150 199,158" strokeWidth="0.4" opacity="0.16" />
            <path d="M 102,147 Q 105,156 101,164" strokeWidth="0.51" opacity="0.25" />
            <path d="M 123,145 Q 120,154 124,162" strokeWidth="0.46" opacity="0.2" />
            <path d="M 143,148 Q 146,157 142,165" strokeWidth="0.53" opacity="0.27" />
            <path d="M 172,144 Q 169,153 173,161" strokeWidth="0.44" opacity="0.18" />
            <path d="M 194,149 Q 191,158 195,166" strokeWidth="0.48" opacity="0.22" />
            
            {/* More scattered - zone 4 */}
            <path d="M 109,155 Q 112,165 108,174" strokeWidth="0.5" opacity="0.24" />
            <path d="M 131,152 Q 128,162 132,171" strokeWidth="0.55" opacity="0.29" />
            <path d="M 151,158 Q 154,168 150,177" strokeWidth="0.47" opacity="0.21" />
            <path d="M 166,154 Q 163,164 167,173" strokeWidth="0.52" opacity="0.26" />
            <path d="M 186,157 Q 183,167 187,176" strokeWidth="0.43" opacity="0.18" />
            <path d="M 118,161 Q 121,171 117,180" strokeWidth="0.49" opacity="0.23" />
            <path d="M 140,156 Q 137,166 141,175" strokeWidth="0.54" opacity="0.28" />
            <path d="M 159,162 Q 162,172 158,181" strokeWidth="0.45" opacity="0.2" />
            <path d="M 178,159 Q 175,169 179,178" strokeWidth="0.5" opacity="0.24" />
            <path d="M 195,163 Q 192,173 196,182" strokeWidth="0.41" opacity="0.17" />
            <path d="M 104,168 Q 107,178 103,187" strokeWidth="0.53" opacity="0.27" />
            <path d="M 125,164 Q 122,174 126,183" strokeWidth="0.46" opacity="0.21" />
            <path d="M 148,167 Q 151,177 147,186" strokeWidth="0.48" opacity="0.22" />
            <path d="M 171,165 Q 168,175 172,184" strokeWidth="0.51" opacity="0.25" />
            <path d="M 191,168 Q 188,178 192,187" strokeWidth="0.44" opacity="0.19" />
            
            {/* Zone 5 - crown area scatter */}
            <path d="M 112,175 Q 115,186 111,196" strokeWidth="0.52" opacity="0.26" />
            <path d="M 133,172 Q 130,183 134,193" strokeWidth="0.47" opacity="0.21" />
            <path d="M 155,178 Q 158,189 154,199" strokeWidth="0.55" opacity="0.29" />
            <path d="M 174,174 Q 171,185 175,195" strokeWidth="0.43" opacity="0.18" />
            <path d="M 193,177 Q 190,188 194,198" strokeWidth="0.5" opacity="0.24" />
            <path d="M 106,182 Q 109,193 105,203" strokeWidth="0.48" opacity="0.22" />
            <path d="M 127,179 Q 124,190 128,200" strokeWidth="0.54" opacity="0.28" />
            <path d="M 146,183 Q 149,194 145,204" strokeWidth="0.45" opacity="0.2" />
            <path d="M 168,180 Q 165,191 169,201" strokeWidth="0.51" opacity="0.25" />
            <path d="M 187,184 Q 184,195 188,205" strokeWidth="0.46" opacity="0.21" />
            <path d="M 119,187 Q 122,198 118,208" strokeWidth="0.49" opacity="0.23" />
            <path d="M 141,185 Q 138,196 142,206" strokeWidth="0.53" opacity="0.27" />
            <path d="M 163,189 Q 166,200 162,210" strokeWidth="0.44" opacity="0.19" />
            <path d="M 181,186 Q 178,197 182,207" strokeWidth="0.5" opacity="0.24" />
            
            {/* Zone 6 - more crown */}
            <path d="M 108,195 Q 111,207 107,218" strokeWidth="0.47" opacity="0.21" />
            <path d="M 130,192 Q 127,204 131,215" strokeWidth="0.52" opacity="0.26" />
            <path d="M 152,198 Q 155,210 151,221" strokeWidth="0.45" opacity="0.2" />
            <path d="M 173,194 Q 170,206 174,217" strokeWidth="0.54" opacity="0.28" />
            <path d="M 191,197 Q 188,209 192,220" strokeWidth="0.43" opacity="0.18" />
            <path d="M 115,202 Q 118,214 114,225" strokeWidth="0.5" opacity="0.24" />
            <path d="M 138,199 Q 135,211 139,222" strokeWidth="0.48" opacity="0.22" />
            <path d="M 161,203 Q 164,215 160,226" strokeWidth="0.51" opacity="0.25" />
            <path d="M 183,200 Q 180,212 184,223" strokeWidth="0.46" opacity="0.21" />
            <path d="M 103,208 Q 106,220 102,231" strokeWidth="0.53" opacity="0.27" />
            <path d="M 125,205 Q 122,217 126,228" strokeWidth="0.44" opacity="0.19" />
            <path d="M 147,209 Q 150,221 146,232" strokeWidth="0.49" opacity="0.23" />
            <path d="M 169,206 Q 166,218 170,229" strokeWidth="0.52" opacity="0.26" />
            <path d="M 188,210 Q 185,222 189,233" strokeWidth="0.45" opacity="0.2" />
            
            {/* Zone 7 - back crown scatter */}
            <path d="M 111,218 Q 114,231 110,243" strokeWidth="0.48" opacity="0.22" />
            <path d="M 135,215 Q 132,228 136,240" strokeWidth="0.54" opacity="0.28" />
            <path d="M 157,221 Q 160,234 156,246" strokeWidth="0.43" opacity="0.18" />
            <path d="M 178,217 Q 175,230 179,242" strokeWidth="0.5" opacity="0.24" />
            <path d="M 122,224 Q 119,237 123,249" strokeWidth="0.47" opacity="0.21" />
            <path d="M 145,219 Q 148,232 144,244" strokeWidth="0.51" opacity="0.25" />
            <path d="M 167,223 Q 164,236 168,248" strokeWidth="0.46" opacity="0.2" />
            <path d="M 185,226 Q 182,239 186,251" strokeWidth="0.53" opacity="0.27" />
            <path d="M 116,231 Q 119,244 115,256" strokeWidth="0.44" opacity="0.19" />
            <path d="M 141,228 Q 138,241 142,253" strokeWidth="0.49" opacity="0.23" />
            <path d="M 162,232 Q 165,245 161,257" strokeWidth="0.52" opacity="0.26" />
            <path d="M 175,229 Q 172,242 176,254" strokeWidth="0.45" opacity="0.21" />
            
            {/* Extra random fills - breaking up any patterns */}
            <path d="M 137,115 Q 134,122 138,128" strokeWidth="0.38" opacity="0.14" />
            <path d="M 179,131 Q 182,139 178,146" strokeWidth="0.42" opacity="0.17" />
            <path d="M 113,149 Q 110,158 114,166" strokeWidth="0.5" opacity="0.23" />
            <path d="M 163,141 Q 160,150 164,158" strokeWidth="0.47" opacity="0.2" />
            <path d="M 184,153 Q 181,162 185,170" strokeWidth="0.44" opacity="0.18" />
            <path d="M 128,169 Q 131,179 127,188" strokeWidth="0.51" opacity="0.25" />
            <path d="M 153,173 Q 150,183 154,192" strokeWidth="0.46" opacity="0.21" />
            <path d="M 176,168 Q 173,178 177,187" strokeWidth="0.48" opacity="0.22" />
            <path d="M 117,191 Q 114,202 118,212" strokeWidth="0.53" opacity="0.27" />
            <path d="M 145,187 Q 148,198 144,208" strokeWidth="0.43" opacity="0.18" />
            <path d="M 165,193 Q 162,204 166,214" strokeWidth="0.5" opacity="0.24" />
            <path d="M 182,191 Q 179,202 183,212" strokeWidth="0.45" opacity="0.2" />
            <path d="M 129,211 Q 126,223 130,234" strokeWidth="0.52" opacity="0.26" />
            <path d="M 158,208 Q 155,220 159,231" strokeWidth="0.47" opacity="0.21" />
            <path d="M 171,215 Q 168,227 172,238" strokeWidth="0.49" opacity="0.23" />
            
            {/* DOUBLED DENSITY - Additional scattered hairs */}
            <path d="M 131,112 Q 128,119 132,125" strokeWidth="0.4" opacity="0.15" />
            <path d="M 169,118 Q 172,125 168,131" strokeWidth="0.45" opacity="0.18" />
            <path d="M 142,123 Q 139,131 143,138" strokeWidth="0.5" opacity="0.22" />
            <path d="M 186,128 Q 183,136 187,143" strokeWidth="0.42" opacity="0.16" />
            <path d="M 109,135 Q 112,143 108,150" strokeWidth="0.48" opacity="0.2" />
            <path d="M 155,131 Q 152,139 156,146" strokeWidth="0.44" opacity="0.17" />
            <path d="M 122,138 Q 119,146 123,153" strokeWidth="0.5" opacity="0.21" />
            <path d="M 174,135 Q 171,143 175,150" strokeWidth="0.46" opacity="0.19" />
            <path d="M 101,145 Q 104,153 100,160" strokeWidth="0.52" opacity="0.24" />
            <path d="M 148,141 Q 145,149 149,156" strokeWidth="0.43" opacity="0.16" />
            <path d="M 191,145 Q 188,153 192,160" strokeWidth="0.48" opacity="0.2" />
            <path d="M 136,148 Q 133,156 137,163" strokeWidth="0.5" opacity="0.22" />
            <path d="M 162,145 Q 159,153 163,160" strokeWidth="0.45" opacity="0.18" />
            <path d="M 111,152 Q 114,160 110,167" strokeWidth="0.47" opacity="0.19" />
            <path d="M 178,151 Q 175,159 179,166" strokeWidth="0.44" opacity="0.17" />
            <path d="M 126,157 Q 123,165 127,172" strokeWidth="0.51" opacity="0.23" />
            <path d="M 195,154 Q 192,162 196,169" strokeWidth="0.42" opacity="0.15" />
            <path d="M 143,155 Q 140,163 144,170" strokeWidth="0.48" opacity="0.2" />
            <path d="M 168,158 Q 165,166 169,173" strokeWidth="0.5" opacity="0.22" />
            <path d="M 105,165 Q 108,173 104,180" strokeWidth="0.46" opacity="0.18" />
            <path d="M 184,162 Q 181,170 185,177" strokeWidth="0.44" opacity="0.16" />
            <path d="M 132,163 Q 129,171 133,178" strokeWidth="0.52" opacity="0.24" />
            <path d="M 157,161 Q 154,169 158,176" strokeWidth="0.43" opacity="0.17" />
            <path d="M 116,169 Q 119,177 115,184" strokeWidth="0.49" opacity="0.21" />
            <path d="M 176,165 Q 173,173 177,180" strokeWidth="0.47" opacity="0.19" />
            <path d="M 145,168 Q 142,176 146,183" strokeWidth="0.5" opacity="0.22" />
            <path d="M 189,171 Q 186,179 190,186" strokeWidth="0.45" opacity="0.18" />
            <path d="M 109,178 Q 112,186 108,193" strokeWidth="0.51" opacity="0.23" />
            <path d="M 163,174 Q 160,182 164,189" strokeWidth="0.44" opacity="0.16" />
            <path d="M 137,177 Q 134,185 138,192" strokeWidth="0.48" opacity="0.2" />
            <path d="M 182,178 Q 179,186 183,193" strokeWidth="0.46" opacity="0.18" />
            <path d="M 122,182 Q 119,190 123,197" strokeWidth="0.52" opacity="0.24" />
            <path d="M 155,179 Q 152,187 156,194" strokeWidth="0.43" opacity="0.17" />
            <path d="M 194,183 Q 191,191 195,198" strokeWidth="0.47" opacity="0.19" />
            <path d="M 103,188 Q 106,196 102,203" strokeWidth="0.5" opacity="0.22" />
            <path d="M 171,184 Q 168,192 172,199" strokeWidth="0.45" opacity="0.18" />
            <path d="M 142,188 Q 139,196 143,203" strokeWidth="0.51" opacity="0.23" />
            <path d="M 186,189 Q 183,197 187,204" strokeWidth="0.44" opacity="0.16" />
            <path d="M 114,195 Q 117,203 113,210" strokeWidth="0.48" opacity="0.2" />
            <path d="M 158,192 Q 155,200 159,207" strokeWidth="0.46" opacity="0.18" />
            <path d="M 178,195 Q 175,203 179,210" strokeWidth="0.52" opacity="0.24" />
            <path d="M 131,198 Q 128,206 132,213" strokeWidth="0.43" opacity="0.17" />
            <path d="M 149,195 Q 146,203 150,210" strokeWidth="0.5" opacity="0.22" />
            <path d="M 191,199 Q 188,207 192,214" strokeWidth="0.47" opacity="0.19" />
            <path d="M 107,205 Q 110,213 106,220" strokeWidth="0.45" opacity="0.18" />
            <path d="M 166,202 Q 163,210 167,217" strokeWidth="0.51" opacity="0.23" />
            <path d="M 139,204 Q 136,212 140,219" strokeWidth="0.48" opacity="0.2" />
            <path d="M 183,206 Q 180,214 184,221" strokeWidth="0.44" opacity="0.16" />
            <path d="M 119,209 Q 122,217 118,224" strokeWidth="0.52" opacity="0.24" />
            <path d="M 154,207 Q 151,215 155,222" strokeWidth="0.46" opacity="0.18" />
            <path d="M 174,210 Q 171,218 175,225" strokeWidth="0.5" opacity="0.22" />
            <path d="M 104,218 Q 107,226 103,233" strokeWidth="0.47" opacity="0.19" />
            <path d="M 145,214 Q 142,222 146,229" strokeWidth="0.43" opacity="0.17" />
            <path d="M 187,216 Q 184,224 188,231" strokeWidth="0.51" opacity="0.23" />
            <path d="M 126,218 Q 123,226 127,233" strokeWidth="0.45" opacity="0.18" />
            <path d="M 163,219 Q 160,227 164,234" strokeWidth="0.48" opacity="0.2" />
            <path d="M 112,225 Q 115,233 111,240" strokeWidth="0.52" opacity="0.24" />
            <path d="M 179,222 Q 176,230 180,237" strokeWidth="0.44" opacity="0.16" />
            <path d="M 137,225 Q 134,233 138,240" strokeWidth="0.5" opacity="0.22" />
            <path d="M 152,223 Q 149,231 153,238" strokeWidth="0.46" opacity="0.18" />
            <path d="M 193,227 Q 190,235 194,242" strokeWidth="0.47" opacity="0.19" />
            <path d="M 120,232 Q 117,240 121,247" strokeWidth="0.51" opacity="0.23" />
            <path d="M 168,229 Q 165,237 169,244" strokeWidth="0.43" opacity="0.17" />
            <path d="M 143,232 Q 140,240 144,247" strokeWidth="0.48" opacity="0.2" />
            <path d="M 184,234 Q 181,242 185,249" strokeWidth="0.45" opacity="0.18" />
            <path d="M 107,238 Q 110,246 106,253" strokeWidth="0.52" opacity="0.24" />
            <path d="M 158,236 Q 155,244 159,251" strokeWidth="0.5" opacity="0.22" />
            <path d="M 131,239 Q 128,247 132,254" strokeWidth="0.44" opacity="0.16" />
            <path d="M 175,238 Q 172,246 176,253" strokeWidth="0.47" opacity="0.19" />
            <path d="M 148,241 Q 145,249 149,256" strokeWidth="0.46" opacity="0.18" />
            <path d="M 117,244 Q 114,252 118,259" strokeWidth="0.51" opacity="0.23" />
            <path d="M 189,243 Q 186,251 190,258" strokeWidth="0.43" opacity="0.17" />
            <path d="M 162,245 Q 159,253 163,260" strokeWidth="0.48" opacity="0.2" />
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
          {/* Large bald area covering most of the top with gradient fade */}
          <ellipse 
            cx="150" 
            cy="165" 
            rx="85" 
            ry="115" 
            fill="url(#fullTopGrad)"
          />
          {/* FADE ZONE - Left side horseshoe boundary */}
          <g stroke={hairColor} fill="none">
            <path d="M 68,82 Q 72,92 69,100" strokeWidth="0.55" opacity="0.26" />
            <path d="M 72,95 Q 76,106 73,114" strokeWidth="0.5" opacity="0.22" />
            <path d="M 66,108 Q 70,120 67,128" strokeWidth="0.6" opacity="0.28" />
            <path d="M 70,122 Q 74,134 71,142" strokeWidth="0.45" opacity="0.2" />
            <path d="M 64,138 Q 68,151 65,159" strokeWidth="0.55" opacity="0.25" />
            <path d="M 68,155 Q 72,168 69,176" strokeWidth="0.5" opacity="0.23" />
            <path d="M 62,172 Q 66,186 63,194" strokeWidth="0.6" opacity="0.27" />
            <path d="M 66,190 Q 70,204 67,212" strokeWidth="0.45" opacity="0.21" />
            <path d="M 64,208 Q 68,222 65,230" strokeWidth="0.55" opacity="0.26" />
            <path d="M 68,226 Q 72,240 69,248" strokeWidth="0.5" opacity="0.22" />
            <path d="M 66,244 Q 70,258 67,266" strokeWidth="0.6" opacity="0.28" />
            <path d="M 74,88 Q 78,99 75,107" strokeWidth="0.4" opacity="0.18" />
            <path d="M 78,115 Q 82,127 79,135" strokeWidth="0.5" opacity="0.24" />
            <path d="M 76,148 Q 80,161 77,169" strokeWidth="0.45" opacity="0.2" />
            <path d="M 74,182 Q 78,196 75,204" strokeWidth="0.55" opacity="0.26" />
            <path d="M 78,218 Q 82,232 79,240" strokeWidth="0.5" opacity="0.22" />
            <path d="M 72,252 Q 76,266 73,274" strokeWidth="0.45" opacity="0.19" />
          </g>
          
          {/* FADE ZONE - Right side horseshoe boundary */}
          <g stroke={hairColor} fill="none">
            <path d="M 232,82 Q 228,92 231,100" strokeWidth="0.55" opacity="0.26" />
            <path d="M 228,95 Q 224,106 227,114" strokeWidth="0.5" opacity="0.22" />
            <path d="M 234,108 Q 230,120 233,128" strokeWidth="0.6" opacity="0.28" />
            <path d="M 230,122 Q 226,134 229,142" strokeWidth="0.45" opacity="0.2" />
            <path d="M 236,138 Q 232,151 235,159" strokeWidth="0.55" opacity="0.25" />
            <path d="M 232,155 Q 228,168 231,176" strokeWidth="0.5" opacity="0.23" />
            <path d="M 238,172 Q 234,186 237,194" strokeWidth="0.6" opacity="0.27" />
            <path d="M 234,190 Q 230,204 233,212" strokeWidth="0.45" opacity="0.21" />
            <path d="M 236,208 Q 232,222 235,230" strokeWidth="0.55" opacity="0.26" />
            <path d="M 232,226 Q 228,240 231,248" strokeWidth="0.5" opacity="0.22" />
            <path d="M 234,244 Q 230,258 233,266" strokeWidth="0.6" opacity="0.28" />
            <path d="M 226,88 Q 222,99 225,107" strokeWidth="0.4" opacity="0.18" />
            <path d="M 222,115 Q 218,127 221,135" strokeWidth="0.5" opacity="0.24" />
            <path d="M 224,148 Q 220,161 223,169" strokeWidth="0.45" opacity="0.2" />
            <path d="M 226,182 Q 222,196 225,204" strokeWidth="0.55" opacity="0.26" />
            <path d="M 222,218 Q 218,232 221,240" strokeWidth="0.5" opacity="0.22" />
            <path d="M 228,252 Q 224,266 227,274" strokeWidth="0.45" opacity="0.19" />
          </g>
          
          {/* FADE ZONE - Back horseshoe boundary */}
          <g stroke={hairColor} fill="none">
            <path d="M 85,262 Q 92,270 88,278" strokeWidth="0.5" opacity="0.24" />
            <path d="M 98,268 Q 106,276 102,284" strokeWidth="0.55" opacity="0.26" />
            <path d="M 112,272 Q 120,280 116,288" strokeWidth="0.45" opacity="0.2" />
            <path d="M 128,275 Q 135,283 131,291" strokeWidth="0.5" opacity="0.22" />
            <path d="M 144,276 Q 150,284 146,292" strokeWidth="0.55" opacity="0.25" />
            <path d="M 158,276 Q 152,284 156,292" strokeWidth="0.5" opacity="0.23" />
            <path d="M 172,275 Q 165,283 169,291" strokeWidth="0.45" opacity="0.2" />
            <path d="M 188,272 Q 180,280 184,288" strokeWidth="0.55" opacity="0.26" />
            <path d="M 202,268 Q 194,276 198,284" strokeWidth="0.5" opacity="0.22" />
            <path d="M 215,262 Q 208,270 212,278" strokeWidth="0.45" opacity="0.19" />
            <path d="M 92,258 Q 99,266 95,274" strokeWidth="0.4" opacity="0.18" />
            <path d="M 135,270 Q 142,278 138,286" strokeWidth="0.5" opacity="0.24" />
            <path d="M 165,270 Q 158,278 162,286" strokeWidth="0.5" opacity="0.24" />
            <path d="M 208,258 Q 201,266 205,274" strokeWidth="0.4" opacity="0.18" />
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

      {/* Scattered fine front hairs - replacing straight lines */}
      <g stroke={hairColor} fill="none">
        {/* Dispersed short hairs across front zone */}
        <path d="M 98,82 Q 101,88 97,93" strokeWidth="0.4" opacity="0.12" />
        <path d="M 105,78 Q 102,85 106,91" strokeWidth="0.35" opacity="0.1" />
        <path d="M 112,85 Q 115,92 111,98" strokeWidth="0.45" opacity="0.14" />
        <path d="M 94,95 Q 97,102 93,108" strokeWidth="0.4" opacity="0.11" />
        <path d="M 108,91 Q 105,98 109,104" strokeWidth="0.5" opacity="0.15" />
        <path d="M 118,88 Q 121,95 117,101" strokeWidth="0.35" opacity="0.1" />
        <path d="M 103,98 Q 100,105 104,111" strokeWidth="0.45" opacity="0.13" />
        <path d="M 125,82 Q 122,89 126,95" strokeWidth="0.4" opacity="0.12" />
        <path d="M 119,76 Q 122,83 118,89" strokeWidth="0.35" opacity="0.09" />
        <path d="M 132,79 Q 129,86 133,92" strokeWidth="0.45" opacity="0.14" />
        <path d="M 127,92 Q 130,99 126,105" strokeWidth="0.4" opacity="0.11" />
        <path d="M 138,85 Q 135,92 139,98" strokeWidth="0.5" opacity="0.15" />
        <path d="M 123,88 Q 120,95 124,101" strokeWidth="0.35" opacity="0.1" />
        <path d="M 142,75 Q 139,82 143,88" strokeWidth="0.4" opacity="0.12" />
        <path d="M 136,72 Q 139,79 135,85" strokeWidth="0.45" opacity="0.13" />
        <path d="M 148,78 Q 145,85 149,91" strokeWidth="0.35" opacity="0.1" />
        <path d="M 144,88 Q 147,95 143,101" strokeWidth="0.5" opacity="0.14" />
        <path d="M 152,82 Q 149,89 153,95" strokeWidth="0.4" opacity="0.11" />
        <path d="M 158,74 Q 161,81 157,87" strokeWidth="0.45" opacity="0.13" />
        <path d="M 164,79 Q 161,86 165,92" strokeWidth="0.35" opacity="0.1" />
        <path d="M 155,85 Q 158,92 154,98" strokeWidth="0.4" opacity="0.12" />
        <path d="M 168,83 Q 165,90 169,96" strokeWidth="0.5" opacity="0.15" />
        <path d="M 162,91 Q 159,98 163,104" strokeWidth="0.35" opacity="0.09" />
        <path d="M 175,77 Q 172,84 176,90" strokeWidth="0.45" opacity="0.13" />
        <path d="M 181,81 Q 178,88 182,94" strokeWidth="0.4" opacity="0.11" />
        <path d="M 172,88 Q 175,95 171,101" strokeWidth="0.35" opacity="0.1" />
        <path d="M 186,85 Q 183,92 187,98" strokeWidth="0.5" opacity="0.14" />
        <path d="M 178,92 Q 181,99 177,105" strokeWidth="0.4" opacity="0.12" />
        <path d="M 193,79 Q 190,86 194,92" strokeWidth="0.45" opacity="0.13" />
        <path d="M 199,83 Q 196,90 200,96" strokeWidth="0.35" opacity="0.1" />
        <path d="M 188,76 Q 191,83 187,89" strokeWidth="0.4" opacity="0.11" />
        <path d="M 204,88 Q 201,95 205,101" strokeWidth="0.5" opacity="0.15" />
        <path d="M 195,94 Q 198,101 194,107" strokeWidth="0.35" opacity="0.09" />
        <path d="M 100,105 Q 103,112 99,118" strokeWidth="0.4" opacity="0.12" />
        <path d="M 115,102 Q 112,109 116,115" strokeWidth="0.45" opacity="0.14" />
        <path d="M 129,99 Q 132,106 128,112" strokeWidth="0.35" opacity="0.1" />
        <path d="M 145,103 Q 142,110 146,116" strokeWidth="0.5" opacity="0.13" />
        <path d="M 158,98 Q 155,105 159,111" strokeWidth="0.4" opacity="0.11" />
        <path d="M 172,101 Q 169,108 173,114" strokeWidth="0.45" opacity="0.14" />
        <path d="M 185,105 Q 182,112 186,118" strokeWidth="0.35" opacity="0.1" />
        <path d="M 198,99 Q 195,106 199,112" strokeWidth="0.4" opacity="0.12" />
        <path d="M 96,118 Q 99,126 95,133" strokeWidth="0.45" opacity="0.13" />
        <path d="M 110,115 Q 107,123 111,130" strokeWidth="0.4" opacity="0.11" />
        <path d="M 122,112 Q 125,120 121,127" strokeWidth="0.5" opacity="0.15" />
        <path d="M 135,118 Q 132,126 136,133" strokeWidth="0.35" opacity="0.1" />
        <path d="M 150,114 Q 153,122 149,129" strokeWidth="0.45" opacity="0.13" />
        <path d="M 166,117 Q 163,125 167,132" strokeWidth="0.4" opacity="0.12" />
        <path d="M 179,113 Q 176,121 180,128" strokeWidth="0.5" opacity="0.14" />
        <path d="M 192,118 Q 189,126 193,133" strokeWidth="0.35" opacity="0.1" />
        <path d="M 203,112 Q 200,120 204,127" strokeWidth="0.45" opacity="0.13" />
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
