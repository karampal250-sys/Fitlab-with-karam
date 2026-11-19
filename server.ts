import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { INDIAN_AND_GLOBAL_FOODS } from './src/data/indianFoods.ts';
import type { FoodItem, Language } from './src/types/fitplate.ts';
import {
  mapFoodLocalNames,
  normalizeCategoryFilter,
  resolveLookupFoodItem,
  searchFoodsWithPriority,
} from './src/utils/foodSearch.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const FALLBACK_MODEL_NAME = 'gemini-3.1-flash-lite';

function parseGeminiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'AI request failed.');
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // not JSON
  }
  return raw;
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = parseGeminiErrorMessage(err).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch failed')
  );
}

function stripJsonCodeFences(text: string): string {
  const trimmed = (text || '').trim();
  const unwrapped = trimmed.startsWith('```')
    ? trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
    : trimmed;
  if (unwrapped.startsWith('{') || unwrapped.startsWith('[')) {
    return unwrapped;
  }
  const match = unwrapped.match(/\{[\s\S]*\}/);
  return match ? match[0] : unwrapped;
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
    config?: Parameters<GoogleGenAI['models']['generateContent']>[0]['config'];
    preferFastModel?: boolean;
  }
) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastErr: unknown = null;

  const fastConfig = { ...(params.config || {}) };
  delete fastConfig.thinkingConfig;

  const hydrogenConfig = {
    ...(params.config || {}),
    thinkingConfig: params.config?.thinkingConfig ?? { thinkingLevel: ThinkingLevel.LOW },
  };

  const sequence = params.preferFastModel
    ? [
        { model: FALLBACK_MODEL_NAME, config: fastConfig, attempts: 2 },
        { model: MODEL_NAME, config: hydrogenConfig, attempts: 1 },
      ]
    : [
        { model: MODEL_NAME, config: hydrogenConfig, attempts: 2 },
        { model: FALLBACK_MODEL_NAME, config: fastConfig, attempts: 2 },
      ];

  for (let s = 0; s < sequence.length; s++) {
    const step = sequence[s];
    for (let attempt = 0; attempt < step.attempts; attempt++) {
      try {
        return await ai.models.generateContent({
          model: step.model,
          contents: params.contents,
          config: step.config,
        });
      } catch (err) {
        lastErr = err;
        const isLastStep = s === sequence.length - 1 && attempt === step.attempts - 1;
        if (!isRetryableGeminiError(err) || isLastStep) {
          if (!isRetryableGeminiError(err)) throw err;
          break;
        }
        await sleep(350 * (attempt + 1));
      }
    }
  }

  throw lastErr;
}

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

  return mapFoodLocalNames({
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
  });
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '25mb' }));
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

  // Search prioritized Indian+Global DB first with category filtering, then supplement & deduplicate with Open Food Facts live API
  app.get('/api/foods/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const language: Language = req.query.lang === 'hi' ? 'hi' : 'en';
    const category = normalizeCategoryFilter(String(req.query.category || 'all'));

    const localMatches = searchFoodsWithPriority({
      query,
      localFoods: INDIAN_AND_GLOBAL_FOODS,
      categoryFilter: category,
      language,
      limit: 60,
    });

    let remoteMatches: FoodItem[] = [];
    // Only query Open Food Facts when browsing 'all' or 'packaged' with >=2 chars and <15 local hits
    const allowRemoteSupplement = category === 'all' || category === 'packaged';
    if (allowRemoteSupplement && query.length >= 2 && localMatches.length < 15) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          query
        )}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`;
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'FitPlateNutritionApp/1.0' },
        });
        clearTimeout(timer);
        if (resp.ok) {
          const json = (await resp.json()) as { products?: Record<string, unknown>[] };
          remoteMatches = (json.products || [])
            .map(mapOffProductToFoodItem)
            .filter((x): x is FoodItem => x !== null)
            .map((item) => resolveLookupFoodItem(item, INDIAN_AND_GLOBAL_FOODS));
        }
      } catch {
        // Offline or Open Food Facts timeout — fallback gracefully to local Indian+Global DB
      }
    }

    const combined = searchFoodsWithPriority({
      query,
      localFoods: INDIAN_AND_GLOBAL_FOODS,
      remoteFoods: remoteMatches,
      categoryFilter: category,
      language,
      limit: 60,
    });

    const hasRemoteInResult = combined.some((item) => item.id.startsWith('off_'));
    res.json({
      items: combined,
      category,
      total: combined.length,
      source: hasRemoteInResult ? 'hybrid' : 'local',
    });
  });

  // Barcode lookup (Prioritize Local Indian+Global DB, then Open Food Facts v2 API with local name mapping)
  app.get('/api/foods/barcode/:code', async (req, res) => {
    const code = String(req.params.code || '').replace(/[^0-9a-zA-Z]/g, '');
    if (!code) {
      res.status(400).json({ error: 'Invalid barcode' });
      return;
    }

    const localMatch = INDIAN_AND_GLOBAL_FOODS.find((f) => f.barcode === code);
    if (localMatch) {
      res.json({ item: mapFoodLocalNames(localMatch), source: 'indian_db' });
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
            const resolved = resolveLookupFoodItem(mapped, INDIAN_AND_GLOBAL_FOODS);
            res.json({
              item: resolved,
              source: resolved.id.startsWith('off_') ? 'open_food_facts' : 'indian_db',
            });
            return;
          }
        }
      }
      res.status(404).json({ error: 'Product not found for this barcode. You can add it as a custom food.' });
    } catch {
      res.status(503).json({ error: 'Barcode lookup unavailable offline. Try local items or add a custom food.' });
    }
  });

  // AI Food Photo Nutrition Recognition (Calories, Protein, Carbs, Fat, Fiber from uploaded image)
  app.post('/api/ai/recognize-food', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server. Check Settings > Secrets.' });
      return;
    }

    const { imageBase64, mimeType, imageMimeType, language } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      imageMimeType?: string;
      language?: 'en' | 'hi';
    };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Please upload a food photo first.' });
      return;
    }

    const normalizeImageMime = (raw?: string): string => {
      const base = (raw || 'image/jpeg').split(';')[0].trim().toLowerCase();
      if (
        base === 'image/jpeg' ||
        base === 'image/jpg' ||
        base === 'image/png' ||
        base === 'image/webp' ||
        base === 'image/heic' ||
        base === 'image/heif'
      ) {
        return base === 'image/jpg' ? 'image/jpeg' : base;
      }
      return 'image/jpeg';
    };

    try {
      const dataUrlMime = imageBase64.match(/^data:([^;]+);base64,/i)?.[1];
      const cleanImg = (imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64).replace(/\s+/g, '');
      if (!cleanImg) {
        res.status(400).json({ error: 'Uploaded image data was empty. Please choose a valid food photo.' });
        return;
      }

      const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [
        {
          inlineData: {
            mimeType: normalizeImageMime(dataUrlMime || imageMimeType || mimeType),
            data: cleanImg,
          },
        },
        {
          text: `Analyze the uploaded image carefully. It may contain ANY kind of food, dish, meal, beverage, sweet, pasta, snack, dry/raw ingredient (such as dry macaroni, uncooked pasta, rice, lentils, fruits, nuts), packaged food item, or food nutrition label.
Identify ALL visible food items, ingredients, sauces, sides, and beverages.
Calculate realistic portion sizes (katori, piece, cup, gram, plate, glass, bowl, tbsp) and accurate complete nutrition for every item:
- grams
- calories (kcal)
- protein (g)
- carbs (g)
- fat (g)
- fiber (g)
If a plate or thali has multiple items (e.g., roti, dal, rice, sabzi, curd, salad, pasta with garlic bread, chai with biscuits), list every single visible item separately so the total sums accurately.
If the image shows a packaged food or nutrition facts label, read the serving/package weight and extract its exact calories, protein, carbs, fat, and fiber.
Respond in ${language === 'hi' ? 'Hindi (with clear food names)' : 'English'}.`,
        },
      ];

      const response = await generateContentWithFallback(ai, {
        contents: { parts },
        preferFastModel: true,
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

      const rawText = stripJsonCodeFences(response.text ?? '{"dishSummary":"","items":[]}');
      const parsed = JSON.parse(rawText) as {
        dishSummary?: string;
        items?: Array<Record<string, unknown>>;
      };

      const sanitizedItems = (Array.isArray(parsed.items) ? parsed.items : [])
        .map((it) => ({
          name: String(it.name || 'Food Item').trim(),
          servingUnit: String(it.servingUnit || 'serving').trim(),
          servingQty: Math.max(0.25, Math.round((Number(it.servingQty) || 1) * 10) / 10),
          grams: Math.max(1, Math.round(Number(it.grams) || 100)),
          calories: Math.max(0, Math.round(Number(it.calories) || 0)),
          protein: Math.max(0, Math.round((Number(it.protein) || 0) * 10) / 10),
          carbs: Math.max(0, Math.round((Number(it.carbs) || 0) * 10) / 10),
          fat: Math.max(0, Math.round((Number(it.fat) || 0) * 10) / 10),
          fiber: Math.max(0, Math.round((Number(it.fiber) || 0) * 10) / 10),
        }))
        .filter((it) => it.name.length > 0);

      if (sanitizedItems.length === 0) {
        res.status(422).json({
          error:
            language === 'hi'
              ? 'इस तस्वीर में कोई भोजन स्पष्ट नहीं दिखा। कृपया भोजन की स्पष्ट फ़ोटो अपलोड करें।'
              : 'No food items could be clearly identified in this photo. Please upload a clearer photo of your meal.',
        });
        return;
      }

      res.json({
        dishSummary: String(parsed.dishSummary || ''),
        items: sanitizedItems,
      });
    } catch (err) {
      const msg = parseGeminiErrorMessage(err);
      res.status(500).json({ error: msg });
    }
  });

  // AI 7-Day Personalized Meal Plan (hitting Protein, Carbs & Fiber targets)
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
        carbsTargetG?: number;
        fatTargetG?: number;
        fiberTargetG?: number;
        goalType: string;
        language: 'en' | 'hi';
      };
      budget: 'budget' | 'moderate' | 'flexible';
    };

    const carbsTarget = profile.carbsTargetG || Math.round((profile.dailyCalorieTarget * 0.48) / 4);
    const fiberTarget = profile.fiberTargetG || Math.round((profile.dailyCalorieTarget / 1000) * 14);

    try {
      const response = await generateContentWithFallback(ai, {
        contents: `Create a realistic, balanced 7-day day-wise Indian & global meal plan for ${profile.name}.
Goal: ${profile.goalType} weight.
Daily Targets to meet EVERY DAY:
- Calories: ~${profile.dailyCalorieTarget} kcal
- Protein: ~${profile.proteinTargetG}g/day
- Carbs: ~${carbsTarget}g/day
- Fiber: ~${fiberTarget}g/day
Diet Type: ${profile.dietType} (strictly respect this!).
Allergies to strictly exclude: ${profile.allergies?.length ? profile.allergies.join(', ') : 'None'}.
Budget Tier: ${budget} (Indian household groceries, practical prep).
Language: ${profile.language === 'hi' ? 'Hindi (Devanagari script for meal titles and tips)' : 'English'}.
Each day (Monday to Sunday) must have 4 meals (breakfast, lunch, snacks, dinner) whose calories, protein, carbs, and fiber sum closely to the daily targets.`,
        config: {
          systemInstruction:
            'You are an evidence-based nutrition planner. Prioritize whole foods, high-protein and high-fiber Indian home staples (roti, dal, sprouts, paneer/tofu, curd, oats, vegetables, fruits, seeds) matching the user dietType and allergies. Always compute accurate day totals.',
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
                    totalProtein: { type: Type.INTEGER },
                    totalCarbs: { type: Type.INTEGER },
                    totalFat: { type: Type.INTEGER },
                    totalFiber: { type: Type.INTEGER },
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
                  required: ['day', 'totalCalories', 'totalProtein', 'totalCarbs', 'totalFat', 'totalFiber', 'estimatedCostInr', 'meals'],
                },
              },
            },
            required: ['title', 'tips', 'days'],
          },
        },
      });

      const plan = JSON.parse(stripJsonCodeFences(response.text ?? '{}'));
      res.json({
        id: `mp_${Date.now()}`,
        budget,
        dailyTargetCalories: profile.dailyCalorieTarget,
        createdAt: new Date().toISOString(),
        ...plan,
      });
    } catch (err) {
      res.status(500).json({ error: parseGeminiErrorMessage(err) });
    }
  });

  // AI Workout Plan (5-Day Gym / Home / Both combining Muscle + Cardio with sets)
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
      mode: 'home' | 'gym' | 'both';
    };

    const modeDesc =
      mode === 'gym'
        ? 'GYM equipment workouts'
        : mode === 'home'
        ? 'HOME bodyweight/minimal-equipment workouts'
        : 'BOTH GYM and HOME workouts (e.g., 3 gym days + 2 home days)';

    try {
      const response = await generateContentWithFallback(ai, {
        contents: `Generate an exact 5-day weekly ${modeDesc} plan for a ${profile.age}-year-old whose goal is to ${profile.goalType} weight (current activity: ${profile.activityLevel}).
Requirements:
- Exactly 5 workout days (Day 1 to Day 5).
- EVERY day MUST combine BOTH muscle/strength exercises (exerciseType: "muscle") AND cardio exercises (exerciseType: "cardio").
- Clearly state number of sets and reps or duration in "setsReps" for every single exercise (e.g., "4 sets × 10-12 reps" or "4 sets × 3 min intervals").
- Language: ${profile.language === 'hi' ? 'Hindi' : 'English'}.`,
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
                          exerciseType: { type: Type.STRING },
                          setsReps: { type: Type.STRING },
                          restSec: { type: Type.INTEGER },
                          caloriesEstimate: { type: Type.INTEGER },
                          note: { type: Type.STRING },
                        },
                        required: ['name', 'exerciseType', 'setsReps', 'restSec', 'caloriesEstimate', 'note'],
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

      const plan = JSON.parse(stripJsonCodeFences(response.text ?? '{}'));
      res.json({
        id: `wp_${Date.now()}`,
        mode,
        goalType: profile.goalType,
        createdAt: new Date().toISOString(),
        ...plan,
      });
    } catch (err) {
      res.status(500).json({ error: parseGeminiErrorMessage(err) });
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
      const response = await generateContentWithFallback(ai, {
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

      const parsed = JSON.parse(stripJsonCodeFences(response.text ?? '{}'));
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: parseGeminiErrorMessage(err) });
    }
  });

  // AI Daily Meal Analysis & Nutrition Score
  app.post('/api/ai/meal-analysis', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(500).json({ error: 'Gemini API key is not configured on the server. Check Settings > Secrets.' });
      return;
    }

    const { activeDate, meals, totals, targets, goalType, dietType, language } = req.body as {
      activeDate?: string;
      meals?: Array<{
        mealType: string;
        foodName: string;
        servingQty?: number;
        servingUnit?: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }>;
      totals?: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      targets?: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      goalType?: string;
      dietType?: string;
      language?: 'en' | 'hi';
    };

    if (!Array.isArray(meals) || meals.length === 0) {
      res.status(400).json({ error: 'Please log at least one food item before running AI meal analysis.' });
      return;
    }

    const mealLines = meals
      .slice(0, 40)
      .map(
        (m) =>
          `- [${m.mealType}] ${m.foodName}${m.servingQty ? ` (${m.servingQty} ${m.servingUnit || 'serving'})` : ''}: ${m.calories} kcal, P ${m.protein}g, C ${m.carbs}g, F ${m.fat}g, Fiber ${m.fiber}g`
      )
      .join('\n');

    const safeTotals = totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    const safeTargets = targets || { calories: 2000, protein: 90, carbs: 220, fat: 65, fiber: 28 };

    try {
      const response = await generateContentWithFallback(ai, {
        contents: `Evaluate the user's daily nutrition intake for ${activeDate || 'today'}.
User Goal: ${goalType || 'maintain'} weight. Diet preference: ${dietType || 'veg'}.
Daily Totals Logged:
- Calories: ${safeTotals.calories} / ${safeTargets.calories} kcal
- Protein: ${safeTotals.protein} / ${safeTargets.protein} g
- Carbs: ${safeTotals.carbs} / ${safeTargets.carbs} g
- Fat: ${safeTotals.fat} / ${safeTargets.fat} g
- Fiber: ${safeTotals.fiber} / ${safeTargets.fiber} g

Logged Meals (${meals.length} items):
${mealLines}

Provide an honest, evidence-based daily Nutrition Score (0 to 100 integer) reflecting calorie alignment, protein sufficiency, fiber density, and macro balance, plus practical strengths, macro gaps, and one actionable next step tailored to their ${dietType || 'veg'} diet.
Respond in ${language === 'hi' ? 'Hindi (Devanagari script)' : 'English'}.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a practical clinical sports nutritionist. Score strictly from 0 to 100 based on how well the logged food macros align with the user targets. Keep summary concise (2 sentences), strengths and gaps 1-3 crisp bullets each, and nextStepAdvice to 1 concrete food/meal tweak.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nutritionScore: { type: Type.INTEGER },
              gradeLabel: { type: Type.STRING },
              summary: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              nextStepAdvice: { type: Type.STRING },
            },
            required: ['nutritionScore', 'gradeLabel', 'summary', 'strengths', 'gaps', 'nextStepAdvice'],
          },
        },
      });

      const parsed = JSON.parse(stripJsonCodeFences(response.text ?? '{}')) as {
        nutritionScore?: number;
        gradeLabel?: string;
        summary?: string;
        strengths?: string[];
        gaps?: string[];
        nextStepAdvice?: string;
      };

      const clampedScore = Math.max(0, Math.min(100, Math.round(Number(parsed.nutritionScore ?? 0))));
      res.json({
        nutritionScore: clampedScore,
        gradeLabel: parsed.gradeLabel || '',
        summary: parsed.summary || '',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4) : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : [],
        nextStepAdvice: parsed.nextStepAdvice || '',
        analyzedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: parseGeminiErrorMessage(err) });
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

      const response = await generateContentWithFallback(ai, {
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
      res.status(500).json({ error: parseGeminiErrorMessage(err) });
    }
  });

  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message = parseGeminiErrorMessage(err) || 'API request failed.';
    res.status(status).json({ error: message });
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
