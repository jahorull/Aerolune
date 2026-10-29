export type LanguageCode = 'en' | 'bn';
export type TempUnit = 'C' | 'F';
export type WindUnit = 'kmh' | 'mph';
export type GraphicsQuality = 'high' | 'medium' | 'low';
export type AstronomicalPhase = 'dawn' | 'noon' | 'evening' | 'night';
export type Viewport3DMode = 'globe' | 'city' | 'story' | 'radar';

export interface MicroclimateWard {
  id: string;
  nameEn: string;
  nameBn: string;
  tempDeltaC: number;
  rainProbDelta: number;
  aqiDelta: number;
  humidityDelta: number;
  urbanHeatFactor: 'High Urban Canopy' | 'Riverfront Breeze' | 'Green Belt' | 'Industrial Corridor' | 'Coastal Marine';
  stationCode: string;
}

export interface OfficialWeatherAlert {
  id: string;
  agency: string; // e.g. "BMD (Bangladesh Meteorological Dept)" | "GDACS / WMO"
  severity: 'Advisory' | 'Watch' | 'Warning' | 'Critical';
  titleEn: string;
  titleBn: string;
  areasEn: string;
  areasBn: string;
  whyIssuedEn: string;
  whyIssuedBn: string;
  safetyStepsEn: string[];
  safetyStepsBn: string[];
  issuedAtIso: string;
  validUntilIso: string;
}

export interface ModelComparisonPoint {
  hourOffset: number;
  label: string;
  ecmwfTempC: number;
  gfsTempC: number;
  iconTempC: number;
  ecmwfRainProb: number;
  gfsRainProb: number;
  iconRainProb: number;
}

export interface HourlyTimelinePoint {
  hourOffset: number; // -24 to +72
  timestampIso: string;
  localHour: number; // 0-23
  isHistorical: boolean; // true if hourOffset <= 0
  dataSource: 'BMD Synoptic + Open-Meteo Archive' | 'ECMWF IFS 0.25°' | 'NOAA GFS 0.25°' | 'DWD ICON Global';
  tempC: number;
  feelsLikeC: number;
  rainProb: number;
  precipMm: number;
  cloudCover: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidity: number;
  uvIndex: number;
  aqi: number;
  pressureHpa: number;
  conditionCode: 'clear' | 'partly-cloudy' | 'overcast' | 'rain' | 'thunderstorm' | 'fog';
}

export interface CityLocation {
  id: string;
  nameEn: string;
  nameBn: string;
  districtEn: string;
  districtBn: string;
  countryEn: string;
  countryBn: string;
  lat: number;
  lon: number;
  timezoneOffsetHours: number;
  elevationM: number;
  isBangladesh: boolean;
  pollenTelemetrySupported: boolean;
  primaryCropsEn: string[];
  primaryCropsBn: string[];
  wards: MicroclimateWard[];
  baseTelemetry: {
    tempC: number;
    feelsLikeC: number;
    highC: number;
    lowC: number;
    humidity: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    uvIndex: number;
    visibilityKm: number;
    pressureHpa: number;
    cloudCover: number;
    rainProb: number;
    precipMm: number;
    dewPointC: number;
    sunriseHour: number; // e.g., 5.75 (05:45)
    sunsetHour: number;  // e.g., 17.5 (17:30)
    aqi: number;
    pm25: number;
    pm10: number;
    no2: number;
    o3: number;
    pollenIndex: number | null; // null when unsupported in region (strictly enforced)
    conditionCode: 'clear' | 'partly-cloudy' | 'overcast' | 'rain' | 'thunderstorm' | 'fog';
    historicalAvgTempC: number;
    historicalAvgRainMm: number;
  };
  officialAlerts: OfficialWeatherAlert[];
}

export interface WhatIfModifiers {
  tempDeltaC: number; // -10 to +15
  windMultiplier: number; // 0.2 to 3.5
  cloudOverride: number | null; // 0 to 100 or null
  rainOverride: number | null; // 0 to 100 or null
  activePromptText: string;
}

export interface ActivityImpactScore {
  id: 'video_shoot' | 'laundry' | 'agriculture' | 'solar';
  titleEn: string;
  titleBn: string;
  score: number; // 0 - 100
  statusEn: 'Optimal' | 'Moderate' | 'Caution' | 'Unfavorable';
  statusBn: string;
  metricLabelEn: string;
  metricLabelBn: string;
  reasoningEn: string;
  reasoningBn: string;
}

export interface AlertRule {
  id: string;
  metric: 'rainProb' | 'aqi' | 'tempC' | 'windSpeedKmh' | 'uvIndex';
  operator: '>' | '<';
  threshold: number;
  enabled: boolean;
  labelEn: string;
  labelBn: string;
}

export interface WeatherJournalEntry {
  id: string;
  dateIso: string;
  cityId: string;
  cityNameEn: string;
  cityNameBn: string;
  tempC: number;
  conditionCode: string;
  aqi: number;
  note: string;
  moodTag: 'Serene' | 'Monsoon Drama' | 'Golden Hour' | 'Heatwave' | 'Breezy';
  skySnapshotDataUrl?: string;
}

export type AIModuleId =
  | 'copilot'
  | 'daily_advisor'
  | 'forecast_explainer'
  | 'risk_explainer'
  | 'confidence_analyzer'
  | 'smart_farming'
  | 'heat_safety'
  | 'allergy_aqi'
  | 'climate_history'
  | 'weather_twin'
  | 'impact_simulator'
  | 'sky_vision'
  | 'weather_journal'
  | 'story_generator'
  | 'kotlin_blueprint';
