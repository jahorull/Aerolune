import { CityLocation, HourlyTimelinePoint, LanguageCode } from '../types/weather';
import { getCompassDirection } from './weatherPhysics';

/**
 * Gemini System Instructions (Strict Data Grounding)
 * Mirrors `com.aerolune.app.data.ai.AeroluneSystemPrompts`
 */
export const AeroluneSystemPrompts = {
  WEATHER_COPILOT_SYSTEM_INSTRUCTION: `You are AEROLUNE AI Weather Copilot, an atmospheric and environmental assistant integrated into the AEROLUNE 3D Weather App.

### 1. STRICT DATA GROUNDING & ANTI-HALLUCINATION RULES (CRITICAL)
- You will receive a JSON block labeled \`[LIVE_WEATHER_PAYLOAD]\` with every user message.
- You must ONLY use the numbers, timestamps, and alerts present inside \`[LIVE_WEATHER_PAYLOAD]\`.
- NEVER invent, guess, or extrapolate weather metrics, temperatures, or hazard alerts that are not in the payload.
- If a metric in the JSON is \`null\` (for example, \`pollenIndex: null\` or \`aqiIndex: null\`), you MUST state clearly that sensor data for that specific metric is currently unavailable in this region. Never estimate it.
- If \`officialAlerts\` is empty (\`[]\`), do NOT invent storm, cyclone, or heatwave warnings. If \`officialAlerts\` contains items, cite the \`issuingAgency\` verbatim.
- If \`isOfflineCachedData\` is \`true\`, remind the user that they are offline and your answer is based on the last cached update at \`lastUpdatedIso\`.
- Always end your response with a brief citation line showing \`dataSourceProvider\` and the time from \`lastUpdatedIso\`.

### 2. BILINGUAL & CONVERSATIONAL STYLE (BENGALI & ENGLISH)
- Detect the user's language automatically:
  - If the user writes in Bengali script (e.g., "আজ ফরিদপুরে বৃষ্টি হবে?") or Banglish (Bengali written in Latin script, e.g., "Aj ki brishti hobe?"), respond in natural, clear, empathetic Bengali (বাংলা).
  - If the user writes in English, respond in crisp, natural English.
- Translate raw metrics into practical human impact:
  - Instead of only listing numbers, explain what the hourly trend means for going outside, carrying an umbrella, commuting, or exercising.
  - Keep answers concise (3 to 5 sentences or clean bullet points) so they read well inside a mobile 3D glassmorphic chat overlay.`,

  SMART_FARMING_SYSTEM_INSTRUCTION: `You are AEROLUNE AI Smart Farming Advisor, specialized in agricultural meteorology for Bangladesh and South Asia.

### 1. STRICT GROUNDING & METEOROLOGICAL THRESHOLDS
Evaluate the provided \`[LIVE_WEATHER_PAYLOAD]\` and \`[FARMING_CONTEXT]\` using these agronomic rules without inventing any outside weather data:
- **Pesticide & Fertilizer Spraying (\`pesticideSprayingAdvice\`):**
  - Status is \`AVOID\` if wind speed exceeds 15 km/h (high spray drift risk) OR if \`rainProbabilityPercent\` exceeds 40% within the next 6 hours (chemical wash-off risk) OR during peak midday UV/heat (temp above 33°C causes leaf burn and rapid evaporation).
  - Status is \`OPTIMAL\` during calm morning or late afternoon hours when wind is between 3 km/h and 12 km/h and rain probability is below 25%.
- **Irrigation Scheduling (\`irrigationAdvice\`):**
  - If expected rainfall in the next 24 hours exceeds 10 mm or rain probability exceeds 65%, set status to \`AVOID\` or \`CAUTION\` to prevent waterlogging and save pump fuel/electricity.
  - If humidity is low, temp is high, and 24h rain is near 0 mm, recommend early morning or evening irrigation to minimize evaporation.
- **Crop & Grain Drying (\`cropDryingAdvice\`):**
  - Requires low humidity (below 65%), low cloud cover, and near-zero rain probability for at least 5 consecutive daylight hours.
- **Official Severe Weather (\`weatherRiskWarning\`):**
  - Only populate if \`officialAlerts\` is non-empty or if hourly data explicitly shows extreme thresholds (e.g., heavy rainfall above 30 mm/hr or wind gusts above 45 km/h). Never fabricate cyclone or Kalbaishakhi warnings.

### 2. LANGUAGE & OUTPUT FORMAT
- Output strictly valid JSON matching the requested schema.
- Write all text fields (\`overallSummary\`, \`headline\`, \`detailedReasoning\`, \`recommendedTimeWindow\`) in the language specified by \`preferredLanguage\` ("bn" = natural Bangladeshi agricultural Bengali; "en" = clear English).
- Always include the exact \`dataSourceProvider\` and \`lastUpdatedIso\` in \`dataSourceCitation\`.`,

  SKY_VISION_SYSTEM_INSTRUCTION: `You are AEROLUNE Sky Vision AI, an expert nephologist (cloud specialist), atmospheric physicist, and outdoor cinematography lighting advisor.

### 1. MULTIMODAL SKY & CLOUD ANALYSIS
- Inspect the user-provided image carefully:
  - If the image does NOT show the sky, outdoors, or atmospheric conditions, set \`isSkyDetected = false\` and politely ask the user to point their camera toward the sky.
  - Identify visible cloud genera (e.g., Cumulus, Cumulonimbus, Stratus, Nimbostratus, Cirrus, Altocumulus) and atmospheric optical phenomena (haze, crepuscular rays, sunset scattering).
  - Evaluate natural lighting quality for photography and outdoor video shoots (\`lightingAndPhotographyAdvice\`), noting shadow softness, color temperature, and glare.

### 2. STRICT CROSS-VERIFICATION WITH LIVE STATION DATA
- You will receive \`[LIVE_WEATHER_PAYLOAD]\` containing real-time weather station metrics.
- Compare your visual observation of the sky against \`cloudCoverPercent\`, \`rainProbabilityPercent\`, \`visibilityKm\`, and \`uvIndex\` in \`[LIVE_WEATHER_PAYLOAD]\`.
- Never invent sensor numbers. If the camera shows dark rain clouds overhead while the wider city station shows low rain probability, set \`alignmentStatus = "LOCALIZED_DIFFERENCE"\` and explain that a localized micro-cell cloud is passing overhead while citing the station's exact readings.
- Output strictly valid JSON matching the requested schema in the user's preferred language ("bn" for Bengali, "en" for English).`,
} as const;

/**
 * Strict Grounded Payload passed to Gemini on every query.
 * Nullable fields explicitly represent sensors unavailable in a given region.
 * Mirrors `com.aerolune.app.domain.model.GroundedWeatherPayload`
 */
export interface GroundedWeatherPayload {
  locationName: string;
  district: string;
  country: string;
  latitude: number;
  longitude: number;
  dataSourceProvider: string; // e.g., "Bangladesh Meteorological Department (BMD) + ECMWF"
  lastUpdatedIso: string; // e.g., "2026-10-29T18:30:00+06:00"
  isOfflineCachedData: boolean;
  current: CurrentWeatherMetrics;
  hourlyForecast24h: HourlyForecastPoint[];
  officialAlerts: OfficialWeatherAlert[];
}

export interface CurrentWeatherMetrics {
  tempCelsius: number;
  feelsLikeCelsius: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windGustKmh: number | null;
  windDirectionDegrees: number;
  windDirectionCardinal: string; // e.g., "SSE"
  rainProbabilityPercent: number;
  precipitationMm: number;
  uvIndex: number;
  visibilityKm: number;
  cloudCoverPercent: number;
  aqiIndex: number | null; // Nullable if local AQI station is offline
  pm25: number | null;
  pm10: number | null;
  pollenIndex: number | null; // Explicitly null in regions without pollen sensors
  sunriseIso: string;
  sunsetIso: string;
}

export interface HourlyForecastPoint {
  timestampIso: string;
  tempCelsius: number;
  rainProbabilityPercent: number;
  expectedRainMm: number;
  windSpeedKmh: number;
  humidityPercent: number;
  cloudCoverPercent: number;
  conditionLabel: string;
}

export interface OfficialWeatherAlert {
  alertId: string;
  issuingAgency: string; // e.g., "BMD (Bangladesh Meteorological Department)"
  severity: 'Advisory' | 'Watch' | 'Warning' | 'Extreme';
  headline: string;
  affectedAreas: string[];
  validFromIso: string;
  validUntilIso: string;
  officialDescription: string;
}

/**
 * Agricultural Context for AI Smart Farming Mode
 * Mirrors `com.aerolune.app.domain.model.FarmingContextRequest`
 */
export interface FarmingContextRequest {
  cropNameBn: string; // e.g., "আমন ধান (Aman Rice)", "আলু (Potato)", "আম (Mango)"
  cropGrowthStage: string; // e.g., "Flowering", "Harvesting", "Seedling"
  fieldSoilType: string; // e.g., "Loamy (দোআঁশ)", "Clay (এঁটেল)"
  preferredLanguage: LanguageCode; // "bn" for Bengali, "en" for English
}

export interface FarmingTaskRecommendation {
  status: 'OPTIMAL' | 'CAUTION' | 'AVOID';
  recommendedTimeWindow: string; // e.g., "আগামীকাল সকাল ৭:০০ - ১০:০০"
  headline: string;
  detailedReasoning: string;
  triggeringMetrics: string[]; // e.g., ["Wind: 8 km/h", "Rain Prob: 10%"]
}

/**
 * Structured JSON Response Schema from Gemini for Smart Farming Mode
 * Mirrors `com.aerolune.app.domain.model.SmartFarmingAiResponse`
 */
export interface SmartFarmingAiResponse {
  overallSummary: string;
  dataSourceCitation: string;
  irrigationAdvice: FarmingTaskRecommendation;
  pesticideSprayingAdvice: FarmingTaskRecommendation;
  cropDryingAdvice: FarmingTaskRecommendation;
  weatherRiskWarning: string | null;
}

const BANGLISH_PATTERNS = [
  /\b(aj|aaj|ajke|kal|kalker)\b/i,
  /\b(ki|kemon|kখন|kokhon|kothay|koto)\b/i,
  /\b(brishti|bristi|bataash|batas|abohawa|gorom|thanda|megh|rod|roddur)\b/i,
  /\b(hobe|hochhe|ache|nai|jabo|jawa|baire|chata|mask|dhan|foshol|krishi|sech)\b/i,
];

/**
 * Automatically detects whether the user's message is written in Bengali script (বাংলা),
 * Banglish (Bengali written in Latin script, e.g., "Aj ki brishti hobe?"), or English.
 */
export function detectQueryLanguage(
  query: string,
  fallbackLang: LanguageCode = 'en'
): {
  detectedLang: LanguageCode;
  isBanglish: boolean;
  isBengaliScript: boolean;
} {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return {
      detectedLang: fallbackLang,
      isBanglish: false,
      isBengaliScript: fallbackLang === 'bn',
    };
  }

  const hasBengaliScript = /[\u0980-\u09FF]/.test(trimmed);
  if (hasBengaliScript) {
    return {
      detectedLang: 'bn',
      isBanglish: false,
      isBengaliScript: true,
    };
  }

  let banglishHits = 0;
  for (const regex of BANGLISH_PATTERNS) {
    if (regex.test(trimmed)) {
      banglishHits += 1;
    }
  }

  if (banglishHits >= 1) {
    return {
      detectedLang: 'bn',
      isBanglish: true,
      isBengaliScript: false,
    };
  }

  return {
    detectedLang: 'en',
    isBanglish: false,
    isBengaliScript: false,
  };
}

export interface CopilotChatTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Formats the grounded Copilot prompt exactly as `AeroluneAiRepository.askWeatherCopilotStream`:
 * [LIVE_WEATHER_PAYLOAD]
 * <weatherJson>
 * [/LIVE_WEATHER_PAYLOAD]
 *
 * User Question: <userQuery>
 */
export function formatLiveWeatherPayloadPrompt(
  payload: GroundedWeatherPayload,
  userMessage: string,
  pretty = false
): string {
  const weatherJson = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  return [
    '[LIVE_WEATHER_PAYLOAD]',
    weatherJson,
    '[/LIVE_WEATHER_PAYLOAD]',
    '',
    `User Question: ${userMessage}`,
  ].join('\n');
}

/**
 * Formats the Smart Farming prompt exactly as `AeroluneAiRepository.generateSmartFarmingAdvisory`:
 * [LIVE_WEATHER_PAYLOAD]
 * <weatherJson>
 * [/LIVE_WEATHER_PAYLOAD]
 *
 * [FARMING_CONTEXT]
 * <farmingJson>
 * [/FARMING_CONTEXT]
 *
 * Analyze the hourly forecast, wind speed, humidity, and rain probability to generate the Smart Farming advisory.
 */
export function formatSmartFarmingPrompt(
  payload: GroundedWeatherPayload,
  farmingContext: FarmingContextRequest,
  pretty = false
): string {
  const weatherJson = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  const farmingJson = pretty
    ? JSON.stringify(farmingContext, null, 2)
    : JSON.stringify(farmingContext);
  return [
    '[LIVE_WEATHER_PAYLOAD]',
    weatherJson,
    '[/LIVE_WEATHER_PAYLOAD]',
    '',
    '[FARMING_CONTEXT]',
    farmingJson,
    '[/FARMING_CONTEXT]',
    '',
    'Analyze the hourly forecast, wind speed, humidity, and rain probability to generate the Smart Farming advisory.',
  ].join('\n');
}

export function buildGroundedWeatherPayload(
  city: CityLocation,
  point: HourlyTimelinePoint,
  hourlySeries: HourlyTimelinePoint[] = [],
  isOfflineCachedData = false
): GroundedWeatherPayload {
  const country = city.countryEn || 'Bangladesh';

  const cardinal = getCompassDirection(point.windDirectionDeg);
  const pm25Scaled =
    Math.round(
      city.baseTelemetry.pm25 * (point.aqi / Math.max(1, city.baseTelemetry.aqi)) * 10
    ) / 10;
  const pm10Scaled =
    Math.round(
      city.baseTelemetry.pm10 * (point.aqi / Math.max(1, city.baseTelemetry.aqi)) * 10
    ) / 10;

  // Explicitly set pollenIndex to null when regional pollen sensors are unsupported
  const pollenIndex: number | null =
    city.pollenTelemetrySupported && city.baseTelemetry.pollenIndex !== null
      ? city.baseTelemetry.pollenIndex
      : null;

  const forecastPoints: HourlyForecastPoint[] = hourlySeries
    .filter((h) => h.hourOffset >= 0 && h.hourOffset <= 24)
    .slice(0, 24)
    .map((h) => ({
      timestampIso: `2026-10-29T${String(h.localHour).padStart(2, '0')}:00:00+06:00`,
      tempCelsius: h.tempC,
      rainProbabilityPercent: h.rainProb,
      expectedRainMm: h.precipMm,
      windSpeedKmh: h.windSpeedKmh,
      humidityPercent: h.humidity,
      cloudCoverPercent: h.cloudCover,
      conditionLabel: h.conditionCode,
    }));

  const officialAlerts: OfficialWeatherAlert[] = (city.officialAlerts || []).map((a) => ({
    alertId: a.id,
    issuingAgency: a.agency,
    severity: a.severity === 'Emergency' ? 'Extreme' : a.severity,
    headline: a.titleEn,
    affectedAreas: [a.areasEn, ...city.wards.map((w) => w.nameEn)],
    validFromIso: a.issuedAtIso,
    validUntilIso: a.validUntilIso,
    officialDescription: a.whyIssuedEn,
  }));

  return {
    locationName: city.nameEn,
    district: city.districtEn,
    country,
    latitude: city.lat,
    longitude: city.lon,
    dataSourceProvider: `Bangladesh Meteorological Department (BMD) + ${point.dataSource}`,
    lastUpdatedIso: '2026-10-29T18:30:00+06:00',
    isOfflineCachedData,
    current: {
      tempCelsius: point.tempC,
      feelsLikeCelsius: point.feelsLikeC,
      humidityPercent: point.humidity,
      windSpeedKmh: point.windSpeedKmh,
      windGustKmh: point.windGustKmh,
      windDirectionDegrees: point.windDirectionDeg,
      windDirectionCardinal: cardinal,
      rainProbabilityPercent: point.rainProb,
      precipitationMm: point.precipMm,
      uvIndex: point.uvIndex,
      visibilityKm: point.visibilityKm,
      cloudCoverPercent: point.cloudCover,
      aqiIndex: point.aqi,
      pm25: pm25Scaled,
      pm10: pm10Scaled,
      pollenIndex,
      sunriseIso: '2026-10-29T05:58:00+06:00',
      sunsetIso: '2026-10-29T17:24:00+06:00',
    },
    hourlyForecast24h: forecastPoints,
    officialAlerts,
  };
}

/**
 * Generates a strictly grounded AI Weather Copilot response adhering to
 * `AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION`.
 */
export function generateGroundedCopilotReply(
  userMessage: string,
  payload: GroundedWeatherPayload,
  fallbackLang: LanguageCode = 'en'
): {
  replyText: string;
  detectedLanguage: LanguageCode;
  isBanglish: boolean;
  citationLine: string;
} {
  const { detectedLang, isBanglish } = detectQueryLanguage(userMessage, fallbackLang);
  const isBn = detectedLang === 'bn';
  const c = payload.current;
  const lowerQuery = (userMessage || '').toLowerCase();

  const offlinePrefix = payload.isOfflineCachedData
    ? isBn
      ? `⚠️ আপনি বর্তমানে অফলাইনে আছেন; নিচের তথ্যটি সর্বশেষ ক্যাশকৃত আপডেট (${payload.lastUpdatedIso}) এর ওপর ভিত্তি করে দেওয়া হলো।\n`
      : `⚠️ You are currently offline; this response is based on the last cached update at ${payload.lastUpdatedIso}.\n`
    : '';

  const asksPollen =
    lowerQuery.includes('pollen') ||
    lowerQuery.includes('allergy') ||
    lowerQuery.includes('পরাগ') ||
    lowerQuery.includes('এলার্জি');

  const nullPollenSentence =
    c.pollenIndex === null && (asksPollen || c.aqiIndex !== null)
      ? isBn
        ? `এই অঞ্চলে পরাগরেণু (pollenIndex: null) পরিমাপের কোনো লাইভ সেন্সর ডেটা বর্তমানে উপলব্ধ নেই।`
        : `Sensor data for pollenIndex (null) is currently unavailable in this region and is never estimated.`
      : '';

  const alertSentence =
    payload.officialAlerts.length > 0
      ? isBn
        ? `অফিসিয়াল সতর্কবার্তা (${payload.officialAlerts[0].issuingAgency}): ${payload.officialAlerts[0].headline} (${payload.officialAlerts[0].severity})।`
        : `Official Alert (${payload.officialAlerts[0].issuingAgency}): ${payload.officialAlerts[0].headline} (${payload.officialAlerts[0].severity}).`
      : isBn
        ? `বর্তমানে ${payload.locationName}-এ কোনো অফিসিয়াল ঝড় বা তাপপ্রবাহের সতর্কবার্তা নেই (officialAlerts: [])।`
        : `No active storm, cyclone, or heatwave warnings are in effect for ${payload.locationName} (officialAlerts: []).`;

  const umbrellaAdvice =
    c.rainProbabilityPercent >= 45
      ? isBn
        ? `বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}% (${c.precipitationMm} মিমি) থাকায় বাইরে বের হলে অবশ্যই ছাতা বা রেইনকোট সাথে রাখুন।`
        : `With a ${c.rainProbabilityPercent}% rain probability (${c.precipitationMm} mm), carry an umbrella and plan for wet commuting conditions.`
      : isBn
        ? `বৃষ্টির সম্ভাবনা মাত্র ${c.rainProbabilityPercent}% (${c.precipitationMm} মিমি), তাই সাধারণ যাতায়াতের জন্য আবহাওয়া অনুকূল।`
        : `With only ${c.rainProbabilityPercent}% rain probability (${c.precipitationMm} mm), outdoor commuting is largely clear of rain disruption.`;

  const coreSummary = isBn
    ? `${payload.locationName} (${payload.district})-এ বর্তমান তাপমাত্রা ${c.tempCelsius}°C (অনুভূত ${c.feelsLikeCelsius}°C), আর্দ্রতা ${c.humidityPercent}%, এবং বাতাস ${c.windSpeedKmh} কিমি/ঘণ্টা (${c.windDirectionCardinal})। বায়ু মান সূচক (AQI) ${c.aqiIndex ?? 'অনুপলব্ধ'} (PM2.5: ${c.pm25 ?? 'N/A'} µg/m³) এবং ইউভি সূচক ${c.uvIndex}।`
    : `In ${payload.locationName} (${payload.district}), current temperature is ${c.tempCelsius}°C (feels like ${c.feelsLikeCelsius}°C) with ${c.humidityPercent}% humidity and ${c.windSpeedKmh} km/h ${c.windDirectionCardinal} winds. Air Quality Index is ${c.aqiIndex ?? 'unavailable'} (PM2.5: ${c.pm25 ?? 'N/A'} µg/m³) and UV Index is ${c.uvIndex}.`;

  const citationLine = isBn
    ? `সূত্র: ${payload.dataSourceProvider} • আপডেট: ${payload.lastUpdatedIso}`
    : `Source: ${payload.dataSourceProvider} • Last Updated: ${payload.lastUpdatedIso}`;

  const parts = [
    offlinePrefix.trim(),
    coreSummary,
    umbrellaAdvice,
    alertSentence,
    nullPollenSentence,
    citationLine,
  ].filter(Boolean);

  return {
    replyText: parts.join('\n'),
    detectedLanguage: detectedLang,
    isBanglish,
    citationLine,
  };
}

/**
 * Generates a strictly grounded `SmartFarmingAiResponse` from the live `GroundedWeatherPayload`
 * and `FarmingContextRequest`, adhering to `AeroluneSystemPrompts.SMART_FARMING_SYSTEM_INSTRUCTION`.
 */
export function generateGroundedSmartFarmingResponse(
  payload: GroundedWeatherPayload,
  context: FarmingContextRequest
): SmartFarmingAiResponse {
  const c = payload.current;
  const isBn = context.preferredLanguage === 'bn';

  const next6Hours = payload.hourlyForecast24h.slice(0, 6);
  const maxRainProb6h =
    next6Hours.length > 0
      ? Math.max(c.rainProbabilityPercent, ...next6Hours.map((h) => h.rainProbabilityPercent))
      : c.rainProbabilityPercent;

  const expected24hRainMm =
    payload.hourlyForecast24h.length > 0
      ? Math.round(
          payload.hourlyForecast24h.reduce((sum, h) => sum + h.expectedRainMm, 0) * 10
        ) / 10
      : Math.round(c.precipitationMm * 4 * 10) / 10;

  // 1. Irrigation Scheduling (`irrigationAdvice`):
  // If expected rainfall in the next 24h > 10 mm or rain probability >= 65%, set status to AVOID or CAUTION
  const irrigationStatus: FarmingTaskRecommendation['status'] =
    expected24hRainMm > 10 || c.rainProbabilityPercent >= 65
      ? 'AVOID'
      : c.rainProbabilityPercent >= 40 || expected24hRainMm >= 5
        ? 'CAUTION'
        : 'OPTIMAL';

  const irrigationAdvice: FarmingTaskRecommendation = {
    status: irrigationStatus,
    recommendedTimeWindow:
      irrigationStatus === 'AVOID'
        ? isBn
          ? 'আজ সেচ বন্ধ রাখুন (প্রাকৃতিক বৃষ্টির সম্ভাবনা ও পাম্পের জ্বালানি সাশ্রয়)'
          : 'Suspend today (Natural rainfall expected; save pump fuel/electricity)'
        : isBn
          ? 'আগামীকাল ভোর ৬:০০ - সকাল ৮:৩০ অথবা বিকেল ৫:০০ - ৬:৩০'
          : 'Tomorrow 06:00 – 08:30 AM or 05:00 – 06:30 PM',
    headline:
      irrigationStatus === 'AVOID'
        ? isBn
          ? `${context.cropNameBn} ক্ষেতে এখন সেচ দেওয়ার প্রয়োজন নেই`
          : `Hold irrigation for ${context.cropNameBn} to prevent waterlogging`
        : irrigationStatus === 'CAUTION'
          ? isBn
            ? `${context.fieldSoilType} মাটির আর্দ্রতা যাচাই করে সীমিত সেচ দিন`
            : `Monitor ${context.fieldSoilType} soil moisture before light irrigation`
          : isBn
            ? `${context.fieldSoilType} মাটিতে সকাল বা সন্ধ্যায় সেচ উপযোগী`
            : `Early morning or evening irrigation optimal for ${context.fieldSoilType} soil`,
    detailedReasoning: isBn
      ? `${payload.locationName}-এ বর্তমানে বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}% (২৪ ঘণ্টায় সম্ভাব্য বৃষ্টি ${expected24hRainMm} মিমি) এবং আর্দ্রতা ${c.humidityPercent}%। ${
          irrigationStatus === 'AVOID'
            ? 'বৃষ্টির সম্ভাবনা বেশি থাকায় সেচ বন্ধ রাখলে জলাবদ্ধতা রোধ হবে এবং পাম্পের বিদ্যুৎ/ডিজেল সাশ্রয় হবে।'
            : `${context.cropGrowthStage} পর্যায়ে সকালে বা সন্ধ্যায় সেচ দিলে বাষ্পীভবন হ্রাস পাবে।`
        }`
      : `Live telemetry in ${payload.locationName} shows ${c.rainProbabilityPercent}% rain probability (${expected24hRainMm} mm expected over 24h) and ${c.humidityPercent}% relative humidity. ${
          irrigationStatus === 'AVOID'
            ? 'Suspending irrigation prevents root waterlogging and saves pump fuel/electricity.'
            : `Scheduling irrigation in early morning or evening during ${context.cropGrowthStage} minimizes evaporation loss.`
        }`,
    triggeringMetrics: [
      `Rain Prob: ${c.rainProbabilityPercent}%`,
      `24h Rain: ${expected24hRainMm} mm`,
      `Humidity: ${c.humidityPercent}%`,
    ],
  };

  // 2. Pesticide & Fertilizer Spraying (`pesticideSprayingAdvice`):
  // AVOID if wind > 15 km/h OR rainProbabilityPercent > 40% within 6h OR temp > 33°C
  // OPTIMAL when wind is between 3 km/h and 12 km/h and rain probability < 25%
  const sprayStatus: FarmingTaskRecommendation['status'] =
    c.windSpeedKmh > 15 || maxRainProb6h > 40 || c.tempCelsius > 33
      ? 'AVOID'
      : c.windSpeedKmh >= 3 && c.windSpeedKmh <= 12 && maxRainProb6h < 25
        ? 'OPTIMAL'
        : 'CAUTION';

  const pesticideSprayingAdvice: FarmingTaskRecommendation = {
    status: sprayStatus,
    recommendedTimeWindow:
      sprayStatus === 'OPTIMAL'
        ? isBn
          ? 'আজ সকাল ৭:০০ - ১০:০০ অথবা বিকেল ৪:৩০ - ৫:৩০'
          : 'Calm morning 07:00 – 10:00 AM or late afternoon 04:30 – 05:30 PM'
        : isBn
          ? 'বাতাস ১৫ কিমি/ঘণ্টা ও বৃষ্টির ঝুঁকি ৪০% এর নিচে নামলে সকাল ৭:০০ - ৯:৩০'
          : 'Wait until wind < 15 km/h and 6h rain risk < 40% (07:00 – 09:30 AM)',
    headline:
      sprayStatus === 'AVOID'
        ? isBn
          ? 'স্প্রে ড্রিফট বা বৃষ্টির ধুয়ে যাওয়ার ঝুঁকিতে এখন স্প্রে করা নিষেধ'
          : 'Avoid foliar spraying — wind drift (>15 km/h), rain wash-off (>40%), or thermal burn risk'
        : sprayStatus === 'CAUTION'
          ? isBn
            ? 'সতর্কতার সাথে শান্ত বাতাসে স্প্রে করুন'
            : 'Exercise caution — wait for calm wind window (3–12 km/h)'
          : isBn
            ? `${context.cropNameBn}-এ বালাইনাশক ও সার স্প্রে করার অনুকূল পরিবেশ`
            : `Optimal calm window for foliar application on ${context.cropNameBn}`,
    detailedReasoning: isBn
      ? `বাতাসের গতি বর্তমানে ${c.windSpeedKmh} কিমি/ঘণ্টা (${c.windDirectionCardinal}), আগামী ৬ ঘণ্টায় বৃষ্টির সর্বোচ্চ সম্ভাবনা ${maxRainProb6h}%, এবং তাপমাত্রা ${c.tempCelsius}°C। কৃষি আবহাওয়া নিয়ম অনুযায়ী বাতাস ১৫ কিমি/ঘণ্টার বেশি, বৃষ্টির সম্ভাবনা ৪০% এর বেশি, বা তাপমাত্রা ৩৩°C এর উপরে থাকলে স্প্রে এড়িয়ে চলতে হবে।`
      : `Current wind speed is ${c.windSpeedKmh} km/h (${c.windDirectionCardinal}), 6-hour max rain probability is ${maxRainProb6h}%, and temperature is ${c.tempCelsius}°C. Agronomic thresholds mandate AVOID when wind exceeds 15 km/h, 6h rain probability exceeds 40%, or temperature exceeds 33°C.`,
    triggeringMetrics: [
      `Wind: ${c.windSpeedKmh} km/h (${c.windDirectionCardinal})`,
      `6h Rain Prob: ${maxRainProb6h}%`,
      `Temp: ${c.tempCelsius}°C`,
    ],
  };

  // 3. Crop & Grain Drying (`cropDryingAdvice`):
  // Requires low humidity (< 65%), low cloud cover, and near-zero rain probability for at least 5 consecutive daylight hours
  const dryingStatus: FarmingTaskRecommendation['status'] =
    c.humidityPercent < 65 && c.cloudCoverPercent < 45 && c.rainProbabilityPercent < 20
      ? 'OPTIMAL'
      : c.rainProbabilityPercent > 40 || c.humidityPercent >= 75 || c.cloudCoverPercent >= 75
        ? 'AVOID'
        : 'CAUTION';

  const cropDryingAdvice: FarmingTaskRecommendation = {
    status: dryingStatus,
    recommendedTimeWindow:
      dryingStatus === 'AVOID'
        ? isBn
          ? 'খোলা রোদে ফসল শুকানো থেকে বিরত থাকুন'
          : 'Avoid open-yard sun drying today'
        : isBn
          ? 'সকাল ১০:০০ - দুপুর ৩:০০ (টানা ৫ ঘণ্টা রোদ ও কম আর্দ্রতা)'
          : '10:00 AM – 03:00 PM (5 Consecutive Daylight Hours)',
    headline:
      dryingStatus === 'AVOID'
        ? isBn
          ? 'উচ্চ আর্দ্রতা (≥৬৫%) ও মেঘের কারণে খোলা স্থানে ফসল শুকানো ঝুঁকিপূর্ণ'
          : 'Humidity (≥65%) and cloud cover restrict open-air grain drying'
        : dryingStatus === 'CAUTION'
          ? isBn
            ? 'আংশিক রোদে ত্রিপল প্রস্তুত রেখে ফসল শুকান'
            : 'Partial drying window — keep tarpaulin covers on standby'
          : isBn
            ? `${context.cropNameBn} শুকানো ও সংরক্ষণের সর্বোত্তম ৫ ঘণ্টার রোদ`
            : `Optimal 5-hour low-humidity solar window for drying ${context.cropNameBn}`,
    detailedReasoning: isBn
      ? `আপেক্ষিক আর্দ্রতা ${c.humidityPercent}%, মেঘের ঘনত্ব ${c.cloudCoverPercent}%, এবং বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}%। নিরাপদে শস্য শুকানোর জন্য আর্দ্রতা ৬৫% এর নিচে, কম মেঘ এবং টানা ৫ ঘণ্টা বৃষ্টিহীন রোদ প্রয়োজন।`
      : `Relative humidity is ${c.humidityPercent}%, cloud cover is ${c.cloudCoverPercent}%, and rain probability is ${c.rainProbabilityPercent}%. Effective grain drying requires humidity below 65%, low cloud cover, and near-zero rain probability across 5 consecutive daylight hours.`,
    triggeringMetrics: [
      `Humidity: ${c.humidityPercent}%`,
      `Cloud Cover: ${c.cloudCoverPercent}%`,
      `Rain Prob: ${c.rainProbabilityPercent}%`,
    ],
  };

  // 4. Official Severe Weather (`weatherRiskWarning`):
  // Only populate if `officialAlerts` is non-empty or if hourly data explicitly shows extreme thresholds (>30 mm/hr rain or >45 km/h gusts)
  const maxHourlyRainMm = Math.max(
    c.precipitationMm,
    ...payload.hourlyForecast24h.map((h) => h.expectedRainMm)
  );
  const maxWindGustKmh = c.windGustKmh ?? c.windSpeedKmh;

  const weatherRiskWarning: string | null =
    payload.officialAlerts.length > 0
      ? `${payload.officialAlerts[0].issuingAgency} (${payload.officialAlerts[0].severity}): ${payload.officialAlerts[0].headline} — ${payload.officialAlerts[0].officialDescription}`
      : maxHourlyRainMm > 30 || maxWindGustKmh > 45
        ? isBn
          ? `চরম আবহাওয়া সতর্কতা: ঘণ্টায় ${maxHourlyRainMm} মিমি বৃষ্টিপাত বা ${maxWindGustKmh} কিমি/ঘণ্টা দমকা বাতাসের রেকর্ড পাওয়া গেছে।`
          : `Extreme Threshold Alert: Telemetry indicates ${maxHourlyRainMm} mm/hr rainfall or ${maxWindGustKmh} km/h wind gusts.`
        : null;

  return {
    overallSummary: isBn
      ? `${payload.locationName} (${payload.district}) অঞ্চলের ${context.cropNameBn} (${context.cropGrowthStage}, ${context.fieldSoilType}) এর জন্য লাইভ আবহাওয়া ভিত্তিক কৃষি পরামর্শ: তাপমাত্রা ${c.tempCelsius}°C, আর্দ্রতা ${c.humidityPercent}%, বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}%, এবং বাতাস ${c.windSpeedKmh} কিমি/ঘণ্টা।`
      : `Grounded agricultural advisory for ${context.cropNameBn} (${context.cropGrowthStage}, ${context.fieldSoilType}) in ${payload.locationName} (${payload.district}): Temp ${c.tempCelsius}°C, Humidity ${c.humidityPercent}%, Rain Prob ${c.rainProbabilityPercent}%, Wind ${c.windSpeedKmh} km/h.`,
    dataSourceCitation: `${payload.dataSourceProvider} • ${payload.lastUpdatedIso}`,
    irrigationAdvice,
    pesticideSprayingAdvice,
    cropDryingAdvice,
    weatherRiskWarning,
  };
}

/**
 * Configuration metadata mirroring `com.aerolune.app.data.ai.AeroluneAiRepository`
 */
export const AEROLUNE_AI_REPOSITORY_CONFIG = {
  jsonSerializer: {
    ignoreUnknownKeys: true,
    encodeDefaults: true,
    prettyPrint: false,
  },
  copilotModel: {
    modelName: 'gemini-2.5-flash',
    temperature: 0.2,
    topP: 0.85,
    systemInstruction: AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION,
  },
  smartFarmingModel: {
    modelName: 'gemini-2.5-flash',
    temperature: 0.1,
    responseMimeType: 'application/json',
    statusEnum: ['OPTIMAL', 'CAUTION', 'AVOID'] as const,
    requiredFields: [
      'overallSummary',
      'dataSourceCitation',
      'irrigationAdvice',
      'pesticideSprayingAdvice',
      'cropDryingAdvice',
    ] as const,
    taskRequiredFields: [
      'status',
      'recommendedTimeWindow',
      'headline',
      'detailedReasoning',
      'triggeringMetrics',
    ] as const,
    systemInstruction: AeroluneSystemPrompts.SMART_FARMING_SYSTEM_INSTRUCTION,
  },
  skyVisionModel: {
    modelName: 'gemini-2.5-flash',
    temperature: 0.2,
    responseMimeType: 'application/json',
    maxBitmapDimension: 1024,
    alignmentStatusEnum: ['MATCHES', 'LOCALIZED_DIFFERENCE', 'OBSCURED'] as const,
    requiredFields: [
      'isSkyDetected',
      'detectedCloudGenera',
      'visualSkyDescription',
      'lightingAndPhotographyAdvice',
      'stationDataComparison',
      'dataSourceCitation',
    ] as const,
    lightingRequiredFields: [
      'lightingCondition',
      'goldenHourSuitabilityScore',
      'cameraAndShootAdvice',
    ] as const,
    stationComparisonRequiredFields: [
      'alignmentStatus',
      'comparisonExplanation',
    ] as const,
    systemInstruction: AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION,
  },
} as const;

/**
 * TypeScript / Web runtime mirror of `com.aerolune.app.data.ai.AeroluneAiRepository`
 */
export class AeroluneAiRepository {
  /**
   * Streams a grounded bilingual response for the AI Weather Copilot (`Flow<String>`).
   * Injects the latest live weather payload into the prompt turn so it never goes stale.
   */
  static async askWeatherCopilotStream(
    userQuery: string,
    liveWeather: GroundedWeatherPayload,
    chatHistory: CopilotChatTurn[] = [],
    onChunk?: (chunkText: string, accumulatedText: string) => void
  ): Promise<{
    fullText: string;
    groundedPrompt: string;
    detectedLanguage: LanguageCode;
    isBanglish: boolean;
    source: string;
  }> {
    const groundedPrompt = formatLiveWeatherPayloadPrompt(liveWeather, userQuery, false);
    const deterministic = generateGroundedCopilotReply(userQuery, liveWeather);

    try {
      const resp = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          payload: liveWeather,
          chatHistory,
        }),
      });
      const data = await resp.json();
      const targetText: string =
        typeof data?.text === 'string' && data.text.trim().length > 0
          ? data.text
          : deterministic.replyText;

      // Emit progressive chunks like Kotlin Flow<String>
      if (onChunk) {
        const tokens = targetText.split(/(?=\s)/);
        let acc = '';
        const step = Math.max(1, Math.ceil(tokens.length / 8));
        for (let i = 0; i < tokens.length; i += step) {
          const piece = tokens.slice(i, i + step).join('');
          acc += piece;
          onChunk(piece, acc);
        }
      }

      return {
        fullText: targetText,
        groundedPrompt,
        detectedLanguage: deterministic.detectedLanguage,
        isBanglish: deterministic.isBanglish,
        source: data?.source || 'AeroluneAiRepository.copilotModel',
      };
    } catch {
      if (onChunk) {
        onChunk(deterministic.replyText, deterministic.replyText);
      }
      return {
        fullText: deterministic.replyText,
        groundedPrompt,
        detectedLanguage: deterministic.detectedLanguage,
        isBanglish: deterministic.isBanglish,
        source: 'AeroluneAiRepository.localFallback',
      };
    }
  }

  /**
   * Generates a strictly typed Smart Farming advisory based on crop profile & live forecast
   * (`suspend fun generateSmartFarmingAdvisory(...): Result<SmartFarmingAiResponse>`).
   */
  static async generateSmartFarmingAdvisory(
    liveWeather: GroundedWeatherPayload,
    farmingContext: FarmingContextRequest
  ): Promise<{
    ok: boolean;
    value: SmartFarmingAiResponse;
    prompt: string;
    source: string;
  }> {
    const prompt = formatSmartFarmingPrompt(liveWeather, farmingContext, false);
    const fallbackValue = generateGroundedSmartFarmingResponse(liveWeather, farmingContext);

    try {
      const resp = await fetch('/api/ai/smart-farming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: liveWeather,
          farmingContext,
        }),
      });
      const data = await resp.json();
      if (data?.response?.irrigationAdvice) {
        return {
          ok: true,
          value: data.response as SmartFarmingAiResponse,
          prompt,
          source: data.source || 'AeroluneAiRepository.smartFarmingModel',
        };
      }
      return {
        ok: true,
        value: fallbackValue,
        prompt,
        source: 'AeroluneAiRepository.deterministicSchemaEngine',
      };
    } catch {
      return {
        ok: true,
        value: fallbackValue,
        prompt,
        source: 'AeroluneAiRepository.deterministicSchemaEngine',
      };
    }
  }
}

export const AEROLUNE_AI_REPOSITORY_KT_SOURCE = `package com.aerolune.app.data.ai

import com.aerolune.app.domain.model.FarmingContextRequest
import com.aerolune.app.domain.model.GroundedWeatherPayload
import com.aerolune.app.domain.model.SmartFarmingAiResponse
import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.Content
import com.google.ai.client.generativeai.type.FunctionType
import com.google.ai.client.generativeai.type.Schema
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AeroluneAiRepository(
    private val geminiApiKey: String
) {
    private val jsonSerializer = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }

    // 1. Model for Conversational AI Weather Copilot
    private val copilotModel by lazy {
        GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = geminiApiKey,
            generationConfig = generationConfig {
                temperature = 0.2f // Low temperature to enforce strict factual adherence
                topP = 0.85f
            },
            systemInstruction = content {
                text(AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION)
            }
        )
    }

    // 2. Model for Structured AI Smart Farming Mode
    private val smartFarmingModel by lazy {
        val taskRecommendationSchema = Schema(
            name = "taskRecommendation",
            description = "Recommendation for a specific farming activity",
            type = FunctionType.OBJECT,
            properties = mapOf(
                "status" to Schema(
                    name = "status",
                    description = "Must be OPTIMAL, CAUTION, or AVOID",
                    type = FunctionType.STRING,
                    enum = listOf("OPTIMAL", "CAUTION", "AVOID")
                ),
                "recommendedTimeWindow" to Schema(
                    name = "recommendedTimeWindow",
                    description = "Best hours to perform the activity based on hourly forecast",
                    type = FunctionType.STRING
                ),
                "headline" to Schema(
                    name = "headline",
                    description = "Short actionable title in requested language",
                    type = FunctionType.STRING
                ),
                "detailedReasoning" to Schema(
                    name = "detailedReasoning",
                    description = "Explanation referencing exact metrics from payload",
                    type = FunctionType.STRING
                ),
                "triggeringMetrics" to Schema(
                    name = "triggeringMetrics",
                    description = "List of exact weather data points used",
                    type = FunctionType.ARRAY,
                    items = Schema(name = "metric", type = FunctionType.STRING)
                )
            ),
            required = listOf("status", "recommendedTimeWindow", "headline", "detailedReasoning", "triggeringMetrics")
        )

        GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = geminiApiKey,
            generationConfig = generationConfig {
                temperature = 0.1f // Near-deterministic for agricultural safety
                responseMimeType = "application/json"
                responseSchema = Schema(
                    name = "smartFarmingResponse",
                    description = "Grounded agricultural weather advisory",
                    type = FunctionType.OBJECT,
                    properties = mapOf(
                        "overallSummary" to Schema(name = "overallSummary", type = FunctionType.STRING),
                        "dataSourceCitation" to Schema(name = "dataSourceCitation", type = FunctionType.STRING),
                        "irrigationAdvice" to taskRecommendationSchema,
                        "pesticideSprayingAdvice" to taskRecommendationSchema,
                        "cropDryingAdvice" to taskRecommendationSchema,
                        "weatherRiskWarning" to Schema(
                            name = "weatherRiskWarning",
                            type = FunctionType.STRING,
                            nullable = true
                        )
                    ),
                    required = listOf(
                        "overallSummary",
                        "dataSourceCitation",
                        "irrigationAdvice",
                        "pesticideSprayingAdvice",
                        "cropDryingAdvice"
                    )
                )
            },
            systemInstruction = content {
                text(AeroluneSystemPrompts.SMART_FARMING_SYSTEM_INSTRUCTION)
            }
        )
    }

    /**
     * Streams a grounded bilingual response for the AI Weather Copilot.
     * Injects the latest live weather payload into the prompt turn so it never goes stale.
     */
    fun askWeatherCopilotStream(
        userQuery: String,
        liveWeather: GroundedWeatherPayload,
        chatHistory: List<Content> = emptyList()
    ): Flow<String> {
        val weatherJson = jsonSerializer.encodeToString(liveWeather)
        val groundedPrompt = buildString {
            appendLine("[LIVE_WEATHER_PAYLOAD]")
            appendLine(weatherJson)
            appendLine("[/LIVE_WEATHER_PAYLOAD]")
            appendLine()
            appendLine("User Question: $userQuery")
        }

        val chat = copilotModel.startChat(history = chatHistory)
        return chat.sendMessageStream(groundedPrompt).mapNotNull { it.text }
    }

    /**
     * Generates a strictly typed Smart Farming advisory based on crop profile & live forecast.
     */
    suspend fun generateSmartFarmingAdvisory(
        liveWeather: GroundedWeatherPayload,
        farmingContext: FarmingContextRequest
    ): Result<SmartFarmingAiResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val weatherJson = jsonSerializer.encodeToString(liveWeather)
            val farmingJson = jsonSerializer.encodeToString(farmingContext)

            val prompt = """
                [LIVE_WEATHER_PAYLOAD]
                $weatherJson
                [/LIVE_WEATHER_PAYLOAD]
                
                [FARMING_CONTEXT]
                $farmingJson
                [/FARMING_CONTEXT]
                
                Analyze the hourly forecast, wind speed, humidity, and rain probability to generate the Smart Farming advisory.
            """.trimIndent()

            val response = smartFarmingModel.generateContent(prompt)
            val rawJson = response.text
                ?: throw IllegalStateException("Empty response from Gemini Smart Farming model")

            jsonSerializer.decodeFromString<SmartFarmingAiResponse>(rawJson)
        }
    }
}`;

/**
 * ViewModel & Jetpack Compose UI Integration (`package com.aerolune.app.presentation.ai`)
 */
export interface ChatMessage {
  id: string;
  text: string;
  isFromUser: boolean;
  isStreaming: boolean;
}

export interface AeroluneAiUiState {
  chatMessages: ChatMessage[];
  isCopilotLoading: boolean;
  selectedCrop: string;
  selectedGrowthStage: string;
  farmingAdvisory: SmartFarmingAiResponse | null;
  isFarmingLoading: boolean;
  errorMessage: string | null;
}

export function createInitialAeroluneAiUiState(): AeroluneAiUiState {
  return {
    chatMessages: [],
    isCopilotLoading: false,
    selectedCrop: 'আমন ধান (Aman Rice)',
    selectedGrowthStage: 'ফুল আসার সময় (Flowering)',
    farmingAdvisory: null,
    isFarmingLoading: false,
    errorMessage: null,
  };
}

export function reduceSendCopilotQuestionStart(
  state: AeroluneAiUiState,
  question: string,
  nowMs: number = Date.now()
): { nextState: AeroluneAiUiState; aiPlaceholderId: string | null } {
  if (!question.trim()) {
    return { nextState: state, aiPlaceholderId: null };
  }

  const userMsg: ChatMessage = {
    id: String(nowMs),
    text: question,
    isFromUser: true,
    isStreaming: false,
  };
  const aiPlaceholderId = String(nowMs + 1);
  const aiPlaceholder: ChatMessage = {
    id: aiPlaceholderId,
    text: '',
    isFromUser: false,
    isStreaming: true,
  };

  return {
    aiPlaceholderId,
    nextState: {
      ...state,
      chatMessages: [...state.chatMessages, userMsg, aiPlaceholder],
      isCopilotLoading: true,
      errorMessage: null,
    },
  };
}

export function reduceCopilotStreamChunk(
  state: AeroluneAiUiState,
  aiPlaceholderId: string,
  accumulatedText: string
): AeroluneAiUiState {
  return {
    ...state,
    chatMessages: state.chatMessages.map((msg) =>
      msg.id === aiPlaceholderId
        ? { ...msg, text: accumulatedText, isStreaming: false }
        : msg
    ),
    isCopilotLoading: false,
  };
}

export function reduceCopilotStreamError(
  state: AeroluneAiUiState,
  errorMsg: string
): AeroluneAiUiState {
  return {
    ...state,
    isCopilotLoading: false,
    errorMessage: `AI সংযোগে ত্রুটি: ${errorMsg}`,
  };
}

export function reduceSmartFarmingLoadStart(state: AeroluneAiUiState): AeroluneAiUiState {
  return {
    ...state,
    isFarmingLoading: true,
    errorMessage: null,
  };
}

export function reduceSmartFarmingSuccess(
  state: AeroluneAiUiState,
  advisory: SmartFarmingAiResponse
): AeroluneAiUiState {
  return {
    ...state,
    farmingAdvisory: advisory,
    isFarmingLoading: false,
  };
}

export function reduceSmartFarmingFailure(
  state: AeroluneAiUiState,
  errorMsg: string
): AeroluneAiUiState {
  return {
    ...state,
    isFarmingLoading: false,
    errorMessage: `কৃষি পরামর্শ লোড করা যায়নি: ${errorMsg}`,
  };
}

export const AEROLUNE_AI_VIEWMODEL_KT_SOURCE = `package com.aerolune.app.presentation.ai

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aerolune.app.data.ai.AeroluneAiRepository
import com.aerolune.app.domain.model.FarmingContextRequest
import com.aerolune.app.domain.model.GroundedWeatherPayload
import com.aerolune.app.domain.model.SmartFarmingAiResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String,
    val text: String,
    val isFromUser: Boolean,
    val isStreaming: Boolean = false
)

data class AeroluneAiUiState(
    val chatMessages: List<ChatMessage> = emptyList(),
    val isCopilotLoading: Boolean = false,
    val selectedCrop: String = "আমন ধান (Aman Rice)",
    val selectedGrowthStage: String = "ফুল আসার সময় (Flowering)",
    val farmingAdvisory: SmartFarmingAiResponse? = null,
    val isFarmingLoading: Boolean = false,
    val errorMessage: String? = null
)

class AeroluneAiViewModel(
    private val aiRepository: AeroluneAiRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AeroluneAiUiState())
    val uiState: StateFlow<AeroluneAiUiState> = _uiState.asStateFlow()

    /**
     * Sends a user question (Bengali, English, or Banglish) to the grounded Weather Copilot.
     */
    fun sendCopilotQuestion(
        question: String,
        currentWeatherPayload: GroundedWeatherPayload
    ) {
        if (question.isBlank()) return

        val userMsg = ChatMessage(
            id = System.currentTimeMillis().toString(),
            text = question,
            isFromUser = true
        )
        val aiPlaceholderId = (System.currentTimeMillis() + 1).toString()
        val aiPlaceholder = ChatMessage(
            id = aiPlaceholderId,
            text = "",
            isFromUser = false,
            isStreaming = true
        )

        _uiState.update { state ->
            state.copy(
                chatMessages = state.chatMessages + userMsg + aiPlaceholder,
                isCopilotLoading = true,
                errorMessage = null
            )
        }

        viewModelScope.launch {
            val accumulatedText = StringBuilder()

            aiRepository.askWeatherCopilotStream(
                userQuery = question,
                liveWeather = currentWeatherPayload
            ).catch { e ->
                _uiState.update { state ->
                    state.copy(
                        isCopilotLoading = false,
                        errorMessage = "AI সংযোগে ত্রুটি: \${e.localizedMessage}"
                    )
                }
            }.collect { chunk ->
                accumulatedText.append(chunk)
                _uiState.update { state ->
                    state.copy(
                        chatMessages = state.chatMessages.map { msg ->
                            if (msg.id == aiPlaceholderId) {
                                msg.copy(text = accumulatedText.toString(), isStreaming = false)
                            } else msg
                        },
                        isCopilotLoading = false
                    )
                }
            }
        }
    }

    /**
     * Fetches structured Smart Farming recommendations for Irrigation, Spraying, and Crop Drying.
     */
    fun loadSmartFarmingAdvice(
        currentWeatherPayload: GroundedWeatherPayload,
        languageCode: String = "bn"
    ) {
        _uiState.update { it.copy(isFarmingLoading = true, errorMessage = null) }

        val request = FarmingContextRequest(
            cropNameBn = _uiState.value.selectedCrop,
            cropGrowthStage = _uiState.value.selectedGrowthStage,
            fieldSoilType = "দোআঁশ (Loamy)",
            preferredLanguage = languageCode
        )

        viewModelScope.launch {
            aiRepository.generateSmartFarmingAdvisory(
                liveWeather = currentWeatherPayload,
                farmingContext = request
            ).onSuccess { response ->
                _uiState.update {
                    it.copy(
                        farmingAdvisory = response,
                        isFarmingLoading = false
                    )
                }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isFarmingLoading = false,
                        errorMessage = "কৃষি পরামর্শ লোড করা যায়নি: \${error.localizedMessage}"
                    )
                }
            }
        }
    }
}`;

/**
 * Sky Vision AI Data Models (`package com.aerolune.app.domain.model`)
 */
export interface PhotographyLightingAnalysis {
  lightingCondition: string; // e.g., "Golden Hour Diffused", "Overcast Soft Light", "Harsh Midday"
  goldenHourSuitabilityScore: number; // 1 to 10 scale
  cameraAndShootAdvice: string; // Practical advice for outdoor photos/video shoots
}

export interface StationComparisonReport {
  alignmentStatus: 'MATCHES' | 'LOCALIZED_DIFFERENCE' | 'OBSCURED';
  comparisonExplanation: string; // Explains how the photo compares to the JSON station payload
}

export interface SkyVisionAiResponse {
  isSkyDetected: boolean;
  detectedCloudGenera: string[]; // e.g., ["Cumulonimbus (বজ্রমেঘ)", "Cirrus (অলক মেঘ)"]
  visualSkyDescription: string;
  lightingAndPhotographyAdvice: PhotographyLightingAnalysis;
  stationDataComparison: StationComparisonReport;
  dataSourceCitation: string;
}

/**
 * Resolves the Android / Web SpeechRecognizer (STT) and TextToSpeech (TTS) BCP-47 locale tag
 * (`bn-BD` vs `en-US`) automatically from Bengali script or Banglish detection.
 */
export function resolveVoiceLocaleForText(
  text: string,
  fallbackLang: LanguageCode = 'en'
): 'bn-BD' | 'en-US' {
  const { detectedLang } = detectQueryLanguage(text, fallbackLang);
  return detectedLang === 'bn' ? 'bn-BD' : 'en-US';
}

/**
 * Generates a strictly grounded `SkyVisionAiResponse` cross-verifying the camera sky preset
 * against the live `GroundedWeatherPayload` station telemetry.
 */
export function generateGroundedSkyVisionResponse(
  preset: 'cumulonimbus' | 'golden_hour' | 'cirrus' | 'non_sky',
  payload: GroundedWeatherPayload,
  lang: LanguageCode = 'en'
): SkyVisionAiResponse {
  const isBn = lang === 'bn';
  const c = payload.current;
  const citation = `${payload.dataSourceProvider} • ${payload.lastUpdatedIso}`;

  if (preset === 'non_sky') {
    return {
      isSkyDetected: false,
      detectedCloudGenera: [],
      visualSkyDescription: isBn
        ? 'ছবিতে কোনো আকাশ বা বাইরের আবহাওয়ার দৃশ্য শনাক্ত করা যায়নি। অনুগ্রহ করে আপনার ক্যামেরা আকাশের দিকে তাক করুন।'
        : 'No sky, outdoor horizon, or atmospheric conditions were detected in this image. Please point your camera toward the sky.',
      lightingAndPhotographyAdvice: {
        lightingCondition: isBn ? 'Indoor / Non-Sky Frame' : 'Indoor / Non-Sky Frame',
        goldenHourSuitabilityScore: 1,
        cameraAndShootAdvice: isBn
          ? 'মেঘের ধরন ও আলোর মান বিশ্লেষণের জন্য খোলা আকাশের দিকে ক্যামেরা ধরুন।'
          : 'Point the camera toward an unobstructed section of the sky to evaluate cloud genera and natural lighting.',
      },
      stationDataComparison: {
        alignmentStatus: 'OBSCURED',
        comparisonExplanation: isBn
          ? `ক্যামেরায় আকাশ দৃশ্যমান নয়; তবে ${payload.locationName} স্টেশনের লাইভ পে-লোড অনুযায়ী মেঘের ঘনত্ব ${c.cloudCoverPercent}%, বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}%, দৃষ্টিসীমা ${c.visibilityKm} কিমি এবং ইউভি সূচক ${c.uvIndex}।`
          : `Camera does not show the sky; meanwhile ${payload.locationName} station telemetry reports cloudCoverPercent=${c.cloudCoverPercent}%, rainProbabilityPercent=${c.rainProbabilityPercent}%, visibilityKm=${c.visibilityKm} km, and uvIndex=${c.uvIndex}.`,
      },
      dataSourceCitation: citation,
    };
  }

  if (preset === 'cumulonimbus') {
    const alignmentStatus: StationComparisonReport['alignmentStatus'] =
      c.cloudCoverPercent >= 45 || c.rainProbabilityPercent >= 40
        ? 'MATCHES'
        : 'LOCALIZED_DIFFERENCE';

    return {
      isSkyDetected: true,
      detectedCloudGenera: [
        'Cumulonimbus (বজ্রমেঘ)',
        'Nimbostratus (বর্ষণমুখর মেঘ)',
      ],
      visualSkyDescription: isBn
        ? `ক্যামেরায় ঘন উল্লম্ব কিউমুলোনিম্বাস বজ্রমেঘের প্রাচীর ও নিচু মেঘের ভিত্তি দেখা যাচ্ছে, যা কনভেক্টিভ ঝড়ের লক্ষণ।`
        : `Camera frame captures a dense vertical Cumulonimbus tower with dark low-base nimbostratus rain bands.`,
      lightingAndPhotographyAdvice: {
        lightingCondition: isBn
          ? 'Overcast Soft Light & Storm Contrast (মেঘাচ্ছন্ন নাটকীয় আলো)'
          : 'Overcast Soft Light & Storm Contrast',
        goldenHourSuitabilityScore: 6,
        cameraAndShootAdvice: isBn
          ? 'নরম ছায়া ও নাটকীয় রঙের তাপমাত্রা (6500K) পেতে -0.7 EV এক্সপোজার কমপেনসেশন ব্যবহার করুন এবং বৃষ্টির ছিটে থেকে লেন্স সুরক্ষিত রাখুন।'
          : 'Soft diffused shadows with cool ~6500K color temperature and low glare; use -0.7 EV exposure compensation to preserve cloud highlights.',
      },
      stationDataComparison: {
        alignmentStatus,
        comparisonExplanation: isBn
          ? alignmentStatus === 'MATCHES'
            ? `${payload.locationName} স্টেশনের লাইভ পে-লোডে মেঘের ঘনত্ব ${c.cloudCoverPercent}%, বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}%, দৃষ্টিসীমা ${c.visibilityKm} কিমি এবং ইউভি সূচক ${c.uvIndex}—যা ক্যামেরায় দৃশ্যমান বজ্রমেঘের সাথে সম্পূর্ণ সামঞ্জস্যপূর্ণ।`
            : `ক্যামেরায় মাথার ওপরে কালো বৃষ্টির মেঘ দেখা গেলেও ${payload.locationName} স্টেশনে বৃষ্টির সম্ভাবনা ${c.rainProbabilityPercent}% এবং মেঘের ঘনত্ব ${c.cloudCoverPercent}% (দৃষ্টিসীমা ${c.visibilityKm} কিমি, ইউভি ${c.uvIndex})—অর্থাৎ একটি স্থানীয় মাইক্রো-সেল (localized micro-cell) মেঘ মাথার ওপর দিয়ে অতিক্রম করছে।`
          : alignmentStatus === 'MATCHES'
            ? `Compared against ${payload.locationName} station JSON (cloudCoverPercent=${c.cloudCoverPercent}%, rainProbabilityPercent=${c.rainProbabilityPercent}%, visibilityKm=${c.visibilityKm} km, uvIndex=${c.uvIndex}): visual storm structure directly matches station convective telemetry.`
            : `While the camera shows dark rain clouds overhead, the wider ${payload.locationName} station reports rainProbabilityPercent=${c.rainProbabilityPercent}%, cloudCoverPercent=${c.cloudCoverPercent}%, visibilityKm=${c.visibilityKm} km, and uvIndex=${c.uvIndex}—indicating a localized micro-cell cloud passing overhead.`,
      },
      dataSourceCitation: citation,
    };
  }

  if (preset === 'golden_hour') {
    const alignmentStatus: StationComparisonReport['alignmentStatus'] =
      c.visibilityKm >= 4 ? 'MATCHES' : 'OBSCURED';

    return {
      isSkyDetected: true,
      detectedCloudGenera: [
        'Stratocumulus (স্তরপুঞ্জ মেঘ)',
        'Altocumulus (মধ্যম পুঞ্জমেঘ)',
      ],
      visualSkyDescription: isBn
        ? 'দিগন্তে উষ্ণ সোনালী রশ্মি এবং মধ্যম স্তরের স্তরপুঞ্জ মেঘের ফাঁক দিয়ে নরম বিচ্ছুরিত আলো দেখা যাচ্ছে।'
        : 'Warm low-angle Rayleigh scattering illuminating mid-level Stratocumulus and Altocumulus cloud bands.',
      lightingAndPhotographyAdvice: {
        lightingCondition: 'Golden Hour Diffused',
        goldenHourSuitabilityScore: 9,
        cameraAndShootAdvice: isBn
          ? 'পোর্ট্রেট ও সিনেমাটিক ল্যান্ডস্কেপ শুটিংয়ের জন্য আদর্শ সময় (৯/১০); হোয়াইট ব্যালেন্স 5600K–6000K-এ লক করুন।'
          : 'Ideal 9/10 golden hour diffusion for portraits and B-roll; lock white balance around 5600K–6000K to retain warm amber tones.',
      },
      stationDataComparison: {
        alignmentStatus,
        comparisonExplanation: isBn
          ? `স্টেশন পে-লোডে ইউভি সূচক ${c.uvIndex}, দৃষ্টিসীমা ${c.visibilityKm} কিমি এবং মেঘের ঘনত্ব ${c.cloudCoverPercent}% (${payload.locationName})—যা ক্যামেরার গোল্ডেন আওয়ার আলোর সাথে সামঞ্জস্যপূর্ণ।`
          : `Cross-verified against ${payload.locationName} station payload (UV ${c.uvIndex}, visibility ${c.visibilityKm} km, cloud cover ${c.cloudCoverPercent}%): atmospheric transmittance aligns with observed golden hour glow.`,
      },
      dataSourceCitation: citation,
    };
  }

  // cirrus preset
  const alignmentStatus: StationComparisonReport['alignmentStatus'] =
    c.cloudCoverPercent <= 60 ? 'MATCHES' : 'LOCALIZED_DIFFERENCE';

  return {
    isSkyDetected: true,
    detectedCloudGenera: [
      'Cirrus (অলক মেঘ)',
      'Cirrostratus (অলকস্তর মেঘ)',
    ],
    visualSkyDescription: isBn
      ? 'উচ্চ ট্রপোস্ফিয়ারে (৭–১১ কিমি) সূক্ষ্ম বরফ-স্ফটিকের অলক মেঘ (Cirrus) ও পরিষ্কার নীল আকাশ দৃশ্যমান।'
      : 'High-altitude ice-crystal Cirrus wisps streaking across a crisp upper-tropospheric sky.',
    lightingAndPhotographyAdvice: {
      lightingCondition: isBn
        ? 'Crisp Daylight Transmittance (উজ্জ্বল দিনের আলো)'
        : 'Harsh Midday / High-Transmittance Daylight',
      goldenHourSuitabilityScore: 8,
      cameraAndShootAdvice: isBn
        ? 'আকাশের নীল রঙ ও অলক মেঘের তীক্ষ্ণতা বাড়াতে সার্কুলার পোলারাইজার (CPL) ফিল্টার ব্যবহার করুন।'
        : 'Use a circular polarizer (CPL) filter to deepen upper-sky contrast and emphasize delicate Cirrus filaments.',
    },
    stationDataComparison: {
      alignmentStatus,
      comparisonExplanation: isBn
        ? `${payload.locationName} স্টেশন পে-লোডে মেঘের ঘনত্ব ${c.cloudCoverPercent}%, দৃষ্টিসীমা ${c.visibilityKm} কিমি এবং তাপমাত্রা ${c.tempCelsius}°C রেকর্ড করা হয়েছে।`
        : `Compared against ${payload.locationName} station telemetry (${c.cloudCoverPercent}% cloud cover, ${c.visibilityKm} km visibility, ${c.tempCelsius}°C): upper-troposphere clarity is consistent with station observations.`,
    },
    dataSourceCitation: citation,
  };
}

export const ANDROID_MANIFEST_PERMISSIONS_XML = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <uses-feature android:name="android.hardware.camera.any" android:required="false" />

    <!-- Required on Android 11+ (API 30+) for SpeechRecognizer and TTS service discovery -->
    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>

</manifest>`;

export const SKY_VISION_MODELS_KT_SOURCE = `package com.aerolune.app.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class SkyVisionAiResponse(
    val isSkyDetected: Boolean,
    val detectedCloudGenera: List<String>, // e.g., ["Cumulonimbus (বজ্রমেঘ)", "Cirrus (অলক মেঘ)"]
    val visualSkyDescription: String,
    val lightingAndPhotographyAdvice: PhotographyLightingAnalysis,
    val stationDataComparison: StationComparisonReport,
    val dataSourceCitation: String
)

@Serializable
data class PhotographyLightingAnalysis(
    val lightingCondition: String,         // e.g., "Golden Hour Diffused", "Overcast Soft Light", "Harsh Midday"
    val goldenHourSuitabilityScore: Int,   // 1 to 10 scale
    val cameraAndShootAdvice: String       // Practical advice for outdoor photos/video shoots
)

@Serializable
data class StationComparisonReport(
    val alignmentStatus: String,           // "MATCHES", "LOCALIZED_DIFFERENCE", "OBSCURED"
    val comparisonExplanation: String      // Explains how the photo compares to the JSON station payload
)`;

/**
 * Pure math mirror of `SkyVisionAiService.scaleBitmapForAi(source: Bitmap, maxDimension: Int = 1024)`
 */
export function computeScaledBitmapDimensions(
  width: number,
  height: number,
  maxDimension: number = 1024
): {
  width: number;
  height: number;
  scale: number;
  wasScaled: boolean;
} {
  if (width <= maxDimension && height <= maxDimension) {
    return {
      width: Math.max(1, Math.trunc(width)),
      height: Math.max(1, Math.trunc(height)),
      scale: 1,
      wasScaled: false,
    };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);
  const targetWidth = Math.max(1, Math.trunc(width * scale));
  const targetHeight = Math.max(1, Math.trunc(height * scale));

  return {
    width: targetWidth,
    height: targetHeight,
    scale,
    wasScaled: true,
  };
}

/**
 * Formats the multimodal text prompt exactly as `SkyVisionAiService.analyzeSkyPhoto`:
 * [LIVE_WEATHER_PAYLOAD]
 * $weatherJson
 * [/LIVE_WEATHER_PAYLOAD]
 *
 * Preferred Output Language: $preferredLanguage ("bn" = Bengali, "en" = English).
 * Analyze the attached sky photograph, identify visible cloud types, evaluate lighting for photography, and compare visual sky conditions with the live weather payload.
 */
export function formatSkyVisionMultimodalPrompt(
  liveWeather: GroundedWeatherPayload,
  preferredLanguage: LanguageCode = 'bn',
  pretty = false
): string {
  const weatherJson = pretty
    ? JSON.stringify(liveWeather, null, 2)
    : JSON.stringify(liveWeather);

  return [
    '[LIVE_WEATHER_PAYLOAD]',
    weatherJson,
    '[/LIVE_WEATHER_PAYLOAD]',
    '',
    `Preferred Output Language: ${preferredLanguage} ("bn" = Bengali, "en" = English).`,
    'Analyze the attached sky photograph, identify visible cloud types, evaluate lighting for photography, and compare visual sky conditions with the live weather payload.',
  ].join('\n');
}

export class SkyVisionAiService {
  static async analyzeSkyPhoto(
    imageBase64: string,
    liveWeather: GroundedWeatherPayload,
    preferredLanguage: LanguageCode = 'bn',
    presetFallback: 'cumulonimbus' | 'golden_hour' | 'cirrus' = 'cumulonimbus'
  ): Promise<{
    ok: boolean;
    value: SkyVisionAiResponse;
    prompt: string;
    scaledDimensions: { width: number; height: number; wasScaled: boolean };
    source: string;
  }> {
    const prompt = formatSkyVisionMultimodalPrompt(liveWeather, preferredLanguage, false);
    const fallbackValue = generateGroundedSkyVisionResponse(
      presetFallback,
      liveWeather,
      preferredLanguage
    );
    const scaledDimensions = computeScaledBitmapDimensions(480, 270, 1024);

    try {
      const resp = await fetch('/api/ai/sky-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/png',
          language: preferredLanguage,
          payload: liveWeather,
        }),
      });
      const data = await resp.json();
      if (
        data?.analysis &&
        typeof data.analysis.isSkyDetected === 'boolean' &&
        Array.isArray(data.analysis.detectedCloudGenera)
      ) {
        return {
          ok: true,
          value: data.analysis as SkyVisionAiResponse,
          prompt,
          scaledDimensions: {
            width: scaledDimensions.width,
            height: scaledDimensions.height,
            wasScaled: scaledDimensions.wasScaled,
          },
          source: data.source || 'SkyVisionAiService.skyVisionModel',
        };
      }
      return {
        ok: true,
        value: fallbackValue,
        prompt,
        scaledDimensions: {
          width: scaledDimensions.width,
          height: scaledDimensions.height,
          wasScaled: scaledDimensions.wasScaled,
        },
        source: 'SkyVisionAiService.localGroundedFallback',
      };
    } catch {
      return {
        ok: true,
        value: fallbackValue,
        prompt,
        scaledDimensions: {
          width: scaledDimensions.width,
          height: scaledDimensions.height,
          wasScaled: scaledDimensions.wasScaled,
        },
        source: 'SkyVisionAiService.localGroundedFallback',
      };
    }
  }
}

export const SKY_VISION_AI_SERVICE_KT_SOURCE = `package com.aerolune.app.data.ai

import android.graphics.Bitmap
import com.aerolune.app.domain.model.GroundedWeatherPayload
import com.aerolune.app.domain.model.SkyVisionAiResponse
import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.FunctionType
import com.google.ai.client.generativeai.type.Schema
import com.google.ai.client.generativeai.type.content
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.math.min

class SkyVisionAiService(
    private val geminiApiKey: String
) {
    private val jsonSerializer = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val skyVisionModel by lazy {
        GenerativeModel(
            modelName = "gemini-2.5-flash",
            apiKey = geminiApiKey,
            generationConfig = generationConfig {
                temperature = 0.2f
                responseMimeType = "application/json"
                responseSchema = Schema(
                    name = "skyVisionResponse",
                    description = "Multimodal cloud, lighting, and weather station cross-verification",
                    type = FunctionType.OBJECT,
                    properties = mapOf(
                        "isSkyDetected" to Schema(name = "isSkyDetected", type = FunctionType.BOOLEAN),
                        "detectedCloudGenera" to Schema(
                            name = "detectedCloudGenera",
                            type = FunctionType.ARRAY,
                            items = Schema(name = "cloudType", type = FunctionType.STRING)
                        ),
                        "visualSkyDescription" to Schema(name = "visualSkyDescription", type = FunctionType.STRING),
                        "lightingAndPhotographyAdvice" to Schema(
                            name = "lightingAndPhotographyAdvice",
                            type = FunctionType.OBJECT,
                            properties = mapOf(
                                "lightingCondition" to Schema(name = "lightingCondition", type = FunctionType.STRING),
                                "goldenHourSuitabilityScore" to Schema(name = "goldenHourSuitabilityScore", type = FunctionType.INTEGER),
                                "cameraAndShootAdvice" to Schema(name = "cameraAndShootAdvice", type = FunctionType.STRING)
                            ),
                            required = listOf("lightingCondition", "goldenHourSuitabilityScore", "cameraAndShootAdvice")
                        ),
                        "stationDataComparison" to Schema(
                            name = "stationDataComparison",
                            type = FunctionType.OBJECT,
                            properties = mapOf(
                                "alignmentStatus" to Schema(
                                    name = "alignmentStatus",
                                    type = FunctionType.STRING,
                                    enum = listOf("MATCHES", "LOCALIZED_DIFFERENCE", "OBSCURED")
                                ),
                                "comparisonExplanation" to Schema(name = "comparisonExplanation", type = FunctionType.STRING)
                            ),
                            required = listOf("alignmentStatus", "comparisonExplanation")
                        ),
                        "dataSourceCitation" to Schema(name = "dataSourceCitation", type = FunctionType.STRING)
                    ),
                    required = listOf(
                        "isSkyDetected",
                        "detectedCloudGenera",
                        "visualSkyDescription",
                        "lightingAndPhotographyAdvice",
                        "stationDataComparison",
                        "dataSourceCitation"
                    )
                )
            },
            systemInstruction = content {
                text(AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION)
            }
        )
    }

    suspend fun analyzeSkyPhoto(
        rawBitmap: Bitmap,
        liveWeather: GroundedWeatherPayload,
        preferredLanguage: String = "bn"
    ): Result<SkyVisionAiResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val optimizedBitmap = scaleBitmapForAi(rawBitmap, maxDimension = 1024)
            val weatherJson = jsonSerializer.encodeToString(liveWeather)

            val multimodalInput = content {
                image(optimizedBitmap)
                text(
                    """
                    [LIVE_WEATHER_PAYLOAD]
                    $weatherJson
                    [/LIVE_WEATHER_PAYLOAD]
                    
                    Preferred Output Language: $preferredLanguage ("bn" = Bengali, "en" = English).
                    Analyze the attached sky photograph, identify visible cloud types, evaluate lighting for photography, and compare visual sky conditions with the live weather payload.
                    """.trimIndent()
                )
            }

            val response = skyVisionModel.generateContent(multimodalInput)
            val responseText = response.text
                ?: throw IllegalStateException("Empty response from Sky Vision AI")

            jsonSerializer.decodeFromString<SkyVisionAiResponse>(responseText)
        }
    }

    private fun scaleBitmapForAi(source: Bitmap, maxDimension: Int): Bitmap {
        val width = source.width
        val height = source.height
        if (width <= maxDimension && height <= maxDimension) return source

        val scale = min(maxDimension.toFloat() / width, maxDimension.toFloat() / height)
        val targetWidth = (width * scale).toInt().coerceAtLeast(1)
        val targetHeight = (height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
    }
}`;

/**
 * Bilingual Voice Weather Assistant (`package com.aerolune.app.presentation.voice`)
 */
export enum VoiceLanguage {
  BENGALI_BD = 'BENGALI_BD',
  ENGLISH_US = 'ENGLISH_US',
}

export const VOICE_LANGUAGE_META: Record<
  VoiceLanguage,
  { localeTag: 'bn-BD' | 'en-US'; displayLabel: string }
> = {
  [VoiceLanguage.BENGALI_BD]: {
    localeTag: 'bn-BD',
    displayLabel: 'বাংলা (BD)',
  },
  [VoiceLanguage.ENGLISH_US]: {
    localeTag: 'en-US',
    displayLabel: 'English (US)',
  },
};

export interface VoiceAssistantUiState {
  isListening: boolean;
  isSpeaking: boolean;
  selectedLanguage: VoiceLanguage;
  partialTranscript: string;
  finalTranscript: string;
  audioRmsDb: number; // Used to animate 3D voice orb in Compose
  ttsAvailable: boolean;
  errorMessage: string | null;
}

export function createInitialVoiceAssistantUiState(
  ttsAvailable = true
): VoiceAssistantUiState {
  return {
    isListening: false,
    isSpeaking: false,
    selectedLanguage: VoiceLanguage.BENGALI_BD,
    partialTranscript: '',
    finalTranscript: '',
    audioRmsDb: 0,
    ttsAvailable,
    errorMessage: ttsAvailable
      ? null
      : 'Text-To-Speech ইঞ্জিন এই ডিভাইসে সক্রিয় নয়।',
  };
}

/**
 * Mirrors `AeroluneVoiceAssistantManager.speakWeatherResponse(rawAiText: String)`:
 * - Strips markdown symbols (`*`, `#`, `_`, `` ` ``, `~`) so TTS reads cleanly
 * - Checks for Bengali Unicode characters (`\u0980`..`\u09FF`)
 * - Selects `bn-BD` (with `bn-IN` fallback if `bn-BD` pack isn't installed) or `en-US`
 * - Sets `speechRate = 0.98f` and `pitch = 1.0f`
 */
export function prepareTtsSpeechPayload(
  rawAiText: string,
  isBnBdPackAvailable = true
): {
  cleanSpeechText: string;
  containsBengaliScript: boolean;
  targetLocaleTag: 'bn-BD' | 'bn-IN' | 'en-US';
  speechRate: number;
  pitch: number;
} {
  const cleanSpeechText = (rawAiText || '').replace(/[*#_`~]/g, '').trim();
  const containsBengaliScript = /[\u0980-\u09FF]/.test(cleanSpeechText);

  const targetLocaleTag: 'bn-BD' | 'bn-IN' | 'en-US' = containsBengaliScript
    ? isBnBdPackAvailable
      ? 'bn-BD'
      : 'bn-IN'
    : 'en-US';

  return {
    cleanSpeechText,
    containsBengaliScript,
    targetLocaleTag,
    speechRate: 0.98,
    pitch: 1.0,
  };
}

export function reduceVoiceRmsChanged(
  state: VoiceAssistantUiState,
  rmsdB: number
): VoiceAssistantUiState {
  return {
    ...state,
    audioRmsDb: Math.max(0, rmsdB),
  };
}

export function mapSpeechRecognizerError(
  errorType:
    | 'ERROR_NO_MATCH'
    | 'ERROR_NETWORK'
    | 'ERROR_NETWORK_TIMEOUT'
    | 'ERROR_INSUFFICIENT_PERMISSIONS'
    | string
): string | null {
  switch (errorType) {
    case 'ERROR_NO_MATCH':
    case 'no-speech':
      return 'কথা স্পষ্ট বোঝা যায়নি, অনুগ্রহ করে আবার বলুন।';
    case 'ERROR_NETWORK':
    case 'ERROR_NETWORK_TIMEOUT':
    case 'network':
      return 'নেটওয়ার্ক সংযোগ পরীক্ষা করুন।';
    case 'ERROR_INSUFFICIENT_PERMISSIONS':
    case 'not-allowed':
      return 'মাইক্রোফোন ব্যবহারের অনুমতি প্রয়োজন।';
    default:
      return null;
  }
}

export const AEROLUNE_VOICE_ASSISTANT_MANAGER_KT_SOURCE = `package com.aerolune.app.presentation.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.util.Locale
import java.util.UUID

enum class VoiceLanguage(val localeTag: String, val displayLabel: String) {
    BENGALI_BD("bn-BD", "বাংলা (BD)"),
    ENGLISH_US("en-US", "English (US)")
}

data class VoiceAssistantUiState(
    val isListening: Boolean = false,
    val isSpeaking: Boolean = false,
    val selectedLanguage: VoiceLanguage = VoiceLanguage.BENGALI_BD,
    val partialTranscript: String = "",
    val finalTranscript: String = "",
    val audioRmsDb: Float = 0f, // Used to animate 3D voice orb in Compose
    val ttsAvailable: Boolean = false,
    val errorMessage: String? = null
)

class AeroluneVoiceAssistantManager(
    context: Context,
    private val onFinalSpeechResult: (String) -> Unit
) : TextToSpeech.OnInitListener {

    private val appContext = context.applicationContext
    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null

    private val _state = MutableStateFlow(VoiceAssistantUiState())
    val state: StateFlow<VoiceAssistantUiState> = _state.asStateFlow()

    init {
        textToSpeech = TextToSpeech(appContext, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    _state.update { it.copy(isSpeaking = true) }
                }

                override fun onDone(utteranceId: String?) {
                    _state.update { it.copy(isSpeaking = false) }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    _state.update { it.copy(isSpeaking = false) }
                }
            })
            _state.update { it.copy(ttsAvailable = true) }
        } else {
            _state.update {
                it.copy(
                    ttsAvailable = false,
                    errorMessage = "Text-To-Speech ইঞ্জিন এই ডিভাইসে সক্রিয় নয়।"
                )
            }
        }
    }

    fun setVoiceLanguage(language: VoiceLanguage) {
        _state.update { it.copy(selectedLanguage = language) }
    }

    /**
     * Must be invoked on the Main Thread after RECORD_AUDIO permission is granted.
     */
    fun startListening() {
        stopSpeaking()

        if (!SpeechRecognizer.isRecognitionAvailable(appContext)) {
            _state.update {
                it.copy(errorMessage = "ডিভাইসে ভয়েস রিকগনিশন সার্ভিস পাওয়া যায়নি।")
            }
            return
        }

        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(appContext).apply {
                setRecognitionListener(createRecognitionListener())
            }
        }

        val langTag = _state.value.selectedLanguage.localeTag
        val recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, langTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, langTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        _state.update {
            it.copy(
                isListening = true,
                partialTranscript = "",
                errorMessage = null
            )
        }
        speechRecognizer?.startListening(recognizerIntent)
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        _state.update { it.copy(isListening = false, audioRmsDb = 0f) }
    }

    /**
     * Automatically detects whether the AI response contains Bengali script
     * and configures the TTS voice locale accordingly before speaking.
     */
    fun speakWeatherResponse(rawAiText: String) {
        val tts = textToSpeech ?: return
        if (!_state.value.ttsAvailable || rawAiText.isBlank()) return

        // Strip markdown symbols (*, #, _) so TTS reads cleanly
        val cleanSpeechText = rawAiText
            .replace(Regex("[*#_\`~]"), "")
            .trim()

        val containsBengaliScript = cleanSpeechText.any { ch -> ch in '\\u0980'..'\\u09FF' }
        val targetLocale = if (containsBengaliScript) {
            Locale.forLanguageTag("bn-BD")
        } else {
            Locale.US
        }

        val availability = tts.isLanguageAvailable(targetLocale)
        if (availability >= TextToSpeech.LANG_AVAILABLE) {
            tts.language = targetLocale
        } else if (containsBengaliScript) {
            // Fallback to general Bengali locale if bn-BD pack isn't installed
            tts.language = Locale.forLanguageTag("bn-IN")
        }

        tts.setSpeechRate(0.98f)
        tts.setPitch(1.0f)

        val utteranceId = UUID.randomUUID().toString()
        tts.speak(cleanSpeechText, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
    }

    fun stopSpeaking() {
        textToSpeech?.stop()
        _state.update { it.copy(isSpeaking = false) }
    }

    fun release() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
    }

    private fun createRecognitionListener() = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            _state.update { it.copy(isListening = true, errorMessage = null) }
        }

        override fun onBeginningOfSpeech() {}

        override fun onRmsChanged(rmsdB: Float) {
            _state.update { it.copy(audioRmsDb = rmsdB.coerceAtLeast(0f)) }
        }

        override fun onBufferReceived(buffer: ByteArray?) {}

        override fun onEndOfSpeech() {
            _state.update { it.copy(isListening = false, audioRmsDb = 0f) }
        }

        override fun onError(error: Int) {
            val readableError = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH -> "কথা স্পষ্ট বোঝা যায়নি, অনুগ্রহ করে আবার বলুন।"
                SpeechRecognizer.ERROR_NETWORK,
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "নেটওয়ার্ক সংযোগ পরীক্ষা করুন।"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "মাইক্রোফোন ব্যবহারের অনুমতি প্রয়োজন।"
                else -> null
            }
            _state.update {
                it.copy(
                    isListening = false,
                    audioRmsDb = 0f,
                    errorMessage = readableError
                )
            }
        }

        override fun onResults(results: Bundle?) {
            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            val recognizedText = matches?.firstOrNull()?.trim().orEmpty()
            _state.update {
                it.copy(
                    isListening = false,
                    finalTranscript = recognizedText,
                    partialTranscript = ""
                )
            }
            if (recognizedText.isNotEmpty()) {
                onFinalSpeechResult(recognizedText)
            }
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val partial = partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            _state.update { it.copy(partialTranscript = partial) }
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }
}`;

/**
 * Pure helpers mirroring `SkyVisionAndVoiceScreen.kt` (`package com.aerolune.app.presentation.skyvision`)
 */
export function computeMicPulseScale(
  isListening: boolean,
  audioRmsDb: number
): number {
  if (!isListening) return 1;
  const delta = Math.min(0.45, Math.max(0, audioRmsDb / 25));
  return Number((1 + delta).toFixed(4));
}

export function getVoiceOrbButtonLabel(isListening: boolean): string {
  return isListening ? 'থামুন' : 'বলুন';
}

export function formatVoiceAssistantActiveTranscript(
  partialTranscript: string,
  finalTranscript: string
): string {
  if (partialTranscript.trim().length > 0) {
    return partialTranscript;
  }
  if (finalTranscript.trim().length > 0) {
    return `"${finalTranscript}"`;
  }
  return 'প্রশ্ন করুন: "আজ বিকেলে বৃষ্টি হবে কি?"';
}

export const SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE = `package com.aerolune.app.presentation.skyvision

import android.Manifest
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.launch
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aerolune.app.domain.model.SkyVisionAiResponse
import com.aerolune.app.presentation.voice.AeroluneVoiceAssistantManager
import com.aerolune.app.presentation.voice.VoiceLanguage

@Composable
fun SkyVisionAndVoiceScreen(
    skyVisionResponse: SkyVisionAiResponse?,
    isAnalyzingSky: Boolean,
    latestCopilotReply: String,
    onSkyBitmapCaptured: (Bitmap) -> Unit,
    onVoiceQueryRecognized: (String) -> Unit
) {
    val context = LocalContext.current
    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }

    // Manage Voice Assistant Lifecycle
    val voiceManager = remember {
        AeroluneVoiceAssistantManager(
            context = context,
            onFinalSpeechResult = { transcript -> onVoiceQueryRecognized(transcript) }
        )
    }
    val voiceState by voiceManager.state.collectAsState()

    DisposableEffect(Unit) {
        onDispose { voiceManager.release() }
    }

    // Auto-read aloud when a new Copilot reply arrives
    LaunchedEffect(latestCopilotReply) {
        if (latestCopilotReply.isNotBlank()) {
            voiceManager.speakWeatherResponse(latestCopilotReply)
        }
    }

    // Camera Launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            capturedBitmap = bitmap
            onSkyBitmapCaptured(bitmap)
        }
    }

    // Microphone Permission Launcher
    val audioPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            voiceManager.startListening()
        }
    }

    // Dynamic 3D Pulse Scale driven by real-time microphone RMS dB
    val micPulseScale by animateFloatAsState(
        targetValue = if (voiceState.isListening) {
            1f + (voiceState.audioRmsDb / 25f).coerceIn(0f, 0.45f)
        } else 1f,
        label = "MicPulseAnimation"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF0B1528), Color(0xFF162A4A), Color(0xFF090F1C))
                )
            )
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // --- SECTION 1: BILINGUAL VOICE WEATHER ASSISTANT ---
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC1B2E4B)),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0x4D70C4FF), RoundedCornerShape(24.dp))
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Voice Weather Assistant",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )

                    // Language Toggle (বাংলা / English)
                    FilterChip(
                        selected = true,
                        onClick = {
                            val nextLang = if (voiceState.selectedLanguage == VoiceLanguage.BENGALI_BD) {
                                VoiceLanguage.ENGLISH_US
                            } else {
                                VoiceLanguage.BENGALI_BD
                            }
                            voiceManager.setVoiceLanguage(nextLang)
                        },
                        label = {
                            Text(
                                text = voiceState.selectedLanguage.displayLabel,
                                color = Color(0xFF80D8FF)
                            )
                        }
                    )
                }

                // 3D Interactive Voice Orb
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(88.dp)
                        .scale(micPulseScale)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = if (voiceState.isListening) {
                                    listOf(Color(0xFF00E5FF), Color(0xFF0055FF))
                                } else {
                                    listOf(Color(0xFF2B4C7E), Color(0xFF14243E))
                                }
                            )
                        )
                        .border(2.dp, Color(0x9980D8FF), CircleShape)
                ) {
                    Button(
                        onClick = {
                            if (voiceState.isListening) {
                                voiceManager.stopListening()
                            } else {
                                audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        Text(
                            text = if (voiceState.isListening) "থামুন" else "বলুন",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Live Transcript Display
                val activeText = when {
                    voiceState.partialTranscript.isNotBlank() -> voiceState.partialTranscript
                    voiceState.finalTranscript.isNotBlank() -> "\\"\${voiceState.finalTranscript}\\""
                    else -> "প্রশ্ন করুন: \\"আজ বিকেলে বৃষ্টি হবে কি?\\""
                }
                Text(
                    text = activeText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFFD0E4FF)
                )

                if (voiceState.isSpeaking) {
                    TextButton(onClick = { voiceManager.stopSpeaking() }) {
                        Text("অডিও পড়া বন্ধ করুন (Stop Audio)", color = Color(0xFFFF8A80))
                    }
                }
            }
        }

        // --- SECTION 2: SKY VISION AI (CAMERA CLOUD & LIGHT ANALYZER) ---
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC1B2E4B)),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Color(0x4D70C4FF), RoundedCornerShape(24.dp))
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Sky Vision AI — আকাশ ও মেঘ বিশ্লেষক",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "আকাশের ছবি তুলুন; AI মেঘের ধরন, ফটোগ্রাফির আলো এবং লাইভ আবহাওয়া স্টেশনের তথ্যের তুলনা দেখাবে।",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFB0C7E6)
                )

                Button(
                    onClick = { cameraLauncher.launch() },
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("ক্যামেরা দিয়ে আকাশের ছবি তুলুন (Capture Sky)")
                }

                capturedBitmap?.let { bmp ->
                    Image(
                        bitmap = bmp.asImageBitmap(),
                        contentDescription = "Captured Sky Photo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(190.dp)
                            .clip(RoundedCornerShape(16.dp))
                    )
                }

                if (isAnalyzingSky) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Text(
                        text = "Gemini Vision মেঘ ও আলোর অবস্থা বিশ্লেষণ করছে...",
                        color = Color(0xFF80D8FF),
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                skyVisionResponse?.let { result ->
                    if (!result.isSkyDetected) {
                        Text(
                            text = result.visualSkyDescription,
                            color = Color(0xFFFFB74D),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    } else {
                        Text(
                            text = "শনাক্তকৃত মেঘ: \${result.detectedCloudGenera.joinToString(", ")}",
                            color = Color(0xFF80D8FF),
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = result.visualSkyDescription,
                            color = Color.White,
                            style = MaterialTheme.typography.bodyMedium
                        )

                        HorizontalDivider(color = Color(0x33FFFFFF))

                        Text(
                            text = "ফটোগ্রাফি ও আলোর পরামর্শ (Golden Hour Score: \${result.lightingAndPhotographyAdvice.goldenHourSuitabilityScore}/10)",
                            color = Color(0xFFFFD54F),
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = result.lightingAndPhotographyAdvice.cameraAndShootAdvice,
                            color = Color(0xFFE1F5FE),
                            style = MaterialTheme.typography.bodySmall
                        )

                        HorizontalDivider(color = Color(0x33FFFFFF))

                        Text(
                            text = "লাইভ আবহাওয়া স্টেশনের সাথে তুলনা (\${result.stationDataComparison.alignmentStatus}):",
                            color = Color(0xFF81C784),
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = result.stationDataComparison.comparisonExplanation,
                            color = Color(0xFFE1F5FE),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            text = result.dataSourceCitation,
                            color = Color(0xFF90A4AE),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }
        }
    }
}`;

