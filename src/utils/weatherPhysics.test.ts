import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWhatIfModifiers,
  buildHourlyTimeline,
  buildModelComparisonSeries,
  calculateActivityImpacts,
  calculateHeatStressRisk,
  cToF,
  evaluateAlertRules,
  formatTemp,
  generateGroundedAIModuleOutput,
  getAstronomicalPhase,
  parseWhatIfPrompt,
} from './weatherPhysics';
import { CITIES_DATABASE } from '../data/locations';
import {
  AEROLUNE_3D_BUTTON_KT_SOURCE,
  AEROLUNE_SKY_STATE_KT_SOURCE,
  ANIMATION_QUALITY_TIER_META,
  Aerolune3DColors,
  AeroluneButtonStyle,
  AnimationQualityTier,
  DEFAULT_AMBIENT_SKY_LIGHTING,
  SKY_PHASE_META,
  SkyPhase,
  WEATHER_VISUAL_MODE_META,
  WeatherAtmosphere,
  WeatherVisualMode,
  compute3DButtonTouchPhysics,
  computeAmbientLightingForPhase,
  cycleWeatherAtmosphere,
  getAtmosphereBackgroundGradient,
  lerpHexColor,
  resolveAeroluneButtonStyleColors,
  resolveWeatherAtmosphere,
} from './aerolune3DPalette';
import {
  TIMELINE_PHASE_META,
  TimeMachineSampleRepository,
  TimelinePhase,
  computeFilamentEarthRotation,
  generateFibonacciSurfaceNodes,
  generateSeededCloudClusters,
  getThermalAuraColor,
  projectSpherePoint,
  resolveTimeMachineFrameAtmosphere,
} from './weatherTimeMachineModels';
import {
  AEROLUNE_AI_REPOSITORY_CONFIG,
  AEROLUNE_AI_VIEWMODEL_KT_SOURCE,
  AEROLUNE_VOICE_ASSISTANT_MANAGER_KT_SOURCE,
  ANDROID_MANIFEST_PERMISSIONS_XML,
  AeroluneSystemPrompts,
  SKY_VISION_AI_SERVICE_KT_SOURCE,
  SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE,
  SKY_VISION_MODELS_KT_SOURCE,
  VOICE_LANGUAGE_META,
  VoiceLanguage,
  buildGroundedWeatherPayload,
  computeMicPulseScale,
  computeScaledBitmapDimensions,
  createInitialAeroluneAiUiState,
  createInitialVoiceAssistantUiState,
  detectQueryLanguage,
  formatLiveWeatherPayloadPrompt,
  formatSkyVisionMultimodalPrompt,
  formatSmartFarmingPrompt,
  formatVoiceAssistantActiveTranscript,
  generateGroundedCopilotReply,
  generateGroundedSkyVisionResponse,
  generateGroundedSmartFarmingResponse,
  getVoiceOrbButtonLabel,
  mapSpeechRecognizerError,
  prepareTtsSpeechPayload,
  reduceCopilotStreamChunk,
  reduceCopilotStreamError,
  reduceSendCopilotQuestionStart,
  reduceSmartFarmingFailure,
  reduceSmartFarmingLoadStart,
  reduceSmartFarmingSuccess,
  reduceVoiceRmsChanged,
  resolveVoiceLocaleForText,
} from './groundedFarmingModels';

test('unit conversions format temperature and convert Celsius to Fahrenheit accurately', () => {
  assert.equal(cToF(0), 32);
  assert.equal(cToF(30), 86);
  assert.equal(formatTemp(31.4, 'C'), '31.4°C');
  assert.equal(formatTemp(30, 'F'), '86.0°F');
});

test('astronomical phase accurately classifies dawn, noon, evening, and night', () => {
  assert.equal(getAstronomicalPhase(6.0, 5.9, 17.5), 'dawn');
  assert.equal(getAstronomicalPhase(12.5, 5.9, 17.5), 'noon');
  assert.equal(getAstronomicalPhase(17.2, 5.9, 17.5), 'evening');
  assert.equal(getAstronomicalPhase(22.0, 5.9, 17.5), 'night');
});

test('heat stress WBGT calculator escalates risk and hydration requirements under high heat/humidity', () => {
  const mild = calculateHeatStressRisk(20, 50, 2, 15);
  const extreme = calculateHeatStressRisk(37, 82, 9.5, 4);
  assert.equal(mild.riskLevel, 'Low');
  assert.equal(extreme.riskLevel, 'Extreme');
  assert.ok(extreme.wbgtC > mild.wbgtC);
  assert.equal(extreme.hydrationMlPerHour, 1000);
});

test('AI Weather Time Machine timeline distinguishes historical vs forecast and attributes data sources', () => {
  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka, 'Auto', 14);
  assert.equal(timeline.length, 97);

  const past24 = timeline.find((p) => p.hourOffset === -24)!;
  const nowPoint = timeline.find((p) => p.hourOffset === 0)!;
  const future12 = timeline.find((p) => p.hourOffset === 12)!;
  const future60 = timeline.find((p) => p.hourOffset === 60)!;

  assert.equal(past24.isHistorical, true);
  assert.equal(past24.dataSource, 'BMD Synoptic + Open-Meteo Archive');
  assert.equal(nowPoint.tempC, dhaka.baseTelemetry.tempC);
  assert.equal(future12.isHistorical, false);
  assert.equal(future12.dataSource, 'ECMWF IFS 0.25°');
  assert.equal(future60.dataSource, 'DWD ICON Global');
});

test('AI What-If Weather Lab parses natural language prompts and modifies telemetry physics', () => {
  const initial = {
    tempDeltaC: 0,
    windMultiplier: 1,
    cloudOverride: null,
    rainOverride: null,
    activePromptText: '',
  };

  const parsed = parseWhatIfPrompt(
    'What if wind speed doubles and increase cloud density to 90% and raise city temperature by 5°C',
    initial
  );
  assert.equal(parsed.windMultiplier, 2.0);
  assert.equal(parsed.cloudOverride, 90);
  assert.equal(parsed.tempDeltaC, 5);

  const dhaka = CITIES_DATABASE[0];
  const nowPoint = buildHourlyTimeline(dhaka)[24];
  const modified = applyWhatIfModifiers(nowPoint, parsed);
  assert.equal(modified.tempC, Math.round((nowPoint.tempC + 5) * 10) / 10);
  assert.equal(modified.cloudCover, 90);
  assert.equal(modified.windSpeedKmh, Math.round(nowPoint.windSpeedKmh * 2 * 10) / 10);
});

test('AI Weather Impact Simulator scores real-world activities and grounded AI enforces Zero Hallucination Policy', () => {
  const faridpur = CITIES_DATABASE.find((c) => c.id === 'faridpur')!;
  const nowPoint = buildHourlyTimeline(faridpur)[24];
  const impacts = calculateActivityImpacts(nowPoint);
  assert.equal(impacts.length, 4);
  assert.ok(impacts.every((item) => item.score >= 0 && item.score <= 100));

  const allergyOutputEn = generateGroundedAIModuleOutput('allergy_aqi', faridpur, nowPoint, 'en');
  assert.ok(
    allergyOutputEn.bulletPoints[0].includes('NOT supported in Faridpur'),
    'Must explicitly state pollen telemetry is unsupported rather than guessing'
  );

  const models = buildModelComparisonSeries(faridpur);
  assert.ok(models.series.length > 0);
});

test('Personal AI Weather Alerts evaluator triggers accurately when threshold is exceeded', () => {
  const dhaka = CITIES_DATABASE[0];
  const nowPoint = buildHourlyTimeline(dhaka)[24];
  const evaluated = evaluateAlertRules(
    [
      {
        id: 'r1',
        metric: 'aqi',
        operator: '>',
        threshold: 150,
        enabled: true,
        labelEn: 'High AQI Alert',
        labelBn: 'উচ্চ AQI সতর্কতা',
      },
    ],
    nowPoint
  );
  assert.equal(evaluated[0].triggered, true);
  assert.equal(evaluated[0].actualValue, 158);
});

test('Aerolune3DColors returns exact 3D extrusion palettes for all 6 WeatherAtmosphere states', () => {
  const dawn = Aerolune3DColors.getPalette(WeatherAtmosphere.DAWN_SUNRISE);
  assert.equal(dawn.surfaceTop, '#FF8E53');
  assert.equal(dawn.extrusionWall, '#7A2230');

  const noon = Aerolune3DColors.getPalette(WeatherAtmosphere.NOON_CLEAR);
  assert.equal(noon.surfaceTop, '#2FA4FF');
  assert.equal(noon.neonGlow, '#00D2FF');

  const evening = Aerolune3DColors.getPalette(WeatherAtmosphere.EVENING_SUNSET);
  assert.equal(evening.surfaceTop, '#9D50BB');
  assert.equal(evening.specularHighlight, '#FFB396');

  const night = Aerolune3DColors.getPalette(WeatherAtmosphere.NIGHT_STARRY);
  assert.equal(night.surfaceTop, '#1F2B4D');
  assert.equal(night.specularHighlight, '#64FFDA');

  const monsoon = Aerolune3DColors.getPalette(WeatherAtmosphere.MONSOON_RAIN);
  assert.equal(monsoon.surfaceTop, '#2C5364');
  assert.equal(monsoon.neonGlow, '#26C6DA');

  const heatwave = Aerolune3DColors.getPalette(WeatherAtmosphere.HEATWAVE_ALERT);
  assert.equal(heatwave.surfaceTop, '#FF512F');
  assert.equal(heatwave.extrusionWall, '#7D0B3B');

  assert.equal(
    resolveWeatherAtmosphere('noon', {
      tempC: 36.2,
      feelsLikeC: 40.1,
      rainProb: 10,
      conditionCode: 'clear',
    }),
    WeatherAtmosphere.HEATWAVE_ALERT
  );
  assert.equal(
    resolveWeatherAtmosphere('noon', {
      tempC: 28.0,
      feelsLikeC: 31.0,
      rainProb: 75,
      conditionCode: 'rain',
    }),
    WeatherAtmosphere.MONSOON_RAIN
  );
  assert.equal(
    resolveWeatherAtmosphere('night', {
      tempC: 24.0,
      feelsLikeC: 25.0,
      rainProb: 15,
      conditionCode: 'clear',
    }),
    WeatherAtmosphere.NIGHT_STARRY
  );

  assert.equal(
    cycleWeatherAtmosphere(WeatherAtmosphere.NIGHT_STARRY),
    WeatherAtmosphere.MONSOON_RAIN
  );
  assert.equal(
    cycleWeatherAtmosphere(WeatherAtmosphere.HEATWAVE_ALERT),
    WeatherAtmosphere.DAWN_SUNRISE
  );
  assert.ok(
    getAtmosphereBackgroundGradient(WeatherAtmosphere.DAWN_SUNRISE).includes('#2C1654')
  );
});

test('TimeMachineSampleRepository generates 49-hour sequence (-24h to +24h) with TimelinePhase and TelemetrySource', () => {
  const frames = TimeMachineSampleRepository.generate48HourTimeline();
  assert.equal(frames.length, 49);

  const pastFrame = frames.find((f) => f.hourOffset === -24)!;
  const liveFrame = frames.find((f) => f.hourOffset === 0)!;
  const futureFrame = frames.find((f) => f.hourOffset === 24)!;

  assert.equal(pastFrame.phase, TimelinePhase.OBSERVED_PAST);
  assert.equal(pastFrame.source.providerName, 'BMD Agargaon Station + Open-Meteo ERA5');
  assert.equal(TIMELINE_PHASE_META[pastFrame.phase].badgeText, 'OBSERVED HISTORY');
  assert.equal(TIMELINE_PHASE_META[pastFrame.phase].primaryColor, '#00E5FF');

  assert.equal(liveFrame.phase, TimelinePhase.LIVE_NOW);
  assert.equal(liveFrame.displayTime, 'এখন (LIVE)');
  assert.equal(liveFrame.source.providerName, 'BMD Live Doppler + Himawari-9 IR');
  assert.equal(TIMELINE_PHASE_META[liveFrame.phase].badgeText, 'LIVE TELEMETRY');

  assert.equal(futureFrame.phase, TimelinePhase.FUTURE_FORECAST);
  assert.equal(futureFrame.source.providerName, 'ECMWF IFS + NOAA GFS Ensemble');
  assert.equal(TIMELINE_PHASE_META[futureFrame.phase].badgeText, 'AI + NWP FORECAST');
  assert.equal(TIMELINE_PHASE_META[futureFrame.phase].primaryColor, '#FF9100');
  assert.ok(futureFrame.aiInsightBn.length > 10);
});

test('Interactive3DWeatherGlobe generates Fibonacci surface nodes, cloud clusters, and projects Bangladesh coordinates onto front hemisphere', () => {
  assert.equal(generateFibonacciSurfaceNodes(false).length, 750);
  assert.equal(generateFibonacciSurfaceNodes(true).length, 260);
  assert.equal(generateSeededCloudClusters(false).length, 240);
  assert.equal(generateSeededCloudClusters(true).length, 80);

  assert.equal(getThermalAuraColor(25), '#00E5FF');
  assert.equal(getThermalAuraColor(30), '#FFAB40');
  assert.equal(getThermalAuraColor(34), '#FF5252');

  // Verify default camera orientation (-3.12 yaw, -0.38 pitch) places Bangladesh (23.68°N, 90.35°E) on front hemisphere (zDepth < 0)
  const bdTheta = ((90 - 23.68) * Math.PI) / 180;
  const bdPhi = (90.35 * Math.PI) / 180;
  const proj = projectSpherePoint(bdTheta, bdPhi, 1.02, 120, 320, 200, 180, -3.12, -0.38);
  assert.ok(proj.zDepth < 0, 'Bangladesh beacon must be on the visible front hemisphere at default yaw/pitch');

  // Verify WeatherTimeMachineScreen.kt atmosphere mapping
  assert.equal(
    resolveTimeMachineFrameAtmosphere({ rainIntensityMm: 8.2, phase: TimelinePhase.OBSERVED_PAST }),
    WeatherAtmosphere.MONSOON_RAIN
  );
  assert.equal(
    resolveTimeMachineFrameAtmosphere({ rainIntensityMm: 1.0, phase: TimelinePhase.FUTURE_FORECAST }),
    WeatherAtmosphere.EVENING_SUNSET
  );
  assert.equal(
    resolveTimeMachineFrameAtmosphere({ rainIntensityMm: 0.0, phase: TimelinePhase.LIVE_NOW }),
    WeatherAtmosphere.NIGHT_STARRY
  );

  // Verify SceneView 4.62.0 Filament3DEarthNode transform math
  const node0 = computeFilamentEarthRotation(0);
  assert.equal(node0.assetFileLocation, 'models/aerolune_earth_clouds.glb');
  assert.equal(node0.scaleToUnits, 1.2);
  assert.equal(node0.rotationDeg.x, 23.68);
  assert.equal(node0.rotationDeg.y, 0);
  assert.equal(node0.rotationDeg.z, 0);

  const node6 = computeFilamentEarthRotation(6);
  assert.equal(node6.rotationDeg.y, 90);
});

test('GroundedWeatherPayload explicitly sets pollenIndex=null in Bangladesh and generates structured SmartFarmingAiResponse', () => {
  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka);
  const nowPoint = timeline[24];

  const payload = buildGroundedWeatherPayload(dhaka, nowPoint, timeline);
  assert.equal(payload.locationName, 'Dhaka');
  assert.equal(payload.country, 'Bangladesh');
  assert.equal(payload.current.pollenIndex, null, 'pollenIndex must be explicitly null in Bangladesh');
  assert.equal(payload.hourlyForecast24h.length, 24);
  assert.equal(payload.officialAlerts.length, 1);

  const response = generateGroundedSmartFarmingResponse(payload, {
    cropNameBn: 'আমন ধান (Aman Rice)',
    cropGrowthStage: 'Flowering',
    fieldSoilType: 'Loamy (দোআঁশ)',
    preferredLanguage: 'bn',
  });

  // Since Dhaka rainProb is 65%, irrigation and spraying must be AVOID
  assert.equal(response.irrigationAdvice.status, 'AVOID');
  assert.equal(response.pesticideSprayingAdvice.status, 'AVOID');
  assert.ok(response.irrigationAdvice.triggeringMetrics.includes('Rain Prob: 65%'));
  assert.ok(response.weatherRiskWarning && response.weatherRiskWarning.length > 10);
});

test('AeroluneSystemPrompts enforces strict data grounding, Banglish auto-detection, offline cache warnings, and agronomic thresholds', () => {
  assert.ok(
    AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION.includes('[LIVE_WEATHER_PAYLOAD]')
  );
  assert.ok(
    AeroluneSystemPrompts.SMART_FARMING_SYSTEM_INSTRUCTION.includes('[FARMING_CONTEXT]')
  );

  // 1. Language auto-detection: Bengali script, Banglish, and English
  const bnScript = detectQueryLanguage('আজ ফরিদপুরে বৃষ্টি হবে?');
  assert.equal(bnScript.detectedLang, 'bn');
  assert.equal(bnScript.isBengaliScript, true);

  const banglish = detectQueryLanguage('Aj ki brishti hobe?');
  assert.equal(banglish.detectedLang, 'bn');
  assert.equal(banglish.isBanglish, true);

  const english = detectQueryLanguage('Will it rain in Dhaka today?');
  assert.equal(english.detectedLang, 'en');
  assert.equal(english.isBanglish, false);

  // 2. Copilot strict grounding with offline cache and null pollenIndex
  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka);
  const offlinePayload = buildGroundedWeatherPayload(dhaka, timeline[24], timeline, true);

  const banglishReply = generateGroundedCopilotReply('Aj ki brishti hobe?', offlinePayload, 'en');
  assert.equal(banglishReply.detectedLanguage, 'bn');
  assert.equal(banglishReply.isBanglish, true);
  assert.ok(banglishReply.replyText.includes(offlinePayload.lastUpdatedIso));
  assert.ok(banglishReply.replyText.includes('pollenIndex: null'));
  assert.ok(banglishReply.replyText.includes(offlinePayload.dataSourceProvider));
});

test('AeroluneAiRepository configures copilotModel and smartFarmingModel and formats [LIVE_WEATHER_PAYLOAD] and [FARMING_CONTEXT] envelopes', () => {
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.copilotModel.temperature, 0.2);
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.copilotModel.topP, 0.85);
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.smartFarmingModel.temperature, 0.1);
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.smartFarmingModel.responseMimeType, 'application/json');
  assert.deepEqual(AEROLUNE_AI_REPOSITORY_CONFIG.smartFarmingModel.statusEnum, [
    'OPTIMAL',
    'CAUTION',
    'AVOID',
  ]);

  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka);
  const payload = buildGroundedWeatherPayload(dhaka, timeline[24], timeline);

  const copilotPrompt = formatLiveWeatherPayloadPrompt(payload, 'আজ ফরিদপুরে বৃষ্টি হবে?');
  assert.ok(copilotPrompt.includes('[LIVE_WEATHER_PAYLOAD]'));
  assert.ok(copilotPrompt.includes('[/LIVE_WEATHER_PAYLOAD]'));
  assert.ok(copilotPrompt.includes('User Question: আজ ফরিদপুরে বৃষ্টি হবে?'));

  const farmingPrompt = formatSmartFarmingPrompt(payload, {
    cropNameBn: 'আমন ধান (Aman Rice)',
    cropGrowthStage: 'Flowering',
    fieldSoilType: 'Loamy (দোআঁশ)',
    preferredLanguage: 'bn',
  });
  assert.ok(farmingPrompt.includes('[LIVE_WEATHER_PAYLOAD]'));
  assert.ok(farmingPrompt.includes('[/LIVE_WEATHER_PAYLOAD]'));
  assert.ok(farmingPrompt.includes('[FARMING_CONTEXT]'));
  assert.ok(farmingPrompt.includes('[/FARMING_CONTEXT]'));
  assert.ok(
    farmingPrompt.includes(
      'Analyze the hourly forecast, wind speed, humidity, and rain probability to generate the Smart Farming advisory.'
    )
  );
});

test('AeroluneAiViewModel state reducers manage ChatMessage streaming, SmartFarmingAiResponse loading, and Bengali error strings', () => {
  const initial = createInitialAeroluneAiUiState();
  assert.deepEqual(initial.chatMessages, []);
  assert.equal(initial.isCopilotLoading, false);
  assert.equal(initial.selectedCrop, 'আমন ধান (Aman Rice)');
  assert.equal(initial.selectedGrowthStage, 'ফুল আসার সময় (Flowering)');
  assert.equal(initial.farmingAdvisory, null);
  assert.equal(initial.isFarmingLoading, false);
  assert.equal(initial.errorMessage, null);

  // Blank question is a no-op
  const blankAttempt = reduceSendCopilotQuestionStart(initial, '   ', 1000);
  assert.equal(blankAttempt.aiPlaceholderId, null);
  assert.equal(blankAttempt.nextState.chatMessages.length, 0);

  // Valid question appends userMsg + streaming aiPlaceholder
  const { nextState: started, aiPlaceholderId } = reduceSendCopilotQuestionStart(
    initial,
    'Aj ki brishti hobe?',
    2000
  );
  assert.equal(aiPlaceholderId, '2001');
  assert.equal(started.isCopilotLoading, true);
  assert.equal(started.chatMessages.length, 2);
  assert.equal(started.chatMessages[0].isFromUser, true);
  assert.equal(started.chatMessages[0].text, 'Aj ki brishti hobe?');
  assert.equal(started.chatMessages[1].id, '2001');
  assert.equal(started.chatMessages[1].isFromUser, false);
  assert.equal(started.chatMessages[1].isStreaming, true);

  // Stream chunk updates placeholder and clears isStreaming + isCopilotLoading
  const streamed = reduceCopilotStreamChunk(
    started,
    aiPlaceholderId!,
    'আজ ঢাকায় বৃষ্টির সম্ভাবনা ৬৫%।'
  );
  assert.equal(streamed.isCopilotLoading, false);
  assert.equal(streamed.chatMessages[1].text, 'আজ ঢাকায় বৃষ্টির সম্ভাবনা ৬৫%。'.replace('。', '।'));
  assert.equal(streamed.chatMessages[1].isStreaming, false);

  // Stream error sets exact Bengali error message
  const errored = reduceCopilotStreamError(started, 'Timeout');
  assert.equal(errored.isCopilotLoading, false);
  assert.equal(errored.errorMessage, 'AI সংযোগে ত্রুটি: Timeout');

  // Smart farming loading, success, and failure transitions
  const farmingLoad = reduceSmartFarmingLoadStart(initial);
  assert.equal(farmingLoad.isFarmingLoading, true);

  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka);
  const payload = buildGroundedWeatherPayload(dhaka, timeline[24], timeline);
  const advisory = generateGroundedSmartFarmingResponse(payload, {
    cropNameBn: initial.selectedCrop,
    cropGrowthStage: initial.selectedGrowthStage,
    fieldSoilType: 'দোআঁশ (Loamy)',
    preferredLanguage: 'bn',
  });

  const farmingSuccess = reduceSmartFarmingSuccess(farmingLoad, advisory);
  assert.equal(farmingSuccess.isFarmingLoading, false);
  assert.equal(farmingSuccess.farmingAdvisory?.irrigationAdvice.status, 'AVOID');

  const farmingFailed = reduceSmartFarmingFailure(farmingLoad, 'Network unreachable');
  assert.equal(farmingFailed.isFarmingLoading, false);
  assert.equal(
    farmingFailed.errorMessage,
    'কৃষি পরামর্শ লোড করা যায়নি: Network unreachable'
  );
  assert.ok(AEROLUNE_AI_VIEWMODEL_KT_SOURCE.includes('class AeroluneAiViewModel'));
});

test('SkyVisionAiResponse, SKY_VISION_SYSTEM_INSTRUCTION, AndroidManifest.xml permissions, and bilingual Voice locale detection work accurately', () => {
  assert.ok(
    ANDROID_MANIFEST_PERMISSIONS_XML.includes('android.permission.CAMERA'),
    'Manifest must declare CAMERA permission'
  );
  assert.ok(
    ANDROID_MANIFEST_PERMISSIONS_XML.includes('android.permission.RECORD_AUDIO'),
    'Manifest must declare RECORD_AUDIO permission'
  );
  assert.ok(
    ANDROID_MANIFEST_PERMISSIONS_XML.includes('android.speech.RecognitionService'),
    'Manifest must declare Android 11+ RecognitionService query'
  );
  assert.ok(
    ANDROID_MANIFEST_PERMISSIONS_XML.includes('android.intent.action.TTS_SERVICE'),
    'Manifest must declare Android 11+ TTS_SERVICE query'
  );
  assert.ok(SKY_VISION_MODELS_KT_SOURCE.includes('data class SkyVisionAiResponse'));
  assert.ok(
    AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION.includes(
      'expert nephologist (cloud specialist), atmospheric physicist, and outdoor cinematography lighting advisor'
    )
  );
  assert.ok(
    AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION.includes('LOCALIZED_DIFFERENCE')
  );

  // Bilingual STT/TTS locale detection
  assert.equal(resolveVoiceLocaleForText('আজ ফরিদপুরে বৃষ্টি হবে?'), 'bn-BD');
  assert.equal(resolveVoiceLocaleForText('Aj ki brishti hobe?'), 'bn-BD');
  assert.equal(resolveVoiceLocaleForText('Will it rain in Dhaka today?'), 'en-US');

  // SkyVisionAiResponse generation
  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka);
  const payload = buildGroundedWeatherPayload(dhaka, timeline[24], timeline);

  const stormSky = generateGroundedSkyVisionResponse('cumulonimbus', payload, 'bn');
  assert.equal(stormSky.isSkyDetected, true);
  assert.ok(stormSky.detectedCloudGenera.includes('Cumulonimbus (বজ্রমেঘ)'));
  assert.equal(stormSky.lightingAndPhotographyAdvice.goldenHourSuitabilityScore, 6);
  assert.equal(stormSky.stationDataComparison.alignmentStatus, 'MATCHES');
  assert.ok(stormSky.dataSourceCitation.includes(payload.dataSourceProvider));

  // Non-sky frame sets isSkyDetected = false and asks user to point camera toward sky
  const nonSky = generateGroundedSkyVisionResponse('non_sky', payload, 'en');
  assert.equal(nonSky.isSkyDetected, false);
  assert.ok(nonSky.visualSkyDescription.includes('point your camera toward the sky'));

  const goldenSky = generateGroundedSkyVisionResponse('golden_hour', payload, 'en');
  assert.equal(goldenSky.lightingAndPhotographyAdvice.lightingCondition, 'Golden Hour Diffused');
  assert.equal(goldenSky.lightingAndPhotographyAdvice.goldenHourSuitabilityScore, 9);
});

test('SkyVisionAiService configures skyVisionModel schema, downscales Bitmaps with scaleBitmapForAi(maxDimension=1024), and formats multimodal prompt', () => {
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.skyVisionModel.modelName, 'gemini-2.5-flash');
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.skyVisionModel.temperature, 0.2);
  assert.equal(AEROLUNE_AI_REPOSITORY_CONFIG.skyVisionModel.maxBitmapDimension, 1024);
  assert.deepEqual(AEROLUNE_AI_REPOSITORY_CONFIG.skyVisionModel.alignmentStatusEnum, [
    'MATCHES',
    'LOCALIZED_DIFFERENCE',
    'OBSCURED',
  ]);

  // 1. Bitmap <= 1024 is returned unchanged
  const smallBmp = computeScaledBitmapDimensions(800, 600, 1024);
  assert.equal(smallBmp.wasScaled, false);
  assert.equal(smallBmp.width, 800);
  assert.equal(smallBmp.height, 600);

  // 2. Landscape 4032x3024 camera photo scales down proportionally to 1024x768
  const cameraBmp = computeScaledBitmapDimensions(4032, 3024, 1024);
  assert.equal(cameraBmp.wasScaled, true);
  assert.equal(cameraBmp.width, 1024);
  assert.equal(cameraBmp.height, 768);

  // 3. Extreme panoramic dimension coerces at least 1px
  const ultraWide = computeScaledBitmapDimensions(5000, 2, 1024);
  assert.equal(ultraWide.width, 1024);
  assert.equal(ultraWide.height, 1);

  // 4. Multimodal prompt envelope
  const dhaka = CITIES_DATABASE[0];
  const timeline = buildHourlyTimeline(dhaka);
  const payload = buildGroundedWeatherPayload(dhaka, timeline[24], timeline);
  const prompt = formatSkyVisionMultimodalPrompt(payload, 'bn', false);

  assert.ok(prompt.includes('[LIVE_WEATHER_PAYLOAD]'));
  assert.ok(prompt.includes('[/LIVE_WEATHER_PAYLOAD]'));
  assert.ok(
    prompt.includes('Preferred Output Language: bn ("bn" = Bengali, "en" = English).')
  );
  assert.ok(
    prompt.includes(
      'Analyze the attached sky photograph, identify visible cloud types, evaluate lighting for photography, and compare visual sky conditions with the live weather payload.'
    )
  );
  assert.ok(SKY_VISION_AI_SERVICE_KT_SOURCE.includes('class SkyVisionAiService'));
  assert.ok(SKY_VISION_AI_SERVICE_KT_SOURCE.includes('scaleBitmapForAi(rawBitmap, maxDimension = 1024)'));
});

test('AeroluneVoiceAssistantManager manages VoiceLanguage(bn-BD, en-US), strips markdown for TTS, falls back to bn-IN, and maps SpeechRecognizer errors', () => {
  assert.equal(VOICE_LANGUAGE_META[VoiceLanguage.BENGALI_BD].localeTag, 'bn-BD');
  assert.equal(VOICE_LANGUAGE_META[VoiceLanguage.BENGALI_BD].displayLabel, 'বাংলা (BD)');
  assert.equal(VOICE_LANGUAGE_META[VoiceLanguage.ENGLISH_US].localeTag, 'en-US');

  const initVoice = createInitialVoiceAssistantUiState(true);
  assert.equal(initVoice.selectedLanguage, VoiceLanguage.BENGALI_BD);
  assert.equal(initVoice.ttsAvailable, true);
  assert.equal(initVoice.audioRmsDb, 0);

  const unavailableVoice = createInitialVoiceAssistantUiState(false);
  assert.equal(
    unavailableVoice.errorMessage,
    'Text-To-Speech ইঞ্জিন এই ডিভাইসে সক্রিয় নয়।'
  );

  // RMS dB coerces at least 0f
  assert.equal(reduceVoiceRmsChanged(initVoice, -4.5).audioRmsDb, 0);
  assert.equal(reduceVoiceRmsChanged(initVoice, 8.75).audioRmsDb, 8.75);

  // Markdown stripping + Bengali Unicode check (\u0980..\u09FF) + bn-BD / bn-IN fallback
  const bnTts = prepareTtsSpeechPayload('**আজ ঢাকায়** _বৃষ্টির_ সম্ভাবনা `৬৫%`।', true);
  assert.equal(bnTts.cleanSpeechText, 'আজ ঢাকায় বৃষ্টির সম্ভাবনা ৬৫%।');
  assert.equal(bnTts.containsBengaliScript, true);
  assert.equal(bnTts.targetLocaleTag, 'bn-BD');
  assert.equal(bnTts.speechRate, 0.98);
  assert.equal(bnTts.pitch, 1.0);

  const bnFallbackTts = prepareTtsSpeechPayload('# আজ ফরিদপুরে বৃষ্টি হবে', false);
  assert.equal(bnFallbackTts.targetLocaleTag, 'bn-IN');

  const enTts = prepareTtsSpeechPayload('**Clear sky** in _Dhaka_ today.', true);
  assert.equal(enTts.cleanSpeechText, 'Clear sky in Dhaka today.');
  assert.equal(enTts.containsBengaliScript, false);
  assert.equal(enTts.targetLocaleTag, 'en-US');

  // SpeechRecognizer error mapping
  assert.equal(
    mapSpeechRecognizerError('ERROR_NO_MATCH'),
    'কথা স্পষ্ট বোঝা যায়নি, অনুগ্রহ করে আবার বলুন।'
  );
  assert.equal(
    mapSpeechRecognizerError('ERROR_NETWORK'),
    'নেটওয়ার্ক সংযোগ পরীক্ষা করুন।'
  );
  assert.equal(
    mapSpeechRecognizerError('ERROR_INSUFFICIENT_PERMISSIONS'),
    'মাইক্রোফোন ব্যবহারের অনুমতি প্রয়োজন।'
  );
  assert.ok(
    AEROLUNE_VOICE_ASSISTANT_MANAGER_KT_SOURCE.includes('class AeroluneVoiceAssistantManager')
  );
});

test('SkyVisionAndVoiceScreen computes 3D micPulseScale, formats live transcripts, and binds TakePicturePreview and RequestPermission', () => {
  // 1. Not listening -> scale = 1
  assert.equal(computeMicPulseScale(false, 12.5), 1);

  // 2. Listening with rmsDb = 5 -> 1 + 5/25 = 1.2
  assert.equal(computeMicPulseScale(true, 5), 1.2);

  // 3. Listening with rmsDb = 20 -> clamped to 1 + 0.45 = 1.45
  assert.equal(computeMicPulseScale(true, 20), 1.45);
  assert.equal(computeMicPulseScale(true, -3), 1);

  // 4. Voice Orb button label ("বলুন" vs "থামুন")
  assert.equal(getVoiceOrbButtonLabel(false), 'বলুন');
  assert.equal(getVoiceOrbButtonLabel(true), 'থামুন');

  // 5. Live transcript priority: partial > quoted final > default Bengali prompt
  assert.equal(
    formatVoiceAssistantActiveTranscript('', ''),
    'প্রশ্ন করুন: "আজ বিকেলে বৃষ্টি হবে কি?"'
  );
  assert.equal(
    formatVoiceAssistantActiveTranscript('', 'আজ ঢাকায় বৃষ্টি হবে কি?'),
    '"আজ ঢাকায় বৃষ্টি হবে কি?"'
  );
  assert.equal(
    formatVoiceAssistantActiveTranscript('আজ ঢাকায়...', 'পুরানো টেক্সট'),
    'আজ ঢাকায়...'
  );

  // 6. Verify SkyVisionAndVoiceScreen Kotlin Compose source
  assert.ok(
    SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE.includes('fun SkyVisionAndVoiceScreen(')
  );
  assert.ok(
    SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE.includes('ActivityResultContracts.TakePicturePreview()')
  );
  assert.ok(
    SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE.includes('ActivityResultContracts.RequestPermission()')
  );
  assert.ok(
    SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE.includes('1f + (voiceState.audioRmsDb / 25f).coerceIn(0f, 0.45f)')
  );
});

test('AeroluneSkyState computes AmbientSkyLighting across 4 SkyPhases, desaturates during MONSOON_RAIN, and configures AnimationQualityTier', () => {
  // 1. Default AmbientSkyLighting
  assert.equal(DEFAULT_AMBIENT_SKY_LIGHTING.skyPhase, SkyPhase.STARRY_NIGHT);
  assert.equal(DEFAULT_AMBIENT_SKY_LIGHTING.weatherMode, WeatherVisualMode.CLEAR_SKY);
  assert.equal(DEFAULT_AMBIENT_SKY_LIGHTING.qualityTier, AnimationQualityTier.ULTRA_3D);
  assert.deepEqual(DEFAULT_AMBIENT_SKY_LIGHTING.lightSourceNormalized, { x: 0.5, y: 0.2 });

  // 2. AnimationQualityTier particle multipliers and shader flags
  assert.equal(ANIMATION_QUALITY_TIER_META[AnimationQualityTier.ULTRA_3D].particleMultiplier, 1.0);
  assert.equal(ANIMATION_QUALITY_TIER_META[AnimationQualityTier.ULTRA_3D].enableRealtimeShaders, true);
  assert.equal(ANIMATION_QUALITY_TIER_META[AnimationQualityTier.BALANCED].particleMultiplier, 0.55);
  assert.equal(ANIMATION_QUALITY_TIER_META[AnimationQualityTier.LOW_END_SAVER].particleMultiplier, 0.2);
  assert.equal(
    ANIMATION_QUALITY_TIER_META[AnimationQualityTier.LOW_END_SAVER].enableRealtimeShaders,
    false
  );

  // 3. Labels
  assert.equal(SKY_PHASE_META[SkyPhase.DAWN_SUNRISE].labelBn, 'ভোর (Sunrise)');
  assert.equal(WEATHER_VISUAL_MODE_META[WeatherVisualMode.HEAT_HAZE].labelBn, 'তীব্র গরম ও Heat Haze');

  // 4. computeAmbientLightingForPhase across all 4 phases (CLEAR_SKY)
  const dawn = computeAmbientLightingForPhase(
    SkyPhase.DAWN_SUNRISE,
    WeatherVisualMode.CLEAR_SKY,
    AnimationQualityTier.ULTRA_3D
  );
  assert.deepEqual(dawn.lightSourceNormalized, { x: 0.2, y: 0.65 });
  assert.equal(dawn.specularRimColor, '#FFCC80');
  assert.equal(dawn.surfaceGlassTint, '#28234A');
  assert.equal(dawn.extrudedBaseColor, '#141029');
  assert.equal(dawn.ambientGlowColor, '#FF8A65');

  const midday = computeAmbientLightingForPhase(
    SkyPhase.BRIGHT_MIDDAY,
    WeatherVisualMode.CLEAR_SKY,
    AnimationQualityTier.BALANCED
  );
  assert.deepEqual(midday.lightSourceNormalized, { x: 0.5, y: 0.15 });
  assert.equal(midday.specularRimColor, '#E1F5FE');
  assert.equal(midday.surfaceGlassTint, '#0D47A1');
  assert.equal(midday.extrudedBaseColor, '#06275C');
  assert.equal(midday.ambientGlowColor, '#40C4FF');

  const sunset = computeAmbientLightingForPhase(
    SkyPhase.GOLDEN_SUNSET,
    WeatherVisualMode.HEAT_HAZE,
    AnimationQualityTier.ULTRA_3D
  );
  assert.deepEqual(sunset.lightSourceNormalized, { x: 0.82, y: 0.68 });
  assert.equal(sunset.specularRimColor, '#FFAB40');
  assert.equal(sunset.surfaceGlassTint, '#3B1D38');
  assert.equal(sunset.extrudedBaseColor, '#1F0C1D');
  assert.equal(sunset.ambientGlowColor, '#FF5252');

  const night = computeAmbientLightingForPhase(
    SkyPhase.STARRY_NIGHT,
    WeatherVisualMode.CLEAR_SKY,
    AnimationQualityTier.LOW_END_SAVER
  );
  assert.deepEqual(night.lightSourceNormalized, { x: 0.75, y: 0.22 });
  assert.equal(night.specularRimColor, '#80D8FF');
  assert.equal(night.surfaceGlassTint, '#132238');
  assert.equal(night.extrudedBaseColor, '#070E1A');
  assert.equal(night.ambientGlowColor, '#00E5FF');

  // 5. Monsoon Rain desaturation & cooling override preserves extrudedBaseColor and lightSourceNormalized
  const monsoonSunset = computeAmbientLightingForPhase(
    SkyPhase.GOLDEN_SUNSET,
    WeatherVisualMode.MONSOON_RAIN,
    AnimationQualityTier.ULTRA_3D
  );
  assert.deepEqual(monsoonSunset.lightSourceNormalized, { x: 0.82, y: 0.68 });
  assert.equal(monsoonSunset.extrudedBaseColor, '#1F0C1D');
  assert.equal(monsoonSunset.specularRimColor, '#90A4AE');
  assert.equal(monsoonSunset.surfaceGlassTint, '#1C2833');
  assert.equal(monsoonSunset.ambientGlowColor, '#4FC3F7');

  assert.ok(
    AEROLUNE_SKY_STATE_KT_SOURCE.includes(
      'val LocalAeroluneSkyLighting = compositionLocalOf { AmbientSkyLighting() }'
    )
  );
});

test('Aerolune3DButton resolves 4 AeroluneButtonStyles, computes touch-position 3D tilt, Z-axis compression, and skips glare in LOW_END_SAVER', () => {
  const sunsetSky = computeAmbientLightingForPhase(
    SkyPhase.GOLDEN_SUNSET,
    WeatherVisualMode.CLEAR_SKY,
    AnimationQualityTier.ULTRA_3D
  );

  // 1. Style resolution
  const skyAdaptive = resolveAeroluneButtonStyleColors(AeroluneButtonStyle.SKY_ADAPTIVE, sunsetSky);
  assert.equal(skyAdaptive.topSurfaceColor, '#3B1D38');
  assert.equal(skyAdaptive.baseExtrusionColor, '#1F0C1D');
  assert.equal(skyAdaptive.rimHighlightColor, '#FFAB40');
  assert.equal(skyAdaptive.glowColor, '#FF5252');

  const copilotCyan = resolveAeroluneButtonStyleColors(AeroluneButtonStyle.COPILOT_CYAN, sunsetSky);
  assert.equal(copilotCyan.topSurfaceColor, '#0A3D62');
  assert.equal(copilotCyan.rimHighlightColor, '#00E5FF');

  const severeWarn = resolveAeroluneButtonStyleColors(AeroluneButtonStyle.SEVERE_WARNING, sunsetSky);
  assert.equal(severeWarn.topSurfaceColor, '#6E1423');
  assert.equal(severeWarn.glowColor, '#FF1744');

  const farmingEmerald = resolveAeroluneButtonStyleColors(
    AeroluneButtonStyle.FARMING_EMERALD,
    sunsetSky
  );
  assert.equal(farmingEmerald.topSurfaceColor, '#14452F');
  assert.equal(farmingEmerald.rimHighlightColor, '#69F0AE');

  // 2. lerpHexColor
  assert.equal(lerpHexColor('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(lerpHexColor('#102030', '#102030', 0.28), '#102030');

  // 3. Idle state physics (isPressed = false)
  const idlePhysics = compute3DButtonTouchPhysics({
    width: 200,
    height: 67,
    isPressed: false,
    extrusionPx: 7,
    maxTiltDegrees: 12,
    skyLighting: sunsetSky,
  });
  assert.equal(idlePhysics.pressProgress, 0);
  assert.equal(idlePhysics.rotationX, 0);
  assert.equal(idlePhysics.rotationY, 0);
  assert.equal(idlePhysics.scale, 1);
  assert.equal(idlePhysics.currentVerticalOffsetPx, 0);
  assert.equal(idlePhysics.shadowDropOffset, 8.75); // 7 * 1.25
  assert.equal(idlePhysics.shadowAlpha, 0.28);
  assert.equal(idlePhysics.glareHotspot.enabled, true);
  assert.equal(idlePhysics.glareHotspot.x, 164); // 200 * 0.82 (sunset lightSourceNormalized.x)
  assert.equal(idlePhysics.glareHotspot.alpha, 0.22);

  // 4. Pressed state physics at top-right corner (touchX = 200, touchY = 0 -> nx = 1, ny = -1)
  const pressedPhysics = compute3DButtonTouchPhysics({
    touchX: 200,
    touchY: 0,
    width: 200,
    height: 67,
    isPressed: true,
    extrusionPx: 7,
    maxTiltDegrees: 12,
    skyLighting: sunsetSky,
  });
  assert.equal(pressedPhysics.pressProgress, 1);
  assert.deepEqual(pressedPhysics.touchNormalized, { x: 1, y: -1 });
  assert.equal(pressedPhysics.rotationX, 12); // -(-1) * 12
  assert.equal(pressedPhysics.rotationY, 12); // 1 * 12
  assert.equal(pressedPhysics.scale, 0.965);
  assert.equal(pressedPhysics.currentVerticalOffsetPx, 5.46); // 7 * 0.78
  assert.equal(pressedPhysics.shadowDropOffset, 4.9); // 7 * (1.25 - 0.55)
  assert.equal(pressedPhysics.shadowAlpha, 0.168); // 0.28 * 0.6
  assert.equal(pressedPhysics.glareHotspot.alpha, 0.42);

  // 5. LOW_END_SAVER disables realtime specular glare shader
  const lowEndSky = computeAmbientLightingForPhase(
    SkyPhase.STARRY_NIGHT,
    WeatherVisualMode.CLEAR_SKY,
    AnimationQualityTier.LOW_END_SAVER
  );
  const lowEndPhysics = compute3DButtonTouchPhysics({
    touchX: 100,
    touchY: 30,
    width: 200,
    height: 67,
    isPressed: true,
    skyLighting: lowEndSky,
  });
  assert.equal(lowEndPhysics.glareHotspot.enabled, false);

  assert.ok(AEROLUNE_3D_BUTTON_KT_SOURCE.includes('enum class AeroluneButtonStyle'));
  assert.ok(
    AEROLUNE_3D_BUTTON_KT_SOURCE.includes(
      'val currentVerticalOffsetPx = extrusionPx * 0.78f * pressProgress'
    )
  );
});
