import React, { useContext, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ANIMATION_QUALITY_TIER_META,
  Aerolune3DColors,
  Aerolune3DPalette,
  AeroluneButtonStyle,
  AmbientSkyLighting,
  DEFAULT_AMBIENT_SKY_LIGHTING,
  WeatherAtmosphere,
  compute3DButtonTouchPhysics,
  lerpHexColor,
  resolveAeroluneButtonStyleColors,
} from '../utils/aerolune3DPalette';

/**
 * Mirrors `val LocalAeroluneSkyLighting = compositionLocalOf { AmbientSkyLighting() }`
 * Through `LocalAeroluneSkyLighting`, every `Aerolune3DButton` automatically adapts its
 * rim reflections and shadows to the current sky without requiring manual theme parameters.
 */
export const LocalAeroluneSkyLighting = React.createContext<AmbientSkyLighting | null>(null);

export function useAeroluneSkyLighting(): AmbientSkyLighting {
  return useContext(LocalAeroluneSkyLighting) ?? DEFAULT_AMBIENT_SKY_LIGHTING;
}

export interface Aerolune3DButtonProps {
  text: string;
  subtitle?: string;
  buttonStyle?: AeroluneButtonStyle;
  icon?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  badgeText?: string;
  depthElevation?: number; // 2 to 10
  extrusionDepth?: number; // default 7
  cornerRadius?: number;   // default 20 for lg, 12 for sm/md
  maxTiltDegrees?: number; // default 12
  isLoading?: boolean;
  accentColor?: 'cyan' | 'amber' | 'emerald' | 'rose' | 'slate';
  weatherStateTint?: 'clear' | 'rain' | 'thunderstorm' | 'heat' | 'neutral';
  atmosphere?: WeatherAtmosphere;
  isLowEndMode?: boolean;
  active?: boolean;
  disabled?: boolean;
  enabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
  testId?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export const Aerolune3DButton: React.FC<Aerolune3DButtonProps> = ({
  text,
  subtitle,
  buttonStyle,
  icon,
  leadingIcon,
  badgeText,
  depthElevation,
  extrusionDepth,
  cornerRadius,
  maxTiltDegrees = 12,
  isLoading = false,
  accentColor,
  atmosphere,
  isLowEndMode,
  active = false,
  disabled = false,
  enabled = true,
  fullWidth = false,
  size = 'md',
  className = '',
  ariaLabel,
  testId,
  onClick,
  type = 'button',
}) => {
  const ambientSkyLighting = useContext(LocalAeroluneSkyLighting);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touchState, setTouchState] = useState<{
    x?: number;
    y?: number;
    width: number;
    height: number;
  }>({ width: 220, height: 62 });

  const isButtonEnabled = enabled && !disabled;

  const effectiveLowEndMode =
    isLowEndMode ??
    (ambientSkyLighting
      ? !ANIMATION_QUALITY_TIER_META[ambientSkyLighting.qualityTier].enableRealtimeShaders
      : false);

  const updateTouchCoordinates = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTouchState({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isButtonEnabled || isLoading) return;
    setPressed(true);
    updateTouchCoordinates(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (effectiveLowEndMode || !isButtonEnabled || isLoading) return;
    updateTouchCoordinates(e);
  };

  const handlePointerLeave = () => {
    setPressed(false);
    setHovered(false);
    setTouchState((prev) => ({ width: prev.width, height: prev.height }));
  };

  // Resolve AeroluneButtonStyle when provided or inside LocalAeroluneSkyLighting
  const resolvedButtonStyle: AeroluneButtonStyle | undefined =
    buttonStyle ??
    (ambientSkyLighting && !atmosphere && !accentColor
      ? AeroluneButtonStyle.SKY_ADAPTIVE
      : undefined);

  const resolvedAtmosphere: WeatherAtmosphere =
    atmosphere ??
    (accentColor === 'amber'
      ? WeatherAtmosphere.DAWN_SUNRISE
      : accentColor === 'rose'
        ? WeatherAtmosphere.HEATWAVE_ALERT
        : accentColor === 'emerald'
          ? WeatherAtmosphere.MONSOON_RAIN
          : WeatherAtmosphere.NIGHT_STARRY);

  const styleColors = resolvedButtonStyle
    ? resolveAeroluneButtonStyleColors(
        resolvedButtonStyle,
        ambientSkyLighting ?? DEFAULT_AMBIENT_SKY_LIGHTING
      )
    : null;

  const palette: Aerolune3DPalette = styleColors
    ? {
        surfaceTop: lerpHexColor(
          styleColors.topSurfaceColor,
          styleColors.rimHighlightColor,
          0.28
        ),
        surfaceBottom: lerpHexColor(
          styleColors.topSurfaceColor,
          styleColors.baseExtrusionColor,
          0.45
        ),
        extrusionWall: styleColors.baseExtrusionColor,
        specularHighlight: styleColors.rimHighlightColor,
        neonGlow: styleColors.glowColor,
        contentColor: '#FFFFFF',
      }
    : Aerolune3DColors.getPalette(resolvedAtmosphere);

  const extrusionPx = extrusionDepth ?? depthElevation ?? (size === 'lg' ? 7 : 5);
  const physics = compute3DButtonTouchPhysics({
    touchX: touchState.x,
    touchY: touchState.y,
    width: touchState.width,
    height: touchState.height,
    isPressed: pressed || hovered,
    enabled: isButtonEnabled,
    extrusionPx,
    maxTiltDegrees,
    skyLighting: ambientSkyLighting ?? DEFAULT_AMBIENT_SKY_LIGHTING,
  });

  const currentVerticalOffsetPx = pressed ? extrusionPx * 0.78 : 0;
  const remainingExtrusionPx = Math.max(
    1.5,
    extrusionPx - currentVerticalOffsetPx
  );

  const sizeStyles: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-xs sm:text-sm gap-2 rounded-lg',
    lg: 'px-5 py-3 text-sm gap-2.5 rounded-2xl',
  };

  const baseBackgroundGradient =
    active || fullWidth || Boolean(resolvedButtonStyle)
      ? `linear-gradient(180deg, ${palette.surfaceTop} 0%, ${
          styleColors ? styleColors.topSurfaceColor : palette.surfaceBottom
        } 52%, ${palette.surfaceBottom} 100%)`
      : hovered
        ? `linear-gradient(180deg, ${palette.surfaceTop}cc 0%, ${palette.surfaceBottom}dd 100%)`
        : `linear-gradient(180deg, ${palette.surfaceTop}38 0%, ${palette.surfaceBottom}66 100%)`;

  const glareLayer =
    !effectiveLowEndMode && physics.glareHotspot.enabled
      ? `radial-gradient(circle at ${physics.glareHotspot.x}px ${physics.glareHotspot.y}px, ${palette.specularHighlight}${
          pressed ? '6B' : '38'
        } 0%, transparent 65%), `
      : '';

  const boxShadowStyle = effectiveLowEndMode
    ? `0 ${remainingExtrusionPx.toFixed(1)}px 0 ${palette.extrusionWall}`
    : active || fullWidth || Boolean(resolvedButtonStyle)
      ? `0 ${remainingExtrusionPx.toFixed(1)}px 0 ${palette.extrusionWall}, inset 0 1.8px 0 ${palette.specularHighlight}, 0 ${physics.shadowDropOffset.toFixed(
          1
        )}px 16px -2px ${palette.neonGlow}66`
      : `0 ${remainingExtrusionPx.toFixed(1)}px 0 ${palette.extrusionWall}, inset 0 1px 0 ${palette.specularHighlight}66`;

  const borderColorStyle =
    active || fullWidth || Boolean(resolvedButtonStyle)
      ? palette.specularHighlight
      : hovered
        ? palette.neonGlow
        : `${palette.specularHighlight}44`;

  const resolvedIcon = leadingIcon ?? icon;

  return (
    <button
      type={type}
      disabled={!isButtonEnabled || isLoading}
      aria-label={ariaLabel || text}
      aria-pressed={active}
      data-testid={testId}
      data-atmosphere={resolvedAtmosphere}
      data-button-style={resolvedButtonStyle}
      data-sky-phase={ambientSkyLighting?.skyPhase}
      data-weather-mode={ambientSkyLighting?.weatherMode}
      data-quality-tier={ambientSkyLighting?.qualityTier}
      data-specular-rim={palette.specularHighlight}
      data-extrusion-offset={currentVerticalOffsetPx.toFixed(2)}
      onClick={() => {
        if (isButtonEnabled && !isLoading && onClick) {
          onClick();
        }
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerDown={handlePointerDown}
      onPointerUp={() => setPressed(false)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        background: `${glareLayer}${baseBackgroundGradient}`,
        color: palette.contentColor,
        borderColor: borderColorStyle,
        borderRadius: cornerRadius ? `${cornerRadius}px` : undefined,
        boxShadow: boxShadowStyle,
        opacity: isButtonEnabled ? 1 : 0.48,
        transform: effectiveLowEndMode
          ? `translateY(${currentVerticalOffsetPx.toFixed(1)}px)`
          : `perspective(560px) rotateX(${physics.rotationX.toFixed(
              1
            )}deg) rotateY(${physics.rotationY.toFixed(1)}deg) scale(${
              pressed ? 0.965 : 1
            }) translateY(${currentVerticalOffsetPx.toFixed(1)}px)`,
        transition:
          'transform 140ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 140ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`inline-flex items-center ${
        fullWidth ? 'w-full justify-between' : 'justify-center'
      } font-medium border select-none whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:pointer-events-none ${sizeStyles[size]} ${className}`}
    >
      <span className="inline-flex items-center gap-2.5 truncate">
        {isLoading ? (
          <Loader2
            className="w-4 h-4 animate-spin shrink-0"
            style={{ color: palette.specularHighlight }}
          />
        ) : (
          resolvedIcon && <span className="shrink-0">{resolvedIcon}</span>
        )}
        <span className="flex flex-col items-start truncate">
          <span className="truncate font-bold">{text}</span>
          {subtitle && (
            <span
              className="text-[10px] font-mono leading-tight truncate"
              style={{ color: `${palette.specularHighlight}E6` }}
            >
              {subtitle}
            </span>
          )}
        </span>
      </span>
      {badgeText && (
        <span
          className="ml-2 px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase rounded border shrink-0"
          style={{
            backgroundColor: `${palette.extrusionWall}cc`,
            borderColor: palette.specularHighlight,
            color: palette.specularHighlight,
          }}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
};

