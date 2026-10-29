import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AeroluneSystemPrompts,
  formatLiveWeatherPayloadPrompt,
  formatSkyVisionMultimodalPrompt,
  formatSmartFarmingPrompt,
} from './src/utils/groundedFarmingModels';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '12mb' }));

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Grounded Conversational Copilot & 16 AI Modules Endpoint
app.post('/api/ai/copilot', async (req, res) => {
  try {
    const {
      query,
      language = 'en',
      moduleType = 'copilot',
      telemetry,
      payload,
      chatHistory = [],
    } = req.body;
    const ai = getGenAIClient();
    if (!ai) {
      res.status(200).json({
        grounded: true,
        source: 'local-deterministic-grounding',
        text: null,
      });
      return;
    }

    const prompt = payload
      ? formatLiveWeatherPayloadPrompt(
          payload,
          query || `Provide grounded ${moduleType} analysis.`
        )
      : `[LIVE_WEATHER_PAYLOAD]\n${JSON.stringify(telemetry)}\n[/LIVE_WEATHER_PAYLOAD]\n\nUser Question: ${
          query || `Provide grounded meteorological analysis (${language}).`
        }`;

    const contents = [
      ...(Array.isArray(chatHistory)
        ? chatHistory.map((turn: { role?: string; text?: string }) => ({
            role: turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(turn.text || '') }],
          }))
        : []),
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: AeroluneSystemPrompts.WEATHER_COPILOT_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        topP: 0.85,
      },
    });

    res.json({
      grounded: true,
      source: 'gemini-3.8-flash',
      text: response.text || '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI service fallback';
    res.status(200).json({
      grounded: true,
      source: 'local-deterministic-grounding',
      text: null,
      warning: message,
    });
  }
});

// 2. Sky Vision AI (Multimodal Bitmap + GroundedWeatherPayload -> SkyVisionAiResponse)
app.post('/api/ai/sky-vision', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png', language = 'en', telemetry, payload } = req.body;
    const ai = getGenAIClient();
    if (!ai || !imageBase64) {
      res.status(200).json({
        grounded: true,
        source: 'local-deterministic-grounding',
        analysis: null,
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const prompt = payload
      ? formatSkyVisionMultimodalPrompt(payload, language === 'bn' ? 'bn' : 'en', false)
      : `[LIVE_WEATHER_PAYLOAD]\n${JSON.stringify(telemetry)}\n[/LIVE_WEATHER_PAYLOAD]\n\nPreferred Output Language: ${language} ("bn" = Bengali, "en" = English).\nAnalyze the attached sky photograph, identify visible cloud types, evaluate lighting for photography, and compare visual sky conditions with the live weather payload.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        systemInstruction: AeroluneSystemPrompts.SKY_VISION_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSkyDetected: { type: Type.BOOLEAN },
            detectedCloudGenera: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            visualSkyDescription: { type: Type.STRING },
            lightingAndPhotographyAdvice: {
              type: Type.OBJECT,
              properties: {
                lightingCondition: { type: Type.STRING },
                goldenHourSuitabilityScore: { type: Type.INTEGER },
                cameraAndShootAdvice: { type: Type.STRING },
              },
              required: [
                'lightingCondition',
                'goldenHourSuitabilityScore',
                'cameraAndShootAdvice',
              ],
            },
            stationDataComparison: {
              type: Type.OBJECT,
              properties: {
                alignmentStatus: {
                  type: Type.STRING,
                  enum: ['MATCHES', 'LOCALIZED_DIFFERENCE', 'OBSCURED'],
                },
                comparisonExplanation: { type: Type.STRING },
              },
              required: ['alignmentStatus', 'comparisonExplanation'],
            },
            dataSourceCitation: { type: Type.STRING },
          },
          required: [
            'isSkyDetected',
            'detectedCloudGenera',
            'visualSkyDescription',
            'lightingAndPhotographyAdvice',
            'stationDataComparison',
            'dataSourceCitation',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    res.json({
      grounded: true,
      source: 'gemini-3.8-flash',
      analysis: parsed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sky Vision fallback';
    res.status(200).json({
      grounded: true,
      source: 'local-deterministic-grounding',
      analysis: null,
      warning: message,
    });
  }
});

// 3. Gemini Text-to-Speech (TTS) Audio Readout
app.post('/api/ai/tts', async (req, res) => {
  try {
    const { text, language = 'en' } = req.body;
    const ai = getGenAIClient();
    if (!ai || !text) {
      res.status(200).json({ audioBase64: null });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: String(text).slice(0, 600),
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: language === 'bn' ? 'Kore' : 'Zephyr' },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    res.json({ audioBase64: base64Audio });
  } catch {
    res.status(200).json({ audioBase64: null });
  }
});

// 4. Structured Smart Farming Mode Endpoint (GroundedWeatherPayload + FarmingContextRequest -> SmartFarmingAiResponse)
app.post('/api/ai/smart-farming', async (req, res) => {
  try {
    const { payload, farmingContext } = req.body;
    const ai = getGenAIClient();
    if (!ai || !payload || !farmingContext) {
      res.status(200).json({
        grounded: true,
        source: 'local-deterministic-grounding',
        response: null,
      });
      return;
    }

    const taskRecommendationSchema = {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: 'Must be OPTIMAL, CAUTION, or AVOID',
          enum: ['OPTIMAL', 'CAUTION', 'AVOID'],
        },
        recommendedTimeWindow: { type: Type.STRING },
        headline: { type: Type.STRING },
        detailedReasoning: { type: Type.STRING },
        triggeringMetrics: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'status',
        'recommendedTimeWindow',
        'headline',
        'detailedReasoning',
        'triggeringMetrics',
      ],
    };

    const prompt = formatSmartFarmingPrompt(payload, farmingContext);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: AeroluneSystemPrompts.SMART_FARMING_SYSTEM_INSTRUCTION,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallSummary: { type: Type.STRING },
            dataSourceCitation: { type: Type.STRING },
            irrigationAdvice: taskRecommendationSchema,
            pesticideSprayingAdvice: taskRecommendationSchema,
            cropDryingAdvice: taskRecommendationSchema,
            weatherRiskWarning: { type: Type.STRING, nullable: true },
          },
          required: [
            'overallSummary',
            'dataSourceCitation',
            'irrigationAdvice',
            'pesticideSprayingAdvice',
            'cropDryingAdvice',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    res.json({
      grounded: true,
      source: 'gemini-3.8-flash',
      response: parsed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Smart Farming fallback';
    res.status(200).json({
      grounded: true,
      source: 'local-deterministic-grounding',
      response: null,
      warning: message,
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AEROLUNE Server running on http://localhost:${PORT}`);
  });
}

startServer();
