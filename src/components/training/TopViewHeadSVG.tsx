import React from "react";

interface TopViewHeadSVGProps {
  hairColor?: string;
  thinningPattern?: "crown" | "temples" | "diffuse" | "frontal";
  className?: string;
}

export function TopViewHeadSVG({
  hairColor = "#2a1810",
  thinningPattern = "crown",
  className
}: TopViewHeadSVGProps) {
  return (
    <svg
      viewBox="0 0 300 280"
      className={className}
      style={{ overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Scalp gradient */}
        <radialGradient id="scalpGradient" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f3d7bb" />
          <stop offset="100%" stopColor="#d2a074" />
        </radialGradient>

        {/* Hair gradient */}
        <radialGradient id="hairGradient" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={hairColor} />
          <stop offset="70%" stopColor={hairColor} />
          <stop offset="100%" stopColor="#3d261c" />
        </radialGradient>

        {/* Density fade for thinning */}
        <radialGradient id="fadeThinning" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#f3d7bb" stopOpacity="1" />
          <stop offset="70%" stopColor="#f3d7bb" stopOpacity="0.45" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* Mask to keep thinning inside the hair mass */}
        <mask id="hairMask">
          <rect width="300" height="280" fill="black" />

          <path
            d="
              M 150 55
              C 95 60 65 95 60 140
              C 55 190 80 225 150 235
              C 220 225 245 190 240 140
              C 235 95 205 60 150 55
            "
            fill="white"
          />
        </mask>
      </defs>

      {/* ----------------- EARS ----------------- */}
      <ellipse cx="50" cy="145" rx="22" ry="32" fill="url(#scalpGradient)" />
      <ellipse cx="250" cy="145" rx="22" ry="32" fill="url(#scalpGradient)" />

      {/* ----------------- SCALP SHAPE ----------------- */}
      <path
        d="
          M 150 30
          C 80 35 45 85 40 135
          C 35 185 60 235 150 245
          C 240 235 265 185 260 135
          C 255 85 220 35 150 30
        "
        fill="url(#scalpGradient)"
      />

      {/* ----------------- HAIR MASS ----------------- */}
      <path
        d="
          M 150 55
          C 95 60 65 95 60 140
          C 55 190 80 225 150 235
          C 220 225 245 190 240 140
          C 235 95 205 60 150 55
        "
        fill="url(#hairGradient)"
      />

      {/* ----------------- NATURAL HAIRLINE ----------------- */}
      {thinningPattern !== "frontal" && (
        <path
          d="
            M 95 130
            C 115 105 135 93 147 90
            L 150 87
            L 153 90
            C 165 93 185 105 205 130
          "
          stroke="#e9c8a8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
        />
      )}

      {/* ----------------- FRONTAL / HORSESHOE LOSS ----------------- */}
      {thinningPattern === "frontal" && (
        <path
          d="
            M 105 150
            C 125 120 140 108 150 108
            C 160 108 175 120 195 150
            C 197 165 197 175 190 185
            C 170 170 150 165 150 165
            C 130 165 110 170 100 185
            C 98 175 100 160 105 150
          "
          fill="url(#fadeThinning)"
          mask="url(#hairMask)"
          opacity="0.9"
        />
      )}

      {/* ----------------- CROWN THINNING ----------------- */}
      {thinningPattern === "crown" && (
        <path
          d="
            M 150 165
            C 138 160 126 170 123 185
            C 118 202 132 218 150 220
            C 168 222 185 210 188 195
            C 192 180 180 167 165 165
            Z
          "
          fill="url(#fadeThinning)"
          mask="url(#hairMask)"
          opacity="0.9"
        />
      )}

      {/* ----------------- TEMPLES THINNING ----------------- */}
      {thinningPattern === "temples" && (
        <>
          {/* Left temple */}
          <path
            d="
              M 95 130
              C 90 115 100 102 118 95
              C 130 92 140 97 147 108
              C 132 118 115 125 95 130
            "
            fill="url(#fadeThinning)"
            mask="url(#hairMask)"
            opacity="0.9"
          />

          {/* Right temple */}
          <path
            d="
              M 205 130
              C 210 115 198 102 182 95
              C 170 92 160 97 153 108
              C 168 118 185 125 205 130
            "
            fill="url(#fadeThinning)"
            mask="url(#hairMask)"
            opacity="0.9"
          />
        </>
      )}

      {/* ----------------- DIFFUSE THINNING ----------------- */}
      {thinningPattern === "diffuse" && (
        <circle
          cx="150"
          cy="150"
          r="95"
          fill="url(#fadeThinning)"
          opacity="0.55"
          mask="url(#hairMask)"
        />
      )}

      {/* ----------------- FRONT LABEL ----------------- */}
      <path d="M 145 45 L 150 28 L 155 45" fill="#d2a074" />
      <text
        x="150"
        y="20"
        textAnchor="middle"
        fontSize="11"
        opacity="0.55"
      >
        FRONT
      </text>
    </svg>
  );
}
