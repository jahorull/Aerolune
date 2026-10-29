import { AstronomicalPhase, HourlyTimelinePoint } from '../types/weather';

/**
 * Represents the live atmospheric state driving AEROLUNE's dynamic 3D lighting.
 * Mirrors `com.aerolune.weather.ui.designsystem.WeatherAtmosphere`
 */
export enum WeatherAtmosphere {
  DAWN_SUNRISE = 'DAWN_SUNRISE',
  NOON_CLEAR = 'NOON_CLEAR',
  EVENING_SUNSET = 'EVENING_SUNSET',
  NIGHT_STARRY = 'NIGHT_STARRY',
  MONSOON_RAIN = 'MONSOON_RAIN',
  HEATWAVE_ALERT = 'HEATWAVE_ALERT',
}

/**
 * Holds color and lighting vectors for 3D extrusion, specular highlights, and ambient glow.
 * Mirrors `com.aerolune.weather.ui.designsystem.Aerolune3DPalette`
 */
export interface Aerolune3DPalette {
  surfaceTop: string;
  surfaceBottom: string;
  extrusionWall: string;      // The 3D physical thickness/side wall of the button
  specularHighlight: string;  // Top-edge light reflection
  neonGlow: string;           // Outer futuristic aura
  contentColor: string;
}

export const Aerolune3DColors = {
  getPalette(atmosphere: WeatherAtmosphere): Aerolune3DPalette {
    switch (atmosphere) {
      case WeatherAtmosphere.DAWN_SUNRISE:
        return {
          surfaceTop: '#FF8E53',
          surfaceBottom: '#CC4B4B',
          extrusionWall: '#7A2230',
          specularHighlight: '#FFE5B4',
          neonGlow: '#FF758C',
          contentColor: '#FFFFFF',
        };
      case WeatherAtmosphere.NOON_CLEAR:
        return {
          surfaceTop: '#2FA4FF',
          surfaceBottom: '#0052D4',
          extrusionWall: '#002B75',
          specularHighlight: '#B8ECFF',
          neonGlow: '#00D2FF',
          contentColor: '#FFFFFF',
        };
      case WeatherAtmosphere.EVENING_SUNSET:
        return {
          surfaceTop: '#9D50BB',
          surfaceBottom: '#4E2A84',
          extrusionWall: '#28114D',
          specularHighlight: '#FFB396',
          neonGlow: '#E86F88',
          contentColor: '#FFFFFF',
        };
      case WeatherAtmosphere.NIGHT_STARRY:
        return {
          surfaceTop: '#1F2B4D',
          surfaceBottom: '#0F172A',
          extrusionWall: '#060A14',
          specularHighlight: '#64FFDA',
          neonGlow: '#38BDF8',
          contentColor: '#E2E8F0',
        };
      case WeatherAtmosphere.MONSOON_RAIN:
        return {
          surfaceTop: '#2C5364',
          surfaceBottom: '#152A36',
          extrusionWall: '#0A161D',
          specularHighlight: '#80DEEA',
          neonGlow: '#26C6DA',
          contentColor: '#ECEFF1',
        };
      case WeatherAtmosphere.HEATWAVE_ALERT:
        return {
          surfaceTop: '#FF512F',
          surfaceBottom: '#DD2476',
          extrusionWall: '#7D0B3B',
          specularHighlight: '#FFF176',
          neonGlow: '#FF6E40',
          contentColor: '#FFFFFF',
        };
    }
  },
};

/**
 * Derives the live `WeatherAtmosphere` from astronomical time and live meteorological telemetry.
 */
export function resolveWeatherAtmosphere(
  phase: AstronomicalPhase,
  point: Pick<HourlyTimelinePoint, 'tempC' | 'feelsLikeC' | 'rainProb' | 'conditionCode'>
): WeatherAtmosphere {
  if (point.tempC >= 35 || point.feelsLikeC >= 38.5) {
    return WeatherAtmosphere.HEATWAVE_ALERT;
  }
  if (
    point.rainProb >= 55 ||
    point.conditionCode === 'rain' ||
    point.conditionCode === 'thunderstorm'
  ) {
    return WeatherAtmosphere.MONSOON_RAIN;
  }
  switch (phase) {
    case 'dawn':
      return WeatherAtmosphere.DAWN_SUNRISE;
    case 'noon':
      return WeatherAtmosphere.NOON_CLEAR;
    case 'evening':
      return WeatherAtmosphere.EVENING_SUNSET;
    case 'night':
    default:
      return WeatherAtmosphere.NIGHT_STARRY;
  }
}

export const WEATHER_ATMOSPHERE_ENTRIES: WeatherAtmosphere[] = [
  WeatherAtmosphere.DAWN_SUNRISE,
  WeatherAtmosphere.NOON_CLEAR,
  WeatherAtmosphere.EVENING_SUNSET,
  WeatherAtmosphere.NIGHT_STARRY,
  WeatherAtmosphere.MONSOON_RAIN,
  WeatherAtmosphere.HEATWAVE_ALERT,
];

export function cycleWeatherAtmosphere(current: WeatherAtmosphere): WeatherAtmosphere {
  const idx = WEATHER_ATMOSPHERE_ENTRIES.indexOf(current);
  const nextIndex = (idx + 1) % WEATHER_ATMOSPHERE_ENTRIES.length;
  return WEATHER_ATMOSPHERE_ENTRIES[nextIndex];
}

/**
 * Mirrors the vertical backgroundBrush gradients from AeroluneShowcaseScreen.kt
 */
export function getAtmosphereBackgroundGradient(atmosphere: WeatherAtmosphere): string {
  switch (atmosphere) {
    case WeatherAtmosphere.DAWN_SUNRISE:
      return 'linear-gradient(180deg, #2C1654 0%, #FF6B6B 55%, #FFD166 100%)';
    case WeatherAtmosphere.NOON_CLEAR:
      return 'linear-gradient(180deg, #005C97 0%, #363795 100%)';
    case WeatherAtmosphere.EVENING_SUNSET:
      return 'linear-gradient(180deg, #1A0B2E 0%, #6B2D5C 52%, #F06543 100%)';
    case WeatherAtmosphere.NIGHT_STARRY:
      return 'linear-gradient(180deg, #030712 0%, #0F172A 50%, #1E293B 100%)';
    case WeatherAtmosphere.MONSOON_RAIN:
      return 'linear-gradient(180deg, #0F2027 0%, #203A43 50%, #2C5364 100%)';
    case WeatherAtmosphere.HEATWAVE_ALERT:
      return 'linear-gradient(180deg, #4A0E17 0%, #9E192D 52%, #E35D35 100%)';
  }
}

/**
 * 1. Ambient Sky Lighting & Quality State (`AeroluneSkyState.kt`)
 * `package com.aerolune.app.presentation.designsystem`
 */
export enum SkyPhase {
  DAWN_SUNRISE = 'DAWN_SUNRISE',
  BRIGHT_MIDDAY = 'BRIGHT_MIDDAY',
  GOLDEN_SUNSET = 'GOLDEN_SUNSET',
  STARRY_NIGHT = 'STARRY_NIGHT',
}

export const SKY_PHASE_META: Record<
  SkyPhase,
  { labelBn: string; labelEn: string }
> = {
  [SkyPhase.DAWN_SUNRISE]: { labelBn: 'ভোর (Sunrise)', labelEn: 'Dawn' },
  [SkyPhase.BRIGHT_MIDDAY]: { labelBn: 'দুপুর (Midday)', labelEn: 'Midday' },
  [SkyPhase.GOLDEN_SUNSET]: { labelBn: 'সন্ধ্যা (Sunset)', labelEn: 'Sunset' },
  [SkyPhase.STARRY_NIGHT]: { labelBn: 'রাত (Night)', labelEn: 'Night' },
};

export enum WeatherVisualMode {
  CLEAR_SKY = 'CLEAR_SKY',
  MONSOON_RAIN = 'MONSOON_RAIN',
  HEAT_HAZE = 'HEAT_HAZE',
}

export const WEATHER_VISUAL_MODE_META: Record<
  WeatherVisualMode,
  { labelBn: string; labelEn: string }
> = {
  [WeatherVisualMode.CLEAR_SKY]: {
    labelBn: 'পরিষ্কার আকাশ',
    labelEn: 'Clear Sky',
  },
  [WeatherVisualMode.MONSOON_RAIN]: {
    labelBn: 'বৃষ্টি ও মেঘ',
    labelEn: 'Monsoon Rain',
  },
  [WeatherVisualMode.HEAT_HAZE]: {
    labelBn: 'তীব্র গরম ও Heat Haze',
    labelEn: 'Heat Haze',
  },
};

export enum AnimationQualityTier {
  ULTRA_3D = 'ULTRA_3D',
  BALANCED = 'BALANCED',
  LOW_END_SAVER = 'LOW_END_SAVER',
}

export const ANIMATION_QUALITY_TIER_META: Record<
  AnimationQualityTier,
  { particleMultiplier: number; enableRealtimeShaders: boolean }
> = {
  [AnimationQualityTier.ULTRA_3D]: {
    particleMultiplier: 1.0,
    enableRealtimeShaders: true,
  },
  [AnimationQualityTier.BALANCED]: {
    particleMultiplier: 0.55,
    enableRealtimeShaders: true,
  },
  [AnimationQualityTier.LOW_END_SAVER]: {
    particleMultiplier: 0.2,
    enableRealtimeShaders: false,
  },
};

export interface NormalizedOffset {
  x: number;
  y: number;
}

export interface AmbientSkyLighting {
  skyPhase: SkyPhase;
  weatherMode: WeatherVisualMode;
  qualityTier: AnimationQualityTier;
  lightSourceNormalized: NormalizedOffset; // Position of Sun/Moon (0..1)
  specularRimColor: string;
  surfaceGlassTint: string;
  extrudedBaseColor: string;
  ambientGlowColor: string;
}

export const DEFAULT_AMBIENT_SKY_LIGHTING: AmbientSkyLighting = {
  skyPhase: SkyPhase.STARRY_NIGHT,
  weatherMode: WeatherVisualMode.CLEAR_SKY,
  qualityTier: AnimationQualityTier.ULTRA_3D,
  lightSourceNormalized: { x: 0.5, y: 0.2 },
  specularRimColor: '#80D8FF',
  surfaceGlassTint: '#162944',
  extrudedBaseColor: '#091326',
  ambientGlowColor: '#00B4D8',
};

/**
 * Computes realistic ambient lighting and 3D button material colors
 * based on the current local hour (0..23) or explicit SkyPhase override.
 */
export function computeAmbientLightingForPhase(
  phase: SkyPhase,
  weatherMode: WeatherVisualMode,
  qualityTier: AnimationQualityTier
): AmbientSkyLighting {
  let baseLighting: AmbientSkyLighting;
  switch (phase) {
    case SkyPhase.DAWN_SUNRISE:
      baseLighting = {
        skyPhase: phase,
        weatherMode,
        qualityTier,
        lightSourceNormalized: { x: 0.2, y: 0.65 },
        specularRimColor: '#FFCC80',
        surfaceGlassTint: '#28234A',
        extrudedBaseColor: '#141029',
        ambientGlowColor: '#FF8A65',
      };
      break;
    case SkyPhase.BRIGHT_MIDDAY:
      baseLighting = {
        skyPhase: phase,
        weatherMode,
        qualityTier,
        lightSourceNormalized: { x: 0.5, y: 0.15 },
        specularRimColor: '#E1F5FE',
        surfaceGlassTint: '#0D47A1',
        extrudedBaseColor: '#06275C',
        ambientGlowColor: '#40C4FF',
      };
      break;
    case SkyPhase.GOLDEN_SUNSET:
      baseLighting = {
        skyPhase: phase,
        weatherMode,
        qualityTier,
        lightSourceNormalized: { x: 0.82, y: 0.68 },
        specularRimColor: '#FFAB40',
        surfaceGlassTint: '#3B1D38',
        extrudedBaseColor: '#1F0C1D',
        ambientGlowColor: '#FF5252',
      };
      break;
    case SkyPhase.STARRY_NIGHT:
    default:
      baseLighting = {
        skyPhase: SkyPhase.STARRY_NIGHT,
        weatherMode,
        qualityTier,
        lightSourceNormalized: { x: 0.75, y: 0.22 },
        specularRimColor: '#80D8FF',
        surfaceGlassTint: '#132238',
        extrudedBaseColor: '#070E1A',
        ambientGlowColor: '#00E5FF',
      };
      break;
  }

  // Desaturate and cool down specular highlights during heavy monsoon rain
  if (weatherMode === WeatherVisualMode.MONSOON_RAIN) {
    return {
      ...baseLighting,
      specularRimColor: '#90A4AE',
      surfaceGlassTint: '#1C2833',
      ambientGlowColor: '#4FC3F7',
    };
  }
  return baseLighting;
}

export function mapAtmosphereToSkyPhaseAndMode(atmosphere: WeatherAtmosphere): {
  skyPhase: SkyPhase;
  weatherMode: WeatherVisualMode;
} {
  switch (atmosphere) {
    case WeatherAtmosphere.DAWN_SUNRISE:
      return { skyPhase: SkyPhase.DAWN_SUNRISE, weatherMode: WeatherVisualMode.CLEAR_SKY };
    case WeatherAtmosphere.NOON_CLEAR:
      return { skyPhase: SkyPhase.BRIGHT_MIDDAY, weatherMode: WeatherVisualMode.CLEAR_SKY };
    case WeatherAtmosphere.EVENING_SUNSET:
      return { skyPhase: SkyPhase.GOLDEN_SUNSET, weatherMode: WeatherVisualMode.CLEAR_SKY };
    case WeatherAtmosphere.MONSOON_RAIN:
      return { skyPhase: SkyPhase.BRIGHT_MIDDAY, weatherMode: WeatherVisualMode.MONSOON_RAIN };
    case WeatherAtmosphere.HEATWAVE_ALERT:
      return { skyPhase: SkyPhase.BRIGHT_MIDDAY, weatherMode: WeatherVisualMode.HEAT_HAZE };
    case WeatherAtmosphere.NIGHT_STARRY:
    default:
      return { skyPhase: SkyPhase.STARRY_NIGHT, weatherMode: WeatherVisualMode.CLEAR_SKY };
  }
}

export const AEROLUNE_SKY_STATE_KT_SOURCE = `package com.aerolune.app.presentation.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color

enum class SkyPhase(val labelBn: String, val labelEn: String) {
    DAWN_SUNRISE("ভোর (Sunrise)", "Dawn"),
    BRIGHT_MIDDAY("দুপুর (Midday)", "Midday"),
    GOLDEN_SUNSET("সন্ধ্যা (Sunset)", "Sunset"),
    STARRY_NIGHT("রাত (Night)", "Night")
}

enum class WeatherVisualMode(val labelBn: String) {
    CLEAR_SKY("পরিষ্কার আকাশ"),
    MONSOON_RAIN("বৃষ্টি ও মেঘ"),
    HEAT_HAZE("তীব্র গরম ও Heat Haze")
}

enum class AnimationQualityTier(val particleMultiplier: Float, val enableRealtimeShaders: Boolean) {
    ULTRA_3D(particleMultiplier = 1.0f, enableRealtimeShaders = true),
    BALANCED(particleMultiplier = 0.55f, enableRealtimeShaders = true),
    LOW_END_SAVER(particleMultiplier = 0.2f, enableRealtimeShaders = false)
}

@Immutable
data class AmbientSkyLighting(
    val skyPhase: SkyPhase = SkyPhase.STARRY_NIGHT,
    val weatherMode: WeatherVisualMode = WeatherVisualMode.CLEAR_SKY,
    val qualityTier: AnimationQualityTier = AnimationQualityTier.ULTRA_3D,
    val lightSourceNormalized: Offset = Offset(0.5f, 0.2f), // Position of Sun/Moon (0..1)
    val specularRimColor: Color = Color(0xFF80D8FF),
    val surfaceGlassTint: Color = Color(0xFF162944),
    val extrudedBaseColor: Color = Color(0xFF091326),
    val ambientGlowColor: Color = Color(0xFF00B4D8)
)

val LocalAeroluneSkyLighting = compositionLocalOf { AmbientSkyLighting() }

/**
 * Computes realistic ambient lighting and 3D button material colors
 * based on the current local hour (0..23) or explicit SkyPhase override.
 */
fun computeAmbientLightingForPhase(
    phase: SkyPhase,
    weatherMode: WeatherVisualMode,
    qualityTier: AnimationQualityTier
): AmbientSkyLighting {
    val baseLighting = when (phase) {
        SkyPhase.DAWN_SUNRISE -> AmbientSkyLighting(
            skyPhase = phase,
            weatherMode = weatherMode,
            qualityTier = qualityTier,
            lightSourceNormalized = Offset(0.2f, 0.65f),
            specularRimColor = Color(0xFFFFCC80),
            surfaceGlassTint = Color(0xFF28234A),
            extrudedBaseColor = Color(0xFF141029),
            ambientGlowColor = Color(0xFFFF8A65)
        )
        SkyPhase.BRIGHT_MIDDAY -> AmbientSkyLighting(
            skyPhase = phase,
            weatherMode = weatherMode,
            qualityTier = qualityTier,
            lightSourceNormalized = Offset(0.5f, 0.15f),
            specularRimColor = Color(0xFFE1F5FE),
            surfaceGlassTint = Color(0xFF0D47A1),
            extrudedBaseColor = Color(0xFF06275C),
            ambientGlowColor = Color(0xFF40C4FF)
        )
        SkyPhase.GOLDEN_SUNSET -> AmbientSkyLighting(
            skyPhase = phase,
            weatherMode = weatherMode,
            qualityTier = qualityTier,
            lightSourceNormalized = Offset(0.82f, 0.68f),
            specularRimColor = Color(0xFFFFAB40),
            surfaceGlassTint = Color(0xFF3B1D38),
            extrudedBaseColor = Color(0xFF1F0C1D),
            ambientGlowColor = Color(0xFFFF5252)
        )
        SkyPhase.STARRY_NIGHT -> AmbientSkyLighting(
            skyPhase = phase,
            weatherMode = weatherMode,
            qualityTier = qualityTier,
            lightSourceNormalized = Offset(0.75f, 0.22f),
            specularRimColor = Color(0xFF80D8FF),
            surfaceGlassTint = Color(0xFF132238),
            extrudedBaseColor = Color(0xFF070E1A),
            ambientGlowColor = Color(0xFF00E5FF)
        )
    }

    // Desaturate and cool down specular highlights during heavy monsoon rain
    return if (weatherMode == WeatherVisualMode.MONSOON_RAIN) {
        baseLighting.copy(
            specularRimColor = Color(0xFF90A4AE),
            surfaceGlassTint = Color(0xFF1C2833),
            ambientGlowColor = Color(0xFF4FC3F7)
        )
    } else {
        baseLighting
    }
}`;

/**
 * 2. Reusable 3D Spatial Button (`Aerolune3DButton.kt`)
 * `package com.aerolune.app.presentation.designsystem`
 */
export enum AeroluneButtonStyle {
  SKY_ADAPTIVE = 'SKY_ADAPTIVE',       // Automatically matches Dawn/Midday/Sunset/Night sky colors
  COPILOT_CYAN = 'COPILOT_CYAN',       // Futuristic AI Copilot accent
  SEVERE_WARNING = 'SEVERE_WARNING',   // High-priority cyclone/heatwave alert style
  FARMING_EMERALD = 'FARMING_EMERALD', // Smart Farming Mode accent
}

export interface AeroluneButtonStyleColors {
  topSurfaceColor: string;
  baseExtrusionColor: string;
  rimHighlightColor: string;
  glowColor: string;
}

export function resolveAeroluneButtonStyleColors(
  style: AeroluneButtonStyle,
  skyLighting: AmbientSkyLighting = DEFAULT_AMBIENT_SKY_LIGHTING
): AeroluneButtonStyleColors {
  switch (style) {
    case AeroluneButtonStyle.COPILOT_CYAN:
      return {
        topSurfaceColor: '#0A3D62',
        baseExtrusionColor: '#051E34',
        rimHighlightColor: '#00E5FF',
        glowColor: '#00B4D8',
      };
    case AeroluneButtonStyle.SEVERE_WARNING:
      return {
        topSurfaceColor: '#6E1423',
        baseExtrusionColor: '#3B0811',
        rimHighlightColor: '#FF8A80',
        glowColor: '#FF1744',
      };
    case AeroluneButtonStyle.FARMING_EMERALD:
      return {
        topSurfaceColor: '#14452F',
        baseExtrusionColor: '#082417',
        rimHighlightColor: '#69F0AE',
        glowColor: '#00E676',
      };
    case AeroluneButtonStyle.SKY_ADAPTIVE:
    default:
      return {
        topSurfaceColor: skyLighting.surfaceGlassTint,
        baseExtrusionColor: skyLighting.extrudedBaseColor,
        rimHighlightColor: skyLighting.specularRimColor,
        glowColor: skyLighting.ambientGlowColor,
      };
  }
}

/**
 * Mirrors `private fun lerpColor(start: Color, stop: Color, fraction: Float): Color`
 */
export function lerpHexColor(
  startHex: string,
  stopHex: string,
  fraction: number
): string {
  const f = Math.min(1, Math.max(0, fraction));
  const parseHex = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };
  const s = parseHex(startHex);
  const e = parseHex(stopHex);
  const r = Math.round(s.r + (e.r - s.r) * f);
  const g = Math.round(s.g + (e.g - s.g) * f);
  const b = Math.round(s.b + (e.b - s.b) * f);
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Pure 3D spatial physics calculator mirroring `Aerolune3DButton.kt`:
 * - Touch-Position 3D Tilt (`rotationX`, `rotationY`, `scale = 0.965f`)
 * - Physical Z-Axis Compression (`currentVerticalOffsetPx = extrusionPx * 0.78f * pressProgress`)
 * - Ambient Floor Glow (`shadowDropOffset = extrusionPx * (1.25f - 0.55f * pressProgress)`)
 * - Dynamic Specular Rim & Glare Hotspot (skipped in `LOW_END_SAVER`)
 */
export function compute3DButtonTouchPhysics(params: {
  touchX?: number;
  touchY?: number;
  width: number;
  height: number;
  isPressed: boolean;
  enabled?: boolean;
  extrusionPx?: number;
  maxTiltDegrees?: number;
  skyLighting?: AmbientSkyLighting;
}): {
  touchNormalized: NormalizedOffset;
  pressProgress: number;
  rotationX: number;
  rotationY: number;
  scale: number;
  currentVerticalOffsetPx: number;
  shadowDropOffset: number;
  shadowAlpha: number;
  capHeight: number;
  glareHotspot: {
    x: number;
    y: number;
    alpha: number;
    enabled: boolean;
  };
} {
  const {
    width,
    height,
    isPressed,
    enabled = true,
    extrusionPx = 7,
    maxTiltDegrees = 12,
    skyLighting = DEFAULT_AMBIENT_SKY_LIGHTING,
  } = params;

  const activePress = isPressed && enabled;
  const pressProgress = activePress ? 1 : 0;

  let nx = 0;
  let ny = 0;
  if (
    activePress &&
    width > 0 &&
    height > 0 &&
    typeof params.touchX === 'number' &&
    typeof params.touchY === 'number'
  ) {
    nx = Math.min(1, Math.max(-1, (params.touchX / width) * 2 - 1));
    ny = Math.min(1, Math.max(-1, (params.touchY / height) * 2 - 1));
  }

  const rotationX = activePress ? Number((-ny * maxTiltDegrees).toFixed(4)) : 0;
  const rotationY = activePress ? Number((nx * maxTiltDegrees).toFixed(4)) : 0;
  const scale = activePress ? 0.965 : 1;

  const currentVerticalOffsetPx = Number(
    (extrusionPx * 0.78 * pressProgress).toFixed(4)
  );
  const shadowDropOffset = Number(
    (extrusionPx * (1.25 - 0.55 * pressProgress)).toFixed(4)
  );
  const shadowAlpha = Number((0.28 * (1 - 0.4 * pressProgress)).toFixed(4));
  const capHeight = Math.max(1, height - extrusionPx);

  const enableRealtimeShaders =
    ANIMATION_QUALITY_TIER_META[skyLighting.qualityTier].enableRealtimeShaders;

  const hotspotX = activePress
    ? width * (0.5 + nx * 0.42)
    : width * skyLighting.lightSourceNormalized.x;
  const hotspotY = activePress
    ? currentVerticalOffsetPx + capHeight * (0.5 + ny * 0.42)
    : currentVerticalOffsetPx + capHeight * 0.15;

  return {
    touchNormalized: { x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) },
    pressProgress,
    rotationX,
    rotationY,
    scale,
    currentVerticalOffsetPx,
    shadowDropOffset,
    shadowAlpha,
    capHeight,
    glareHotspot: {
      x: Number(hotspotX.toFixed(2)),
      y: Number(hotspotY.toFixed(2)),
      alpha: activePress ? 0.42 : 0.22,
      enabled: enableRealtimeShaders,
    },
  };
}

export const AEROLUNE_3D_BUTTON_KT_SOURCE = `package com.aerolune.app.presentation.designsystem

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp

enum class AeroluneButtonStyle {
    SKY_ADAPTIVE,     // Automatically matches Dawn/Midday/Sunset/Night sky colors
    COPILOT_CYAN,     // Futuristic AI Copilot accent
    SEVERE_WARNING,   // High-priority cyclone/heatwave alert style
    FARMING_EMERALD   // Smart Farming Mode accent
}

@Composable
fun Aerolune3DButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    style: AeroluneButtonStyle = AeroluneButtonStyle.SKY_ADAPTIVE,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    cornerRadius: Dp = 20.dp,
    extrusionDepth: Dp = 7.dp,
    maxTiltDegrees: Float = 12f,
    leadingIcon: (@Composable () -> Unit)? = null
) {
    val skyLighting = LocalAeroluneSkyLighting.current
    val haptic = LocalHapticFeedback.current
    val density = LocalDensity.current

    var buttonSize by remember { mutableStateOf(IntSize.Zero) }
    var isPressed by remember { mutableStateOf(false) }
    // Normalized touch offset from button center (-1f..1f)
    var touchNormalized by remember { mutableStateOf(Offset.Zero) }

    // Resolve style palette combined with live ambient sky lighting
    val (topSurfaceColor, baseExtrusionColor, rimHighlightColor, glowColor) = remember(style, skyLighting) {
        when (style) {
            AeroluneButtonStyle.SKY_ADAPTIVE -> listOf(
                skyLighting.surfaceGlassTint,
                skyLighting.extrudedBaseColor,
                skyLighting.specularRimColor,
                skyLighting.ambientGlowColor
            )
            AeroluneButtonStyle.COPILOT_CYAN -> listOf(
                Color(0xFF0A3D62),
                Color(0xFF051E34),
                Color(0xFF00E5FF),
                Color(0xFF00B4D8)
            )
            AeroluneButtonStyle.SEVERE_WARNING -> listOf(
                Color(0xFF6E1423),
                Color(0xFF3B0811),
                Color(0xFFFF8A80),
                Color(0xFFFF1744)
            )
            AeroluneButtonStyle.FARMING_EMERALD -> listOf(
                Color(0xFF14452F),
                Color(0xFF082417),
                Color(0xFF69F0AE),
                Color(0xFF00E676)
            )
        }
    }

    // Spring-driven 3D physical animations
    val pressProgress by animateFloatAsState(
        targetValue = if (isPressed && enabled) 1f else 0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMediumLow
        ),
        label = "3DPressDepth"
    )

    val animatedRotationX by animateFloatAsState(
        targetValue = if (isPressed && enabled) -touchNormalized.y * maxTiltDegrees else 0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "3DTiltX"
    )

    val animatedRotationY by animateFloatAsState(
        targetValue = if (isPressed && enabled) touchNormalized.x * maxTiltDegrees else 0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "3DTiltY"
    )

    val animatedScale by animateFloatAsState(
        targetValue = if (isPressed && enabled) 0.965f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "3DScale"
    )

    val extrusionPx = with(density) { extrusionDepth.toPx() }
    val cornerRadiusPx = with(density) { cornerRadius.toPx() }
    // When pressed, the top face moves downward toward the extruded base
    val currentVerticalOffsetPx = extrusionPx * 0.78f * pressProgress

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .defaultMinSize(minWidth = 160.dp, minHeight = 62.dp)
            .onSizeChanged { buttonSize = it }
            .semantics { role = Role.Button }
            .graphicsLayer {
                rotationX = animatedRotationX
                rotationY = animatedRotationY
                scaleX = animatedScale
                scaleY = animatedScale
                cameraDistance = 14f * density.density
                alpha = if (enabled) 1f else 0.48f
            }
            .pointerInput(enabled, isLoading) {
                if (!enabled || isLoading) return@pointerInput
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    isPressed = true
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)

                    fun updateTouchTilt(position: Offset) {
                        if (buttonSize.width > 0 && buttonSize.height > 0) {
                            val nx = ((position.x / buttonSize.width) * 2f - 1f).coerceIn(-1f, 1f)
                            val ny = ((position.y / buttonSize.height) * 2f - 1f).coerceIn(-1f, 1f)
                            touchNormalized = Offset(nx, ny)
                        }
                    }
                    updateTouchTilt(down.position)

                    var pointerInside = true
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Main)
                        val change = event.changes.firstOrNull() ?: break

                        if (change.changedToUpIgnoreConsumed()) {
                            isPressed = false
                            touchNormalized = Offset.Zero
                            if (pointerInside) {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onClick()
                            }
                            break
                        } else {
                            val pos = change.position
                            pointerInside = pos.x in 0f..buttonSize.width.toFloat() &&
                                pos.y in 0f..buttonSize.height.toFloat()
                            if (pointerInside) {
                                updateTouchTilt(pos)
                            } else {
                                isPressed = false
                                touchNormalized = Offset.Zero
                            }
                        }
                    }
                }
            }
    ) {
        // 3D Multi-Layer Canvas (Ambient Shadow + Extruded Lip + Glass Cap + Specular Rim)
        Canvas(modifier = Modifier.matchParentSize()) {
            val canvasWidth = size.width
            val capHeight = (size.height - extrusionPx).coerceAtLeast(1f)
            val corner = CornerRadius(cornerRadiusPx, cornerRadiusPx)

            // 1. Ambient Floor Glow / Drop Shadow
            val shadowDropOffset = extrusionPx * (1.25f - 0.55f * pressProgress)
            drawRoundRect(
                color = glowColor.copy(alpha = 0.28f * (1f - 0.4f * pressProgress)),
                topLeft = Offset(4f, shadowDropOffset + 3f),
                size = Size(canvasWidth - 8f, capHeight),
                cornerRadius = corner
            )

            // 2. 3D Extruded Physical Base (The bottom bevel that gives real thickness)
            drawRoundRect(
                brush = Brush.horizontalGradient(
                    colors = listOf(
                        baseExtrusionColor.copy(alpha = 0.95f),
                        lerpColor(baseExtrusionColor, rimHighlightColor, 0.22f),
                        baseExtrusionColor.copy(alpha = 0.95f)
                    )
                ),
                topLeft = Offset(0f, extrusionPx),
                size = Size(canvasWidth, capHeight),
                cornerRadius = corner
            )

            // 3. Elevated Top Cap Surface (Moves down by currentVerticalOffsetPx when pressed)
            val topCapOrigin = Offset(0f, currentVerticalOffsetPx)
            drawRoundRect(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        lerpColor(topSurfaceColor, rimHighlightColor, 0.28f),
                        topSurfaceColor,
                        lerpColor(topSurfaceColor, baseExtrusionColor, 0.45f)
                    ),
                    startY = currentVerticalOffsetPx,
                    endY = currentVerticalOffsetPx + capHeight
                ),
                topLeft = topCapOrigin,
                size = Size(canvasWidth, capHeight),
                cornerRadius = corner
            )

            // 4. Interactive Touch Glare & Sky Specular Reflection (Skipped in LOW_END_SAVER mode)
            if (skyLighting.qualityTier.enableRealtimeShaders) {
                val hotspotX = if (isPressed) {
                    canvasWidth * (0.5f + touchNormalized.x * 0.42f)
                } else {
                    canvasWidth * skyLighting.lightSourceNormalized.x
                }
                val hotspotY = if (isPressed) {
                    currentVerticalOffsetPx + capHeight * (0.5f + touchNormalized.y * 0.42f)
                } else {
                    currentVerticalOffsetPx + capHeight * 0.15f
                }

                drawRoundRect(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            rimHighlightColor.copy(alpha = if (isPressed) 0.42f else 0.22f),
                            Color.Transparent
                        ),
                        center = Offset(hotspotX, hotspotY),
                        radius = canvasWidth * 0.65f
                    ),
                    topLeft = topCapOrigin,
                    size = Size(canvasWidth, capHeight),
                    cornerRadius = corner
                )
            }

            // 5. Specular 3D Rim Border (Bright top-edge catchlight, subtle bottom bevel)
            drawRoundRect(
                brush = Brush.linearGradient(
                    colors = listOf(
                        rimHighlightColor.copy(alpha = 0.92f),
                        rimHighlightColor.copy(alpha = 0.25f),
                        baseExtrusionColor.copy(alpha = 0.8f)
                    ),
                    start = Offset(
                        x = canvasWidth * (0.5f + touchNormalized.x * 0.3f),
                        y = currentVerticalOffsetPx
                    ),
                    end = Offset(
                        x = canvasWidth * 0.5f,
                        y = currentVerticalOffsetPx + capHeight
                    )
                ),
                topLeft = Offset(1f, currentVerticalOffsetPx + 1f),
                size = Size(canvasWidth - 2f, capHeight - 2f),
                cornerRadius = corner,
                style = Stroke(width = 1.8.dp.toPx())
            )
        }

        // Foreground Content (Moves in sync with the 3D top cap surface)
        Row(
            modifier = Modifier
                .padding(
                    start = 20.dp,
                    end = 20.dp,
                    top = 12.dp,
                    bottom = 12.dp + extrusionDepth
                )
                .graphicsLayer {
                    translationY = currentVerticalOffsetPx
                },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = rimHighlightColor,
                    strokeWidth = 2.5.dp,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
            } else if (leadingIcon != null) {
                leadingIcon()
                Spacer(modifier = Modifier.width(12.dp))
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = text,
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        color = rimHighlightColor.copy(alpha = 0.9f),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }
    }
}

private fun lerpColor(start: Color, stop: Color, fraction: Float): Color {
    val f = fraction.coerceIn(0f, 1f)
    return Color(
        red = start.red + (stop.red - start.red) * f,
        green = start.green + (stop.green - start.green) * f,
        blue = start.blue + (stop.blue - start.blue) * f,
        alpha = start.alpha + (stop.alpha - start.alpha) * f
    )
}`;

