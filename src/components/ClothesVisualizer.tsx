/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface ClothesVisualizerProps {
  category: string;
  color: string;
  className?: string;
  showPattern?: boolean;
}

export const ClothesVisualizer: React.FC<ClothesVisualizerProps> = ({
  category,
  color,
  className = "w-full h-full",
  showPattern = false
}) => {
  const normalizedCategory = category.toLowerCase();
  
  // Clean color checks
  const safeColor = color && color.startsWith("#") ? color : "#FF6B00";

  // Determine patterns for Estampas
  const isEstampa = normalizedCategory.includes("estampa") || normalizedCategory.includes("touca") || showPattern;

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/50 p-6 ${className}`}>
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-radial from-white/30 to-transparent pointer-events-none" />

      <svg
        viewBox="0 0 200 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-h-64 object-contain drop-shadow-xl"
      >
        <defs>
          {/* Shadows and Shading Gradients */}
          <linearGradient id="shadingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="50%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.35" />
          </linearGradient>

          {/* Autism Puzzle Pattern */}
          <pattern id="puzzlePattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M5,15 C5,10 10,10 10,5 C10,0 15,0 15,5 C15,10 20,10 20,15 C20,20 15,20 15,25 C15,30 10,30 10,25 C10,20 5,20 5,15 Z" fill="#3B82F6" opacity="0.3" />
            <path d="M25,15 C25,10 30,10 30,5 C30,0 35,0 35,5 C35,10 40,10 40,15 C40,20 35,20 35,25 C35,30 30,30 30,25 C30,20 25,20 25,15 Z" fill="#10B981" opacity="0.3" />
            <circle cx="15" cy="15" r="2" fill="#FBBF24" opacity="0.4" />
          </pattern>

          {/* Pediatria Teeth / Smile Pattern for Odonto */}
          <pattern id="odontoPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            {/* Simple tooth layout */}
            <path d="M6,6 C6,4 10,4 10,6 C10,8 8,10 8,12 C8,10 6,8 6,6 Z" fill="white" opacity="0.5" />
            <path d="M12,12 C12,10 16,10 16,12 C16,14 14,16 14,18 C14,16 12,14 12,12 Z" fill="white" opacity="0.5" />
          </pattern>

          {/* Cute dots for Mônica / Barbie */}
          <pattern id="dotsPattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="2" fill="#FFFFFF" opacity="0.4" />
            <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" opacity="0.3" />
          </pattern>
        </defs>

        {/* Batas (Feminine medical lab tops, sleek silhouettes) */}
        {normalizedCategory.includes("bata") && (
          <g>
            {/* Shadow Base */}
            <ellipse cx="100" cy="225" rx="45" ry="8" fill="black" opacity="0.1" />

            {/* Left Sleeve */}
            <path
              d="M60 70 L40 105 C38 112 43 118 50 115 L62 98 Z"
              fill={safeColor}
            />
            {/* Sleeve Hem Left */}
            <path d="M40 105 L50 115" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" />

            {/* Right Sleeve */}
            <path
              d="M140 70 L160 105 C162 112 157 118 150 115 L138 98 Z"
              fill={safeColor}
            />
            {/* Sleeve Hem Right */}
            <path d="M160 105 L150 115" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" />

            {/* Main Body */}
            <path
              d="M70 50 C80 52 120 52 130 50 C140 70 145 110 135 150 C130 170 140 210 142 220 H58 C60 210 70 170 65 150 C55 110 60 70 70 50 Z"
              fill={safeColor}
            />

            {/* Princess Style Belt / Crease Line */}
            <path
              d="M60 150 Q100 158 140 150"
              stroke="#000000"
              strokeWidth="1.5"
              strokeOpacity="0.15"
            />
            {/* Golden Belt Details */}
            <rect x="92" y="147" width="16" height="6" rx="2" fill="white" fillOpacity="0.3" stroke="black" strokeOpacity="0.1" />

            {/* Pockets */}
            <path
              d="M68 175 H85 V195 C85 198 81 202 78 202 H68 V175 Z"
              fill="black"
              fillOpacity="0.08"
              stroke="white"
              strokeWidth="1"
              strokeOpacity="0.3"
            />
            <path
              d="M132 175 H115 V195 C115 198 119 202 122 202 H132 V175 Z"
              fill="black"
              fillOpacity="0.08"
              stroke="white"
              strokeWidth="1"
              strokeOpacity="0.3"
            />

            {/* V-Neck & Collar Bones */}
            <path
              d="M85 50 L100 75 L115 50"
              fill="#F5F5F5"
              stroke="black"
              strokeWidth="0.5"
              strokeOpacity="0.1"
            />
            {/* V-Collar Lapels */}
            <path
              d="M70 50 L85 50 L100 75 L85 85 Z"
              fill="black"
              fillOpacity="0.05"
            />
            <path
              d="M130 50 L115 50 L100 75 L115 85 Z"
              fill="black"
              fillOpacity="0.05"
            />

            {/* Shading Layer */}
            <path
              d="M70 50 C80 52 120 52 130 50 C140 70 145 110 135 150 C130 170 140 210 142 220 H58 C60 210 70 170 65 150 C55 110 60 70 70 50 Z"
              fill="url(#shadingGrad)"
              style={{ mixBlendMode: "multiply" }}
            />
          </g>
        )}

        {/* Calças (Sleek medical pants) */}
        {normalizedCategory.includes("calça") && (
          <g>
            {/* Shadow Base */}
            <ellipse cx="100" cy="225" rx="55" ry="10" fill="black" opacity="0.12" />

            {/* Waist Band / Pala */}
            <path
              d="M65 40 Q100 45 135 40 L132 60 Q100 65 68 60 Z"
              fill={safeColor}
            />
            {/* Drawstring or belt detail */}
            <circle cx="100" cy="50" r="3" fill="white" opacity="0.7" />
            <path d="M100 50 L95 65" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
            <path d="M100 50 L106 64" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />

            {/* Legs */}
            <path
              d="M68 60 L62 210 C62 214 66 218 72 218 L94 218 L97 100 L103 100 L106 218 L128 218 C134 218 138 214 138 210 L132 60 Z"
              fill={safeColor}
            />

            {/* Hem crease lines */}
            <line x1="62" y1="210" x2="94" y2="210" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
            <line x1="106" y1="210" x2="138" y2="210" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />

            {/* Side pockets stitches */}
            <path d="M68 80 Q80 90 85 105" stroke="white" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M132 80 Q120 90 115 105" stroke="white" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3,3" />

            {/* Shading Layer */}
            <path
              d="M65 40 Q100 45 135 40 L138 210 C138 214 134 218 128 218 L106 218 L103 100 L97 100 L94 218 L72 218 C66 218 62 214 62 210 Z"
              fill="url(#shadingGrad)"
              style={{ mixBlendMode: "multiply" }}
            />
          </g>
        )}

        {/* Estampas & Custom Accessories (Medical top with fun motifs) */}
        {!normalizedCategory.includes("bata") && !normalizedCategory.includes("calça") && (
          <g>
            {/* Shadow Base */}
            <ellipse cx="100" cy="225" rx="50" ry="8" fill="black" opacity="0.1" />

            {/* Touca (Surgical Cap design) */}
            {normalizedCategory.includes("touca") ? (
              <g>
                {/* Cap Base Rounded */}
                <path
                  d="M50 130 C50 60 150 60 150 130 C150 145 140 155 130 155 H70 C60 155 50 145 50 130 Z"
                  fill={safeColor}
                />
                
                {/* Applied pattern */}
                {safeColor.includes("10B981") || normalizedCategory.includes("verde") ? (
                  <path
                    d="M50 130 C50 60 150 60 150 130 C150 145 140 155 130 155 H70 C60 155 50 145 50 130 Z"
                    fill="url(#puzzlePattern)"
                  />
                ) : (
                  <path
                    d="M50 130 C50 60 150 60 150 130 C150 145 140 155 130 155 H70 C60 155 50 145 50 130 Z"
                    fill="url(#dotsPattern)"
                  />
                )}

                {/* Back tie tie lines */}
                <path d="M110 152 Q120 170 125 180" stroke={safeColor} strokeWidth="4" strokeLinecap="round" />
                <path d="M90 152 Q80 170 75 180" stroke={safeColor} strokeWidth="4" strokeLinecap="round" />
                <ellipse cx="100" cy="154" rx="6" ry="4" fill={safeColor} />

                {/* Shading Layer */}
                <path
                  d="M50 130 C50 60 150 60 150 130 C150 145 140 155 130 155 H70 C60 155 50 145 50 130 Z"
                  fill="url(#shadingGrad)"
                  style={{ mixBlendMode: "multiply" }}
                />
              </g>
            ) : (
              /* Standard medical print top (Scrub) */
              <g>
                {/* Left Sleeve */}
                <path d="M62 70 L42 100 C39 105 44 112 51 110 L64 94 Z" fill={safeColor} />
                {/* Right Sleeve */}
                <path d="M138 70 L158 100 C161 105 156 112 149 110 L136 94 Z" fill={safeColor} />

                {/* Body */}
                <path
                  d="M72 55 C82 56 118 56 128 55 C136 75 140 120 134 165 C132 180 135 210 136 218 H64 C65 210 68 180 66 165 C60 120 64 75 72 55 Z"
                  fill={safeColor}
                />

                {/* Patterns based on name */}
                {normalizedCategory.includes("odonto") ? (
                  <path
                    d="M72 55 C82 56 118 56 128 55 C136 75 140 120 134 165 C132 180 135 210 136 218 H64 C65 210 68 180 66 165 C60 120 64 75 72 55 Z"
                    fill="url(#odontoPattern)"
                  />
                ) : isEstampa ? (
                  <path
                    d="M72 55 C82 56 118 56 128 55 C136 75 140 120 134 165 C132 180 135 210 136 218 H64 C65 210 68 180 66 165 C60 120 64 75 72 55 Z"
                    fill="url(#dotsPattern)"
                  />
                ) : null}

                {/* V-Neck opening */}
                <path d="M88 55 L100 76 L112 55 Z" fill="#F3F4F6" stroke="black" strokeWidth="0.5" strokeOpacity="0.1" />

                {/* Bottom pockets */}
                <rect x="70" y="165" width="22" height="24" rx="2" fill="black" fillOpacity="0.08" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
                <rect x="108" y="165" width="22" height="24" rx="2" fill="black" fillOpacity="0.08" stroke="white" strokeWidth="1" strokeOpacity="0.2" />

                {/* Shading Layer */}
                <path
                  d="M72 55 C82 56 118 56 128 55 C136 75 140 120 134 165 C132 180 135 210 136 218 H64 C65 210 68 180 66 165 C60 120 64 75 72 55 Z"
                  fill="url(#shadingGrad)"
                  style={{ mixBlendMode: "multiply" }}
                />
              </g>
            )}
          </g>
        )}
      </svg>

      {/* Modern Badge for Category */}
      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-black/70 backdrop-blur-md border border-neutral-200/50 dark:border-neutral-800/50 px-2.5 py-1 text-[10px] font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest pointer-events-none">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: safeColor }} />
        {category}
      </span>
    </div>
  );
};
