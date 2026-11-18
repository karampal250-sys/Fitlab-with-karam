import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode,
  Check,
  ChevronDown,
  Edit3,
  Heart,
  Image as ImageIcon,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Utensils,
  X,
} from 'lucide-react';
import type { DietType, FoodItem, FoodLogEntry, Language, MealType } from '../types/fitplate';
import { computeMacrosForGrams, INDIAN_AND_GLOBAL_FOODS } from '../data/indianFoods';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';
import { t } from '../i18n/translations';

interface FoodLoggerSheetProps {
  language: Language;
  activeDate: string;
  initialMealType: MealType;
  uid: string;
  customFoods: FoodItem[];
  favoriteIds: string[];
  recentFoodIds: string[];
  onToggleFavorite: (food: FoodItem) => void;
  onSaveCustomFood: (food: FoodItem) => void;
  onAddLog: (entry: FoodLogEntry) => void;
  onClose?: () => void;
  isStandaloneTab?: boolean;
}

type LoggerTab = 'search' | 'photo' | 'custom' | 'barcode' | 'favorites' | 'recent';

interface AiDetectedFood {
  name: string;
  servingUnit: string;
  servingQty: number;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

function resizeDataUrlIfNeeded(dataUrl: string, maxDim = 1280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h || (w <= maxDim && h <= maxDim && dataUrl.length < 1_400_000)) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const FoodLoggerSheet: React.FC<FoodLoggerSheetProps> = ({
  language,
  activeDate,
  initialMealType,
  uid,
  customFoods,
  favoriteIds,
  recentFoodIds,
  onToggleFavorite,
  onSaveCustomFood,
  onAddLog,
  onClose,
  isStandaloneTab,
}) => {
  const isHi = language === 'hi';
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [activeTab, setActiveTab] = useState<LoggerTab>('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>(INDIAN_AND_GLOBAL_FOODS);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);

  // Selected food serving adjuster
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [servingQty, setServingQty] = useState(1);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Food Photo Upload nutrition calculation state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<AiDetectedFood[]>([]);
  const [dishSummary, setDishSummary] = useState('');
  const [loggedAllDone, setLoggedAllDone] = useState(false);

  // Manual Custom Food & Recipe Builder state
  const [customName, setCustomName] = useState('');
  const [customDiet, setCustomDiet] = useState<DietType>('veg');
  const [customUnit, setCustomUnit] = useState<'katori' | 'piece' | 'gram' | 'cup' | 'plate'>('katori');
  const [customGrams, setCustomGrams] = useState(150);
  const [customCal, setCustomCal] = useState(220);
  const [customPro, setCustomPro] = useState(8);
  const [customCarb, setCustomCarb] = useState(28);
  const [customFat, setCustomFat] = useState(7);
  const [customFib, setCustomFib] = useState(3);
  const [isRecipeMode, setIsRecipeMode] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<{ food: FoodItem; grams: number }[]>([]);

  const allKnownFoods = [...customFoods, ...INDIAN_AND_GLOBAL_FOODS];

  useEffect(() => {
    setMealType(initialMealType);
  }, [initialMealType]);

  // Debounced hybrid search (local Indian DB + Open Food Facts API)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([...customFoods, ...INDIAN_AND_GLOBAL_FOODS]);
      return;
    }
    const localFirst = allKnownFoods.filter(
      (f) =>
        f.name.toLowerCase().includes(trimmed.toLowerCase()) ||
        f.nameHi.toLowerCase().includes(trimmed.toLowerCase()) ||
        f.category.toLowerCase().includes(trimmed.toLowerCase())
    );
    setSearchResults(localFirst);

    const timer = setTimeout(async () => {
      if (trimmed.length < 2) return;
      setIsSearching(true);
      try {
        const { ok, data } = await safeFetchJson<{ items?: FoodItem[] }>(
          apiUrl(`/api/foods/search?q=${encodeURIComponent(trimmed)}`)
        );
        if (ok && data && Array.isArray(data.items)) {
          const merged = [
            ...customFoods.filter((f) => f.name.toLowerCase().includes(trimmed.toLowerCase())),
            ...data.items,
          ];
          setSearchResults(merged);
        }
      } catch {
        // Offline fallback keeps local matches
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [query, customFoods.length]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
    };
  }, []);

  const lookupBarcode = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setBarcodeLoading(true);
    setBarcodeError(null);
    try {
      const { ok, data } = await safeFetchJson<{ item?: FoodItem; error?: string }>(
        apiUrl(`/api/foods/barcode/${encodeURIComponent(clean)}`)
      );
      if (!ok || !data) {
        const offlineHit = allKnownFoods.find((f) => f.barcode === clean);
        if (offlineHit) {
          setSelectedFood(offlineHit);
          setSelectedServingIdx(0);
          setServingQty(1);
        } else {
          setBarcodeError(data?.error || (isHi ? 'प्रोडक्ट नहीं मिला।' : 'Product not found.'));
        }
      } else if (data.item) {
        setSelectedFood(data.item);
        setSelectedServingIdx(0);
        setServingQty(1);
      }
    } catch {
      const offlineHit = allKnownFoods.find((f) => f.barcode === clean);
      if (offlineHit) {
        setSelectedFood(offlineHit);
        setSelectedServingIdx(0);
        setServingQty(1);
      } else {
        setBarcodeError(isHi ? 'ऑफ़लाइन बारकोड नहीं मिला।' : 'Offline: barcode not in local cache.');
      }
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, autoAnalyzeOnSelect = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeDataUrlIfNeeded(String(reader.result));
      setPhotoPreview(resized);
      setDetectedItems([]);
      setDishSummary('');
      setPhotoError(null);
      setLoggedAllDone(false);
      if (autoAnalyzeOnSelect) {
        setActiveTab('photo');
        void analyzeFoodWithAi(resized);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const loadSamplePhotoForAi = async (imgPath: string) => {
    setPhotoError(null);
    try {
      const resp = await fetch(imgPath);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const resized = await resizeDataUrlIfNeeded(String(reader.result));
        setPhotoPreview(resized);
        setDetectedItems([]);
        setDishSummary('');
        setLoggedAllDone(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      setPhotoError('Could not load sample image.');
    }
  };

  const analyzeFoodWithAi = async (overridePhoto?: string) => {
    const activePhoto = overridePhoto ?? photoPreview;
    if (!activePhoto) {
      setPhotoError(
        isHi ? 'कृपया पहले भोजन की तस्वीर अपलोड करें।' : 'Please upload a food photo first.'
      );
      return;
    }

    const detectedImgMime = activePhoto.match(/^data:([^;]+);/)?.[1] || 'image/jpeg';

    setPhotoLoading(true);
    setPhotoError(null);
    setLoggedAllDone(false);
    try {
      const { ok, data } = await safeFetchJson<{
        dishSummary?: string;
        items?: AiDetectedFood[];
        error?: string;
      }>(apiUrl('/api/ai/recognize-food'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: activePhoto,
          imageMimeType: detectedImgMime,
          language,
        }),
      });
      if (!ok || !data) {
        setPhotoError(
          data?.error ||
            (isHi
              ? 'फ़ोटो से पोषण गणना अभी उपलब्ध नहीं है। आप "मैनुअल फ़ूड" से दर्ज कर सकते हैं।'
              : 'Photo nutrition calculation failed or is unavailable offline. You can use Manual Food entry.')
        );
      } else {
        setDishSummary(data.dishSummary || '');
        setDetectedItems(data.items || []);
      }
    } catch {
      setPhotoError(isHi ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।' : 'Network error calculating food nutrition.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const logSelectedFood = () => {
    if (!selectedFood) return;
    const serving = selectedFood.servings[selectedServingIdx] || selectedFood.servings[0];
    const totalGrams = Math.round(serving.grams * servingQty * 10) / 10;
    const macros = computeMacrosForGrams(selectedFood, totalGrams);

    const entry: FoodLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid,
      date: activeDate,
      mealType,
      foodId: selectedFood.id,
      foodName: isHi ? selectedFood.nameHi : selectedFood.name,
      servingUnit: serving.unit,
      servingQty,
      grams: totalGrams,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      source: selectedFood.id.startsWith('off_')
        ? 'open_food_facts'
        : selectedFood.category === 'custom'
        ? 'custom'
        : 'indian_db',
      createdAt: new Date().toISOString(),
    };
    onAddLog(entry);
    setSelectedFood(null);
    setServingQty(1);
  };

  const logAiItem = (item: AiDetectedFood) => {
    onAddLog({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid,
      date: activeDate,
      mealType,
      foodId: `ai_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32)}`,
      foodName: item.name,
      servingUnit: item.servingUnit || 'serving',
      servingQty: item.servingQty || 1,
      grams: item.grams || 100,
      calories: Math.round(item.calories),
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      fiber: Number(item.fiber) || 0,
      source: 'ai_photo',
      createdAt: new Date().toISOString(),
    });
  };

  const logAllAiItems = () => {
    detectedItems.forEach((item) => logAiItem(item));
    setLoggedAllDone(true);
  };

  const editAiItemManually = (item: AiDetectedFood) => {
    setIsRecipeMode(false);
    setCustomName(item.name);
    setCustomGrams(Math.max(1, Math.round(item.grams || 100)));
    setCustomCal(Math.max(0, Math.round(item.calories || 0)));
    setCustomPro(Math.max(0, Math.round((item.protein || 0) * 10) / 10));
    setCustomCarb(Math.max(0, Math.round((item.carbs || 0) * 10) / 10));
    setCustomFat(Math.max(0, Math.round((item.fat || 0) * 10) / 10));
    setCustomFib(Math.max(0, Math.round((item.fiber || 0) * 10) / 10));
    const unitLower = (item.servingUnit || '').toLowerCase();
    if (unitLower.includes('piece') || unitLower.includes('roti')) setCustomUnit('piece');
    else if (unitLower.includes('cup')) setCustomUnit('cup');
    else if (unitLower.includes('plate')) setCustomUnit('plate');
    else if (unitLower.includes('gram') || unitLower === 'g') setCustomUnit('gram');
    else setCustomUnit('katori');
    setActiveTab('custom');
  };

  const buildCustomFoodFromForm = (): { food: FoodItem; totals: { grams: number; calories: number; protein: number; carbs: number; fat: number; fiber: number } } => {
    let totalGrams = customGrams;
    let totalCal = customCal;
    let totalPro = customPro;
    let totalCarb = customCarb;
    let totalFat = customFat;
    let totalFib = customFib;

    if (isRecipeMode && recipeIngredients.length > 0) {
      totalGrams = recipeIngredients.reduce((acc, r) => acc + r.grams, 0);
      const summed = recipeIngredients.reduce(
        (acc, r) => {
          const m = computeMacrosForGrams(r.food, r.grams);
          return {
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
            fiber: acc.fiber + m.fiber,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );
      totalCal = summed.calories;
      totalPro = summed.protein;
      totalCarb = summed.carbs;
      totalFat = summed.fat;
      totalFib = summed.fiber;
    }

    const safeG = Math.max(1, totalGrams);
    const factor = 100 / safeG;

    const newFood: FoodItem = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      nameHi: customName.trim(),
      category: 'custom',
      dietType: customDiet,
      isRecipe: isRecipeMode,
      per100g: {
        calories: Math.round(totalCal * factor),
        protein: Math.round(totalPro * factor * 10) / 10,
        carbs: Math.round(totalCarb * factor * 10) / 10,
        fat: Math.round(totalFat * factor * 10) / 10,
        fiber: Math.round(totalFib * factor * 10) / 10,
      },
      servings: [
        {
          unit: customUnit,
          labelEn: `1 ${customUnit} (${safeG}g)`,
          labelHi: `1 ${customUnit} (${safeG}g)`,
          grams: safeG,
        },
      ],
    };

    return {
      food: newFood,
      totals: {
        grams: safeG,
        calories: Math.round(totalCal),
        protein: Math.round(totalPro * 10) / 10,
        carbs: Math.round(totalCarb * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
        fiber: Math.round(totalFib * 10) / 10,
      },
    };
  };

  const handleSaveCustomOrRecipe = (e: React.FormEvent, logImmediately = true) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const { food, totals } = buildCustomFoodFromForm();
    onSaveCustomFood(food);

    if (logImmediately) {
      onAddLog({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uid,
        date: activeDate,
        mealType,
        foodId: food.id,
        foodName: food.name,
        servingUnit: customUnit,
        servingQty: 1,
        grams: totals.grams,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        source: 'custom',
        createdAt: new Date().toISOString(),
      });
    } else {
      setSelectedFood(food);
      setSelectedServingIdx(0);
      setServingQty(1);
      setActiveTab('search');
    }

    setCustomName('');
    setRecipeIngredients([]);
  };

  const favoriteFoods = allKnownFoods.filter((f) => favoriteIds.includes(f.id));
  const recentFoods = recentFoodIds
    .map((id) => allKnownFoods.find((f) => f.id === id))
    .filter((x): x is FoodItem => Boolean(x));

  const alphabetSortedSearch = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCategory =
      categoryFilter === 'all'
        ? searchResults
        : categoryFilter === 'indian_mains'
        ? searchResults.filter((f) => f.category === 'bread_rice' || f.category === 'dal_curry')
        : searchResults.filter((f) => f.category === categoryFilter);

    const base = activeLetter
      ? byCategory.filter((f) => {
          const label = (isHi ? f.nameHi : f.name).trim().toLowerCase();
          return (
            label.startsWith(activeLetter.toLowerCase()) ||
            f.name.trim().toLowerCase().startsWith(activeLetter.toLowerCase())
          );
        })
      : byCategory;

    return [...base].sort((a, b) => {
      const aName = (isHi ? a.nameHi : a.name).trim();
      const bName = (isHi ? b.nameHi : b.name).trim();
      if (q) {
        const aStarts = aName.toLowerCase().startsWith(q) || a.name.toLowerCase().startsWith(q);
        const bStarts = bName.toLowerCase().startsWith(q) || b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }
      return aName.localeCompare(bName);
    });
  }, [searchResults, query, activeLetter, categoryFilter, isHi]);

  const detectedTotals = useMemo(
    () =>
      detectedItems.reduce(
        (acc, it) => ({
          calories: acc.calories + Math.round(it.calories || 0),
          protein: Math.round((acc.protein + (it.protein || 0)) * 10) / 10,
          carbs: Math.round((acc.carbs + (it.carbs || 0)) * 10) / 10,
          fat: Math.round((acc.fat + (it.fat || 0)) * 10) / 10,
          fiber: Math.round((acc.fiber + (it.fiber || 0)) * 10) / 10,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      ),
    [detectedItems]
  );

  const listToRender =
    activeTab === 'favorites' ? favoriteFoods : activeTab === 'recent' ? recentFoods : alphabetSortedSearch;

  const activeServing = selectedFood?.servings[selectedServingIdx] || selectedFood?.servings[0];
  const activeMacros =
    selectedFood && activeServing ? computeMacrosForGrams(selectedFood, activeServing.grams * servingQty) : null;

  return (
    <div
      className={`bg-white dark:bg-[#111a15] ${
        isStandaloneTab
          ? 'rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-4 sm:p-6'
          : 'rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto'
      } space-y-5`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold">{t(language, 'logFood')}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">{activeDate}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 dark:bg-emerald-950/60 flex items-center justify-center hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Meal Slot Selector */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b]">
        {(['breakfast', 'lunch', 'snacks', 'dinner'] as MealType[]).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setMealType(slot)}
            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              mealType === slot
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(language, slot)}
          </button>
        ))}
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            ['search', t(language, 'logFood'), Search],
            ['photo', t(language, 'photoAi'), ImageIcon],
            ['custom', t(language, 'customAndRecipes'), Edit3],
            ['barcode', t(language, 'barcodeScan'), Barcode],
            ['favorites', t(language, 'favorites'), Heart],
            ['recent', t(language, 'recent'), Utensils],
          ] as [LoggerTab, string, React.FC<{ className?: string }>][]
        ).map(([tabId, label, Icon]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => {
              setActiveTab(tabId);
            }}
            className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-colors ${
              activeTab === tabId
                ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                : 'bg-stone-50 dark:bg-[#090e0b] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-emerald-900/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Selected Food Serving Adjuster */}
      {selectedFood && activeMacros && activeServing && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                {isHi ? selectedFood.nameHi : selectedFood.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-num mt-0.5">
                {activeMacros.calories} kcal · P {activeMacros.protein}g · C {activeMacros.carbs}g · F {activeMacros.fat}g ·
                Fib {activeMacros.fiber}g
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFood(null)}
              className="min-h-[36px] min-w-[36px] rounded-lg text-slate-500 hover:text-slate-900 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {isHi ? 'माप इकाई (कटोरी / पीस / ग्राम)' : 'Serving Unit'}
              </label>
              <select
                value={selectedServingIdx}
                onChange={(e) => setSelectedServingIdx(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#090e0b] text-xs font-medium"
              >
                {selectedFood.servings.map((s, idx) => (
                  <option key={`${s.unit}_${idx}`} value={idx}>
                    {isHi ? s.labelHi : s.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {isHi ? 'मात्रा' : 'Quantity'}
              </label>
              <div className="flex items-center gap-2">
                {[0.5, 1, 1.5, 2].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setServingQty(q)}
                    className={`flex-1 min-h-[44px] rounded-xl font-mono-num text-xs font-semibold border ${
                      servingQty === q
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/50'
                    }`}
                  >
                    {q}×
                  </button>
                ))}
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="20"
                  value={servingQty}
                  onChange={(e) => setServingQty(Math.max(0.25, Number(e.target.value) || 1))}
                  className="w-16 min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#090e0b] font-mono-num text-xs text-center"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logSelectedFood}
            className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isHi ? `${t(language, mealType)} में जोड़ें` : `Add to ${t(language, mealType)}`} · {activeMacros.calories} kcal
          </button>
        </div>
      )}

      {/* Search / Favorites / Recent */}
      {(activeTab === 'search' || activeTab === 'favorites' || activeTab === 'recent') && (
        <div className="space-y-3">
          {/* Direct Food Photo Upload Shortcut (Request 9) */}
          {activeTab === 'search' && (
            <label className="w-full min-h-[46px] px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {isHi
                    ? 'भोजन की फ़ोटो अपलोड करें (कैलोरी, प्रोटीन, फाइबर और कार्ब्स गिनें)'
                    : 'Upload Food Photo (Auto-calculate Calories, Protein, Fiber & Carbs)'}
                </span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold shrink-0">
                {isHi ? 'अपलोड' : 'Upload'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e, true)}
                className="hidden"
              />
            </label>
          )}

          {activeTab === 'search' && (
            <div ref={searchDropdownRef} className="relative space-y-2">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setActiveLetter(null);
                    setQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder={
                    isHi
                      ? 'अक्षर लिखें या ड्रॉपडाउन से चुनें (A–Z)...'
                      : 'Type letter(s) or open A–Z food dropdown...'
                  }
                  className="w-full min-h-[46px] pl-10 pr-12 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  aria-label="Toggle alphabetical food dropdown"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="absolute right-1.5 min-h-[36px] min-w-[36px] rounded-lg hover:bg-slate-200/70 dark:hover:bg-emerald-900/40 flex items-center justify-center text-slate-500"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Alphabetical A-Z Dropdown List */}
              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-[50px] z-30 rounded-2xl bg-white dark:bg-[#111a15] border border-emerald-200 dark:border-emerald-800 shadow-xl overflow-hidden">
                  <div className="px-3 py-2 bg-stone-50 dark:bg-[#090e0b] border-b border-slate-100 dark:border-emerald-950 flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setActiveLetter(null)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 ${
                        activeLetter === null
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-emerald-950'
                      }`}
                    >
                      A–Z
                    </button>
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          setActiveLetter(ch);
                          setQuery('');
                        }}
                        className={`min-w-[24px] py-1 rounded-md text-[11px] font-mono-num font-bold shrink-0 ${
                          activeLetter === ch
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-emerald-950'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-emerald-950/70">
                    {alphabetSortedSearch.length === 0 ? (
                      <div className="p-4 text-xs text-center text-slate-500">
                        {isHi ? 'इस अक्षर से कोई भोजन नहीं मिला।' : 'No food items match this letter.'}
                      </div>
                    ) : (
                      alphabetSortedSearch.map((food) => {
                        const srv = food.servings[0];
                        const macros = computeMacrosForGrams(food, srv.grams);
                        return (
                          <button
                            key={`dd_${food.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedFood(food);
                              setSelectedServingIdx(0);
                              setServingQty(1);
                              setDropdownOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {isHi ? food.nameHi : food.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                                {isHi ? srv.labelHi : srv.labelEn} · P {macros.protein}g · C {macros.carbs}g
                              </div>
                            </div>
                            <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                              {macros.calories} kcal
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {(
                [
                  ['all', isHi ? 'सभी' : 'All Foods'],
                  ['beverage', isHi ? 'चाय व ड्रिंक्स' : 'Drinks & Tea'],
                  ['sweets', isHi ? 'भारतीय मिठाई' : 'Indian Sweets'],
                  ['indo_chinese', isHi ? 'इंडो-चाइनीज' : 'Indo-Chinese'],
                  ['indian_mains', isHi ? 'रोटी, चावल व दाल' : 'Roti, Rice & Dal'],
                  ['breakfast', isHi ? 'नाश्ता' : 'Breakfast'],
                  ['snack_street', isHi ? 'चाट व स्नैक्स' : 'Street Snacks'],
                  ['protein_dairy', isHi ? 'प्रोटीन व डेयरी' : 'Protein & Dairy'],
                  ['fruit_nut', isHi ? 'फल व मेवे' : 'Fruits & Nuts'],
                ] as [string, string][]
              ).map(([catId, label]) => (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setCategoryFilter(catId)}
                  className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                    categoryFilter === catId
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-50 dark:bg-[#090e0b] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-emerald-900/50 hover:border-emerald-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {isSearching && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isHi ? 'Open Food Facts और भारतीय डेटाबेस में खोजा जा रहा है...' : 'Searching Indian DB & Open Food Facts...'}
            </p>
          )}

          <div className="divide-y divide-slate-100 dark:divide-emerald-950/70 max-h-[420px] overflow-y-auto">
            {listToRender.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {isHi ? 'कोई भोजन नहीं मिला।' : 'No foods found in this list yet.'}
              </div>
            ) : (
              listToRender.map((food) => {
                const defaultSrv = food.servings[0];
                const defaultMacros = computeMacrosForGrams(food, defaultSrv.grams);
                const isFav = favoriteIds.includes(food.id);
                return (
                  <div
                    key={food.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-stone-50 dark:hover:bg-emerald-950/20 px-2 rounded-xl transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFood(food);
                        setSelectedServingIdx(0);
                        setServingQty(1);
                      }}
                      className="flex-1 text-left min-h-[44px] flex flex-col justify-center"
                    >
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {isHi ? food.nameHi : food.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num mt-0.5">
                        {isHi ? defaultSrv.labelHi : defaultSrv.labelEn} · {defaultMacros.calories} kcal · P {defaultMacros.protein}g
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(food)}
                        aria-label="Favorite"
                        className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFood(food);
                          setSelectedServingIdx(0);
                          setServingQty(1);
                        }}
                        className="min-h-[44px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                      >
                        {isHi ? 'जोड़ें' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Food Photo Upload Nutrition Calculator Tab */}
      {activeTab === 'photo' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isHi ? 'फ़ोटो से पोषण व कैलोरी गणना' : 'Food Photo Nutrition Calculator'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isHi
                    ? 'भोजन की फ़ोटो अपलोड करें और इमेज के आधार पर कैलोरी, प्रोटीन, फाइबर और कार्ब्स की गणना करें।'
                    : 'Upload a food photo to automatically calculate calories, protein, fiber, and carbs from the image.'}
                </p>
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null);
                    setDetectedItems([]);
                    setDishSummary('');
                    setPhotoError(null);
                  }}
                  className="text-xs font-semibold text-rose-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isHi ? 'हटाएं' : 'Clear Photo'}
                </button>
              )}
            </div>

            <label className="w-full min-h-[84px] p-4 rounded-2xl border-2 border-dashed border-emerald-400/80 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center transition-colors">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                <Upload className="w-4 h-4" />
                <span>
                  {photoPreview
                    ? isHi
                      ? 'दूसरी भोजन फ़ोटो अपलोड करें'
                      : 'Upload Another Food Photo'
                    : isHi
                    ? 'भोजन की फ़ोटो चुनें (कैलोरी, प्रोटीन, फाइबर व कार्ब्स गिनें)'
                    : 'Upload Food Photo (Calculates Calories, Protein, Fiber & Carbs)'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                JPG, PNG, WebP · {isHi ? 'तस्वीर से तुरंत पोषण गणना' : 'Instant image nutrition breakdown'}
              </span>
              <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, true)} className="hidden" />
            </label>

            {photoPreview && (
              <div className="space-y-3">
                <img
                  src={photoPreview}
                  alt="Meal preview"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-56 object-cover rounded-2xl border border-slate-200 dark:border-emerald-900/60"
                />
                <button
                  type="button"
                  disabled={photoLoading}
                  onClick={() => analyzeFoodWithAi()}
                  className="w-full min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {photoLoading
                    ? isHi
                      ? 'फ़ोटो से पोषण गिना जा रहा है...'
                      : 'Calculating from Photo...'
                    : isHi
                    ? 'फ़ोटो से कैलोरी व मैक्रोज़ निकालें'
                    : 'Calculate Calories & Macros from Image'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadSamplePhotoForAi('/src/assets/images/fitplate_poha_breakfast_1794826256666.jpg')}
                className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-[11px] font-medium"
              >
                {isHi ? 'उदाहरण: पोहा बाउल' : 'Sample: Poha Bowl'}
              </button>
              <button
                type="button"
                onClick={() => loadSamplePhotoForAi('/src/assets/images/fitplate_hero_thali_1794826405362.jpg')}
                className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-[11px] font-medium"
              >
                {isHi ? 'उदाहरण: भारतीय थाली' : 'Sample: Indian Thali'}
              </button>
            </div>

            {photoError && <p className="text-xs text-rose-600 dark:text-rose-400">{photoError}</p>}

            {/* Detected Food Results */}
            {detectedItems.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-emerald-900/50">
                {dishSummary && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{dishSummary}</p>
                )}

                <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      {isHi ? 'फ़ोटो से कुल पोषण गणना' : 'Calculated Nutrition from Image'}
                    </span>
                    <button
                      type="button"
                      disabled={loggedAllDone}
                      onClick={logAllAiItems}
                      className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-700/70 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {loggedAllDone
                        ? isHi
                          ? 'सभी जुड़ गए'
                          : 'All Logged'
                        : isHi
                        ? `सभी ${t(language, mealType)} में जोड़ें`
                        : `Log All to ${t(language, mealType)}`}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#111a15] border border-emerald-200/70 dark:border-emerald-900/50">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {isHi ? 'कैलोरी' : 'Calories'}
                      </div>
                      <div className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                        {detectedTotals.calories} kcal
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#111a15] border border-emerald-200/70 dark:border-emerald-900/50">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {t(language, 'protein')}
                      </div>
                      <div className="font-mono-num text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {detectedTotals.protein} g
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#111a15] border border-emerald-200/70 dark:border-emerald-900/50">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {t(language, 'fiber')}
                      </div>
                      <div className="font-mono-num text-sm font-bold text-teal-700 dark:text-teal-400">
                        {detectedTotals.fiber} g
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#111a15] border border-emerald-200/70 dark:border-emerald-900/50">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {t(language, 'carbs')}
                      </div>
                      <div className="font-mono-num text-sm font-bold text-sky-700 dark:text-sky-400">
                        {detectedTotals.carbs} g
                      </div>
                    </div>
                  </div>
                </div>

                {detectedItems.map((item, idx) => (
                  <div
                    key={`${item.name}_${idx}`}
                    className="p-3 rounded-xl bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                        {item.servingQty} {item.servingUnit} ({item.grams}g) · {item.calories} kcal ·{' '}
                        {t(language, 'protein')} {item.protein}g · {t(language, 'fiber')} {item.fiber}g ·{' '}
                        {t(language, 'carbs')} {item.carbs}g
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => editAiItemManually(item)}
                        aria-label="Edit food manually"
                        className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isHi ? 'बदलें' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => logAiItem(item)}
                        className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shrink-0"
                      >
                        {isHi ? 'जोड़ें' : 'Log'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Food Details & Recipe Builder Tab */}
      {activeTab === 'custom' && (
        <form onSubmit={(e) => handleSaveCustomOrRecipe(e, true)} className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b]">
            <button
              type="button"
              onClick={() => setIsRecipeMode(false)}
              className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                !isRecipeMode ? 'bg-white dark:bg-emerald-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHi ? 'मैनुअल फ़ूड विवरण' : 'Manual Food Details'}
            </button>
            <button
              type="button"
              onClick={() => setIsRecipeMode(true)}
              className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                isRecipeMode ? 'bg-white dark:bg-emerald-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHi ? 'रेसिपी बिल्डर' : 'Recipe Builder'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {isHi ? 'भोजन का नाम' : 'Food Name'}
              </label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={isRecipeMode ? 'e.g. Homemade Protein Shake' : 'e.g. Mom’s Matar Paneer'}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isHi ? 'डाइट प्रकार' : 'Diet Type'}
                </label>
                <select
                  value={customDiet}
                  onChange={(e) => setCustomDiet(e.target.value as DietType)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-medium"
                >
                  <option value="veg">Veg</option>
                  <option value="vegan">Vegan</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="non-veg">Non-Veg</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isHi ? 'इकाई' : 'Serving Unit'}
                </label>
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-medium"
                >
                  <option value="katori">katori</option>
                  <option value="piece">piece</option>
                  <option value="cup">cup</option>
                  <option value="plate">plate</option>
                  <option value="gram">gram</option>
                </select>
              </div>
            </div>
          </div>

          {isRecipeMode ? (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 space-y-3">
              <div className="text-xs font-semibold">{isHi ? 'सामग्री जोड़ें' : 'Add Ingredients from Database'}</div>
              <div className="flex flex-wrap gap-1.5">
                {INDIAN_AND_GLOBAL_FOODS.slice(0, 12).map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() =>
                      setRecipeIngredients((prev) => [...prev, { food: ing, grams: ing.servings[0].grams }])
                    }
                    className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-[11px] font-medium"
                  >
                    + {isHi ? ing.nameHi : ing.name}
                  </button>
                ))}
              </div>
              {recipeIngredients.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-emerald-900/50">
                  {recipeIngredients.map((item, idx) => (
                    <div key={`${item.food.id}_${idx}`} className="flex items-center justify-between text-xs">
                      <span>
                        {item.food.name} ({item.grams}g)
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecipeIngredients((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-600 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {isHi ? 'कैलोरी और पोषण दर्ज करें' : 'Nutrition for 1 serving'}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomCal(Math.round(customPro * 4 + customCarb * 4 + customFat * 9))}
                  className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  {isHi ? 'मैक्रोज़ से कैलोरी जोड़ें' : 'Auto-calc kcal from macros'}
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {[
                  ['Grams', customGrams, setCustomGrams],
                  ['Calories', customCal, setCustomCal],
                  ['Protein (g)', customPro, setCustomPro],
                  ['Carbs (g)', customCarb, setCustomCarb],
                  ['Fat (g)', customFat, setCustomFat],
                  ['Fiber (g)', customFib, setCustomFib],
                ].map(([lbl, val, setter]) => (
                  <div key={String(lbl)}>
                    <label className="block text-[11px] text-slate-500 mb-1">{String(lbl)}</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={Number(val)}
                      onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
                      className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="submit"
              className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isHi ? `${t(language, mealType)} में तुरंत जोड़ें` : `Log Food to ${t(language, mealType)}`}
            </button>
            <button
              type="button"
              onClick={(e) => handleSaveCustomOrRecipe(e, false)}
              className="min-h-[46px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              {isHi ? 'सेव करें व मात्रा चुनें' : 'Save & Adjust Qty'}
            </button>
          </div>
        </form>
      )}

      {/* Barcode Lookup Tab (No device camera access) */}
      {activeTab === 'barcode' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isHi ? 'प्रोडक्ट बारकोड नंबर दर्ज करें' : 'Enter Product Barcode Number'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="e.g. 8901262150118"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-sm"
              />
              <button
                type="button"
                disabled={barcodeLoading}
                onClick={() => lookupBarcode(barcodeInput)}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {barcodeLoading ? '...' : isHi ? 'खोजें' : 'Lookup'}
              </button>
            </div>

            {barcodeError && <p className="text-xs text-amber-600 dark:text-amber-400">{barcodeError}</p>}

            <div className="pt-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                {isHi ? 'त्वरित परीक्षण बारकोड:' : 'Quick test packaged barcodes:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  ['8901262150118', 'Amul Milk'],
                  ['8901719125423', 'Parle-G'],
                  ['8901058851755', 'Maggi'],
                  ['8908005471019', 'Yoga Bar'],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setBarcodeInput(code);
                      lookupBarcode(code);
                    }}
                    className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-xs font-medium hover:border-emerald-500 transition-colors"
                  >
                    {label} · <span className="font-mono-num text-slate-500">{code}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
