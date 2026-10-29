import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  Code2,
  Cpu,
  History,
  Mic,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Sprout,
  Trash2,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  AIModuleId,
  AlertRule,
  CityLocation,
  HourlyTimelinePoint,
  LanguageCode,
  TempUnit,
  WeatherJournalEntry,
} from '../types/weather';
import {
  buildModelComparisonSeries,
  calculateActivityImpacts,
  evaluateAlertRules,
  formatTemp,
  generateGroundedAIModuleOutput,
} from '../utils/weatherPhysics';
import { Aerolune3DButton } from './Aerolune3DButton';
import { SmartFarmingGroundedPanel } from './SmartFarmingGroundedPanel';
import {
  AEROLUNE_VOICE_ASSISTANT_MANAGER_KT_SOURCE,
  ANDROID_MANIFEST_PERMISSIONS_XML,
  AeroluneAiRepository,
  AeroluneAiUiState,
  AeroluneSystemPrompts,
  CopilotChatTurn,
  SKY_VISION_AI_SERVICE_KT_SOURCE,
  SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE,
  SKY_VISION_MODELS_KT_SOURCE,
  SkyVisionAiResponse,
  SkyVisionAiService,
  VOICE_LANGUAGE_META,
  VoiceAssistantUiState,
  VoiceLanguage,
  buildGroundedWeatherPayload,
  computeMicPulseScale,
  createInitialAeroluneAiUiState,
  createInitialVoiceAssistantUiState,
  formatVoiceAssistantActiveTranscript,
  generateGroundedCopilotReply,
  generateGroundedSkyVisionResponse,
  getVoiceOrbButtonLabel,
  mapSpeechRecognizerError,
  prepareTtsSpeechPayload,
  reduceCopilotStreamChunk,
  reduceCopilotStreamError,
  reduceSendCopilotQuestionStart,
  resolveVoiceLocaleForText,
} from '../utils/groundedFarmingModels';

interface GeminiAIEcosystemHubProps {
  lang: LanguageCode;
  city: CityLocation;
  point: HourlyTimelinePoint;
  tempUnit: TempUnit;
  isLowEndMode: boolean;
  alertRules: AlertRule[];
  onAddAlertRule: (rule: AlertRule) => void;
  onToggleAlertRule: (id: string) => void;
  onDeleteAlertRule: (id: string) => void;
  journalEntries: WeatherJournalEntry[];
  onAddJournalEntry: (entry: WeatherJournalEntry) => void;
}

function generateProceduralSkyCanvasDataUrl(preset: 'cumulonimbus' | 'golden_hour' | 'cirrus'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 270);
  if (preset === 'cumulonimbus') {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.6, '#1e293b');
    grad.addColorStop(1, '#334155');
  } else if (preset === 'golden_hour') {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.55, '#9a3412');
    grad.addColorStop(1, '#f59e0b');
  } else {
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#bae6fd');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 270);

  // Draw procedural cloud formations
  const count = preset === 'cumulonimbus' ? 45 : 28;
  for (let i = 0; i < count; i++) {
    const cx = 60 + ((i * 73) % 360);
    const cy = preset === 'cumulonimbus' ? 50 + ((i * 29) % 150) : 80 + ((i * 19) % 100);
    const r = preset === 'cumulonimbus' ? 28 + (i % 30) : 18 + (i % 22);
    const cGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    if (preset === 'cumulonimbus') {
      cGrad.addColorStop(0, 'rgba(148, 163, 184, 0.75)');
      cGrad.addColorStop(1, 'rgba(51, 65, 85, 0)');
    } else if (preset === 'golden_hour') {
      cGrad.addColorStop(0, 'rgba(253, 186, 116, 0.7)');
      cGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    } else {
      cGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      cGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

export const GeminiAIEcosystemHub: React.FC<GeminiAIEcosystemHubProps> = ({
  lang,
  city,
  point,
  tempUnit,
  isLowEndMode,
  alertRules,
  onAddAlertRule,
  onToggleAlertRule,
  onDeleteAlertRule,
  journalEntries,
  onAddJournalEntry,
}) => {
  const [activeModule, setActiveModule] = useState<AIModuleId>('copilot');
  const [copilotQuery, setCopilotQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [liveGeminiText, setLiveGeminiText] = useState<string | null>(null);
  const [isCallingAI, setIsCallingAI] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);

  // Sky Vision AI state
  const [skyPreset, setSkyPreset] = useState<'cumulonimbus' | 'golden_hour' | 'cirrus'>('cumulonimbus');
  const [uploadedSkyUrl, setUploadedSkyUrl] = useState<string | null>(null);
  const [skyVisionAnalysis, setSkyVisionAnalysis] = useState<SkyVisionAiResponse | null>(null);
  const [isAnalyzingSky, setIsAnalyzingSky] = useState(false);
  const [showSkyVisionCode, setShowSkyVisionCode] = useState(false);
  const [showSkyVisionComposeScreen, setShowSkyVisionComposeScreen] = useState(false);
  const [showVoiceManagerCode, setShowVoiceManagerCode] = useState(false);
  const [voiceUiState, setVoiceUiState] = useState<VoiceAssistantUiState>(() =>
    createInitialVoiceAssistantUiState(true)
  );
  const [voiceActiveLocale, setVoiceActiveLocale] = useState<'bn-BD' | 'bn-IN' | 'en-US'>(
    lang === 'bn' ? 'bn-BD' : 'en-US'
  );

  // Alert Rule form state
  const [newRuleMetric, setNewRuleMetric] = useState<AlertRule['metric']>('rainProb');
  const [newRuleThreshold, setNewRuleThreshold] = useState<string>('70');
  const [ruleError, setRuleError] = useState<string>('');

  // Weather Memory Journal form state
  const [journalNote, setJournalNote] = useState('');
  const [journalMood, setJournalMood] = useState<WeatherJournalEntry['moodTag']>('Monsoon Drama');
  const [journalError, setJournalError] = useState('');
  const [recapSummary, setRecapSummary] = useState<string | null>(null);

  const [isOfflineSim, setIsOfflineSim] = useState(false);
  const [showPromptInspector, setShowPromptInspector] = useState(false);
  const [copilotChatHistory, setCopilotChatHistory] = useState<CopilotChatTurn[]>([]);
  const [aiUiState, setAiUiState] = useState<AeroluneAiUiState>(() =>
    createInitialAeroluneAiUiState()
  );

  const livePayload = React.useMemo(
    () => buildGroundedWeatherPayload(city, point, [], isOfflineSim),
    [city, point, isOfflineSim]
  );

  const copilotDeterministicReply = React.useMemo(
    () =>
      submittedQuery
        ? generateGroundedCopilotReply(submittedQuery, livePayload, lang)
        : null,
    [submittedQuery, livePayload, lang]
  );

  const groundedOutput = generateGroundedAIModuleOutput(
    activeModule,
    city,
    point,
    lang,
    submittedQuery || undefined
  );

  const impacts = calculateActivityImpacts(point);
  const modelSeries = buildModelComparisonSeries(city);
  const evaluatedAlerts = evaluateAlertRules(alertRules, point);

  const triggerGeminiCopilot = async (queryText: string, _modId: AIModuleId = activeModule) => {
    if (!queryText.trim()) return;
    setSubmittedQuery(queryText);
    setIsCallingAI(true);
    setLiveGeminiText(null);

    const nowMs = Date.now();
    const { aiPlaceholderId } = reduceSendCopilotQuestionStart(aiUiState, queryText, nowMs);
    setAiUiState((prev) => reduceSendCopilotQuestionStart(prev, queryText, nowMs).nextState);

    try {
      const streamResult = await AeroluneAiRepository.askWeatherCopilotStream(
        queryText,
        livePayload,
        copilotChatHistory,
        (_chunk, accumulated) => {
          setLiveGeminiText(accumulated);
          if (aiPlaceholderId) {
            setAiUiState((prev) => reduceCopilotStreamChunk(prev, aiPlaceholderId, accumulated));
          }
        }
      );
      setLiveGeminiText(streamResult.fullText);
      if (aiPlaceholderId) {
        setAiUiState((prev) =>
          reduceCopilotStreamChunk(prev, aiPlaceholderId, streamResult.fullText)
        );
      }
      setCopilotChatHistory((prev) => [
        ...prev.slice(-6),
        { role: 'user', text: streamResult.groundedPrompt },
        { role: 'model', text: streamResult.fullText },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setAiUiState((prev) => reduceCopilotStreamError(prev, errMsg));
    } finally {
      setIsCallingAI(false);
    }
  };

  const handleCopilotFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;
    triggerGeminiCopilot(copilotQuery.trim(), activeModule);
  };

  // Voice Weather Assistant (STT + TTS Manager mirroring AeroluneVoiceAssistantManager.kt)
  const toggleVoiceLanguage = () => {
    setVoiceUiState((prev) => {
      const nextLang =
        prev.selectedLanguage === VoiceLanguage.BENGALI_BD
          ? VoiceLanguage.ENGLISH_US
          : VoiceLanguage.BENGALI_BD;
      setVoiceActiveLocale(VOICE_LANGUAGE_META[nextLang].localeTag);
      return {
        ...prev,
        selectedLanguage: nextLang,
      };
    });
  };

  const handleVoiceOrbToggle = () => {
    if (voiceUiState.isListening) {
      const sampleFinal =
        voiceUiState.selectedLanguage === VoiceLanguage.BENGALI_BD
          ? `আজ ${city.nameBn}-এ বিকেলে বৃষ্টি হবে কি?`
          : `Will it rain this afternoon in ${city.nameEn}?`;
      setIsListeningMic(false);
      setVoiceUiState((prev) => ({
        ...prev,
        isListening: false,
        partialTranscript: '',
        finalTranscript: sampleFinal,
        audioRmsDb: 0,
      }));
      setCopilotQuery(sampleFinal);
      triggerGeminiCopilot(sampleFinal, 'copilot');
    } else {
      const samplePartial =
        voiceUiState.selectedLanguage === VoiceLanguage.BENGALI_BD
          ? `শোনা হচ্ছে: আজ ${city.nameBn}-এ বিকেলে...`
          : `Listening: Will it rain this afternoon in ${city.nameEn}...`;
      setIsListeningMic(true);
      setVoiceUiState((prev) => ({
        ...prev,
        isListening: true,
        isSpeaking: false,
        partialTranscript: samplePartial,
        audioRmsDb: 10.0,
        errorMessage: null,
      }));
    }
  };

  const handleVoiceInput = () => {
    const langTag = VOICE_LANGUAGE_META[voiceUiState.selectedLanguage].localeTag;
    setVoiceActiveLocale(langTag);

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      const sample =
        voiceUiState.selectedLanguage === VoiceLanguage.BENGALI_BD
          ? `আজ ${city.nameBn}-এ বৃষ্টি হবে?`
          : `Will it rain in ${city.nameEn} today and is it safe to go outside?`;
      setVoiceUiState((prev) => ({
        ...prev,
        isListening: false,
        finalTranscript: sample,
        partialTranscript: '',
        audioRmsDb: 7.4,
        errorMessage: null,
      }));
      setVoiceActiveLocale(resolveVoiceLocaleForText(sample, lang));
      setCopilotQuery(sample);
      triggerGeminiCopilot(sample, 'copilot');
      return;
    }

    try {
      setIsListeningMic(true);
      setVoiceUiState((prev) => ({
        ...prev,
        isListening: true,
        isSpeaking: false,
        partialTranscript: '',
        audioRmsDb: 6.8,
        errorMessage: null,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRec as any)();
      recognition.lang = langTag;
      recognition.interimResults = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        const isFinal = Boolean(event.results?.[0]?.isFinal);
        if (transcript) {
          if (isFinal) {
            setVoiceUiState((prev) => ({
              ...prev,
              isListening: false,
              finalTranscript: transcript,
              partialTranscript: '',
              audioRmsDb: 0,
            }));
            setVoiceActiveLocale(resolveVoiceLocaleForText(transcript, lang));
            setCopilotQuery(transcript);
            triggerGeminiCopilot(transcript, 'copilot');
            setIsListeningMic(false);
          } else {
            setVoiceUiState((prev) => ({
              ...prev,
              partialTranscript: transcript,
              audioRmsDb: 8.2,
            }));
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsListeningMic(false);
        setVoiceUiState((prev) => ({
          ...prev,
          isListening: false,
          audioRmsDb: 0,
          errorMessage: mapSpeechRecognizerError(event?.error || ''),
        }));
      };
      recognition.onend = () => {
        setIsListeningMic(false);
        setVoiceUiState((prev) => ({
          ...prev,
          isListening: false,
          audioRmsDb: 0,
        }));
      };
      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  const handleSpeakReadout = async () => {
    const rawAiText =
      liveGeminiText ||
      copilotDeterministicReply?.replyText ||
      `${groundedOutput.summary} ${groundedOutput.bulletPoints.join(' ')}`;
    const ttsPayload = prepareTtsSpeechPayload(rawAiText, true);
    setVoiceActiveLocale(ttsPayload.targetLocaleTag);
    setVoiceUiState((prev) => ({ ...prev, isSpeaking: true }));

    try {
      const resp = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsPayload.cleanSpeechText,
          language: ttsPayload.containsBengaliScript ? 'bn' : 'en',
        }),
      });
      const data = await resp.json();
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        audio.onended = () =>
          setVoiceUiState((prev) => ({ ...prev, isSpeaking: false }));
        audio.play();
        return;
      }
    } catch {
      // Fallback to browser SpeechSynthesis
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(ttsPayload.cleanSpeechText);
      utter.lang = ttsPayload.targetLocaleTag;
      utter.rate = ttsPayload.speechRate;
      utter.pitch = ttsPayload.pitch;
      utter.onend = () =>
        setVoiceUiState((prev) => ({ ...prev, isSpeaking: false }));
      window.speechSynthesis.speak(utter);
    } else {
      setVoiceUiState((prev) => ({ ...prev, isSpeaking: false }));
    }
  };

  // Sky Vision AI Handler (Multimodal Bitmap + GroundedWeatherPayload -> SkyVisionAiResponse)
  const defaultSkyVisionResponse = React.useMemo(
    () => generateGroundedSkyVisionResponse(skyPreset, livePayload, lang),
    [skyPreset, livePayload, lang]
  );

  const activeSkyVision: SkyVisionAiResponse = skyVisionAnalysis || defaultSkyVisionResponse;

  const handleAnalyzeSky = async (presetOverride?: 'cumulonimbus' | 'golden_hour' | 'cirrus') => {
    const activePreset = presetOverride || skyPreset;
    setIsAnalyzingSky(true);
    const imgUrl = uploadedSkyUrl || generateProceduralSkyCanvasDataUrl(activePreset);

    try {
      const result = await SkyVisionAiService.analyzeSkyPhoto(
        imgUrl,
        livePayload,
        lang,
        activePreset
      );
      setSkyVisionAnalysis(result.value);
    } finally {
      setIsAnalyzingSky(false);
    }
  };

  const handleSkyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedSkyUrl(reader.result);
        handleAnalyzeSky();
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Custom Alert Rule with validation
  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(newRuleThreshold);
    if (!newRuleThreshold.trim() || Number.isNaN(num) || num < 0 || num > 500) {
      setRuleError(
        lang === 'bn'
          ? 'অনুগ্রহ করে ০ থেকে ৫০০ এর মধ্যে একটি সঠিক সংখ্যা দিন।'
          : 'Please enter a valid threshold between 0 and 500.'
      );
      return;
    }
    setRuleError('');
    const metricNames: Record<AlertRule['metric'], { en: string; bn: string }> = {
      rainProb: { en: `Rain Probability > ${num}%`, bn: `বৃষ্টির সম্ভাবনা > ${num}%` },
      aqi: { en: `Air Quality Index (AQI) > ${num}`, bn: `একিউআই (AQI) > ${num}` },
      tempC: { en: `Temperature > ${num}°C`, bn: `তাপমাত্রা > ${num}°C` },
      windSpeedKmh: { en: `Wind Speed > ${num} km/h`, bn: `বাতাসের গতি > ${num} km/h` },
      uvIndex: { en: `UV Index > ${num}`, bn: `ইউভি সূচক > ${num}` },
    };
    onAddAlertRule({
      id: `rule-${Date.now()}`,
      metric: newRuleMetric,
      operator: '>',
      threshold: num,
      enabled: true,
      labelEn: metricNames[newRuleMetric].en,
      labelBn: metricNames[newRuleMetric].bn,
    });
  };

  // Add Weather Memory Journal Entry with validation
  const handleAddJournalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalNote.trim()) {
      setJournalError(
        lang === 'bn'
          ? 'ডায়েরি সংরক্ষণের আগে একটি নোট লিখুন।'
          : 'Please enter a weather observation note before saving.'
      );
      return;
    }
    setJournalError('');
    onAddJournalEntry({
      id: `journal-${Date.now()}`,
      dateIso: new Date().toISOString().slice(0, 10),
      cityId: city.id,
      cityNameEn: city.nameEn,
      cityNameBn: city.nameBn,
      tempC: point.tempC,
      conditionCode: point.conditionCode,
      aqi: point.aqi,
      note: journalNote.trim(),
      moodTag: journalMood,
    });
    setJournalNote('');
  };

  const generateMonthlyRecap = () => {
    const count = journalEntries.length;
    const avgTemp =
      count > 0
        ? (journalEntries.reduce((acc, item) => acc + item.tempC, 0) / count).toFixed(1)
        : point.tempC.toFixed(1);
    setRecapSummary(
      lang === 'bn'
        ? `মাসিক এআই আবহাওয়া স্মৃতি সারসংক্ষেপ: আপনি মোট ${count}টি আবহাওয়া মুহূর্ত লিপিবদ্ধ করেছেন। গড় তাপমাত্রা ছিল ${avgTemp}°C এবং সর্বাধিক অনুভূতি ছিল "${journalEntries[0]?.moodTag || 'Monsoon Drama'}"।`
        : `AI End-of-Month Weather Memory Recap: Across ${count} logged observations, your recorded mean temperature was ${avgTemp}°C with dominant atmospheric mood "${journalEntries[0]?.moodTag || 'Monsoon Drama'}".`
    );
  };

  const modulesList: { id: AIModuleId; labelEn: string; labelBn: string; icon: React.ReactNode }[] = [
    { id: 'copilot', labelEn: 'AI Weather Copilot', labelBn: 'এআই আবহাওয়া কপিলট', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'smart_farming', labelEn: 'Smart Farming (BD)', labelBn: 'স্মার্ট কৃষি পরামর্শ', icon: <Sprout className="w-3.5 h-3.5" /> },
    { id: 'confidence_analyzer', labelEn: 'Model Confidence', labelBn: 'মডেল কনফিডেন্স', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'risk_explainer', labelEn: 'Risk Explainer', labelBn: 'দুর্যোগ ঝুঁকি বিশ্লেষক', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    { id: 'heat_safety', labelEn: 'Heat & WBGT Safety', labelBn: 'তাপ ও স্বাস্থ্য সুরক্ষা', icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { id: 'allergy_aqi', labelEn: 'Allergy & AQI', labelBn: 'এলার্জি ও বায়ু মান', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { id: 'climate_history', labelEn: 'Climate History', labelBn: 'জলবায়ু ইতিহাস', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'weather_twin', labelEn: 'Personal Weather Twin', labelBn: 'পার্সোনাল ওয়েদার টুইন', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'sky_vision', labelEn: 'Sky Vision AI', labelBn: 'স্কাই ভিশন এআই (ক্যামেরা)', icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'weather_journal', labelEn: 'Memory Journal & Alerts', labelBn: 'ডায়েরি ও অ্যালার্ট রুলস', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'kotlin_blueprint', labelEn: 'Kotlin/Compose 3D Code', labelBn: 'কটলিন/কম্পোজ আর্কিটেকচার', icon: <Code2 className="w-3.5 h-3.5" /> },
  ];

  const sampleQueries =
    lang === 'bn'
      ? [
          'আজ ফরিদপুরে বৃষ্টি হবে?',
          'Aj ki brishti hobe?',
          'এখন বাইরে যাওয়ার জন্য আবহাওয়া কেমন?',
          'পরাগরেণু (pollen) ও বায়ু মান কেমন?',
        ]
      : [
          'Aj ki brishti hobe?',
          'আজ ফরিদপুরে বৃষ্টি হবে?',
          `Will it rain in ${city.nameEn} today?`,
          'What is the pollenIndex and AQI right now?',
        ];

  return (
    <section
      aria-label="Grounded Gemini AI Ecosystem & Activity Simulators"
      className="space-y-6"
    >
      {/* Section Header + Zero Hallucination Guardrail Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            {lang === 'bn'
              ? 'জেমিনি এআই ইকোসিস্টেম · জিরো-হ্যালুসিনেশন গ্রাউন্ডিং'
              : 'GEMINI AI ECOSYSTEM · STRICT JSON TELEMETRY GROUNDING'}
          </div>
          <h2 className="text-2xl font-display font-bold text-white mt-1">
            {lang === 'bn'
              ? 'এআই আবহাওয়া বুদ্ধিমত্তা ও ইমপ্যাক্ট সিমুলেটর'
              : 'Grounded Meteorological Intelligence & Impact Suite'}
          </h2>
        </div>
        <div className="text-xs font-mono text-slate-400">
          <span>Grounding Guardrail: Active</span>
          <span aria-hidden="true" className="mx-2">·</span>
          <span>Bilingual: বাংলা & English</span>
        </div>
      </div>

      {/* AI Module Selector Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="AI Intelligence Modules">
        {modulesList.map((mod) => (
          <Aerolune3DButton
            key={mod.id}
            testId={`ai-module-tab-${mod.id}`}
            size="sm"
            active={activeModule === mod.id}
            accentColor="cyan"
            isLowEndMode={isLowEndMode}
            icon={mod.icon}
            text={lang === 'bn' ? mod.labelBn : mod.labelEn}
            onClick={() => {
              setActiveModule(mod.id);
              setLiveGeminiText(null);
            }}
          />
        ))}
      </div>

      {/* Main Active AI Module Workspace */}
      {activeModule === 'smart_farming' ? (
        <SmartFarmingGroundedPanel
          lang={lang}
          city={city}
          point={point}
          isLowEndMode={isLowEndMode}
        />
      ) : activeModule === 'sky_vision' ? (
        <div
          data-testid="sky-vision-ai-panel"
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                com.aerolune.app.domain.model · SkyVisionAiResponse + GroundedWeatherPayload
              </div>
              <h3 className="text-lg font-semibold text-white mt-0.5">
                {lang === 'bn'
                  ? 'স্কাই ভিশন এআই — মাল্টিমোডাল মেঘ শনাক্তকরণ ও স্টেশন ক্রস-চেক'
                  : 'Sky Vision AI — Multimodal Cloud Genera & Station Alignment'}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="sky-vision-live-tab"
                onClick={() => {
                  setShowSkyVisionCode(false);
                  setShowSkyVisionComposeScreen(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  !showSkyVisionCode && !showSkyVisionComposeScreen
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'লাইভ স্কাই ভিশন ও ভয়েস' : 'SkyVisionAndVoiceScreen UI'}</span>
              </button>
              <button
                type="button"
                data-testid="sky-vision-compose-screen-toggle"
                onClick={() => {
                  setShowSkyVisionComposeScreen(true);
                  setShowSkyVisionCode(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  showSkyVisionComposeScreen
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>SkyVisionAndVoiceScreen.kt</span>
              </button>
              <button
                type="button"
                data-testid="sky-vision-code-toggle"
                onClick={() => {
                  setShowSkyVisionCode(true);
                  setShowSkyVisionComposeScreen(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  showSkyVisionCode
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-400'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>SkyVisionAiService.kt + Manifest + Models</span>
              </button>
            </div>
          </div>

          {showSkyVisionComposeScreen ? (
            <div className="space-y-2">
              <div className="text-xs font-mono text-cyan-400">
                package com.aerolune.app.presentation.skyvision · SkyVisionAndVoiceScreen.kt (TakePicturePreview + RequestPermission + 3D MicPulseAnimation)
              </div>
              <pre
                data-testid="sky-vision-compose-screen-code"
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[420px] overflow-y-auto leading-relaxed"
              >
                {SKY_VISION_AND_VOICE_SCREEN_KT_SOURCE}
              </pre>
            </div>
          ) : showSkyVisionCode ? (
            <div
              data-testid="sky-vision-manifest-and-models"
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              <div className="space-y-2">
                <div className="text-xs font-mono text-emerald-400">
                  1. AndroidManifest.xml + SkyVisionAiResponse.kt + SKY_VISION_SYSTEM_INSTRUCTION
                </div>
                <pre
                  data-testid="android-manifest-xml-code"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed"
                >
{`${ANDROID_MANIFEST_PERMISSIONS_XML}

${SKY_VISION_MODELS_KT_SOURCE}

// In AeroluneSystemPrompts.kt:
const val SKY_VISION_SYSTEM_INSTRUCTION = """
${AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION}
"""`}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-mono text-cyan-400">
                  2. SkyVisionAiService.kt (scaleBitmapForAi maxDimension=1024 + analyzeSkyPhoto)
                </div>
                <pre
                  data-testid="sky-vision-models-kt-code"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-cyan-200 overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed"
                >
                  {SKY_VISION_AI_SERVICE_KT_SOURCE}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* SECTION 1: BILINGUAL VOICE WEATHER ASSISTANT (3D Interactive Voice Orb) */}
              <div
                data-testid="sky-vision-voice-assistant-card"
                className="bg-[#1B2E4B]/80 border border-[#70C4FF]/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div className="space-y-1.5 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <span className="text-base font-bold text-white">
                      Voice Weather Assistant
                    </span>
                    <button
                      type="button"
                      data-testid="sky-vision-voice-lang-chip"
                      onClick={toggleVoiceLanguage}
                      className="px-3 py-1 rounded-lg bg-slate-900/90 border border-cyan-400/50 text-xs font-mono text-[#80D8FF] hover:border-cyan-300 transition-colors"
                    >
                      {VOICE_LANGUAGE_META[voiceUiState.selectedLanguage].displayLabel}
                    </button>
                    <span className="text-[11px] font-mono text-slate-400">
                      micPulseScale: {computeMicPulseScale(voiceUiState.isListening, voiceUiState.audioRmsDb)}x ({voiceUiState.audioRmsDb.toFixed(1)} dB)
                    </span>
                  </div>
                  <p
                    data-testid="sky-vision-voice-transcript"
                    className="text-sm text-[#D0E4FF]"
                  >
                    {formatVoiceAssistantActiveTranscript(
                      voiceUiState.partialTranscript,
                      voiceUiState.finalTranscript
                    )}
                  </p>
                  {voiceUiState.isSpeaking && (
                    <button
                      type="button"
                      data-testid="sky-vision-stop-audio-btn"
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                        }
                        setVoiceUiState((prev) => ({ ...prev, isSpeaking: false }));
                      }}
                      className="text-xs font-semibold text-[#FF8A80] hover:underline"
                    >
                      অডিও পড়া বন্ধ করুন (Stop Audio)
                    </button>
                  )}
                </div>

                {/* 3D Interactive Voice Orb (88px Circle scaled by micPulseScale) */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    data-testid="voice-orb-button"
                    onClick={handleVoiceOrbToggle}
                    style={{
                      transform: `scale(${computeMicPulseScale(
                        voiceUiState.isListening,
                        voiceUiState.audioRmsDb
                      )})`,
                      background: voiceUiState.isListening
                        ? 'radial-gradient(circle, #00E5FF 0%, #0055FF 100%)'
                        : 'radial-gradient(circle, #2B4C7E 0%, #14243E 100%)',
                    }}
                    className="w-[88px] h-[88px] rounded-full border-2 border-[#80D8FF]/60 flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform duration-200 cursor-pointer shrink-0"
                  >
                    {getVoiceOrbButtonLabel(voiceUiState.isListening)}
                  </button>
                </div>
              </div>

              {/* SECTION 2: SKY VISION AI (CAMERA CLOUD & LIGHT ANALYZER) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Aerolune3DButton
                    testId="sky-preset-cumulonimbus"
                    size="sm"
                    active={skyPreset === 'cumulonimbus' && !uploadedSkyUrl}
                    text={lang === 'bn' ? 'কিউমুলোনিম্বাস মেঘ' : 'Cumulonimbus Tower'}
                    onClick={() => {
                      setUploadedSkyUrl(null);
                      setSkyPreset('cumulonimbus');
                      handleAnalyzeSky('cumulonimbus');
                    }}
                  />
                  <Aerolune3DButton
                    testId="sky-preset-golden-hour"
                    size="sm"
                    active={skyPreset === 'golden_hour' && !uploadedSkyUrl}
                    text={lang === 'bn' ? 'গোল্ডেন আওয়ার আকাশ' : 'Golden Hour Sky'}
                    onClick={() => {
                      setUploadedSkyUrl(null);
                      setSkyPreset('golden_hour');
                      handleAnalyzeSky('golden_hour');
                    }}
                  />
                  <Aerolune3DButton
                    testId="sky-preset-cirrus"
                    size="sm"
                    active={skyPreset === 'cirrus' && !uploadedSkyUrl}
                    text={lang === 'bn' ? 'সিরাস মেঘ' : 'High Cirrus Sky'}
                    onClick={() => {
                      setUploadedSkyUrl(null);
                      setSkyPreset('cirrus');
                      handleAnalyzeSky('cirrus');
                    }}
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-cyan-300 border border-slate-700 hover:border-cyan-400 cursor-pointer whitespace-nowrap shrink-0">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'আকাশের ছবি আপলোড' : 'Upload Sky Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSkyFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 h-56 flex items-center justify-center relative">
                  <img
                    src={uploadedSkyUrl || generateProceduralSkyCanvasDataUrl(skyPreset)}
                    alt="Sky cloud observation frame"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-slate-950/85 border border-slate-700 rounded px-2.5 py-1 text-[11px] font-mono text-emerald-300">
                    isSkyDetected: {String(activeSkyVision.isSkyDetected)}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-slate-950/85 border border-slate-700 rounded px-2.5 py-1 text-[11px] font-mono text-cyan-300">
                    Station: {city.nameEn} · Cloud {point.cloudCover}% · Rain {point.rainProb}%
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="text-[11px] font-mono text-slate-400">
                    detectedCloudGenera (List&lt;String&gt;)
                  </div>
                  <div
                    data-testid="sky-vision-cloud-genera"
                    className="flex flex-wrap gap-2"
                  >
                    {activeSkyVision.detectedCloudGenera.map((genus, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-xs font-mono text-cyan-200"
                      >
                        {genus}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    {activeSkyVision.visualSkyDescription}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-amber-400">
                    {isAnalyzingSky
                      ? 'Analyzing Downscaled Bitmap + GroundedWeatherPayload...'
                      : 'MULTIMODAL SKY VISION + STATION COMPARISON'}
                  </span>
                  <Aerolune3DButton
                    size="sm"
                    accentColor="amber"
                    text={lang === 'bn' ? 'পুনরায় বিশ্লেষণ করুন' : 'Run Sky Vision AI'}
                    onClick={() => handleAnalyzeSky()}
                  />
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* PhotographyLightingAnalysis */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">
                        PhotographyLightingAnalysis
                      </span>
                      <span
                        data-testid="sky-vision-golden-hour-score"
                        className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-300 font-mono font-bold"
                      >
                        Score: {activeSkyVision.lightingAndPhotographyAdvice.goldenHourSuitabilityScore}/10
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {activeSkyVision.lightingAndPhotographyAdvice.lightingCondition}
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      {activeSkyVision.lightingAndPhotographyAdvice.cameraAndShootAdvice}
                    </p>
                  </div>

                  {/* StationComparisonReport */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono">
                        StationComparisonReport
                      </span>
                      <span
                        data-testid="sky-vision-alignment-status"
                        className={`px-2 py-0.5 rounded border font-mono font-bold text-[11px] ${
                          activeSkyVision.stationDataComparison.alignmentStatus === 'MATCHES'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : activeSkyVision.stationDataComparison.alignmentStatus ===
                                'LOCALIZED_DIFFERENCE'
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-rose-500/20 border-rose-400 text-rose-300'
                        }`}
                      >
                        {activeSkyVision.stationDataComparison.alignmentStatus}
                      </span>
                    </div>
                    <p className="text-emerald-200 leading-relaxed">
                      {activeSkyVision.stationDataComparison.comparisonExplanation}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                  dataSourceCitation: {activeSkyVision.dataSourceCitation}
                </div>
              </div>
              </div>
            </div>
          )}
        </div>
      ) : activeModule === 'weather_journal' ? (
        <div
          data-testid="weather-journal-and-alerts"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Personal AI Weather Alerts Rule Builder */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
              <span>{lang === 'bn' ? 'পার্সোনাল এআই আবহাওয়া অ্যালার্ট রুল বিল্ডার' : 'PERSONAL AI WEATHER ALERTS (WORKMANAGER + FCM)'}</span>
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {lang === 'bn' ? 'কাস্টম আবহাওয়া সতর্কতা নিয়ম' : 'Custom Threshold Alert Rules'}
            </h3>

            <form onSubmit={handleAddRuleSubmit} className="flex flex-wrap gap-2 items-center">
              <label htmlFor="alert-metric-select" className="sr-only">
                Alert Metric
              </label>
              <select
                id="alert-metric-select"
                value={newRuleMetric}
                onChange={(e) => setNewRuleMetric(e.target.value as AlertRule['metric'])}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="rainProb">Rain Probability (%)</option>
                <option value="aqi">Air Quality Index (AQI)</option>
                <option value="tempC">Temperature (°C)</option>
                <option value="windSpeedKmh">Wind Speed (km/h)</option>
                <option value="uvIndex">UV Index</option>
              </select>

              <label htmlFor="alert-threshold-input" className="sr-only">
                Alert Threshold Value
              </label>
              <input
                id="alert-threshold-input"
                type="number"
                value={newRuleThreshold}
                onChange={(e) => setNewRuleThreshold(e.target.value)}
                placeholder="Threshold"
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
              />

              <Aerolune3DButton
                type="submit"
                size="sm"
                accentColor="cyan"
                icon={<Plus className="w-3.5 h-3.5" />}
                text={lang === 'bn' ? 'অ্যালার্ট যোগ করুন' : 'Add Alert Rule'}
              />
            </form>
            {ruleError && <p className="text-xs text-rose-400 font-mono">{ruleError}</p>}

            <div className="space-y-2">
              {evaluatedAlerts.map(({ rule, actualValue, triggered }) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-white">
                      {lang === 'bn' ? rule.labelBn : rule.labelEn}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      Current: {actualValue} ·{' '}
                      <span className={triggered ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                        {triggered
                          ? lang === 'bn'
                            ? '▲ ট্রিগার হয়েছে (TRIGGERED)'
                            : '▲ TRIGGERED NOW'
                          : lang === 'bn'
                            ? '● স্বাভাবিক সীমায়'
                            : '● Monitoring'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleAlertRule(rule.id)}
                      className={`px-2 py-1 rounded font-mono text-[11px] ${
                        rule.enabled ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${rule.labelEn}`}
                      onClick={() => onDeleteAlertRule(rule.id)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weather Memory Journal & Monthly AI Recap */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-amber-400">
              <span>{lang === 'bn' ? 'ওয়েদার মেমোরি জার্নাল ও মাসিক রিক্যাপ' : 'WEATHER MEMORY JOURNAL & AI RECAP'}</span>
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">
                {lang === 'bn' ? 'ব্যক্তিগত আবহাওয়া ডায়েরি' : 'Personal Weather Timeline'}
              </h3>
              <Aerolune3DButton
                size="sm"
                accentColor="amber"
                text={lang === 'bn' ? 'মাসিক এআই রিক্যাপ' : 'Generate Monthly Recap'}
                onClick={generateMonthlyRecap}
              />
            </div>

            {recapSummary && (
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-3 text-xs text-amber-200">
                {recapSummary}
              </div>
            )}

            <form onSubmit={handleAddJournalSubmit} className="space-y-2.5">
              <div className="flex gap-2">
                <label htmlFor="journal-mood-select" className="sr-only">
                  Weather Mood
                </label>
                <select
                  id="journal-mood-select"
                  value={journalMood}
                  onChange={(e) => setJournalMood(e.target.value as WeatherJournalEntry['moodTag'])}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="Monsoon Drama">Monsoon Drama</option>
                  <option value="Golden Hour">Golden Hour</option>
                  <option value="Serene">Serene</option>
                  <option value="Breezy">Breezy</option>
                  <option value="Heatwave">Heatwave</option>
                </select>
                <label htmlFor="journal-note-input" className="sr-only">
                  Weather Memory Note
                </label>
                <input
                  id="journal-note-input"
                  type="text"
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'আজকের আবহাওয়ার অনুভূতি বা নোট লিখুন...'
                      : `Log today's weather snapshot in ${city.nameEn}...`
                  }
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
                <Aerolune3DButton
                  type="submit"
                  size="sm"
                  accentColor="cyan"
                  text={lang === 'bn' ? 'সংরক্ষণ' : 'Save Log'}
                />
              </div>
              {journalError && <p className="text-xs text-rose-400 font-mono">{journalError}</p>}
            </form>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {journalEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                    <span>
                      {entry.dateIso} · {lang === 'bn' ? entry.cityNameBn : entry.cityNameEn} ·{' '}
                      {formatTemp(entry.tempC, tempUnit)}
                    </span>
                    <span className="text-cyan-400">{entry.moodTag}</span>
                  </div>
                  <p className="text-slate-200">{entry.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeModule === 'kotlin_blueprint' ? (
        <div
          data-testid="kotlin-compose-blueprint"
          className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                NATIVE ANDROID ARCHITECTURE · KOTLIN + JETPACK COMPOSE + AGSL + FILAMENT
              </div>
              <h3 className="text-lg font-semibold text-white mt-0.5">
                Production Kotlin & AGSL Shader Reference Modules
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Clean Architecture · MVVM StateFlow · Hilt</span>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed">
{`package com.aerolune.weather.ui.designsystem

import androidx.compose.ui.graphics.Color

/**
 * Represents the live atmospheric state driving AEROLUNE's dynamic 3D lighting.
 */
enum class WeatherAtmosphere {
    DAWN_SUNRISE,
    NOON_CLEAR,
    EVENING_SUNSET,
    NIGHT_STARRY,
    MONSOON_RAIN,
    HEATWAVE_ALERT
}

/**
 * Holds color and lighting vectors for 3D extrusion, specular highlights, and ambient glow.
 */
data class Aerolune3DPalette(
    val surfaceTop: Color,
    val surfaceBottom: Color,
    val extrusionWall: Color,      // The 3D physical thickness/side wall of the button
    val specularHighlight: Color,  // Top-edge light reflection
    val neonGlow: Color,           // Outer futuristic aura
    val contentColor: Color
)

object Aerolune3DColors {
    fun getPalette(atmosphere: WeatherAtmosphere): Aerolune3DPalette {
        return when (atmosphere) {
            WeatherAtmosphere.DAWN_SUNRISE -> Aerolune3DPalette(
                surfaceTop = Color(0xFFFF8E53),
                surfaceBottom = Color(0xFFCC4B4B),
                extrusionWall = Color(0xFF7A2230),
                specularHighlight = Color(0xFFFFE5B4),
                neonGlow = Color(0xFFFF758C),
                contentColor = Color.White
            )
            WeatherAtmosphere.NOON_CLEAR -> Aerolune3DPalette(
                surfaceTop = Color(0xFF2FA4FF),
                surfaceBottom = Color(0xFF0052D4),
                extrusionWall = Color(0xFF002B75),
                specularHighlight = Color(0xFFB8ECFF),
                neonGlow = Color(0xFF00D2FF),
                contentColor = Color.White
            )
            WeatherAtmosphere.EVENING_SUNSET -> Aerolune3DPalette(
                surfaceTop = Color(0xFF9D50BB),
                surfaceBottom = Color(0xFF4E2A84),
                extrusionWall = Color(0xFF28114D),
                specularHighlight = Color(0xFFFFB396),
                neonGlow = Color(0xFFE86F88),
                contentColor = Color.White
            )
            WeatherAtmosphere.NIGHT_STARRY -> Aerolune3DPalette(
                surfaceTop = Color(0xFF1F2B4D),
                surfaceBottom = Color(0xFF0F172A),
                extrusionWall = Color(0xFF060A14),
                specularHighlight = Color(0xFF64FFDA),
                neonGlow = Color(0xFF38BDF8),
                contentColor = Color(0xFFE2E8F0)
            )
            WeatherAtmosphere.MONSOON_RAIN -> Aerolune3DPalette(
                surfaceTop = Color(0xFF2C5364),
                surfaceBottom = Color(0xFF152A36),
                extrusionWall = Color(0xFF0A161D),
                specularHighlight = Color(0xFF80DEEA),
                neonGlow = Color(0xFF26C6DA),
                contentColor = Color(0xFFECEFF1)
            )
            WeatherAtmosphere.HEATWAVE_ALERT -> Aerolune3DPalette(
                surfaceTop = Color(0xFFFF512F),
                surfaceBottom = Color(0xFFDD2476),
                extrusionWall = Color(0xFF7D0B3B),
                specularHighlight = Color(0xFFFFF176),
                neonGlow = Color(0xFFFF6E40),
                contentColor = Color.White
            )
        }
    }
}

// Reusable 3D Jetpack Compose Component (Aerolune3DButton.kt)
@Composable
fun Aerolune3DButton(
    text: String,
    atmosphere: WeatherAtmosphere = WeatherAtmosphere.NIGHT_STARRY,
    depthElevation: Dp = 6.dp,
    isLowEndMode: Boolean = false,
    onClick: () -> Unit
) {
    val palette = remember(atmosphere) { Aerolune3DColors.getPalette(atmosphere) }
    var isPressed by remember { mutableStateOf(false) }
    val pressOffset by animateFloatAsState(
        targetValue = if (isPressed) 1f else 0f,
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow, dampingRatio = Spring.DampingRatioMediumBouncy)
    )
    Box(
        modifier = Modifier
            .graphicsLayer {
                translationY = pressOffset * depthElevation.toPx()
                if (!isLowEndMode) shadowElevation = (1f - pressOffset) * depthElevation.toPx()
            }
            .background(
                Brush.verticalGradient(listOf(palette.surfaceTop, palette.surfaceBottom)),
                RoundedCornerShape(12.dp)
            )
            .border(1.dp, palette.specularHighlight, RoundedCornerShape(12.dp))
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = { isPressed = true; tryAwaitRelease(); isPressed = false; onClick() }
                )
            }
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge, color = palette.contentColor)
    }
}`}
          </pre>
        </div>
      ) : (
        /* Conversational Copilot + Selected AI Module Analysis + Multi-Model Chart */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left 7 Columns: Grounded Copilot & Active Module Output */}
          <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-cyan-400">{groundedOutput.badge}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="copilot-offline-toggle"
                    onClick={() => setIsOfflineSim((prev) => !prev)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                      isOfflineSim
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400'
                    }`}
                  >
                    <span>{isOfflineSim ? 'Offline Cache: ON' : 'Offline Cache: OFF'}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="copilot-prompt-inspector-toggle"
                    onClick={() => setShowPromptInspector((prev) => !prev)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                      showPromptInspector
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>System Prompt</span>
                  </button>
                  <button
                    type="button"
                    data-testid="voice-manager-code-toggle"
                    onClick={() => setShowVoiceManagerCode((prev) => !prev)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                      showVoiceManagerCode
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>VoiceManager.kt</span>
                  </button>
                  <button
                    type="button"
                    data-testid="voice-language-toggle"
                    onClick={toggleVoiceLanguage}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-900 border border-slate-700 text-cyan-300 hover:border-cyan-400 transition-colors"
                  >
                    <span>
                      Mic: {VOICE_LANGUAGE_META[voiceUiState.selectedLanguage].displayLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="copilot-stt-button"
                    onClick={handleVoiceInput}
                    aria-label="Voice Weather Assistant Microphone Input"
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                      isListeningMic
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {isListeningMic
                        ? `Listening (${voiceUiState.audioRmsDb.toFixed(1)} dB)...`
                        : lang === 'bn'
                          ? 'ভয়েস ইনপুট (STT)'
                          : 'Voice Input (STT)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="copilot-tts-button"
                    onClick={handleSpeakReadout}
                    aria-label="Read Weather Summary Aloud (TTS)"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono bg-slate-900 border border-slate-700 text-slate-300 hover:border-cyan-400 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {lang === 'bn'
                        ? `শুনুন (TTS · ${voiceActiveLocale})`
                        : `Speak (TTS · ${voiceActiveLocale})`}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 data-testid="ai-module-title" className="text-lg font-semibold text-white">
                  {groundedOutput.title}
                </h3>
                {copilotDeterministicReply && (
                  <span
                    data-testid="copilot-detected-language-badge"
                    className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-mono text-cyan-300"
                  >
                    {copilotDeterministicReply.isBanglish
                      ? 'Auto-Detected: Banglish → বাংলা Response'
                      : copilotDeterministicReply.detectedLanguage === 'bn'
                        ? 'Auto-Detected: বাংলা (Bengali)'
                        : 'Auto-Detected: English'}
                  </span>
                )}
              </div>

              {showVoiceManagerCode && (
                <pre
                  data-testid="aerolune-voice-manager-code"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-cyan-200 max-h-56 overflow-y-auto whitespace-pre"
                >
                  {AEROLUNE_VOICE_ASSISTANT_MANAGER_KT_SOURCE}
                </pre>
              )}

              {showPromptInspector && (
                <pre
                  data-testid="copilot-system-prompt-preview"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-cyan-200 max-h-48 overflow-y-auto whitespace-pre-wrap"
                >
                  {AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION}
                </pre>
              )}

              {aiUiState.errorMessage && (
                <div
                  data-testid="copilot-error-banner"
                  className="bg-rose-950/50 border border-rose-500/40 rounded-lg p-3 text-xs font-mono text-rose-200"
                >
                  {aiUiState.errorMessage}
                </div>
              )}

              {aiUiState.chatMessages.length > 0 && (
                <div
                  data-testid="copilot-chat-messages-list"
                  className="space-y-2 max-h-60 overflow-y-auto pr-1"
                >
                  {aiUiState.chatMessages.slice(-4).map((msg) => (
                    <div
                      key={msg.id}
                      data-testid={msg.isFromUser ? 'copilot-user-msg' : 'copilot-ai-msg'}
                      className={`rounded-lg p-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line border ${
                        msg.isFromUser
                          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-100 ml-6'
                          : 'bg-slate-900/95 border-slate-700 text-slate-100 mr-2'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-slate-400">
                        <span>
                          {msg.isFromUser
                            ? 'ChatMessage (isFromUser=true)'
                            : 'AEROLUNE Copilot · Grounded Stream'}
                        </span>
                        {msg.isStreaming && (
                          <span className="text-cyan-400">isStreaming=true...</span>
                        )}
                      </div>
                      <div>{msg.text || (msg.isStreaming ? '...' : '')}</div>
                    </div>
                  ))}
                </div>
              )}

              {isCallingAI ? (
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 text-xs font-mono text-cyan-300">
                  {lang === 'bn'
                    ? 'লাইভ আবহাওয়া জেসন পে-লোড যাচাই করে উত্তর তৈরি হচ্ছে...'
                    : 'Synthesizing strictly grounded response from [LIVE_WEATHER_PAYLOAD]...'}
                </div>
              ) : liveGeminiText ? (
                <div
                  data-testid="ai-copilot-response-text"
                  className="bg-slate-900/90 border border-cyan-500/30 rounded-lg p-4 text-sm text-slate-100 leading-relaxed whitespace-pre-line"
                >
                  {liveGeminiText}
                </div>
              ) : copilotDeterministicReply ? (
                <div
                  data-testid="ai-copilot-response-text"
                  className="bg-slate-900/90 border border-cyan-500/30 rounded-lg p-4 text-sm text-slate-100 leading-relaxed whitespace-pre-line"
                >
                  {copilotDeterministicReply.replyText}
                </div>
              ) : (
                <div
                  data-testid="ai-copilot-response-text"
                  className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-2.5"
                >
                  <p className="text-sm text-slate-200 leading-relaxed">{groundedOutput.summary}</p>
                  <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                    {groundedOutput.bulletPoints.map((bp, i) => (
                      <li key={i}>{bp}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] font-mono text-slate-400">
                {copilotDeterministicReply
                  ? copilotDeterministicReply.citationLine
                  : groundedOutput.groundingFootnote}
              </div>
            </div>

            {/* Quick Bilingual Prompt Chips + Conversational Input Bar */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap gap-1.5">
                {sampleQueries.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCopilotQuery(q);
                      triggerGeminiCopilot(q, activeModule);
                    }}
                    className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCopilotFormSubmit} className="flex gap-2">
                <label htmlFor="copilot-query-input" className="sr-only">
                  Ask AI Weather Copilot in Bengali or English
                </label>
                <input
                  id="copilot-query-input"
                  type="text"
                  value={copilotQuery}
                  onChange={(e) => setCopilotQuery(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'বাংলা বা ইংরেজিতে প্রশ্ন করুন (যেমন: আজ ফরিদপুরে বৃষ্টি হবে?)...'
                      : `Ask in Bengali or English (e.g. "আজ ফরিদপুরে বৃষ্টি হবে?" or "Safe time to spray crops in ${city.nameEn}?")`
                  }
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <Aerolune3DButton
                  type="submit"
                  size="md"
                  accentColor="cyan"
                  isLowEndMode={isLowEndMode}
                  icon={<Send className="w-3.5 h-3.5" />}
                  text={lang === 'bn' ? 'জিজ্ঞাসা করুন' : 'Ask Copilot'}
                />
              </form>
            </div>
          </div>

          {/* Right 5 Columns: Multi-Model Forecast Confidence Comparison (GFS vs ECMWF vs ICON) */}
          <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                <span>{lang === 'bn' ? 'মাল্টি-মডেল পূর্বাভাস তুলনা' : 'MULTI-MODEL NWP CONFIDENCE'}</span>
                <span>{modelSeries.confidenceLevel}</span>
              </div>
              <h3 className="text-base font-semibold text-white">
                ECMWF IFS vs. NOAA GFS vs. DWD ICON
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'bn'
                  ? `তাপমাত্রার সর্বোচ্চ ব্যবধান ±${modelSeries.maxTempSpreadC}°C · বৃষ্টির সম্ভাবনার ব্যবধান ${modelSeries.maxRainSpreadPct}%`
                  : `Max ensemble spread: ±${modelSeries.maxTempSpreadC}°C thermal · ${modelSeries.maxRainSpreadPct}% precipitation`}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-1.5">Lead</th>
                    <th className="py-1.5 text-cyan-400">ECMWF</th>
                    <th className="py-1.5 text-amber-400">GFS</th>
                    <th className="py-1.5 text-emerald-400">ICON</th>
                    <th className="py-1.5 text-right">Rain Spread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {modelSeries.series.map((row) => (
                    <tr key={row.hourOffset} className="text-slate-200">
                      <td className="py-1.5 font-semibold">{row.label}</td>
                      <td className="py-1.5">{formatTemp(row.ecmwfTempC, tempUnit)}</td>
                      <td className="py-1.5">{formatTemp(row.gfsTempC, tempUnit)}</td>
                      <td className="py-1.5">{formatTemp(row.iconTempC, tempUnit)}</td>
                      <td className="py-1.5 text-right text-slate-300">
                        {Math.min(row.ecmwfRainProb, row.gfsRainProb, row.iconRainProb)}–
                        {Math.max(row.ecmwfRainProb, row.gfsRainProb, row.iconRainProb)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
              {lang === 'bn'
                ? 'কোনো কাল্পনিক একক নির্ভুলতা স্কোর ব্যবহার না করে সরাসরি মডেলের পার্থক্য দেখানো হয়েছে।'
                : 'Displays real NWP ensemble divergence ranges rather than fabricated single-number accuracy scores.'}
            </div>
          </div>
        </div>
      )}

      {/* AI Weather Impact Simulator (4 Real-World Activity Scoring Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-semibold text-white">
            {lang === 'bn'
              ? 'এআই ওয়েদার ইমপ্যাক্ট সিমুলেটর (বাস্তব জীবনের কাজের স্কোর)'
              : 'AI Weather Impact Simulator — Real-World Activity Scores'}
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {lang === 'bn' ? 'লাইভ ও হোয়াট-ইফ ল্যাবের সাথে সিঙ্ককৃত' : 'Synchronized with Time Machine & What-If Lab'}
          </span>
        </div>

        <div
          data-testid="activity-impact-simulator"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {impacts.map((act) => (
            <div
              key={act.id}
              className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {lang === 'bn' ? act.titleBn : act.titleEn}
                  </span>
                  <span
                    className={`font-mono text-lg font-bold ${
                      act.score >= 75
                        ? 'text-emerald-400'
                        : act.score >= 52
                          ? 'text-cyan-400'
                          : act.score >= 32
                            ? 'text-amber-400'
                            : 'text-rose-400'
                    }`}
                  >
                    {act.score}/100
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {lang === 'bn' ? act.statusBn : act.statusEn} ·{' '}
                  {lang === 'bn' ? act.metricLabelBn : act.metricLabelEn}
                </div>
              </div>

              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    act.score >= 75
                      ? 'bg-emerald-400'
                      : act.score >= 52
                        ? 'bg-cyan-400'
                        : act.score >= 32
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                  }`}
                  style={{ width: `${act.score}%` }}
                />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {lang === 'bn' ? act.reasoningBn : act.reasoningEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
