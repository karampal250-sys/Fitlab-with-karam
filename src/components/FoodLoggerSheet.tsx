import React, { useEffect, useRef, useState } from 'react';
import { Barcode, Camera, Heart, Plus, Search, Sparkles, Utensils, X } from 'lucide-react';
import type { DietType, FoodItem, FoodLogEntry, Language, MealType } from '../types/fitplate';
import { computeMacrosForGrams, INDIAN_AND_GLOBAL_FOODS } from '../data/indianFoods';
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

type LoggerTab = 'search' | 'favorites' | 'recent' | 'barcode' | 'photo' | 'custom';

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

  // Selected food serving adjuster
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [servingQty, setServingQty] = useState(1);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // AI Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoHint, setPhotoHint] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<AiDetectedFood[]>([]);
  const [dishSummary, setDishSummary] = useState('');

  // Custom Food & Recipe Builder state
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
        f.nameHi.toLowerCase().includes(trimmed.toLowerCase())
    );
    setSearchResults(localFirst);

    const timer = setTimeout(async () => {
      if (trimmed.length < 2) return;
      setIsSearching(true);
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = (await res.json()) as { items: FoodItem[] };
          const merged = [...customFoods.filter((f) => f.name.toLowerCase().includes(trimmed.toLowerCase())), ...(data.items || [])];
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
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setBarcodeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setBarcodeError(
        isHi ? 'कैमरा उपलब्ध नहीं है। नीचे बारकोड नंबर दर्ज करें।' : 'Camera permission unavailable. Enter a barcode number below.'
      );
    }
  };

  const lookupBarcode = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setBarcodeLoading(true);
    setBarcodeError(null);
    try {
      const res = await fetch(`/api/foods/barcode/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        setBarcodeError(data.error || 'Product not found.');
      } else if (data.item) {
        stopCamera();
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(String(reader.result));
      setDetectedItems([]);
      setDishSummary('');
      setPhotoError(null);
    };
    reader.readAsDataURL(file);
  };

  const loadSamplePhotoForAi = async (imgPath: string, hintText: string) => {
    setPhotoError(null);
    setPhotoHint(hintText);
    try {
      const resp = await fetch(imgPath);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(String(reader.result));
        setDetectedItems([]);
        setDishSummary('');
      };
      reader.readAsDataURL(blob);
    } catch {
      setPhotoError('Could not load sample image.');
    }
  };

  const analyzeFoodPhoto = async () => {
    if (!photoPreview) return;
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const res = await fetch('/api/ai/recognize-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: photoPreview,
          mimeType: photoPreview.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          hint: photoHint,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data.error || 'Photo recognition failed.');
      } else {
        setDishSummary(data.dishSummary || '');
        setDetectedItems(data.items || []);
      }
    } catch {
      setPhotoError(isHi ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।' : 'Network error analyzing photo.');
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
      servingUnit: item.servingUnit,
      servingQty: item.servingQty,
      grams: item.grams,
      calories: Math.round(item.calories),
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      source: 'ai_photo',
      createdAt: new Date().toISOString(),
    });
  };

  const handleSaveCustomOrRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

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
    onSaveCustomFood(newFood);
    setSelectedFood(newFood);
    setCustomName('');
    setRecipeIngredients([]);
    setActiveTab('search');
  };

  const favoriteFoods = allKnownFoods.filter((f) => favoriteIds.includes(f.id));
  const recentFoods = recentFoodIds
    .map((id) => allKnownFoods.find((f) => f.id === id))
    .filter((x): x is FoodItem => Boolean(x));

  const listToRender =
    activeTab === 'favorites' ? favoriteFoods : activeTab === 'recent' ? recentFoods : searchResults;

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
              stopCamera();
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
            ['favorites', t(language, 'favorites'), Heart],
            ['recent', t(language, 'recent'), Utensils],
            ['barcode', t(language, 'barcodeScan'), Barcode],
            ['photo', t(language, 'photoAi'), Camera],
            ['custom', t(language, 'customAndRecipes'), Plus],
          ] as [LoggerTab, string, React.FC<{ className?: string }>][]
        ).map(([tabId, label, Icon]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => {
              if (tabId !== 'barcode') stopCamera();
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
          {activeTab === 'search' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(language, 'searchFoodPlaceholder')}
                className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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

      {/* Barcode Scanner Tab */}
      {activeTab === 'barcode' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isHi ? 'कैमरा या बारकोड नंबर से खोजें' : 'Scan or Enter Product Barcode'}
              </span>
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isHi ? 'कैमरा खोलें' : 'Open Camera'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="min-h-[40px] px-3.5 rounded-xl bg-slate-800 text-white text-xs font-semibold"
                >
                  {isHi ? 'बंद करें' : 'Stop Camera'}
                </button>
              )}
            </div>

            {cameraActive && (
              <div className="rounded-2xl overflow-hidden bg-black aspect-video relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
            )}

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

      {/* AI Photo Recognition Tab */}
      {activeTab === 'photo' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{isHi ? 'AI प्लेट पहचान' : 'AI Meal Photo Scanner'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi
                    ? 'थाली या भोजन की तस्वीर अपलोड करें — AI मात्रा और कैलोरी का अनुमान लगाएगा।'
                    : 'Upload or capture a meal photo to estimate portions and macros automatically.'}
                </p>
              </div>
              <label className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" />
                {isHi ? 'फ़ोटो चुनें' : 'Upload / Capture'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  loadSamplePhotoForAi(
                    '/src/assets/images/fitplate_poha_breakfast_1794826256666.jpg',
                    'Kanda Poha with peanuts'
                  )
                }
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-xs font-medium"
              >
                {isHi ? 'उदाहरण: पोहा बाउल' : 'Try Sample: Poha Bowl'}
              </button>
              <button
                type="button"
                onClick={() =>
                  loadSamplePhotoForAi(
                    '/src/assets/images/fitplate_hero_thali_1794826405362.jpg',
                    'Indian thali with 2 rotis, dal, palak paneer'
                  )
                }
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-xs font-medium"
              >
                {isHi ? 'उदाहरण: भारतीय थाली' : 'Try Sample: Indian Thali'}
              </button>
            </div>

            {photoPreview && (
              <div className="space-y-3">
                <img
                  src={photoPreview}
                  alt="Meal preview"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-56 object-cover rounded-2xl border border-slate-200 dark:border-emerald-900/60"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={photoHint}
                    onChange={(e) => setPhotoHint(e.target.value)}
                    placeholder={isHi ? 'वैकल्पिक नोट (जैसे: बिना घी के 2 रोटी)' : 'Optional note (e.g. 2 rotis, less oil)'}
                    className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs"
                  />
                  <button
                    type="button"
                    disabled={photoLoading}
                    onClick={analyzeFoodPhoto}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {photoLoading ? (isHi ? 'जांच जारी...' : 'Analyzing...') : isHi ? 'पहचानें' : 'Analyze Photo'}
                  </button>
                </div>
              </div>
            )}

            {photoError && <p className="text-xs text-rose-600 dark:text-rose-400">{photoError}</p>}

            {detectedItems.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-emerald-900/50">
                {dishSummary && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{dishSummary}</p>}
                {detectedItems.map((item, idx) => (
                  <div
                    key={`${item.name}_${idx}`}
                    className="p-3 rounded-xl bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                        {item.servingQty} {item.servingUnit} ({item.grams}g) · {item.calories} kcal · P {item.protein}g
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => logAiItem(item)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shrink-0"
                    >
                      {isHi ? 'जोड़ें' : 'Log'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Food & Recipe Builder */}
      {activeTab === 'custom' && (
        <form onSubmit={handleSaveCustomOrRecipe} className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b]">
            <button
              type="button"
              onClick={() => setIsRecipeMode(false)}
              className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                !isRecipeMode ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHi ? 'कस्टम फूड' : 'Custom Food'}
            </button>
            <button
              type="button"
              onClick={() => setIsRecipeMode(true)}
              className={`min-h-[38px] rounded-lg text-xs font-semibold ${
                isRecipeMode ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isHi ? 'रेसिपी बिल्डर' : 'Recipe Builder'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={isRecipeMode ? 'e.g. Homemade Protein Shake' : 'e.g. Mom’s Matar Paneer'}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm"
            />
            <div className="flex gap-2">
              <select
                value={customDiet}
                onChange={(e) => setCustomDiet(e.target.value as DietType)}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-medium"
              >
                <option value="veg">Veg</option>
                <option value="vegan">Vegan</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="non-veg">Non-Veg</option>
              </select>
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-medium"
              >
                <option value="katori">katori</option>
                <option value="piece">piece</option>
                <option value="cup">cup</option>
                <option value="plate">plate</option>
                <option value="gram">gram</option>
              </select>
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
                    value={Number(val)}
                    onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
                    className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
          >
            {isHi ? 'सेव करें और चुनें' : 'Save & Select Food'}
          </button>
        </form>
      )}
    </div>
  );
};
