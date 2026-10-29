import React, { useEffect, useState } from 'react';
import { Code2, History, Sparkles, Sun } from 'lucide-react';
import { CityLocation, HourlyTimelinePoint, LanguageCode, TempUnit, WindUnit } from '../types/weather';
import {
  AEROLUNE_3D_BUTTON_KT_SOURCE,
  AEROLUNE_SKY_STATE_KT_SOURCE,
  ANIMATION_QUALITY_TIER_META,
  AeroluneButtonStyle,
  AnimationQualityTier,
  SKY_PHASE_META,
  SkyPhase,
  WEATHER_VISUAL_MODE_META,
  WeatherAtmosphere,
  WeatherVisualMode,
  computeAmbientLightingForPhase,
  cycleWeatherAtmosphere,
  getAtmosphereBackgroundGradient,
  mapAtmosphereToSkyPhaseAndMode,
} from '../utils/aerolune3DPalette';
import { formatTemp, formatWind, getCompassDirection } from '../utils/weatherPhysics';
import { Aerolune3DButton, LocalAeroluneSkyLighting } from './Aerolune3DButton';
import { Aerolune3DGlassCard } from './Aerolune3DGlassCard';
import { WeatherTimeMachineScreen } from './WeatherTimeMachineScreen';

export interface AeroluneShowcaseScreenProps {
  lang: LanguageCode;
  city: CityLocation;
  point: HourlyTimelinePoint;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  atmosphere: WeatherAtmosphere;
  isLowEndMode: boolean;
  onToggleLowEndMode: (enabled: boolean) => void;
  onChangeAtmosphere: (next: WeatherAtmosphere) => void;
  onAskCopilot: () => void;
  onLaunchTimeMachine: () => void;
}

/**
 * Interactive implementation of `com.aerolune.weather.ui.screens.AeroluneShowcaseScreen`,
 * `com.aerolune.app.presentation.designsystem.AeroluneSkyState`, and
 * `com.aerolune.weather.timemachine.WeatherTimeMachineScreen`
 */
export const AeroluneShowcaseScreen: React.FC<AeroluneShowcaseScreenProps> = ({
  lang,
  city,
  point,
  tempUnit,
  windUnit,
  atmosphere,
  isLowEndMode,
  onToggleLowEndMode,
  onChangeAtmosphere,
  onAskCopilot,
  onLaunchTimeMachine,
}) => {
  const initialMapped = mapAtmosphereToSkyPhaseAndMode(atmosphere);
  const [skyPhase, setSkyPhase] = useState<SkyPhase>(initialMapped.skyPhase);
  const [weatherMode, setWeatherMode] = useState<WeatherVisualMode>(initialMapped.weatherMode);
  const [qualityTier, setQualityTier] = useState<AnimationQualityTier>(
    isLowEndMode ? AnimationQualityTier.LOW_END_SAVER : AnimationQualityTier.ULTRA_3D
  );
  const [showSkyStateCode, setShowSkyStateCode] = useState(false);
  const [show3DButtonCode, setShow3DButtonCode] = useState(false);

  // Sync when top-level atmosphere or low-end mode changes externally
  useEffect(() => {
    const mapped = mapAtmosphereToSkyPhaseAndMode(atmosphere);
    setSkyPhase(mapped.skyPhase);
    setWeatherMode(mapped.weatherMode);
  }, [atmosphere]);

  useEffect(() => {
    setQualityTier(
      isLowEndMode ? AnimationQualityTier.LOW_END_SAVER : AnimationQualityTier.ULTRA_3D
    );
  }, [isLowEndMode]);

  const ambientSkyLighting = computeAmbientLightingForPhase(
    skyPhase,
    weatherMode,
    qualityTier
  );
  const tierMeta = ANIMATION_QUALITY_TIER_META[qualityTier];

  const backgroundGradient = getAtmosphereBackgroundGradient(atmosphere);
  const windCardinal = getCompassDirection(point.windDirectionDeg);
  const countryLabel =
    city.countryCode === 'BD'
      ? 'Bangladesh'
      : city.countryCode === 'GB'
        ? 'United Kingdom'
        : city.countryCode === 'JP'
          ? 'Japan'
          : city.districtEn;
  const pm25Value = Math.round(
    city.baseTelemetry.pm25 * (point.aqi / Math.max(1, city.baseTelemetry.aqi))
  );

  return (
    <LocalAeroluneSkyLighting.Provider value={ambientSkyLighting}>
      <section
        id="aerolune-showcase-screen"
        data-testid="aerolune-showcase-screen"
        aria-label="Aerolune 3D Design System & Weather Time Machine Showcase"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        {/* Left 6 Columns: Live Interactive AeroluneShowcaseScreen + AmbientSkyLighting Preview */}
        <div
          style={{ background: backgroundGradient }}
          className="lg:col-span-6 rounded-2xl border border-slate-700/80 p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4 transition-all duration-500"
        >
          {/* Header & Low-End Mode Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-200/90">
                com.aerolune.app.presentation.designsystem · AeroluneSkyState.kt
              </div>
              <h2 className="text-2xl font-display font-black tracking-wider text-white">
                AEROLUNE 3D
              </h2>
              <p className="text-sm text-white/80 font-medium">
                {lang === 'bn' ? `${city.nameBn}, বাংলাদেশ` : `${city.nameEn}, ${countryLabel}`} •{' '}
                {formatTemp(point.tempC, tempUnit)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="aerolune-sky-state-code-toggle"
                onClick={() => {
                  setShowSkyStateCode((prev) => !prev);
                  setShow3DButtonCode(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-colors ${
                  showSkyStateCode
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-semibold'
                    : 'bg-slate-950/55 text-cyan-200 border-white/20 hover:border-cyan-400'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>AeroluneSkyState.kt</span>
              </button>

              <button
                type="button"
                data-testid="aerolune-3d-button-code-toggle"
                onClick={() => {
                  setShow3DButtonCode((prev) => !prev);
                  setShowSkyStateCode(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-colors ${
                  show3DButtonCode
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-semibold'
                    : 'bg-slate-950/55 text-cyan-200 border-white/20 hover:border-cyan-400'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Aerolune3DButton.kt</span>
              </button>

              <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-950/45 border border-white/20 rounded-xl px-3 py-1.5">
                <span className="text-xs font-mono text-white/90">Low-End Mode</span>
                <input
                  type="checkbox"
                  data-testid="showcase-low-end-switch"
                  checked={qualityTier === AnimationQualityTier.LOW_END_SAVER}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setQualityTier(
                      checked ? AnimationQualityTier.LOW_END_SAVER : AnimationQualityTier.ULTRA_3D
                    );
                    onToggleLowEndMode(checked);
                  }}
                  className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {showSkyStateCode && (
            <pre
              data-testid="aerolune-sky-state-code"
              className="bg-slate-950/95 border border-slate-700 rounded-xl p-3.5 text-[11px] font-mono text-cyan-200 max-h-56 overflow-y-auto whitespace-pre leading-relaxed"
            >
              {AEROLUNE_SKY_STATE_KT_SOURCE}
            </pre>
          )}

          {show3DButtonCode && (
            <pre
              data-testid="aerolune-3d-button-code"
              className="bg-slate-950/95 border border-slate-700 rounded-xl p-3.5 text-[11px] font-mono text-cyan-200 max-h-56 overflow-y-auto whitespace-pre leading-relaxed"
            >
              {AEROLUNE_3D_BUTTON_KT_SOURCE}
            </pre>
          )}

          {/* AmbientSkyLighting & LocalAeroluneSkyLighting Live Controller */}
          <div
            data-testid="ambient-sky-lighting-controls"
            className="bg-slate-950/60 border border-white/15 rounded-xl p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-cyan-300 font-semibold">
                LocalAeroluneSkyLighting · Sun/Moon Offset({ambientSkyLighting.lightSourceNormalized.x}, {ambientSkyLighting.lightSourceNormalized.y})
              </span>
              <span
                data-testid="ambient-sky-lighting-summary"
                className="text-white/80"
              >
                Rim {ambientSkyLighting.specularRimColor} · Glass {ambientSkyLighting.surfaceGlassTint} · Particles {(tierMeta.particleMultiplier * 100).toFixed(0)}%
              </span>
            </div>

            {/* SkyPhase + WeatherVisualMode + AnimationQualityTier Selectors */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(SKY_PHASE_META) as SkyPhase[]).map((phase) => (
                <button
                  key={phase}
                  type="button"
                  data-testid={`sky-phase-chip-${phase}`}
                  onClick={() => setSkyPhase(phase)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                    skyPhase === phase
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                      : 'bg-slate-900/80 text-slate-200 border-white/15 hover:border-cyan-400'
                  }`}
                >
                  {SKY_PHASE_META[phase].labelBn}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(WEATHER_VISUAL_MODE_META) as WeatherVisualMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`weather-visual-mode-chip-${mode}`}
                    onClick={() => setWeatherMode(mode)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                      weatherMode === mode
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                        : 'bg-slate-900/80 text-slate-300 border-white/15 hover:border-amber-400'
                    }`}
                  >
                    {WEATHER_VISUAL_MODE_META[mode].labelBn}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(Object.keys(ANIMATION_QUALITY_TIER_META) as AnimationQualityTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    data-testid={`quality-tier-chip-${tier}`}
                    onClick={() => {
                      setQualityTier(tier);
                      onToggleLowEndMode(tier === AnimationQualityTier.LOW_END_SAVER);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      qualityTier === tier
                        ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                        : 'bg-slate-900/80 text-slate-300 border-white/15 hover:border-emerald-400'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 1. AI Forecast Explainer 3D Glass Card */}
          <Aerolune3DGlassCard atmosphere={atmosphere} isLowEndMode={!tierMeta.enableRealtimeShaders}>
            <div className="text-xs font-mono font-bold tracking-wider text-[#64FFDA]">
              AI FORECAST EXPLAINER
            </div>
            <p className="mt-1.5 text-sm sm:text-base font-medium text-white leading-relaxed">
              {lang === 'bn'
                ? `বিকেলের দিকে তাপমাত্রা ২°C কমতে পারে, তবে সন্ধ্যা ৬টার পর হালকা বৃষ্টির সম্ভাবনা (${point.rainProb}%) রয়েছে।`
                : `বিকেলের দিকে তাপমাত্রা ২°C কমতে পারে, তবে সন্ধ্যা ৬টার পর হালকা বৃষ্টির সম্ভাবনা (${point.rainProb}%) রয়েছে। (Afternoon temp may dip 2°C with ${point.rainProb}% rain probability in ${city.nameEn}.)`}
            </p>
            <div className="mt-2 text-[11px] font-mono text-white/70">
              Source: ECMWF + BMD Live Telemetry ({point.dataSource})
            </div>
          </Aerolune3DGlassCard>

          {/* 2. Environmental Telemetry Grid (AQI & Wind/UV) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Aerolune3DGlassCard atmosphere={atmosphere} isLowEndMode={!tierMeta.enableRealtimeShaders}>
              <div className="text-[11px] font-mono text-white/75">AIR QUALITY (AQI)</div>
              <div className="mt-1 text-2xl sm:text-3xl font-mono font-extrabold text-[#FFB74D]">
                {point.aqi}
              </div>
              <div className="mt-0.5 text-xs font-mono text-white/85">
                PM2.5: {pm25Value} µg/m³
              </div>
            </Aerolune3DGlassCard>

            <Aerolune3DGlassCard atmosphere={atmosphere} isLowEndMode={!tierMeta.enableRealtimeShaders}>
              <div className="text-[11px] font-mono text-white/75">WIND &amp; UV INDEX</div>
              <div className="mt-1 text-2xl sm:text-3xl font-mono font-extrabold text-[#38BDF8]">
                {formatWind(point.windSpeedKmh, windUnit)}
              </div>
              <div className="mt-0.5 text-xs font-mono text-white/85">
                Direction: {windCardinal} • UV: {point.uvIndex}
              </div>
            </Aerolune3DGlassCard>
          </div>

          {/* 3. 3D Spatial Buttons with AeroluneButtonStyle (SKY_ADAPTIVE, COPILOT_CYAN, FARMING_EMERALD, SEVERE_WARNING) */}
          <div className="space-y-2.5 pt-1">
            <Aerolune3DButton
              testId="showcase-copilot-3d-btn"
              fullWidth
              size="lg"
              text="Ask AI Weather Copilot"
              subtitle="SKY_ADAPTIVE · LocalAeroluneSkyLighting"
              badgeText="GEMINI LIVE"
              icon={<Sparkles className="w-4 h-4" />}
              extrusionDepth={7}
              cornerRadius={20}
              onClick={onAskCopilot}
            />

            <Aerolune3DButton
              testId="showcase-timemachine-3d-btn"
              fullWidth
              size="lg"
              buttonStyle={AeroluneButtonStyle.COPILOT_CYAN}
              text="Launch 3D Weather Time Machine"
              subtitle="COPILOT_CYAN · 24h Past & 24h Forecast"
              badgeText="24H REPLAY"
              icon={<History className="w-4 h-4" />}
              extrusionDepth={7}
              cornerRadius={20}
              onClick={onLaunchTimeMachine}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Aerolune3DButton
                testId="showcase-farming-3d-btn"
                fullWidth
                size="md"
                buttonStyle={AeroluneButtonStyle.FARMING_EMERALD}
                text="Smart Farming Mode"
                subtitle="FARMING_EMERALD"
                extrusionDepth={6}
                cornerRadius={16}
                onClick={onAskCopilot}
              />

              <Aerolune3DButton
                testId="showcase-cycle-atmosphere-3d-btn"
                fullWidth
                size="md"
                buttonStyle={AeroluneButtonStyle.SEVERE_WARNING}
                text={`Cycle (${atmosphere})`}
                subtitle="SEVERE_WARNING"
                icon={<Sun className="w-4 h-4" />}
                extrusionDepth={6}
                cornerRadius={16}
                onClick={() => onChangeAtmosphere(cycleWeatherAtmosphere(atmosphere))}
              />
            </div>
          </div>
        </div>

        {/* Right 6 Columns: Complete AI Weather Time Machine Screen (WeatherTimeMachineScreen.kt) */}
        <div className="lg:col-span-6">
          <WeatherTimeMachineScreen isLowEndMode={!tierMeta.enableRealtimeShaders} />
        </div>
      </section>
    </LocalAeroluneSkyLighting.Provider>
  );
};


