import React from 'react';
import {
  Aerolune3DColors,
  WeatherAtmosphere,
} from '../utils/aerolune3DPalette';

export interface Aerolune3DGlassCardProps {
  atmosphere: WeatherAtmosphere;
  isLowEndMode?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Reusable 3D Glass Card (`com.aerolune.weather.ui.designsystem.Aerolune3DGlassCard`)
 * Renders multi-layered 3D extrusion walls, top specular highlight, and atmospheric surface tinting.
 */
export const Aerolune3DGlassCard: React.FC<Aerolune3DGlassCardProps> = ({
  atmosphere,
  isLowEndMode = false,
  className = '',
  children,
}) => {
  const palette = Aerolune3DColors.getPalette(atmosphere);

  return (
    <div
      data-atmosphere-card={atmosphere}
      style={{
        background: isLowEndMode
          ? '#0F172A'
          : `linear-gradient(165deg, ${palette.surfaceTop}33 0%, ${palette.surfaceBottom}77 100%)`,
        borderColor: isLowEndMode ? `${palette.specularHighlight}40` : `${palette.specularHighlight}77`,
        boxShadow: isLowEndMode
          ? `0 3px 0 ${palette.extrusionWall}`
          : `0 6px 0 ${palette.extrusionWall}, inset 0 1.5px 0 ${palette.specularHighlight}88, 0 10px 24px -6px ${palette.neonGlow}33`,
        color: palette.contentColor,
      }}
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
};
