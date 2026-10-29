import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Code2,
  Database,
  Droplets,
  Sparkles,
  Sprout,
  Sun,
  Wind,
} from 'lucide-react';
import { CityLocation, HourlyTimelinePoint, LanguageCode } from '../types/weather';
import {
  AEROLUNE_AI_REPOSITORY_KT_SOURCE,
  AEROLUNE_AI_VIEWMODEL_KT_SOURCE,
  AeroluneAiRepository,
  AeroluneSystemPrompts,
  FarmingContextRequest,
  FarmingTaskRecommendation,
  SmartFarmingAiResponse,
  buildGroundedWeatherPayload,
  formatSmartFarmingPrompt,
  generateGroundedSmartFarmingResponse,
} from '../utils/groundedFarmingModels';
import { Aerolune3DButton } from './Aerolune3DButton';

export interface SmartFarmingGroundedPanelProps {
  lang: LanguageCode;
  city: CityLocation;
  point: HourlyTimelinePoint;
  isLowEndMode: boolean;
}

const CROP_OPTIONS = [
  'আমন ধান (Aman Rice)',
  'বোরো ধান (Boro Rice)',
  'পাট (Jute)',
  'আলু (Potato)',
  'পেঁয়াজ (Onion)',
  'আম (Mango)',
  'গম (Wheat)',
];

const GROWTH_STAGES = [
  'ফুল আসার সময় (Flowering)',
  'Seedling (চারা পর্যায়)',
  'Vegetative (বৃদ্ধি পর্যায়)',
  'Flowering (ফুল আসা পর্যায়)',
  'Grain Filling (দানা গঠন)',
  'Harvesting (ফসল কাটা ও মাড়াই)',
];

const SOIL_TYPES = [
  'দোআঁশ (Loamy)',
  'Loamy (দোআঁশ মাটি)',
  'Clay Loam (এঁটেল দোআঁশ)',
  'Clay (এঁটেল মাটি)',
  'Sandy Loam (বেলে দোআঁশ)',
];

export const SmartFarmingGroundedPanel: React.FC<SmartFarmingGroundedPanelProps> = ({
  lang,
  city,
  point,
  isLowEndMode,
}) => {
  const [cropNameBn, setCropNameBn] = useState<string>(CROP_OPTIONS[0]);
  const [cropGrowthStage, setCropGrowthStage] = useState<string>(GROWTH_STAGES[0]);
  const [fieldSoilType, setFieldSoilType] = useState<string>(SOIL_TYPES[0]);
  const [inspectorTab, setInspectorTab] = useState<
    'recommendations' | 'payload' | 'prompts' | 'repository' | 'viewmodel' | 'kotlin'
  >('recommendations');
  const [liveAiResponse, setLiveAiResponse] = useState<SmartFarmingAiResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const payload = useMemo(
    () => buildGroundedWeatherPayload(city, point, []),
    [city, point]
  );

  const farmingContext: FarmingContextRequest = useMemo(
    () => ({
      cropNameBn,
      cropGrowthStage,
      fieldSoilType,
      preferredLanguage: lang,
    }),
    [cropNameBn, cropGrowthStage, fieldSoilType, lang]
  );

  const deterministicResponse = useMemo(
    () => generateGroundedSmartFarmingResponse(payload, farmingContext),
    [payload, farmingContext]
  );

  const activeResponse = liveAiResponse || deterministicResponse;

  const handleRunGeminiSmartFarming = async () => {
    setIsGenerating(true);
    try {
      const result = await AeroluneAiRepository.generateSmartFarmingAdvisory(
        payload,
        farmingContext
      );
      if (result.ok && result.value) {
        setLiveAiResponse(result.value);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStatusBadge = (status: FarmingTaskRecommendation['status']) => {
    const styles: Record<FarmingTaskRecommendation['status'], string> = {
      OPTIMAL: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
      CAUTION: 'bg-amber-500/20 border-amber-400 text-amber-300',
      AVOID: 'bg-rose-500/20 border-rose-400 text-rose-300',
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded border text-[11px] font-mono font-bold tracking-wider ${styles[status]}`}
      >
        {status}
      </span>
    );
  };

  const renderTaskCard = (
    title: string,
    icon: React.ReactNode,
    rec: FarmingTaskRecommendation,
    testId: string
  ) => (
    <div
      data-testid={testId}
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400">
            {icon}
            <span>{title}</span>
          </span>
          {renderStatusBadge(rec.status)}
        </div>

        <h4 className="text-sm font-semibold text-white">{rec.headline}</h4>

        <div className="text-xs font-mono text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
          ⏰ {rec.recommendedTimeWindow}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{rec.detailedReasoning}</p>
      </div>

      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
        {rec.triggeringMetrics.map((m, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-cyan-300"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div
      data-testid="smart-farming-grounded-panel"
      className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5"
    >
      {/* Top Bar: FarmingContextRequest Selectors + Inspector Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="text-xs font-mono text-emerald-400">
            com.aerolune.app.domain.model · GroundedWeatherPayload + SmartFarmingAiResponse
          </div>
          <h3 className="text-lg font-display font-bold text-white mt-0.5">
            {lang === 'bn'
              ? 'এআই স্মার্ট কৃষি পরামর্শ (সেচ, বালাইনাশক স্প্রে ও ফসল শুকানো)'
              : 'AI Smart Farming Mode — Structured Grounded Recommendations'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setInspectorTab('recommendations')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              inspectorTab === 'recommendations'
                ? 'bg-emerald-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-emerald-400'
            }`}
          >
            <Sprout className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'কৃষি পরামর্শ' : 'Farming Advisory'}</span>
          </button>
          <button
            type="button"
            data-testid="farming-payload-tab"
            onClick={() => setInspectorTab('payload')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              inspectorTab === 'payload'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>GroundedWeatherPayload JSON</span>
          </button>
          <button
            type="button"
            data-testid="farming-system-prompts-tab"
            onClick={() => setInspectorTab('prompts')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              inspectorTab === 'prompts'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>AeroluneSystemPrompts.kt</span>
          </button>
          <button
            type="button"
            data-testid="farming-repository-tab"
            onClick={() => setInspectorTab('repository')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              inspectorTab === 'repository'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>AeroluneAiRepository.kt</span>
          </button>
          <button
            type="button"
            data-testid="farming-viewmodel-tab"
            onClick={() => setInspectorTab('viewmodel')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              inspectorTab === 'viewmodel'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>AeroluneAiViewModel.kt</span>
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('kotlin')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              inspectorTab === 'kotlin'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>@Serializable Models</span>
          </button>
        </div>
      </div>

      {/* FarmingContextRequest Form Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end bg-slate-900/75 border border-slate-800 rounded-xl p-3.5">
        <div>
          <label htmlFor="farming-crop-select" className="block text-[11px] font-mono text-slate-400 mb-1">
            cropNameBn (ফসল নির্বাচন)
          </label>
          <select
            id="farming-crop-select"
            value={cropNameBn}
            onChange={(e) => {
              setCropNameBn(e.target.value);
              setLiveAiResponse(null);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
          >
            {CROP_OPTIONS.map((crop) => (
              <option key={crop} value={crop}>
                {crop}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="farming-stage-select" className="block text-[11px] font-mono text-slate-400 mb-1">
            cropGrowthStage (বৃদ্ধির পর্যায়)
          </label>
          <select
            id="farming-stage-select"
            value={cropGrowthStage}
            onChange={(e) => {
              setCropGrowthStage(e.target.value);
              setLiveAiResponse(null);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
          >
            {GROWTH_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="farming-soil-select" className="block text-[11px] font-mono text-slate-400 mb-1">
            fieldSoilType (মাটির ধরন)
          </label>
          <select
            id="farming-soil-select"
            value={fieldSoilType}
            onChange={(e) => {
              setFieldSoilType(e.target.value);
              setLiveAiResponse(null);
            }}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
          >
            {SOIL_TYPES.map((soil) => (
              <option key={soil} value={soil}>
                {soil}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Aerolune3DButton
            fullWidth
            size="md"
            accentColor="emerald"
            isLowEndMode={isLowEndMode}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            text={
              isGenerating
                ? lang === 'bn'
                  ? 'বিশ্লেষণ চলছে...'
                  : 'Synthesizing...'
                : lang === 'bn'
                  ? 'এআই কৃষি বিশ্লেষণ'
                  : 'Synthesize Smart Farming'
            }
            onClick={handleRunGeminiSmartFarming}
          />
        </div>
      </div>

      {inspectorTab === 'recommendations' ? (
        <div className="space-y-4">
          {/* Overall Summary & Data Source Citation */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-emerald-400 font-semibold">
                SmartFarmingAiResponse · Grounded Telemetry Output
              </span>
              <span className="text-slate-400">{activeResponse.dataSourceCitation}</span>
            </div>
            <p className="text-sm text-slate-100 leading-relaxed">
              {activeResponse.overallSummary}
            </p>
            {activeResponse.weatherRiskWarning && (
              <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-500/40 rounded-lg p-3 text-xs text-amber-200 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{activeResponse.weatherRiskWarning}</span>
              </div>
            )}
          </div>

          {/* 3 FarmingTaskRecommendation Cards: Irrigation, Pesticide Spraying, Crop Drying */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {renderTaskCard(
              lang === 'bn' ? '১. সেচ পরামর্শ (Irrigation)' : '1. IRRIGATION ADVICE',
              <Droplets className="w-3.5 h-3.5" />,
              activeResponse.irrigationAdvice,
              'farming-irrigation-card'
            )}
            {renderTaskCard(
              lang === 'bn' ? '২. বালাইনাশক স্প্রে (Spraying)' : '2. PESTICIDE SPRAYING',
              <Wind className="w-3.5 h-3.5" />,
              activeResponse.pesticideSprayingAdvice,
              'farming-spraying-card'
            )}
            {renderTaskCard(
              lang === 'bn' ? '৩. ফসল শুকানো (Crop Drying)' : '3. CROP DRYING ADVICE',
              <Sun className="w-3.5 h-3.5" />,
              activeResponse.cropDryingAdvice,
              'farming-drying-card'
            )}
          </div>
        </div>
      ) : inspectorTab === 'payload' ? (
        <div className="space-y-2">
          <div className="text-xs font-mono text-slate-400">
            Exact <code className="text-cyan-300">[LIVE_WEATHER_PAYLOAD]</code> + <code className="text-emerald-300">[FARMING_CONTEXT]</code> injected into Gemini (note <code className="text-amber-300">pollenIndex: {String(payload.current.pollenIndex)}</code> when regional pollen sensor is unsupported):
          </div>
          <pre
            data-testid="grounded-weather-payload-json"
            className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[420px] overflow-y-auto leading-relaxed"
          >
            {formatSmartFarmingPrompt(payload, farmingContext)}
          </pre>
        </div>
      ) : inspectorTab === 'prompts' ? (
        <pre
          data-testid="aerolune-system-prompts-code"
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[420px] overflow-y-auto leading-relaxed"
        >
{`package com.aerolune.app.data.ai

object AeroluneSystemPrompts {

    const val WEATHER_COPILOT_SYSTEM_INSTRUCTION = """
${AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION}
"""

    const val SMART_FARMING_SYSTEM_INSTRUCTION = """
${AeroluneSystemPrompts.SMART_FARMING_SYSTEM_INSTRUCTION}
"""

    const val SKY_VISION_SYSTEM_INSTRUCTION = """
${AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION}
"""
}`}
        </pre>
      ) : inspectorTab === 'repository' ? (
        <pre
          data-testid="aerolune-ai-repository-code"
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[420px] overflow-y-auto leading-relaxed"
        >
          {AEROLUNE_AI_REPOSITORY_KT_SOURCE}
        </pre>
      ) : inspectorTab === 'viewmodel' ? (
        <pre
          data-testid="aerolune-ai-viewmodel-code"
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[420px] overflow-y-auto leading-relaxed"
        >
          {AEROLUNE_AI_VIEWMODEL_KT_SOURCE}
        </pre>
      ) : (
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[420px] overflow-y-auto leading-relaxed">
{`package com.aerolune.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class GroundedWeatherPayload(
    val locationName: String,
    val district: String,
    val country: String = "Bangladesh",
    val latitude: Double,
    val longitude: Double,
    val dataSourceProvider: String,
    val lastUpdatedIso: String,
    val isOfflineCachedData: Boolean = false,
    val current: CurrentWeatherMetrics,
    val hourlyForecast24h: List<HourlyForecastPoint>,
    val officialAlerts: List<OfficialWeatherAlert> = emptyList()
)

@Serializable
data class FarmingContextRequest(
    val cropNameBn: String,
    val cropGrowthStage: String,
    val fieldSoilType: String,
    val preferredLanguage: String = "bn"
)

@Serializable
data class SmartFarmingAiResponse(
    val overallSummary: String,
    val dataSourceCitation: String,
    val irrigationAdvice: FarmingTaskRecommendation,
    val pesticideSprayingAdvice: FarmingTaskRecommendation,
    val cropDryingAdvice: FarmingTaskRecommendation,
    val weatherRiskWarning: String?
)

@Serializable
data class FarmingTaskRecommendation(
    val status: String, // "OPTIMAL", "CAUTION", "AVOID"
    val recommendedTimeWindow: String,
    val headline: String,
    val detailedReasoning: String,
    val triggeringMetrics: List<String>
)

@Serializable
data class SkyVisionAiResponse(
    val isSkyDetected: Boolean,
    val detectedCloudGenera: List<String>,
    val visualSkyDescription: String,
    val lightingAndPhotographyAdvice: PhotographyLightingAnalysis,
    val stationDataComparison: StationComparisonReport,
    val dataSourceCitation: String
)

@Serializable
data class PhotographyLightingAnalysis(
    val lightingCondition: String,
    val goldenHourSuitabilityScore: Int,
    val cameraAndShootAdvice: String
)

@Serializable
data class StationComparisonReport(
    val alignmentStatus: String,
    val comparisonExplanation: String
)`}
        </pre>
      )}
    </div>
  );
};
