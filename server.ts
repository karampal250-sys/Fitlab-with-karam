import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { INDIAN_AND_GLOBAL_FOODS } from './src/data/indianFoods.ts';
import type { FoodItem } from './src/types/fitplate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGenAiClient(): GoogleGenAI | null {
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

function mapOffProductToFoodItem(p: Record<string, unknown>): FoodItem | null {
  const name = String(p.product_name || p.product_name_en || '').trim();
  if (!name) return null;
  const nutriments = (p.nutriments || {}) as Record<string, unknown>;
  const kcal = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0);
  if (!Number.isFinite(kcal) || kcal <= 0) return null;

  const protein = Number(nutriments.proteins_100g ?? 0) || 0;
  const carbs = Number(nutriments.carbohydrates_100g ?? 0) || 0;
  const fat = Number(nutriments.fat_100g ?? 0) || 0;
  const fiber = Number(nutriments.fiber_100g ?? 0) || 0;
  const code = String(p.code || Math.random().toString(36).slice(2, 10));

  const servingQty = Number(p.serving_quantity) || 100;
  const servingLabel = String(p.serving_size || `${servingQty}g`);

  return {
    id: `off_${code}`,
    name: `${name}${p.brands ? ` (${String(p.brands).split(',')[0].trim()})` : ''}`.slice(0, 100),
    nameHi: name.slice(0, 100),
    category: 'packaged',
    dietType: 'veg',
    barcode: code,
    per100g: {
      calories: Math.round(kcal),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      fiber: Math.round(fiber * 10) / 10,
    },
    servings: [
      {
        unit: 'gram',
        labelEn: servingLabel,
        labelHi: servingLabel,
        grams: servingQty > 0 && servingQty <= 1000 ? servingQty : 100,
      },
      {
        unit: 'gram',
        labelEn: '100g',
        labelHi: '100 ग्राम',
        grams: 100,
      },
    ],
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '12mb' }));
  app.use((req, res, next) => {
    if (req.path === '/manifest.webmanifest' || req.path === '/sw.js' || req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Fit-Plat with Karam API' });
  });

  // Search local Indian+Global DB + Open Food Facts live API
  app.get('/api/foods/search', async (req, res) => {
    const query = String(req.query.q || '').trim().toLowerCase();
    const localMatches = query
      ? INDIAN_AND_GLOBAL_FOODS.filter(
          (f) =>
            f.name.toLowerCase().includes(query) ||
            f.nameHi.toLowerCase().includes(query) ||
            f.category.toLowerCase().includes(query)
        )
      : INDIAN_AND_GLOBAL_FOODS;

    let remoteMatches: FoodItem[] = [];
    if (query.length >= 2) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          query
        )}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`;
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'FitPlateNutritionApp/1.0' },
        });
        clearTimeout(timer);
        if (resp.ok) {
          const json = (await resp.json()) as { products?: Record<string, unknown>[] };
          remoteMatches = (json.products || [])
            .map(mapOffProductToFoodItem)
            .filter((x): x is FoodItem => x !== null);
        }
      } catch {
        // Offline or Open Food Facts timeout — fallback gracefully to local Indian+Global DB
      }
    }

    res.json({
      items: [...localMatches, ...remoteMatches].slice(0, 30),
      source: remoteMatches.length > 0 ? 'hybrid' : 'local',
    });
  });

  // Barcode lookup (Local packaged Indian items + Open Food Facts v2 API)
  app.get('/api/foods/barcode/:code', async (req, res) => {
    const code = String(req.params.code || '').replace(/[^0-9a-zA-Z]/g, '');
    if (!code) {
      res.status(400).json({ error: 'Invalid barcode' });
      return;
    }

    const localMatch = INDIAN_AND_GLOBAL_FOODS.find((f) => f.barcode === code);
    if (localMatch) {
      res.json({ item: localMatch, source: 'indian_db' });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        code
      )}.json?fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`;
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'FitPlateNutritionApp/1.0' },
      });
      clearTimeout(timer);
      if (resp.ok) {
        const data = (await resp.json()) as { status?: number; product?: Record<string, unknown> };
        if (data.status === 1 && data.product) {
          const mapped = mapOffProductToFoodItem({ ...data.product, code });
          if (mapped) {
            res.json({ item: mapped, source: 'open_food_facts' });
            return;
          }
        }
      }
      res.status(404).json({ error: 'Product not found for this barcode. You can add it as a custom food.' });
    } catch {
      res.status(503).json({ error: 'Barcode lookup unavailable offline. Try local items or add a custom food.' });
    }
  });

  // AI Photo Food Recognition
  app.post('/api/ai/recognize-food', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server. Check Settings > Secrets.' });
      return;
    }

    const { imageBase64, mimeType, hint, language } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      hint?: string;
      language?: 'en' | 'hi';
    };

    if (!imageBase64) {
      res.status(400).json({ error: 'Image data is required.' });
      return;
    }

    try {
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: `Identify all visible food items in this meal photo (Indian or global dishes). ${
                hint ? `User note: ${hint}. ` : ''
              }Estimate realistic portion sizes using Indian/household units (katori, piece, cup, gram, plate) and nutrition (calories, protein, carbs, fat, fiber). Respond in ${
                language === 'hi' ? 'Hindi (with English food names if clearer)' : 'English'
              }.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dishSummary: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    servingUnit: { type: Type.STRING },
                    servingQty: { type: Type.NUMBER },
                    grams: { type: Type.NUMBER },
                    calories: { type: Type.INTEGER },
                    protein: { type: Type.NUMBER },
                    carbs: { type: Type.NUMBER },
                    fat: { type: Type.NUMBER },
                    fiber: { type: Type.NUMBER },
                  },
                  required: ['name', 'servingUnit', 'servingQty', 'grams', 'calories', 'protein', 'carbs', 'fat', 'fiber'],
                },
              },
            },
            required: ['dishSummary', 'items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"dishSummary":"","items":[]}').trim());
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze food photo.';
      res.status(500).json({ error: msg });
    }
  });

  // AI 7-Day Personalized Meal Plan
  app.post('/api/ai/meal-plan', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
      return;
    }

    const { profile, budget } = req.body as {
      profile: {
        name: string;
        dietType: string;
        allergies: string[];
        dailyCalorieTarget: number;
        proteinTargetG: number;
        goalType: string;
        language: 'en' | 'hi';
      };
      budget: 'budget' | 'moderate' | 'flexible';
    };

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Create a realistic, balanced 7-day Indian & global meal plan for ${profile.name}.
Goal: ${profile.goalType} weight.
Daily Calorie Target: ${profile.dailyCalorieTarget} kcal (never recommend extreme crash diets).
Protein Target: ${profile.proteinTargetG}g/day.
Diet Type: ${profile.dietType} (strictly respect this!).
Allergies to strictly exclude: ${profile.allergies?.length ? profile.allergies.join(', ') : 'None'}.
Budget Tier: ${budget} (Indian household groceries, practical prep).
Language: ${profile.language === 'hi' ? 'Hindi (Devanagari script for meal titles and tips)' : 'English'}.
Each day must have 4 meals: breakfast, lunch, snacks, dinner whose calories sum close to ${profile.dailyCalorieTarget} kcal.`,
        config: {
          systemInstruction:
            'You are an evidence-based nutrition planner. Prioritize whole foods, Indian home staples (roti, dal, paneer, poha, sprouts, curd, rice, sabzi) alongside global options matching the user dietType and allergies. Never suggest unsafe starvation diets.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.STRING },
                    totalCalories: { type: Type.INTEGER },
                    estimatedCostInr: { type: Type.STRING },
                    meals: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          mealType: { type: Type.STRING },
                          title: { type: Type.STRING },
                          portion: { type: Type.STRING },
                          calories: { type: Type.INTEGER },
                          protein: { type: Type.NUMBER },
                          carbs: { type: Type.NUMBER },
                          fat: { type: Type.NUMBER },
                          fiber: { type: Type.NUMBER },
                        },
                        required: ['mealType', 'title', 'portion', 'calories', 'protein', 'carbs', 'fat', 'fiber'],
                      },
                    },
                  },
                  required: ['day', 'totalCalories', 'estimatedCostInr', 'meals'],
                },
              },
            },
            required: ['title', 'tips', 'days'],
          },
        },
      });

      const plan = JSON.parse((response.text ?? '{}').trim());
      res.json({
        id: `mp_${Date.now()}`,
        budget,
        dailyTargetCalories: profile.dailyCalorieTarget,
        createdAt: new Date().toISOString(),
        ...plan,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate meal plan.' });
    }
  });

  // AI Workout Plan (Home / Gym)
  app.post('/api/ai/workout-plan', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
      return;
    }

    const { profile, mode } = req.body as {
      profile: {
        goalType: string;
        activityLevel: string;
        age: number;
        language: 'en' | 'hi';
      };
      mode: 'home' | 'gym';
    };

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate a clear, beginner-friendly 5-day ${mode.toUpperCase()} workout split for a ${
          profile.age
        }-year-old whose goal is to ${profile.goalType} weight (current activity: ${profile.activityLevel}).
Language: ${profile.language === 'hi' ? 'Hindi' : 'English'}.
Include warm-up/form cues and realistic calorie burn estimates per exercise.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.STRING },
                    focus: { type: Type.STRING },
                    durationMin: { type: Type.INTEGER },
                    exercises: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          setsReps: { type: Type.STRING },
                          restSec: { type: Type.INTEGER },
                          caloriesEstimate: { type: Type.INTEGER },
                          note: { type: Type.STRING },
                        },
                        required: ['name', 'setsReps', 'restSec', 'caloriesEstimate', 'note'],
                      },
                    },
                  },
                  required: ['day', 'focus', 'durationMin', 'exercises'],
                },
              },
            },
            required: ['title', 'days'],
          },
        },
      });

      const plan = JSON.parse((response.text ?? '{}').trim());
      res.json({
        id: `wp_${Date.now()}`,
        mode,
        goalType: profile.goalType,
        createdAt: new Date().toISOString(),
        ...plan,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate workout plan.' });
    }
  });

  // AI Quick Remaining-Calorie Suggestion
  app.post('/api/ai/quick-suggestion', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
      return;
    }

    const { remainingCalories, remainingProteinG, dietType, allergies, language } = req.body as {
      remainingCalories: number;
      remainingProteinG: number;
      dietType: string;
      allergies: string[];
      language: 'en' | 'hi';
    };

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `The user has ${Math.max(100, remainingCalories)} kcal and ${Math.max(
          5,
          remainingProteinG
        )}g protein left for today. Diet: ${dietType}. Allergies to avoid: ${
          allergies?.length ? allergies.join(', ') : 'None'
        }.
Suggest ONE practical Indian or global meal/snack pairing fitting closely within ${Math.max(
          100,
          remainingCalories
        )} kcal.
Language: ${language === 'hi' ? 'Hindi' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestionText: { type: Type.STRING },
              foodName: { type: Type.STRING },
              servingUnit: { type: Type.STRING },
              calories: { type: Type.INTEGER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER },
              fiber: { type: Type.NUMBER },
            },
            required: ['suggestionText', 'foodName', 'servingUnit', 'calories', 'protein', 'carbs', 'fat', 'fiber'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get suggestion.' });
    }
  });

  // AI Coach Chat Assistant
  app.post('/api/ai/coach-chat', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
      return;
    }

    const { message, history, context } = req.body as {
      message: string;
      history: { role: 'user' | 'assistant'; text: string }[];
      context: {
        name: string;
        age: number;
        dietType: string;
        allergies: string[];
        goalType: string;
        dailyCalorieTarget: number;
        eatenCalories: number;
        proteinEaten: number;
        proteinTarget: number;
        language: 'en' | 'hi';
      };
    };

    if (!message?.trim()) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    try {
      const historyText = (history || [])
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}User question: ${message}`,
        config: {
          systemInstruction: `You are Fit-Plat with Karam Coach, a warm, practical nutrition and fitness assistant.
User Profile: ${context.name}, Age ${context.age}, Goal: ${context.goalType} weight, Diet: ${context.dietType}, Allergies: ${
            context.allergies?.length ? context.allergies.join(', ') : 'None'
          }.
Today's Progress: ${context.eatenCalories}/${context.dailyCalorieTarget} kcal eaten, ${context.proteinEaten}/${
            context.proteinTarget
          }g protein.
Safety Rules: Never recommend extreme crash diets or eating below 1200 kcal (women) / 1500 kcal (men). For medical conditions, pregnancy, or under-18 users, gently remind them to consult a doctor.
Keep answers concise, actionable, and culturally aware of Indian foods (roti, dal, paneer, curd, poha, etc.).
Reply in ${context.language === 'hi' ? 'Hindi (Devanagari)' : 'English'}.`,
        },
      });

      res.json({ reply: response.text || 'I could not generate a response right now.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Chat request failed.' });
    }
  });

  // Vite middleware in dev / static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true' || Boolean(process.env.K_SERVICE);
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      plugins: hmrDisabled
        ? [
            {
              name: 'disable-hmr-websocket',
              enforce: 'post',
              transform(code, id) {
                const cleanId = id.split('?')[0];
                if (cleanId.endsWith('/vite/dist/client/client.mjs')) {
                  return code
                    .replace('async connect(handlers) {', 'async connect() { return;')
                    .replace('wsTransport.send(data);', '');
                }
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        port: PORT,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found. Run npm run build.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Fit-Plat with Karam server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
