import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Globe,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  HourlyTimelinePoint,
  LanguageCode,
  TempUnit,
  Viewport3DMode,
  WindUnit,
} from '../types/weather';
import { formatTemp, formatWind } from '../utils/weatherPhysics';
import {
  TIMELINE_PHASE_META,
  resolveTimelineFrameFromPoint,
} from '../utils/weatherTimeMachineModels';
import { Aerolune3DButton } from './Aerolune3DButton';

interface TimeMachineDockProps {
  lang: LanguageCode;
  mode: Viewport3DMode;
  onModeChange: (m: Viewport3DMode) => void;
  timeline: HourlyTimelinePoint[];
  selectedOffset: number;
  onOffsetChange: (offset: number) => void;
  isPlayingTimeline: boolean;
  onTogglePlayTimeline: () => void;
  currentPoint: HourlyTimelinePoint;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  soundEnabled: boolean;
  soundVolume: number;
  onToggleSound: () => void;
  onSoundVolumeChange: (v: number) => void;
  onTriggerThunder: () => void;
  isLowEndMode: boolean;
  storyStep: number;
  onStoryStepChange: (step: number) => void;
}

export const TimeMachineDock: React.FC<TimeMachineDockProps> = ({
  lang,
  mode,
  onModeChange,
  selectedOffset,
  onOffsetChange,
  isPlayingTimeline,
  onTogglePlayTimeline,
  currentPoint,
  tempUnit,
  windUnit,
  isCollapsed,
  onToggleCollapse,
  soundEnabled,
  soundVolume,
  onToggleSound,
  onSoundVolumeChange,
  onTriggerThunder,
  isLowEndMode,
  storyStep,
  onStoryStepChange,
}) => {
  const frameMeta = resolveTimelineFrameFromPoint(currentPoint);
  const phaseConfig = TIMELINE_PHASE_META[frameMeta.phase];

  const formatOffsetLabel = (offset: number) => {
    if (offset === 0) return lang === 'bn' ? 'এখন (LIVE 0h)' : 'LIVE NOW (0h)';
    if (offset < 0) {
      return lang === 'bn' ? `অতীত ${offset} ঘণ্টা` : `Observed ${offset}h`;
    }
    return lang === 'bn' ? `পূর্বাভাস +${offset} ঘণ্টা` : `Forecast +${offset}h`;
  };

  const storyTitles =
    lang === 'bn'
      ? [
          '১. বঙ্গোপসাগর থেকে জলীয় বাষ্পের আগমন',
          '২. শহরের ওপর কিউমুলোনিম্বাস মেঘের ঘনীভবন',
          '৩. দমকা বাতাস ও বৃষ্টির ধারা নামা',
          '৪. মেঘ সরে গিয়ে নির্মল বায়ু ও তাপমাত্রা হ্রাস',
        ]
      : [
          '1. Bay of Bengal Moisture Advection',
          '2. Urban Cumulonimbus Tower Convergence',
          '3. Convective Downpour & Gust Front',
          '4. Post-Rain Clearing & Thermal Relief',
        ];

  return (
    <div
      data-testid="time-machine-dock"
      className="w-full max-w-[940px] mx-auto px-3 sm:px-4 z-20 pointer-events-auto"
    >
      {/* Top Collapse / Expand Tab (Cinema / Zen Mode Drawer) */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Show 3D Controls' : 'Hide 3D Controls'}
          className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-mono text-slate-300 bg-[#0B0E17] border border-b-0 border-slate-800 rounded-t-lg hover:text-cyan-300 hover:border-cyan-500/40 transition-colors whitespace-nowrap shrink-0"
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />}
          <span>
            {isCollapsed
              ? lang === 'bn'
                ? '▴ কন্ট্রোল ডক দেখান (H)'
                : '▴ Show Time Machine & 3D Dock (H)'
              : lang === 'bn'
                ? '▾ সিনেমা ভিউ / কন্ট্রোল লুকান (H)'
                : '▾ Hide Controls / Zen Mode (H)'}
          </span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="bg-[#0B0E17]/95 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-2xl space-y-3">
          {/* Row 1: 3D Scene Mode Switcher + TimelinePhase Badge & Mandatory TelemetrySource Attribution */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="3D Viewport Mode">
              <Aerolune3DButton
                size="sm"
                active={mode === 'city'}
                accentColor="cyan"
                isLowEndMode={isLowEndMode}
                icon={<Compass className="w-3.5 h-3.5" />}
                text={lang === 'bn' ? 'লিভিং সিটি 3D' : 'Living City 3D'}
                onClick={() => onModeChange('city')}
              />
              <Aerolune3DButton
                size="sm"
                active={mode === 'globe'}
                accentColor="cyan"
                isLowEndMode={isLowEndMode}
                icon={<Globe className="w-3.5 h-3.5" />}
                text={lang === 'bn' ? '3D আর্থ গ্লোব' : '3D Weather Globe'}
                onClick={() => onModeChange('globe')}
              />
              <Aerolune3DButton
                size="sm"
                active={mode === 'radar'}
                accentColor="cyan"
                isLowEndMode={isLowEndMode}
                icon={<Layers className="w-3.5 h-3.5" />}
                text={lang === 'bn' ? 'ওয়ার্ড রেইন রাডার' : 'Ward 3D Radar'}
                onClick={() => onModeChange('radar')}
              />
              <Aerolune3DButton
                size="sm"
                active={mode === 'story'}
                accentColor="amber"
                isLowEndMode={isLowEndMode}
                icon={<Sparkles className="w-3.5 h-3.5" />}
                text={lang === 'bn' ? '3D ওয়েদার স্টোরি' : '3D Weather Story'}
                onClick={() => onModeChange('story')}
              />
            </div>

            {/* TimelinePhase Badge (OBSERVED HISTORY / LIVE TELEMETRY / AI + NWP FORECAST) + Source */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span
                data-testid="time-machine-state-label"
                style={{
                  color: phaseConfig.primaryColor,
                  borderColor: `${phaseConfig.primaryColor}66`,
                  backgroundColor: `${phaseConfig.secondaryColor}18`,
                }}
                className="px-2 py-0.5 rounded border font-bold tracking-wide"
              >
                {phaseConfig.badgeText}
              </span>
              <span
                data-testid="time-machine-source"
                className="text-slate-300"
                title={`${frameMeta.source.modelResolution} · ${frameMeta.source.lastIngestedTimestamp}`}
              >
                {frameMeta.source.providerName} ({frameMeta.source.modelResolution})
              </span>
            </div>
          </div>

          {/* Conditional Row for 3D Weather Story Generator Stage Controls */}
          {mode === 'story' && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-amber-500/30 rounded-lg px-3 py-2">
              <div className="text-xs text-amber-200 font-medium">
                {storyTitles[storyStep % 4]}
              </div>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onStoryStepChange(idx)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      storyStep === idx
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Stage {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Flagship AI Weather Time Machine Scrubber (-24h Past to +72h Future) */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTogglePlayTimeline}
                  aria-label={isPlayingTimeline ? 'Pause Time Machine' : 'Play Time Machine'}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
                >
                  {isPlayingTimeline ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingTimeline ? (lang === 'bn' ? 'বিরতি' : 'Pause') : (lang === 'bn' ? 'টাইম মেশিন চালু' : 'Play Replay')}</span>
                </button>
                {selectedOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => onOffsetChange(0)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'লাইভে ফিরুন' : 'Reset to Live'}</span>
                  </button>
                )}
                <span className="font-mono font-semibold text-white">
                  {formatOffsetLabel(selectedOffset)} ({String(currentPoint.localHour).padStart(2, '0')}:00 BST)
                </span>
                <span
                  className="hidden sm:inline text-[11px] font-mono"
                  style={{ color: phaseConfig.primaryColor }}
                >
                  · {phaseConfig.labelBn}
                </span>
              </div>

              {/* Instant Telemetry Readout at Scrubbed Timestamp */}
              <div className="flex items-center gap-3 font-mono text-xs text-slate-300">
                <span>{formatTemp(currentPoint.tempC, tempUnit)}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-cyan-300">
                  <CloudRain className="w-3.5 h-3.5" />
                  {currentPoint.rainProb}% ({currentPoint.precipMm}mm)
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatWind(currentPoint.windSpeedKmh, windUnit)}</span>
              </div>
            </div>

            <div className="relative pt-1">
              <label htmlFor="time-machine-slider" className="sr-only">
                AI Weather Time Machine Timeline Offset Hours
              </label>
              <input
                id="time-machine-slider"
                type="range"
                min={-24}
                max={72}
                step={1}
                value={selectedOffset}
                onChange={(e) => onOffsetChange(Number(e.target.value))}
                style={{ accentColor: phaseConfig.primaryColor }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-800"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                <span style={{ color: '#00E5FF' }}>-24h Observed</span>
                <span style={{ color: '#00BFA5' }}>-12h</span>
                <span style={{ color: '#64FFDA' }} className="font-semibold">
                  LIVE (0h)
                </span>
                <span style={{ color: '#FF9100' }}>+24h Forecast</span>
                <span style={{ color: '#FF9100' }}>+48h</span>
                <span style={{ color: '#D500F9' }}>+72h Outlook</span>
              </div>
            </div>

            {/* Grounded Bengali Frame Insight & Last Ingested Timestamp */}
            <div
              data-testid="time-machine-frame-insight"
              className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-900/75 border border-slate-800/90 rounded-lg px-3 py-1.5 text-slate-200"
            >
              <span>{frameMeta.aiInsightBn}</span>
              <span className="font-mono text-slate-400 shrink-0">
                {frameMeta.source.lastIngestedTimestamp}
              </span>
            </div>
          </div>

          {/* Row 3: Spatial Weather Soundscape Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleSound}
                aria-pressed={soundEnabled}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  soundEnabled
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                <span>
                  {soundEnabled
                    ? lang === 'bn'
                      ? 'স্পেশিয়াল অডিও সক্রিয়'
                      : 'Spatial Soundscape Active'
                    : lang === 'bn'
                      ? 'আবহাওয়া সাউন্ডস্কেপ চালু করুন'
                      : 'Enable Weather Soundscape'}
                </span>
              </button>

              {soundEnabled && (
                <>
                  <label htmlFor="soundscape-volume" className="text-slate-400 font-mono">
                    Vol
                  </label>
                  <input
                    id="soundscape-volume"
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={soundVolume}
                    onChange={(e) => onSoundVolumeChange(Number(e.target.value))}
                    className="w-20 h-1.5 bg-slate-800 accent-emerald-400 rounded cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={onTriggerThunder}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 font-mono whitespace-nowrap shrink-0"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'বজ্রধ্বনি' : 'Thunder Test'}</span>
                  </button>
                </>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {lang === 'bn'
                ? 'মাউস ড্র্যাগ করে ৩ডি দৃশ্য ঘোরান · জুম করতে স্ক্রল করুন'
                : 'Drag to orbit 3D world · Scroll to zoom'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
