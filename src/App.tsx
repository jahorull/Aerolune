import React, { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  Globe2,
  LocateFixed,
  Moon,
  Search,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Wifi,
} from 'lucide-react';
import { CITIES_DATABASE } from './data/locations';
import {
  AlertRule,
  AstronomicalPhase,
  CityLocation,
  GraphicsQuality,
  LanguageCode,
  TempUnit,
  Viewport3DMode,
  WeatherJournalEntry,
  WhatIfModifiers,
  WindUnit,
} from './types/weather';
import {
  applyWhatIfModifiers,
  buildHourlyTimeline,
  formatTemp,
  formatWind,
  getAstronomicalPhase,
} from './utils/weatherPhysics';
import { weatherSoundscape } from './utils/spatialAudio';
import { Aerolune3DButton } from './components/Aerolune3DButton';
import { Aerolune3DViewport } from './components/Aerolune3DViewport';
import { TimeMachineDock } from './components/TimeMachineDock';
import { TelemetryAndMicroclimatePanel } from './components/TelemetryAndMicroclimatePanel';
import { GeminiAIEcosystemHub } from './components/GeminiAIEcosystemHub';
import { AeroluneShowcaseScreen } from './components/AeroluneShowcaseScreen';
import {
  Aerolune3DColors,
  WeatherAtmosphere,
  resolveWeatherAtmosphere,
} from './utils/aerolune3DPalette';

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule-rain-70',
    metric: 'rainProb',
    operator: '>',
    threshold: 70,
    enabled: true,
    labelEn: 'Notify if Rain Probability > 70%',
    labelBn: 'বৃষ্টির সম্ভাবনা ৭০% ছাড়িয়ে গেলে জানান',
  },
  {
    id: 'rule-aqi-150',
    metric: 'aqi',
    operator: '>',
    threshold: 150,
    enabled: true,
    labelEn: 'Notify if Air Quality Index (AQI) > 150',
    labelBn: 'একিউআই (AQI) ১৫০ ছাড়িয়ে গেলে সতর্ক করুন',
  },
  {
    id: 'rule-temp-35',
    metric: 'tempC',
    operator: '>',
    threshold: 35,
    enabled: true,
    labelEn: 'Notify if Temperature > 35°C',
    labelBn: 'তাপমাত্রা ৩৫°C ছাড়িয়ে গেলে জানান',
  },
];

const DEFAULT_JOURNAL_ENTRIES: WeatherJournalEntry[] = [
  {
    id: 'j-1',
    dateIso: '2026-10-28',
    cityId: 'dhaka',
    cityNameEn: 'Dhaka',
    cityNameBn: 'ঢাকা',
    tempC: 31.0,
    conditionCode: 'rain',
    aqi: 142,
    note: 'Late afternoon monsoon shower cooled Dhanmondi Lake promenade; dramatic cumulonimbus clouds.',
    moodTag: 'Monsoon Drama',
  },
  {
    id: 'j-2',
    dateIso: '2026-10-25',
    cityId: 'faridpur',
    cityNameEn: 'Faridpur',
    cityNameBn: 'ফরিদপুর',
    tempC: 29.8,
    conditionCode: 'partly-cloudy',
    aqi: 88,
    note: 'Crisp Padma river breeze at Charbhadrasan; farmers preparing winter onion seedbeds.',
    moodTag: 'Golden Hour',
  },
];

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('en');
  const [selectedCityId, setSelectedCityId] = useState<string>('dhaka');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tempUnit, setTempUnit] = useState<TempUnit>('C');
  const [windUnit, setWindUnit] = useState<WindUnit>('kmh');
  const [viewportMode, setViewportMode] = useState<Viewport3DMode>('city');
  const [timelineOffset, setTimelineOffset] = useState<number>(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [storyStep, setStoryStep] = useState<number>(0);

  // Graphics & Low-End Device Mode
  const [quality, setQuality] = useState<GraphicsQuality>('high');
  const [isLowEndMode, setIsLowEndMode] = useState<boolean>(false);
  const [forcedPhase, setForcedPhase] = useState<AstronomicalPhase | 'auto'>('auto');
  const [forcedAtmosphere, setForcedAtmosphere] = useState<WeatherAtmosphere | 'auto'>('auto');

  // Spatial Audio Soundscape
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [soundVolume, setSoundVolume] = useState<number>(0.45);

  // Live Open-Meteo telemetry sync status
  const [cities, setCities] = useState<CityLocation[]>(CITIES_DATABASE);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string>('BMD + Open-Meteo Cached Sync');

  // What-If Weather Lab Modifiers
  const [whatIf, setWhatIf] = useState<WhatIfModifiers>({
    tempDeltaC: 0,
    windMultiplier: 1,
    cloudOverride: null,
    rainOverride: null,
    activePromptText: '',
  });

  // Persistent Personal Alert Rules & Weather Journal
  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => {
    try {
      const saved = localStorage.getItem('aerolune_alert_rules');
      return saved ? JSON.parse(saved) : DEFAULT_ALERT_RULES;
    } catch {
      return DEFAULT_ALERT_RULES;
    }
  });

  const [journalEntries, setJournalEntries] = useState<WeatherJournalEntry[]>(() => {
    try {
      const saved = localStorage.getItem('aerolune_journal_entries');
      return saved ? JSON.parse(saved) : DEFAULT_JOURNAL_ENTRIES;
    } catch {
      return DEFAULT_JOURNAL_ENTRIES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('aerolune_alert_rules', JSON.stringify(alertRules));
    } catch {
      // Ignore storage quota errors
    }
  }, [alertRules]);

  useEffect(() => {
    try {
      localStorage.setItem('aerolune_journal_entries', JSON.stringify(journalEntries));
    } catch {
      // Ignore storage quota errors
    }
  }, [journalEntries]);

  const activeCity = useMemo(
    () => cities.find((c) => c.id === selectedCityId) || cities[0],
    [cities, selectedCityId]
  );

  const [selectedWardId, setSelectedWardId] = useState<string>(activeCity.wards[0]?.id || 'mirpur');

  useEffect(() => {
    if (activeCity.wards.length > 0) {
      setSelectedWardId(activeCity.wards[0].id);
    }
  }, [activeCity]);

  // Optional non-blocking live Open-Meteo telemetry enrichment
  useEffect(() => {
    let cancelled = false;
    async function fetchLiveOpenMeteo() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${activeCity.lat}&longitude=${activeCity.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&timezone=auto`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled || !data?.current) return;

        setCities((prev) =>
          prev.map((c) =>
            c.id === activeCity.id
              ? {
                  ...c,
                  baseTelemetry: {
                    ...c.baseTelemetry,
                    tempC: typeof data.current.temperature_2m === 'number' ? data.current.temperature_2m : c.baseTelemetry.tempC,
                    feelsLikeC: typeof data.current.apparent_temperature === 'number' ? data.current.apparent_temperature : c.baseTelemetry.feelsLikeC,
                    humidity: typeof data.current.relative_humidity_2m === 'number' ? data.current.relative_humidity_2m : c.baseTelemetry.humidity,
                    cloudCover: typeof data.current.cloud_cover === 'number' ? data.current.cloud_cover : c.baseTelemetry.cloudCover,
                    windSpeedKmh: typeof data.current.wind_speed_10m === 'number' ? data.current.wind_speed_10m : c.baseTelemetry.windSpeedKmh,
                    windDirectionDeg: typeof data.current.wind_direction_10m === 'number' ? data.current.wind_direction_10m : c.baseTelemetry.windDirectionDeg,
                    pressureHpa: typeof data.current.surface_pressure === 'number' ? data.current.surface_pressure : c.baseTelemetry.pressureHpa,
                  },
                }
              : c
          )
        );
        setLastSyncedLabel('Live Open-Meteo + BMD Synoptic Stream');
      } catch {
        // Offline-first fallback already active
      }
    }
    fetchLiveOpenMeteo();
    return () => {
      cancelled = true;
    };
  }, [activeCity.id, activeCity.lat, activeCity.lon]);

  // Build 97-hour Time Machine series (-24h Observed to +72h Forecast)
  const timeline = useMemo(() => buildHourlyTimeline(activeCity, 'Auto', 14), [activeCity]);

  const rawTimelinePoint = useMemo(
    () => timeline.find((p) => p.hourOffset === timelineOffset) || timeline[24],
    [timeline, timelineOffset]
  );

  // Apply AI What-If Weather Lab physics modifiers
  const activePoint = useMemo(
    () => applyWhatIfModifiers(rawTimelinePoint, whatIf),
    [rawTimelinePoint, whatIf]
  );

  const astronomicalPhase: AstronomicalPhase = useMemo(() => {
    if (forcedPhase !== 'auto') return forcedPhase;
    return getAstronomicalPhase(
      activePoint.localHour,
      activeCity.baseTelemetry.sunriseHour,
      activeCity.baseTelemetry.sunsetHour
    );
  }, [forcedPhase, activePoint.localHour, activeCity]);

  const activeAtmosphere: WeatherAtmosphere = useMemo(() => {
    if (forcedAtmosphere !== 'auto') return forcedAtmosphere;
    return resolveWeatherAtmosphere(astronomicalPhase, activePoint);
  }, [forcedAtmosphere, astronomicalPhase, activePoint]);

  const activePalette = useMemo(
    () => Aerolune3DColors.getPalette(activeAtmosphere),
    [activeAtmosphere]
  );

  // Keyboard shortcut 'H' for Zen / Cinema Mode Dock Collapse
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Time Machine Auto-Play Loop
  useEffect(() => {
    if (!isPlayingTimeline) return;
    const timer = window.setInterval(() => {
      setTimelineOffset((prev) => (prev >= 72 ? -24 : prev + 3));
    }, 900);
    return () => clearInterval(timer);
  }, [isPlayingTimeline]);

  // Sync Spatial Weather Soundscape when telemetry or phase changes
  useEffect(() => {
    if (soundEnabled) {
      weatherSoundscape.updateTelemetry(activePoint, astronomicalPhase, soundVolume);
    }
  }, [soundEnabled, activePoint, astronomicalPhase, soundVolume]);

  const handleToggleSound = () => {
    if (soundEnabled) {
      weatherSoundscape.stop();
      setSoundEnabled(false);
    } else {
      weatherSoundscape.start(activePoint, astronomicalPhase, soundVolume);
      setSoundEnabled(true);
    }
  };

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.nameEn.toLowerCase().includes(q) ||
        c.nameBn.includes(q) ||
        c.districtEn.toLowerCase().includes(q) ||
        c.wards.some((w) => w.nameEn.toLowerCase().includes(q) || w.nameBn.includes(q))
    );
  }, [cities, searchQuery]);

  const phaseGradientClasses: Record<AstronomicalPhase, string> = {
    dawn: 'from-indigo-950/80 via-amber-950/30 to-[#07090E]',
    noon: 'from-sky-950/70 via-slate-900/50 to-[#07090E]',
    evening: 'from-purple-950/80 via-orange-950/35 to-[#07090E]',
    night: 'from-[#07090E] via-[#0B0E17] to-[#07090E]',
  };

  return (
    <div
      data-phase={astronomicalPhase}
      data-atmosphere={activeAtmosphere}
      className={`min-h-screen bg-gradient-to-b ${phaseGradientClasses[astronomicalPhase]} text-slate-100 flex flex-col`}
    >
      {/* Top Navigation Bar (Strict 3-Zone Top Bar Contract per frontend-design skill) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-[#07090E]/95 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-xl font-display font-bold tracking-wider text-white whitespace-nowrap shrink-0"
        >
          AEROLUNE
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <a
            href="#viewport-stage"
            className="hover:text-cyan-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'bn' ? '৩ডি আবহাওয়া বিশ্ব' : '3D Worlds'}
          </a>
          <a
            href="#telemetry-section"
            className="hover:text-cyan-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'bn' ? 'টেলিমেট্রি ও ওয়ার্ড' : 'Telemetry'}
          </a>
          <a
            href="#ai-ecosystem"
            className="hover:text-cyan-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'bn' ? 'জেমিনি এআই হাব' : 'Gemini AI'}
          </a>
          <a
            href="#personalization-bar"
            className="hover:text-cyan-400 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'bn' ? 'পারফরম্যান্স ও ইউনিট' : 'Settings'}
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action (Bilingual Toggle EN / বাংলা) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            data-testid="language-toggle-btn"
            onClick={() => setLang((prev) => (prev === 'en' ? 'bn' : 'en'))}
            className="px-4 py-2 text-xs font-mono font-semibold text-slate-950 bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'en' ? 'বাংলা সংস্করণ (BN)' : 'English Version (EN)'}
          </button>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-8">
        {/* Workspace Calibration & City/Upazila Search Bar */}
        <section
          id="personalization-bar"
          aria-label="City Search, Astronomical Phase & Performance Controls"
          className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4"
        >
          {/* City & Upazila Quick Selectors + Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="city-search-input" className="sr-only">
                Search City, District, or Upazila
              </label>
              <input
                id="city-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'শহর বা উপজেলা খুঁজুন (ঢাকা, ফরিদপুর, সিলেট)...'
                    : 'Search city / upazila (Dhaka, Faridpur, Sylhet)...'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select City">
              {filteredCities.map((c) => (
                <Aerolune3DButton
                  key={c.id}
                  size="sm"
                  active={c.id === activeCity.id}
                  atmosphere={activeAtmosphere}
                  isLowEndMode={isLowEndMode}
                  text={lang === 'bn' ? c.nameBn : c.nameEn}
                  onClick={() => {
                    setSelectedCityId(c.id);
                    setTimelineOffset(0);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Units, Astronomical Day/Night Cycle & Graphics Scaling */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Temperature Unit Toggle */}
            <button
              type="button"
              data-testid="temp-unit-toggle"
              onClick={() => setTempUnit((u) => (u === 'C' ? 'F' : 'C'))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-400 whitespace-nowrap shrink-0"
            >
              °{tempUnit} ({tempUnit === 'C' ? 'Metric' : 'Imperial'})
            </button>

            {/* Wind Unit Toggle */}
            <button
              type="button"
              onClick={() => setWindUnit((w) => (w === 'kmh' ? 'mph' : 'kmh'))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-400 whitespace-nowrap shrink-0"
            >
              {windUnit === 'kmh' ? 'km/h' : 'mph'}
            </button>

            {/* Astronomical Phase Selector */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              {(
                [
                  { id: 'auto', label: 'Auto Sky', icon: <LocateFixed className="w-3 h-3" /> },
                  { id: 'dawn', label: 'Dawn', icon: <Sunrise className="w-3 h-3" /> },
                  { id: 'noon', label: 'Noon', icon: <Sun className="w-3 h-3" /> },
                  { id: 'evening', label: 'Evening', icon: <Sunset className="w-3 h-3" /> },
                  { id: 'night', label: 'Night', icon: <Moon className="w-3 h-3" /> },
                ] as const
              ).map((ph) => (
                <button
                  key={ph.id}
                  type="button"
                  onClick={() => {
                    setForcedPhase(ph.id);
                    setForcedAtmosphere('auto');
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    forcedPhase === ph.id && forcedAtmosphere === 'auto'
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ph.icon}
                  <span>{ph.label}</span>
                </button>
              ))}
            </div>

            {/* WeatherAtmosphere 3D Palette Selector */}
            <label htmlFor="atmosphere-palette-select" className="sr-only">
              3D Atmosphere Palette
            </label>
            <select
              id="atmosphere-palette-select"
              data-testid="atmosphere-palette-select"
              value={forcedAtmosphere}
              onChange={(e) => {
                const val = e.target.value as WeatherAtmosphere | 'auto';
                setForcedAtmosphere(val);
                if (val === WeatherAtmosphere.DAWN_SUNRISE) setForcedPhase('dawn');
                else if (val === WeatherAtmosphere.NOON_CLEAR) setForcedPhase('noon');
                else if (val === WeatherAtmosphere.EVENING_SUNSET) setForcedPhase('evening');
                else if (val === WeatherAtmosphere.NIGHT_STARRY) setForcedPhase('night');
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
            >
              <option value="auto">Palette: AUTO ({activeAtmosphere})</option>
              <option value={WeatherAtmosphere.DAWN_SUNRISE}>DAWN_SUNRISE</option>
              <option value={WeatherAtmosphere.NOON_CLEAR}>NOON_CLEAR</option>
              <option value={WeatherAtmosphere.EVENING_SUNSET}>EVENING_SUNSET</option>
              <option value={WeatherAtmosphere.NIGHT_STARRY}>NIGHT_STARRY</option>
              <option value={WeatherAtmosphere.MONSOON_RAIN}>MONSOON_RAIN</option>
              <option value={WeatherAtmosphere.HEATWAVE_ALERT}>HEATWAVE_ALERT</option>
            </select>

            {/* Low-End / 60fps Performance Mode Toggle */}
            <button
              type="button"
              data-testid="low-end-mode-toggle"
              aria-pressed={isLowEndMode}
              onClick={() => {
                setIsLowEndMode((prev) => !prev);
                setQuality((prev) => (prev === 'high' ? 'low' : 'high'));
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                isLowEndMode
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{isLowEndMode ? 'Low-End 60fps Mode: ON' : 'Shader Quality: High'}</span>
            </button>
          </div>
        </section>

        {/* Primary 3D Spatial Viewport Stage + Unobstructed Center + Collapsible Bottom Dock */}
        <section
          id="viewport-stage"
          aria-label="Interactive 3D Weather Environment Stage"
          className="relative w-full h-[560px] sm:h-[620px] rounded-2xl overflow-hidden border border-slate-800 bg-[#07090E] shadow-2xl flex flex-col justify-between"
        >
          {/* Dedicated Isolated Three.js WebGL Mount */}
          <div className="absolute inset-0 z-0">
            <Aerolune3DViewport
              mode={viewportMode}
              city={activeCity}
              point={activePoint}
              phase={astronomicalPhase}
              quality={quality}
              isLowEndMode={isLowEndMode}
              storyStep={storyStep}
              selectedWardId={selectedWardId}
            />
          </div>

          {/* Minimal Top-Left Spec HUD (Solid rgba surface, zero backdrop-blur over WebGL) */}
          <div className="relative z-10 p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4 pointer-events-none">
            <div className="bg-[#07090E]/90 border border-slate-800 rounded-xl px-4 py-3 space-y-1 pointer-events-auto">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <Globe2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'bn' ? activeCity.districtBn : activeCity.districtEn} ·{' '}
                  {activeCity.lat.toFixed(2)}°N, {activeCity.lon.toFixed(2)}°E
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
                  {lang === 'bn' ? activeCity.nameBn : activeCity.nameEn}
                </h1>
                <span className="text-2xl sm:text-3xl font-mono font-bold text-cyan-300">
                  {formatTemp(activePoint.tempC, tempUnit)}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-300">
                <span>
                  {lang === 'bn' ? 'অনুভূত:' : 'Feels:'} {formatTemp(activePoint.feelsLikeC, tempUnit)}
                </span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>
                  {lang === 'bn' ? 'বৃষ্টি:' : 'Rain:'} {activePoint.rainProb}%
                </span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>
                  {lang === 'bn' ? 'বাতাস:' : 'Wind:'} {formatWind(activePoint.windSpeedKmh, windUnit)}
                </span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>AQI {activePoint.aqi}</span>
              </div>
            </div>

            {/* Top-Right Sync, Astronomical Phase & Aerolune3DPalette Indicator */}
            <div className="bg-[#07090E]/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 pointer-events-auto flex flex-wrap items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lastSyncedLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="uppercase text-amber-300">{astronomicalPhase} SKY</span>
              <span aria-hidden="true">·</span>
              <span
                data-testid="active-atmosphere-badge"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px]"
                style={{
                  background: `linear-gradient(180deg, ${activePalette.surfaceTop}44 0%, ${activePalette.surfaceBottom}88 100%)`,
                  borderColor: activePalette.specularHighlight,
                  color: activePalette.contentColor,
                  boxShadow: `0 2px 0 ${activePalette.extrusionWall}`,
                }}
              >
                <Sparkles className="w-3 h-3" style={{ color: activePalette.neonGlow }} />
                <span>{activeAtmosphere}</span>
              </span>
            </div>
          </div>

          {/* Unified Bottom Collapsible Control Dock (Zero Viewport Center Occlusion) */}
          <div className="relative z-10 pb-3">
            <TimeMachineDock
              lang={lang}
              mode={viewportMode}
              onModeChange={setViewportMode}
              timeline={timeline}
              selectedOffset={timelineOffset}
              onOffsetChange={setTimelineOffset}
              isPlayingTimeline={isPlayingTimeline}
              onTogglePlayTimeline={() => setIsPlayingTimeline((p) => !p)}
              currentPoint={activePoint}
              tempUnit={tempUnit}
              windUnit={windUnit}
              isCollapsed={dockCollapsed}
              onToggleCollapse={() => setDockCollapsed((c) => !c)}
              soundEnabled={soundEnabled}
              soundVolume={soundVolume}
              onToggleSound={handleToggleSound}
              onSoundVolumeChange={(v) => {
                setSoundVolume(v);
                weatherSoundscape.updateTelemetry(activePoint, astronomicalPhase, v);
              }}
              onTriggerThunder={() => weatherSoundscape.triggerThunderClap()}
              isLowEndMode={isLowEndMode}
              storyStep={storyStep}
              onStoryStepChange={setStoryStep}
            />
          </div>
        </section>

        {/* Comprehensive Environmental Metrics, Ward Microclimate Explorer & AI What-If Lab */}
        <div id="telemetry-section">
          <TelemetryAndMicroclimatePanel
            lang={lang}
            city={activeCity}
            point={activePoint}
            tempUnit={tempUnit}
            windUnit={windUnit}
            selectedWardId={selectedWardId}
            onSelectWard={setSelectedWardId}
            whatIf={whatIf}
            onChangeWhatIf={setWhatIf}
            isLowEndMode={isLowEndMode}
          />
        </div>

        {/* Complete 3D Dashboard Preview & Usage Example (AeroluneShowcaseScreen.kt) */}
        <AeroluneShowcaseScreen
          lang={lang}
          city={activeCity}
          point={activePoint}
          tempUnit={tempUnit}
          windUnit={windUnit}
          atmosphere={activeAtmosphere}
          isLowEndMode={isLowEndMode}
          onToggleLowEndMode={(enabled) => {
            setIsLowEndMode(enabled);
            setQuality(enabled ? 'low' : 'high');
          }}
          onChangeAtmosphere={(next) => {
            setForcedAtmosphere(next);
            if (next === WeatherAtmosphere.DAWN_SUNRISE) setForcedPhase('dawn');
            else if (next === WeatherAtmosphere.NOON_CLEAR) setForcedPhase('noon');
            else if (next === WeatherAtmosphere.EVENING_SUNSET) setForcedPhase('evening');
            else if (next === WeatherAtmosphere.NIGHT_STARRY) setForcedPhase('night');
          }}
          onAskCopilot={() => {
            const el = document.getElementById('ai-ecosystem');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onLaunchTimeMachine={() => {
            setViewportMode('globe');
            setDockCollapsed(false);
            setIsPlayingTimeline(true);
            const el = document.getElementById('viewport-stage');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Grounded Gemini AI Ecosystem & Activity Impact Simulator */}
        <div id="ai-ecosystem">
          <GeminiAIEcosystemHub
            lang={lang}
            city={activeCity}
            point={activePoint}
            tempUnit={tempUnit}
            isLowEndMode={isLowEndMode}
            alertRules={alertRules}
            onAddAlertRule={(r) => setAlertRules((prev) => [r, ...prev])}
            onToggleAlertRule={(id) =>
              setAlertRules((prev) =>
                prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
              )
            }
            onDeleteAlertRule={(id) => setAlertRules((prev) => prev.filter((r) => r.id !== id))}
            journalEntries={journalEntries}
            onAddJournalEntry={(entry) => setJournalEntries((prev) => [entry, ...prev])}
          />
        </div>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-5 px-6 text-center text-xs text-slate-400 font-mono">
        AEROLUNE — 3D & AI Weather Super-App · Grounded in BMD, ECMWF IFS, NOAA GFS & Open-Meteo Telemetry · বাংলা ও English
      </footer>
    </div>
  );
}
