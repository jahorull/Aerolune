import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Droplets,
  Eye,
  Flame,
  Gauge,
  MapPin,
  RotateCcw,
  Sliders,
  Sun,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';
import {
  CityLocation,
  HourlyTimelinePoint,
  LanguageCode,
  TempUnit,
  WhatIfModifiers,
  WindUnit,
} from '../types/weather';
import {
  calculateHeatStressRisk,
  formatTemp,
  formatWind,
  getCompassDirection,
  parseWhatIfPrompt,
} from '../utils/weatherPhysics';
import { Aerolune3DButton } from './Aerolune3DButton';

interface TelemetryAndMicroclimatePanelProps {
  lang: LanguageCode;
  city: CityLocation;
  point: HourlyTimelinePoint;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  selectedWardId: string;
  onSelectWard: (id: string) => void;
  whatIf: WhatIfModifiers;
  onChangeWhatIf: (next: WhatIfModifiers) => void;
  isLowEndMode: boolean;
}

export const TelemetryAndMicroclimatePanel: React.FC<TelemetryAndMicroclimatePanelProps> = ({
  lang,
  city,
  point,
  tempUnit,
  windUnit,
  selectedWardId,
  onSelectWard,
  whatIf,
  onChangeWhatIf,
  isLowEndMode,
}) => {
  const [whatIfInput, setWhatIfInput] = useState('');

  const activeWard = city.wards.find((w) => w.id === selectedWardId) || city.wards[0];
  const wardTempC = Math.round((point.tempC + (activeWard?.tempDeltaC || 0)) * 10) / 10;
  const wardRainProb = Math.min(100, Math.max(0, point.rainProb + (activeWard?.rainProbDelta || 0)));
  const wardAqi = Math.max(10, point.aqi + (activeWard?.aqiDelta || 0));

  const heatRisk = calculateHeatStressRisk(
    point.tempC,
    point.humidity,
    point.uvIndex,
    point.windSpeedKmh
  );

  // Solar arc progress (0 to 1 during daylight)
  const sr = city.baseTelemetry.sunriseHour;
  const ss = city.baseTelemetry.sunsetHour;
  const solarProgress = Math.max(0, Math.min(1, (point.localHour - sr) / (ss - sr)));

  const handleWhatIfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatIfInput.trim()) return;
    const updated = parseWhatIfPrompt(whatIfInput, whatIf);
    onChangeWhatIf(updated);
  };

  const resetWhatIf = () => {
    setWhatIfInput('');
    onChangeWhatIf({
      tempDeltaC: 0,
      windMultiplier: 1,
      cloudOverride: null,
      rainOverride: null,
      activePromptText: '',
    });
  };

  const hasActiveWhatIf =
    whatIf.tempDeltaC !== 0 ||
    whatIf.windMultiplier !== 1 ||
    whatIf.cloudOverride !== null ||
    whatIf.rainOverride !== null;

  return (
    <section
      aria-label="Comprehensive Meteorological Telemetry & Hyper-Local Explorer"
      className="space-y-6"
    >
      {/* Official Meteorological Agency Alert Banner (Strictly Grounded) */}
      {city.officialAlerts.length > 0 && (
        <div
          data-testid="official-alert-banner"
          className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{city.officialAlerts[0].agency}</span>
              <span aria-hidden="true">·</span>
              <span>{city.officialAlerts[0].severity.toUpperCase()}</span>
            </div>
            <h2 className="text-base font-semibold text-white">
              {lang === 'bn' ? city.officialAlerts[0].titleBn : city.officialAlerts[0].titleEn}
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl">
              {lang === 'bn' ? city.officialAlerts[0].whyIssuedBn : city.officialAlerts[0].whyIssuedEn}
            </p>
          </div>
          <div className="text-xs font-mono text-amber-200/90 shrink-0">
            {lang === 'bn' ? 'প্রভাবিত এলাকা: ' : 'Impacted: '}
            {lang === 'bn' ? city.officialAlerts[0].areasBn : city.officialAlerts[0].areasEn}
          </div>
        </div>
      )}

      {/* Primary Telemetry Grid (6 Precision Instrument Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Thermal &WBGT Card */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{lang === 'bn' ? 'তাপমাত্রা ও তাপ সূচক' : 'THERMAL & WBGT TELEMETRY'}</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div data-testid="primary-temp-readout" className="text-3xl font-mono font-bold text-white">
                {formatTemp(point.tempC, tempUnit)}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {lang === 'bn' ? 'অনুভূত:' : 'Feels Like:'} {formatTemp(point.feelsLikeC, tempUnit)} · WBGT {heatRisk.wbgtC}°C
              </div>
            </div>
            <div className="text-right font-mono text-xs text-slate-300">
              <div>H: {formatTemp(city.baseTelemetry.highC + whatIf.tempDeltaC, tempUnit)}</div>
              <div>L: {formatTemp(city.baseTelemetry.lowC + whatIf.tempDeltaC, tempUnit)}</div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              {lang === 'bn' ? 'হিট স্ট্রেস ঝুঁকি:' : 'Heat Stress Risk:'}
            </span>
            <span
              className={
                heatRisk.riskLevel === 'Extreme' || heatRisk.riskLevel === 'High'
                  ? 'text-amber-400 font-semibold'
                  : 'text-emerald-400 font-semibold'
              }
            >
              ● {heatRisk.riskLevel} ({heatRisk.hydrationMlPerHour} mL/hr H₂O)
            </span>
          </div>
        </div>

        {/* 2. Air Quality Index (AQI) & Pollutant Breakdown */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{lang === 'bn' ? 'বায়ুর মান ও দূষণ বিশ্লেষণ' : 'AIR QUALITY (AQI) & POLLUTANTS'}</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div data-testid="primary-aqi-readout" className="text-3xl font-mono font-bold text-white">
                {point.aqi} <span className="text-xs font-normal text-slate-400">US AQI</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {point.aqi > 150
                  ? lang === 'bn'
                    ? '▲ অস্বাস্থ্যকর (N95 মাস্ক পরুন)'
                    : '▲ Unhealthy (Wear N95)'
                  : point.aqi > 100
                    ? lang === 'bn'
                      ? '▲ সংবেদনশীলদের জন্য সতর্কতা'
                      : '▲ Moderate-High'
                    : lang === 'bn'
                      ? '● সন্তোষজনক বায়ু মান'
                      : '● Good / Acceptable'}
              </div>
            </div>
            <div className="text-right font-mono text-xs text-slate-300">
              <div>PM2.5: {city.baseTelemetry.pm25} µg/m³</div>
              <div>PM10: {city.baseTelemetry.pm10} µg/m³</div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>NO₂: {city.baseTelemetry.no2} · O₃: {city.baseTelemetry.o3}</span>
            <span>
              {city.pollenTelemetrySupported
                ? `Pollen: ${city.baseTelemetry.pollenIndex}/120`
                : lang === 'bn'
                  ? 'পোলেন সেন্সর নেই'
                  : 'Pollen: Sensor N/A'}
            </span>
          </div>
        </div>

        {/* 3. Wind Vector, 3D Compass & Barometric Pressure */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{lang === 'bn' ? 'বায়ুপ্রবাহ ও ৩ডি কম্পাস' : '3D WIND COMPASS & STREAMLINES'}</span>
            <Wind className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div data-testid="primary-wind-readout" className="text-3xl font-mono font-bold text-white">
                {formatWind(point.windSpeedKmh, windUnit)}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {lang === 'bn' ? 'দিক:' : 'Vector:'} {point.windDirectionDeg}° ({getCompassDirection(point.windDirectionDeg)})
              </div>
            </div>
            {/* Interactive SVG Wind Compass */}
            <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center relative">
              <span className="absolute top-0.5 text-[9px] font-mono text-cyan-400">N</span>
              <div
                style={{ transform: `rotate(${point.windDirectionDeg}deg)` }}
                className="w-1 h-7 bg-gradient-to-t from-slate-600 to-cyan-400 rounded-full transition-transform duration-300"
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              {point.pressureHpa} hPa
            </span>
            <span>
              {lang === 'bn' ? 'মেঘের ঘনত্ব:' : 'Cloud Cover:'} {point.cloudCover}%
            </span>
          </div>
        </div>

        {/* 4. Precipitation, Humidity & Visibility */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{lang === 'bn' ? 'বৃষ্টিপাত, আর্দ্রতা ও দৃষ্টিসীমা' : 'PRECIPITATION & VISIBILITY'}</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-mono font-bold text-white">
                {point.rainProb}% <span className="text-sm font-normal text-cyan-400">({point.precipMm} mm/h)</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {lang === 'bn' ? 'আপেক্ষিক আর্দ্রতা:' : 'Relative Humidity:'} {point.humidity}% · Dew {city.baseTelemetry.dewPointC}°C
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'দৃষ্টিসীমা:' : 'Visibility:'} {city.baseTelemetry.visibilityKm} km
            </span>
            <span>{point.conditionCode.toUpperCase()}</span>
          </div>
        </div>

        {/* 5. UV Index & Safe Solar Exposure Timer */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{lang === 'bn' ? 'ইউভি সূচক ও নিরাপদ সময়' : 'UV INDEX & EXPOSURE TIMER'}</span>
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-mono font-bold text-white">
                UV {point.uvIndex}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {point.uvIndex >= 7
                  ? lang === 'bn'
                    ? 'উচ্চ বিকিরণ — সর্বোচ্চ ২৫ মিনিট রোদে থাকুন'
                    : 'High Solar Load — Max 25 min unshaded'
                  : point.uvIndex >= 3
                    ? lang === 'bn'
                      ? 'মাঝারি — সর্বোচ্চ ৪৫ মিনিট নিরাপদ'
                      : 'Moderate — ~45 min safe window'
                    : lang === 'bn'
                      ? 'নিরাপদ ইউভি মাত্রা'
                      : 'Low UV — Safe outdoor window'}
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (point.uvIndex / 11) * 100)}%` }}
            />
          </div>
        </div>

        {/* 6. Astronomical Sunrise & Sunset Interactive Arc Tracker */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{lang === 'bn' ? 'সূর্যোদয় ও সূর্যাস্ত ট্র্যাকার' : 'ASTRONOMICAL SOLAR ARC'}</span>
            <Sunrise className="w-4 h-4 text-amber-400" />
          </div>
          <div className="relative h-14 flex items-end justify-between px-2">
            <svg viewBox="0 0 200 60" className="w-full h-14 overflow-visible">
              <path
                d="M 10 52 Q 100 -18 190 52"
                fill="none"
                stroke="#334155"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <circle
                cx={10 + solarProgress * 180}
                cy={52 - Math.sin(solarProgress * Math.PI) * 35}
                r="6"
                fill="#f59e0b"
              />
            </svg>
          </div>
          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="inline-flex items-center gap-1">
              <Sunrise className="w-3.5 h-3.5 text-amber-400" />
              05:{String(Math.round((sr % 1) * 60)).padStart(2, '0')}
            </span>
            <span className="text-slate-400">
              Local {String(point.localHour).padStart(2, '0')}:00
            </span>
            <span className="inline-flex items-center gap-1">
              <Sunset className="w-3.5 h-3.5 text-orange-400" />
              17:{String(Math.round((ss % 1) * 60)).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Hyper-Local Ward Microclimate Explorer + AI What-If Weather Lab (2-Column Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Microclimate Ward Explorer */}
        <div
          data-testid="microclimate-explorer"
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
              <span>{lang === 'bn' ? 'হাইপার-লোকাল ওয়ার্ড মাইক্রোক্লাইমেট এক্সপ্লোরার' : 'HYPER-LOCAL MICROCLIMATE EXPLORER'}</span>
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {lang === 'bn'
                ? `${city.nameBn}-এর এলাকাভিত্তিক আবহাওয়ার পার্থক্য`
                : `Ward & Upazila Variations in ${city.nameEn}`}
            </h3>
            <p className="text-xs text-slate-400">
              {lang === 'bn'
                ? 'শহরের একেক এলাকায় গাছপালা, নদী ও ভবনের ঘনত্বের কারণে তাপমাত্রা ও বৃষ্টির তারতম্য ঘটে।'
                : 'Compares multi-station and interpolated grid telemetry across neighborhoods rather than a flat city-wide average.'}
            </p>
          </div>

          {/* Ward selector buttons */}
          <div className="flex flex-wrap gap-2">
            {city.wards.map((ward) => (
              <Aerolune3DButton
                key={ward.id}
                size="sm"
                active={ward.id === activeWard?.id}
                accentColor="cyan"
                isLowEndMode={isLowEndMode}
                text={lang === 'bn' ? ward.nameBn : ward.nameEn}
                onClick={() => onSelectWard(ward.id)}
              />
            ))}
          </div>

          {/* Selected Ward Comparison Readout */}
          {activeWard && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white font-semibold">
                  {lang === 'bn' ? activeWard.nameBn : activeWard.nameEn} ({activeWard.stationCode})
                </span>
                <span className="text-cyan-400">{activeWard.urbanHeatFactor}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 font-mono">
                <div>
                  <div className="text-[11px] text-slate-400">{lang === 'bn' ? 'তাপমাত্রা' : 'Ward Temp'}</div>
                  <div className="text-base font-bold text-white">
                    {formatTemp(wardTempC, tempUnit)}{' '}
                    <span className="text-xs text-amber-400">
                      ({activeWard.tempDeltaC >= 0 ? '+' : ''}{activeWard.tempDeltaC}°C)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{lang === 'bn' ? 'বৃষ্টির সম্ভাবনা' : 'Rain Prob'}</div>
                  <div className="text-base font-bold text-cyan-300">
                    {wardRainProb}%{' '}
                    <span className="text-xs text-slate-400">
                      ({activeWard.rainProbDelta >= 0 ? '+' : ''}{activeWard.rainProbDelta}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{lang === 'bn' ? 'একিউআই (AQI)' : 'Local AQI'}</div>
                  <div className="text-base font-bold text-white">
                    {wardAqi}{' '}
                    <span className="text-xs text-slate-400">
                      ({activeWard.aqiDelta >= 0 ? '+' : ''}{activeWard.aqiDelta})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI What-If Weather Lab Sandbox */}
        <div
          data-testid="what-if-weather-lab"
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-amber-400">
              <span>{lang === 'bn' ? 'এআই হোয়াট-ইফ ওয়েদার ল্যাব (স্যান্ডবক্স)' : 'AI WHAT-IF WEATHER LAB SANDBOX'}</span>
              <Sliders className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">
                {lang === 'bn' ? 'আবহাওয়া পরিবর্তন সিমুলেটর' : 'Real-Time 3D & Telemetry Sandbox'}
              </h3>
              {hasActiveWhatIf && (
                <button
                  type="button"
                  onClick={resetWhatIf}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{lang === 'bn' ? 'রিসেট' : 'Reset Sandbox'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Natural Language What-If Prompt Form */}
          <form onSubmit={handleWhatIfSubmit} className="flex gap-2">
            <label htmlFor="what-if-prompt-input" className="sr-only">
              What-If Weather Prompt
            </label>
            <input
              id="what-if-prompt-input"
              type="text"
              value={whatIfInput}
              onChange={(e) => setWhatIfInput(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'যেমন: "দ্বিগুণ বাতাস এবং ভারী বৃষ্টি" বা "Raise temperature by 5°C"'
                  : 'e.g. "What if wind speed doubles?" or "Raise city temperature by 5°C"'
              }
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            <Aerolune3DButton
              type="submit"
              size="sm"
              accentColor="amber"
              isLowEndMode={isLowEndMode}
              text={lang === 'bn' ? 'প্রয়োগ করুন' : 'Simulate'}
            />
          </form>

          {/* Interactive Parameter Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 text-xs font-mono">
            <div>
              <label htmlFor="whatif-temp-slider" className="flex justify-between text-slate-300 mb-1">
                <span>Temp Δ</span>
                <span className="text-amber-400">
                  {whatIf.tempDeltaC >= 0 ? '+' : ''}{whatIf.tempDeltaC}°C
                </span>
              </label>
              <input
                id="whatif-temp-slider"
                type="range"
                min={-8}
                max={12}
                step={1}
                value={whatIf.tempDeltaC}
                onChange={(e) =>
                  onChangeWhatIf({ ...whatIf, tempDeltaC: Number(e.target.value) })
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="whatif-wind-slider" className="flex justify-between text-slate-300 mb-1">
                <span>Wind ×</span>
                <span className="text-cyan-400">{whatIf.windMultiplier.toFixed(1)}x</span>
              </label>
              <input
                id="whatif-wind-slider"
                type="range"
                min={0.5}
                max={3.0}
                step={0.5}
                value={whatIf.windMultiplier}
                onChange={(e) =>
                  onChangeWhatIf({ ...whatIf, windMultiplier: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label htmlFor="whatif-cloud-slider" className="flex justify-between text-slate-300 mb-1">
                <span>Cloud %</span>
                <span className="text-cyan-300">
                  {whatIf.cloudOverride !== null ? `${whatIf.cloudOverride}%` : `${point.cloudCover}%`}
                </span>
              </label>
              <input
                id="whatif-cloud-slider"
                type="range"
                min={0}
                max={100}
                step={5}
                value={whatIf.cloudOverride !== null ? whatIf.cloudOverride : point.cloudCover}
                onChange={(e) =>
                  onChangeWhatIf({ ...whatIf, cloudOverride: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
