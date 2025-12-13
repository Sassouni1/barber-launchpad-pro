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
