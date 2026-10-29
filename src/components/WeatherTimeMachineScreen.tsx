import React, { useEffect, useMemo, useState } from 'react';
import { Box, Code2, Globe2, Pause, Play, RotateCcw } from 'lucide-react';
import {
  TIMELINE_PHASE_META,
  TimeMachineSampleRepository,
  computeFilamentEarthRotation,
  resolveTimeMachineFrameAtmosphere,
} from '../utils/weatherTimeMachineModels';
import { Aerolune3DButton } from './Aerolune3DButton';
import { Aerolune3DGlassCard } from './Aerolune3DGlassCard';
import { Filament3DEarthNode } from './Filament3DEarthNode';
import { Interactive3DWeatherGlobe } from './Interactive3DWeatherGlobe';

export interface WeatherTimeMachineScreenProps {
  isLowEndMode?: boolean;
  externalSelectedIndex?: number;
}

/**
 * Complete AI Weather Time Machine Screen (`com.aerolune.weather.timemachine.WeatherTimeMachineScreen`)
 * Binds the 3D Weather Globe (Compose Canvas or SceneView 4.62+ PBR .glb `Filament3DEarthNode`),
 * the Color-Coded 24h Past / 24h Future Timeline Scrubber, the Source Attribution Badge,
 * and the reusable `Aerolune3DButton` and `Aerolune3DGlassCard` components.
 */
export const WeatherTimeMachineScreen: React.FC<WeatherTimeMachineScreenProps> = ({
  isLowEndMode = false,
}) => {
  const frames = useMemo(
    () => TimeMachineSampleRepository.generate48HourTimeline(),
    []
  );
  // Index 24 corresponds to hourOffset == 0 ("NOW")
  const [selectedIndex, setSelectedIndex] = useState<number>(24);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'canvas_globe' | 'filament_glb' | 'kotlin'>('canvas_globe');

  const currentFrame = frames[selectedIndex] || frames[24];
  const phaseMeta = TIMELINE_PHASE_META[currentFrame.phase];
  const filamentTransform = useMemo(
    () => computeFilamentEarthRotation(currentFrame.hourOffset),
    [currentFrame.hourOffset]
  );

  // Auto-Replay Loop: Advances hour-by-hour through the 48h window every 650ms when active
  useEffect(() => {
    if (!isPlayingReplay) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % frames.length);
    }, 650);
    return () => clearInterval(timer);
  }, [isPlayingReplay, frames.length]);

  // Map current frame phase to Aerolune's 3D lighting atmosphere
  const activeAtmosphere = useMemo(
    () => resolveTimeMachineFrameAtmosphere(currentFrame),
    [currentFrame]
  );

  return (
    <div
      data-testid="weather-time-machine-screen"
      style={{
        background: 'linear-gradient(180deg, #020617 0%, #0F172A 52%, #090D16 100%)',
      }}
      className="rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-2xl flex flex-col justify-between space-y-4"
    >
      {/* Top Mode Bar: Canvas Particle Globe vs SceneView 4.62 .glb vs Kotlin Source */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="text-[11px] font-mono text-cyan-400">
          WeatherTimeMachineScreen.kt · SceneView 4.62.0 Ready
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="wtm-mode-canvas"
            onClick={() => setViewMode('canvas_globe')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              viewMode === 'canvas_globe'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>3D Particle Globe</span>
          </button>
          <button
            type="button"
            data-testid="wtm-mode-filament"
            onClick={() => setViewMode('filament_glb')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              viewMode === 'filament_glb'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>SceneView .glb</span>
          </button>
          <button
            type="button"
            data-testid="wtm-mode-kotlin"
            onClick={() => setViewMode('kotlin')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              viewMode === 'kotlin'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Kotlin Source</span>
          </button>
        </div>
      </div>

      {viewMode !== 'kotlin' ? (
        <div className="flex flex-col justify-between space-y-4">
          {/* 1. Top HUD: Phase Indicator + Source Attribution Banner */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg sm:text-xl font-display font-black tracking-wider text-white">
                  AI WEATHER TIME MACHINE
                </h3>
                <p
                  style={{ color: phaseMeta.primaryColor }}
                  className="text-xs sm:text-sm font-semibold mt-0.5"
                >
                  {phaseMeta.labelBn}
                </p>
              </div>

              {/* Distinct Color Badge for Observed History vs Future Forecast */}
              <span
                data-testid="wtm-screen-phase-badge"
                style={{
                  backgroundColor: `${phaseMeta.primaryColor}2E`,
                  borderColor: phaseMeta.primaryColor,
                  color: phaseMeta.primaryColor,
                }}
                className="px-3 py-1 rounded-lg border text-[11px] font-mono font-extrabold tracking-wider"
              >
                {phaseMeta.badgeText}
              </span>
            </div>

            {/* Mandatory Telemetry Source Attribution Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/55 border border-white/15 px-3 py-2 text-xs">
              <span className="text-white/90 font-medium">
                উৎস (Source): {currentFrame.source.providerName}
              </span>
              <span
                style={{ color: phaseMeta.primaryColor }}
                className="font-mono font-bold"
              >
                {currentFrame.source.modelResolution}
              </span>
            </div>
          </div>

          {/* 2. Interactive 3D Weather Globe Viewport (Compose Canvas OR SceneView 4.62+ .glb ModelNode) */}
          {viewMode === 'filament_glb' ? (
            <Filament3DEarthNode
              currentFrame={currentFrame}
              isLowEndMode={isLowEndMode}
            />
          ) : (
            <Interactive3DWeatherGlobe
              currentFrame={currentFrame}
              isLowEndMode={isLowEndMode}
              className="h-[250px] sm:h-[270px]"
            />
          )}

          {/* 3. Bottom Control Deck: 3D Telemetry Card + Timeline Slider + 3D Replay Buttons */}
          <div className="space-y-3.5">
            <Aerolune3DGlassCard
              atmosphere={activeAtmosphere}
              isLowEndMode={isLowEndMode}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  data-testid="wtm-screen-display-time"
                  style={{ color: phaseMeta.primaryColor }}
                  className="text-base sm:text-lg font-mono font-extrabold"
                >
                  {currentFrame.displayTime}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-white">
                  {currentFrame.temperatureC.toFixed(1)}°C • মেঘ{' '}
                  {Math.round(currentFrame.cloudCoverFraction * 100)}% • বৃষ্টি{' '}
                  {currentFrame.rainIntensityMm.toFixed(1)} mm
                </span>
              </div>

              <p className="mt-2 text-xs sm:text-sm text-white/95 leading-relaxed">
                {currentFrame.aiInsightBn}
              </p>

              {/* SceneView ModelNode Rotation Readout */}
              <div className="mt-2 text-[11px] font-mono text-cyan-300/90">
                Filament3DEarthNode({currentFrame.hourOffset}) → Float3(x=
                {filamentTransform.rotationDeg.x}f, y={filamentTransform.rotationDeg.y}f, z=0f)
              </div>

              {/* Dual-Color Timeline Scrubber (-24h Past to +24h Forecast, 49 frames) */}
              <div className="mt-2.5 space-y-1.5">
                <label htmlFor="wtm-screen-slider" className="sr-only">
                  48-Hour Weather Time Machine Scrubber
                </label>
                <input
                  id="wtm-screen-slider"
                  data-testid="wtm-screen-slider"
                  type="range"
                  min={0}
                  max={frames.length - 1}
                  step={1}
                  value={selectedIndex}
                  onChange={(e) => {
                    setIsPlayingReplay(false);
                    setSelectedIndex(Number(e.target.value));
                  }}
                  style={{ accentColor: phaseMeta.primaryColor }}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/20"
                />

                {/* Legend Row under Slider */}
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span style={{ color: '#00E5FF' }}>-২৪ ঘণ্টা (Observed)</span>
                  <span style={{ color: '#64FFDA' }} className="font-bold">
                    এখন (LIVE)
                  </span>
                  <span style={{ color: '#FF9100' }}>+২৪ ঘণ্টা (Forecast)</span>
                </div>
              </div>
            </Aerolune3DGlassCard>

            {/* Reusable 3D Action Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <Aerolune3DButton
                  fullWidth
                  size="lg"
                  text={isPlayingReplay ? 'Pause Replay' : '24h Auto Replay'}
                  badgeText={isPlayingReplay ? 'PLAYING' : '3D SIM'}
                  icon={
                    isPlayingReplay ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )
                  }
                  atmosphere={activeAtmosphere}
                  isLowEndMode={isLowEndMode}
                  onClick={() => setIsPlayingReplay((prev) => !prev)}
                />
              </div>

              <div className="sm:col-span-5">
                <Aerolune3DButton
                  fullWidth
                  size="lg"
                  text="Jump to Now"
                  icon={<RotateCcw className="w-4 h-4" />}
                  atmosphere={activeAtmosphere}
                  isLowEndMode={isLowEndMode}
                  onClick={() => {
                    setIsPlayingReplay(false);
                    setSelectedIndex(24); // Reset to 0h LIVE
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[540px] overflow-y-auto leading-relaxed">
{`// In app/build.gradle.kts:
// implementation("io.github.sceneview:sceneview:4.62.0")

@Composable
fun Filament3DEarthNode(hourOffset: Int) {
    val engine = io.github.sceneview.rememberEngine()
    val modelLoader = io.github.sceneview.rememberModelLoader(engine)

    io.github.sceneview.SceneView(
        modifier = Modifier.fillMaxSize(),
        engine = engine,
        modelLoader = modelLoader
    ) {
        io.github.sceneview.rememberModelInstance(
            modelLoader = modelLoader,
            assetFileLocation = "models/aerolune_earth_clouds.glb"
        )?.let { modelInstance ->
            io.github.sceneview.node.ModelNode(
                modelInstance = modelInstance,
                scaleToUnits = 1.2f,
                rotation = dev.romainguy.kotlin.math.Float3(
                    x = 23.68f, // Tilt toward Bangladesh latitude
                    y = (hourOffset * 15f) % 360f, // Rotate with timeline hour
                    z = 0f
                )
            )
        }
    }
}

@Composable
fun WeatherTimeMachineScreen(isLowEndMode: Boolean = false) {
    val frames = remember { TimeMachineSampleRepository.generate48HourTimeline() }
    var selectedIndex by remember { mutableIntStateOf(24) } // 0h LIVE
    var isPlayingReplay by remember { mutableStateOf(false) }
    val currentFrame = frames[selectedIndex]

    Box(modifier = Modifier.fillMaxSize()) {
        // Swap Interactive3DWeatherGlobe or Filament3DEarthNode(currentFrame.hourOffset)
        Filament3DEarthNode(hourOffset = currentFrame.hourOffset)
    }
}`}
        </pre>
      )}
    </div>
  );
};

