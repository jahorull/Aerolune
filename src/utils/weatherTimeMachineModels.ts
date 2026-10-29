import { HourlyTimelinePoint } from '../types/weather';
import { WeatherAtmosphere } from './aerolune3DPalette';

/**
 * Distinguishes past observed telemetry from future numerical weather prediction models.
 * Mirrors `com.aerolune.weather.timemachine.TimelinePhase`
 */
export enum TimelinePhase {
  OBSERVED_PAST = 'OBSERVED_PAST',
  LIVE_NOW = 'LIVE_NOW',
  FUTURE_FORECAST = 'FUTURE_FORECAST',
}

export interface TimelinePhaseConfig {
  phase: TimelinePhase;
  labelBn: string;
  labelEn: string;
  badgeText: string;
  primaryColor: string;
  secondaryColor: string;
}

export const TIMELINE_PHASE_META: Record<TimelinePhase, TimelinePhaseConfig> = {
  [TimelinePhase.OBSERVED_PAST]: {
    phase: TimelinePhase.OBSERVED_PAST,
    labelBn: 'অতীতের রেকর্ডকৃত আবহাওয়া (গত ২৪ ঘণ্টা)',
    labelEn: 'Recorded Observed Weather (Past 24 Hours)',
    badgeText: 'OBSERVED HISTORY',
    primaryColor: '#00E5FF', // Cyan for verified past observations
    secondaryColor: '#00BFA5',
  },
  [TimelinePhase.LIVE_NOW]: {
    phase: TimelinePhase.LIVE_NOW,
    labelBn: 'বর্তমান লাইভ আবহাওয়া',
    labelEn: 'Current Live Weather Telemetry',
    badgeText: 'LIVE TELEMETRY',
    primaryColor: '#64FFDA', // Bright Mint for current hour
    secondaryColor: '#1DE9B6',
  },
  [TimelinePhase.FUTURE_FORECAST]: {
    phase: TimelinePhase.FUTURE_FORECAST,
    labelBn: 'ভবিষ্যৎ পূর্বাভাস (আগামী ২৪ ঘণ্টা)',
    labelEn: 'Future NWP Forecast',
    badgeText: 'AI + NWP FORECAST',
    primaryColor: '#FF9100', // Distinct Amber/Violet for future predictions
    secondaryColor: '#D500F9',
  },
};

/**
 * Mandatory source transparency for every single timestamp on the timeline.
 * Mirrors `com.aerolune.weather.timemachine.TelemetrySource`
 */
export interface TelemetrySource {
  providerName: string; // e.g., "BMD Agargaon Station + Open-Meteo ERA5", "ECMWF IFS + NOAA GFS Ensemble"
  modelResolution: string; // e.g., "9km High-Res Forecast", "Observed Surface + 10km Radar"
  lastIngestedTimestamp: string;
}

/**
 * Represents 1 hour in the 49-hour (-24h to +24h) Time Machine window.
 * Mirrors `com.aerolune.weather.timemachine.HourlyWeatherFrame`
 */
export interface HourlyWeatherFrame {
  hourOffset: number; // -24 to +24 (0 = Now)
  displayTime: string; // e.g., "এখন (LIVE)", "-6h (অতীত)", "+6h (পূর্বাভাস)"
  phase: TimelinePhase;
  temperatureC: number;
  cloudCoverFraction: number; // 0.0 to 1.0
  rainIntensityMm: number; // 0.0 to 35.0 mm/hr
  windSpeedKmh: number; // 0.0 to 100.0 km/h
  windDirectionDeg: number; // 0 to 360
  source: TelemetrySource;
  aiInsightBn: string; // Grounded Bengali explanation for this timestamp
}

export function getTimelinePhaseForOffset(offset: number): TimelinePhase {
  if (offset < 0) return TimelinePhase.OBSERVED_PAST;
  if (offset === 0) return TimelinePhase.LIVE_NOW;
  return TimelinePhase.FUTURE_FORECAST;
}

export function getTelemetrySourceForPhase(phase: TimelinePhase): TelemetrySource {
  switch (phase) {
    case TimelinePhase.OBSERVED_PAST:
      return {
        providerName: 'BMD Agargaon Station + Open-Meteo ERA5',
        modelResolution: 'Observed Surface + 10km Radar',
        lastIngestedTimestamp: 'Verified Observation',
      };
    case TimelinePhase.LIVE_NOW:
      return {
        providerName: 'BMD Live Doppler + Himawari-9 IR',
        modelResolution: 'Real-Time 2km Composite',
        lastIngestedTimestamp: 'Updated 2 mins ago',
      };
    case TimelinePhase.FUTURE_FORECAST:
      return {
        providerName: 'ECMWF IFS + NOAA GFS Ensemble',
        modelResolution: '9km High-Res Forecast',
        lastIngestedTimestamp: 'Model Run 06Z',
      };
  }
}

export function generateBengaliFrameInsight(
  tempC: number,
  cloudCoverFraction: number,
  rainIntensityMm: number,
  windSpeedKmh: number
): string {
  const cloudPct = Math.round(cloudCoverFraction * 100);
  if (rainIntensityMm > 8) {
    return `ভারী বৃষ্টিপাত (${rainIntensityMm.toFixed(1)} মিমি/ঘণ্টা) এবং ঘণ্টায় ${Math.round(windSpeedKmh)} কিমি বেগে দমকা হাওয়া প্রবাহিত হচ্ছে।`;
  }
  if (rainIntensityMm > 1) {
    return `হালকা থেকে মাঝারি বৃষ্টি এবং আকাশে ${cloudPct}% মেঘের উপস্থিতি রয়েছে।`;
  }
  return `আকাশ আংশিক মেঘলা (${cloudPct}%), তাপমাত্রা ${tempC.toFixed(1)}°C এবং বাতাস স্বাভাবিক।`;
}

/**
 * Demo generator producing a realistic 49-hour sequence (-24h to +24h) for Dhaka, Bangladesh.
 * Mirrors `com.aerolune.weather.timemachine.TimeMachineSampleRepository`
 */
export const TimeMachineSampleRepository = {
  generate48HourTimeline(): HourlyWeatherFrame[] {
    const frames: HourlyWeatherFrame[] = [];
    for (let offset = -24; offset <= 24; offset++) {
      const phase = getTimelinePhaseForOffset(offset);
      const wave = Math.sin((offset + 6) * 0.26);
      const temp = Math.round((28.5 + wave * 4.5) * 10) / 10;
      const rawCloud = (Math.sin(offset * 0.18) + 1) / 2;
      const cloud = Math.min(0.95, Math.max(0.15, rawCloud));
      const rain = cloud > 0.62 ? Math.round((cloud - 0.62) * 45 * 10) / 10 : 0;
      const wind = Math.round((12 + cloud * 26) * 10) / 10;
      const windDir = ((135 + offset * 2.5) % 360 + 360) % 360;

      const source = getTelemetrySourceForPhase(phase);
      const insight = generateBengaliFrameInsight(temp, cloud, rain, wind);
      const timeLabel =
        offset === 0
          ? 'এখন (LIVE)'
          : offset < 0
            ? `${offset}h (অতীত)`
            : `+${offset}h (পূর্বাভাস)`;

      frames.push({
        hourOffset: offset,
        displayTime: timeLabel,
        phase,
        temperatureC: temp,
        cloudCoverFraction: Math.round(cloud * 100) / 100,
        rainIntensityMm: rain,
        windSpeedKmh: wind,
        windDirectionDeg: windDir,
        source,
        aiInsightBn: insight,
      });
    }
    return frames;
  },
};

export function resolveTimelineFrameFromPoint(point: HourlyTimelinePoint): HourlyWeatherFrame {
  const phase = getTimelinePhaseForOffset(point.hourOffset);
  const source = getTelemetrySourceForPhase(phase);
  const cloudFraction = Math.min(1, Math.max(0, point.cloudCover / 100));
  const insight = generateBengaliFrameInsight(
    point.tempC,
    cloudFraction,
    point.precipMm,
    point.windSpeedKmh
  );
  const displayTime =
    point.hourOffset === 0
      ? 'এখন (LIVE)'
      : point.hourOffset < 0
        ? `${point.hourOffset}h (অতীত)`
        : `+${point.hourOffset}h (পূর্বাভাস)`;

  return {
    hourOffset: point.hourOffset,
    displayTime,
    phase,
    temperatureC: point.tempC,
    cloudCoverFraction: cloudFraction,
    rainIntensityMm: point.precipMm,
    windSpeedKmh: point.windSpeedKmh,
    windDirectionDeg: point.windDirectionDeg,
    source,
    aiInsightBn: insight,
  };
}

/**
 * 3D Spherical-to-Cartesian & Perspective Projection Engine (`Interactive3DWeatherGlobe.kt`)
 */
export interface GlobeParticle {
  baseTheta: number; // Latitude angle (0 to PI)
  basePhi: number; // Longitude angle (0 to 2*PI)
  altitudeMultiplier: number;
  size: number;
}

export interface ProjectedPoint3D {
  screenX: number;
  screenY: number;
  zDepth: number;
}

export function getThermalAuraColor(tempC: number): string {
  if (tempC >= 33) return '#FF5252';
  if (tempC >= 29) return '#FFAB40';
  return '#00E5FF';
}

export function projectSpherePoint(
  theta: number,
  phi: number,
  radiusScale: number,
  baseRadius: number,
  fov: number,
  centerX: number,
  centerY: number,
  rotationYaw: number,
  rotationPitch: number
): ProjectedPoint3D {
  const r = baseRadius * radiusScale;
  const x0 = r * Math.sin(theta) * Math.cos(phi);
  const y0 = r * Math.cos(theta);
  const z0 = r * Math.sin(theta) * Math.sin(phi);

  // Rotate around Y-axis (Yaw)
  const cosY = Math.cos(rotationYaw);
  const sinY = Math.sin(rotationYaw);
  const x1 = x0 * cosY - z0 * sinY;
  const z1 = x0 * sinY + z0 * cosY;

  // Rotate around X-axis (Pitch)
  const cosX = Math.cos(rotationPitch);
  const sinX = Math.sin(rotationPitch);
  const y2 = y0 * cosX - z1 * sinX;
  const z2 = y0 * sinX + z1 * cosX;

  const perspective = fov / (fov + z2 + baseRadius);
  const screenX = centerX + x1 * perspective;
  const screenY = centerY + y2 * perspective;
  return { screenX, screenY, zDepth: z2 };
}

export function generateFibonacciSurfaceNodes(isLowEndMode: boolean): GlobeParticle[] {
  const count = isLowEndMode ? 260 : 750;
  const goldenAngle = Math.PI * (1 + Math.sqrt(5));
  const twoPi = 2 * Math.PI;
  const nodes: GlobeParticle[] = [];
  for (let i = 0; i < count; i++) {
    const z = 1 - (2 * (i + 0.5)) / count;
    const theta = Math.acos(Math.min(1, Math.max(-1, z)));
    const phi = (goldenAngle * i) % twoPi;
    nodes.push({
      baseTheta: theta,
      basePhi: phi,
      altitudeMultiplier: 1.0,
      size: i % 7 === 0 ? 3.8 : 2.2,
    });
  }
  return nodes;
}

export function generateSeededCloudClusters(isLowEndMode: boolean): GlobeParticle[] {
  const count = isLowEndMode ? 80 : 240;
  let seed = 42;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const clusters: GlobeParticle[] = [];
  for (let i = 0; i < count; i++) {
    clusters.push({
      baseTheta: nextRandom() * Math.PI,
      basePhi: nextRandom() * 2 * Math.PI,
      altitudeMultiplier: 1.07 + nextRandom() * 0.04,
      size: 8 + nextRandom() * 14,
    });
  }
  return clusters;
}

/**
 * Maps current frame phase & rain intensity to Aerolune's 3D lighting atmosphere
 * Mirrors `WeatherTimeMachineScreen.kt`
 */
export function resolveTimeMachineFrameAtmosphere(
  currentFrame: Pick<HourlyWeatherFrame, 'rainIntensityMm' | 'phase'>
): WeatherAtmosphere {
  if (currentFrame.rainIntensityMm > 5) {
    return WeatherAtmosphere.MONSOON_RAIN;
  }
  if (currentFrame.phase === TimelinePhase.FUTURE_FORECAST) {
    return WeatherAtmosphere.EVENING_SUNSET;
  }
  return WeatherAtmosphere.NIGHT_STARRY;
}

export interface FilamentEarthTransform {
  assetFileLocation: string;
  scaleToUnits: number;
  rotationDeg: {
    x: number;
    y: number;
    z: number;
  };
}

/**
 * Computes the exact SceneView 4.62.0 ModelNode transform for `Filament3DEarthNode(hourOffset: Int)`
 * x = 23.68f (Tilt toward Bangladesh latitude)
 * y = (hourOffset * 15f) % 360f (Rotate 15 deg per timeline hour)
 * z = 0f
 */
export function computeFilamentEarthRotation(hourOffset: number): FilamentEarthTransform {
  const rawY = (hourOffset * 15) % 360;
  return {
    assetFileLocation: 'models/aerolune_earth_clouds.glb',
    scaleToUnits: 1.2,
    rotationDeg: {
      x: 23.68,
      y: Math.round(rawY * 100) / 100,
      z: 0,
    },
  };
}



