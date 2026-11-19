import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, Heart, Minus, Plus, Search, X } from 'lucide-react';
import type { DietType, FoodItem, FoodLogEntry, Language, MealType } from '../types/fitplate';
import { computeMacrosForGrams, INDIAN_AND_GLOBAL_FOODS } from '../data/indianFoods';
import { searchFoodsWithPriority } from '../utils/foodSearch';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';
import { t } from '../i18n/translations';

export type LoggerTab = 'search' | 'custom';

interface FoodLoggerSheetProps {
  language: Language;
  activeDate: string;
  initialMealType: MealType;
  initialTab?: LoggerTab;
  uid: string;
  customFoods: FoodItem[];
  favoriteIds: string[];
  recentFoodIds: string[];
  onToggleFavorite: (food: FoodItem) => void;
  onSaveCustomFood: (food: FoodItem) => void;
  onAddLog: (entry: FoodLogEntry, keepOpen?: boolean) => void;
  onClose?: () => void;
  isStandaloneTab?: boolean;
}

export const FoodLoggerSheet: React.FC<FoodLoggerSheetProps> = ({
  language,
  activeDate,
  initialMealType,
  initialTab,
  uid,
  customFoods,
  favoriteIds,
  onToggleFavorite,
  onSaveCustomFood,
  onAddLog,
  onClose,
  isStandaloneTab,
}) => {
  const isHi = language === 'hi';
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [activeTab, setActiveTab] = useState<LoggerTab>(initialTab || 'search');

  const [query, setQuery] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected food portion & quantity adjuster
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [servingQty, setServingQty] = useState(1);

  // Simple Manual Food Entry state
  const [customName, setCustomName] = useState('');
  const [customDiet, setCustomDiet] = useState<DietType>('veg');
  const [customUnit, setCustomUnit] = useState<'katori' | 'piece' | 'gram' | 'cup' | 'plate'>('katori');
  const [customGrams, setCustomGrams] = useState(150);
  const [customCal, setCustomCal] = useState(200);
  const [customPro, setCustomPro] = useState(0);
  const [customCarb, setCustomCarb] = useState(0);
  const [customFat, setCustomFat] = useState(0);
  const [customFib, setCustomFib] = useState(0);
  const [quickAddedBanner, setQuickAddedBanner] = useState<string | null>(null);

  useEffect(() => {
    setMealType(initialMealType);
  }, [initialMealType]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Debounced hybrid search: local Indian+Global DB responds immediately & ranks first; Open Food Facts supplements
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { ok, data } = await safeFetchJson<{ items?: FoodItem[] }>(
          apiUrl(
            `/api/foods/search?q=${encodeURIComponent(trimmed)}&category=all&lang=${encodeURIComponent(language)}`
          )
        );
        if (!cancelled && ok && data && Array.isArray(data.items)) {
          setRemoteSearchResults(data.items.filter((it) => it.id.startsWith('off_')));
        }
      } catch {
        // Offline fallback keeps prioritized local matches
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, language]);

  const quickLogFoodDefault = (food: FoodItem, qty = 1) => {
    const serving = food.servings[0];
    if (!serving) return;
    const totalGrams = Math.round(serving.grams * qty * 10) / 10;
    const macros = computeMacrosForGrams(food, totalGrams);
    const foodTitle = isHi ? food.nameHi : food.name;

    onAddLog({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid,
      date: activeDate,
      mealType,
      foodId: food.id,
      foodName: foodTitle,
      servingUnit: serving.unit,
      servingQty: qty,
      grams: totalGrams,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      source: food.id.startsWith('off_')
        ? 'open_food_facts'
        : food.category === 'custom' || food.id.startsWith('custom_')
        ? 'custom'
        : 'indian_db',
      createdAt: new Date().toISOString(),
    });
    setQuickAddedBanner(
      isHi
        ? `${foodTitle} (${macros.calories} kcal) ${t(language, mealType)} में जोड़ा गया`
        : `Added ${foodTitle} (${macros.calories} kcal) to ${t(language, mealType)}`
    );
  };

  const logSelectedFood = () => {
    if (!selectedFood) return;
    const serving = selectedFood.servings[selectedServingIdx] || selectedFood.servings[0];
    const totalGrams = Math.round(serving.grams * servingQty * 10) / 10;
    const macros = computeMacrosForGrams(selectedFood, totalGrams);
    const foodTitle = isHi ? selectedFood.nameHi : selectedFood.name;

    const entry: FoodLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid,
      date: activeDate,
      mealType,
      foodId: selectedFood.id,
      foodName: foodTitle,
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
        : selectedFood.category === 'custom' || selectedFood.id.startsWith('custom_')
        ? 'custom'
        : 'indian_db',
      createdAt: new Date().toISOString(),
    };
    onAddLog(entry);
    setQuickAddedBanner(
      isHi
        ? `${foodTitle} (${macros.calories} kcal) ${t(language, mealType)} में जोड़ा गया`
        : `Added ${foodTitle} (${macros.calories} kcal) to ${t(language, mealType)}`
    );
    setSelectedFood(null);
    setServingQty(1);
  };

  const handleSaveManualFood = (e: React.FormEvent, logImmediately = true) => {
    e.preventDefault();
    const cleanName = customName.trim().slice(0, 120);
    if (!cleanName) return;

    const safeG = Math.max(1, Math.min(5000, Math.round(customGrams || 100)));
    const safeCal = Math.max(0, Math.min(5000, Math.round(customCal || 0)));
    const safePro = Math.max(0, Math.min(500, Math.round((customPro || 0) * 10) / 10));
    const safeCarb = Math.max(0, Math.min(500, Math.round((customCarb || 0) * 10) / 10));
    const safeFat = Math.max(0, Math.min(500, Math.round((customFat || 0) * 10) / 10));
    const safeFib = Math.max(0, Math.min(200, Math.round((customFib || 0) * 10) / 10));
    const factor = 100 / safeG;

    const newFood: FoodItem = {
      id: `custom_${Date.now()}`,
      name: cleanName,
      nameHi: cleanName,
      category: 'custom',
      dietType: customDiet,
      isRecipe: false,
      per100g: {
        calories: Math.round(safeCal * factor),
        protein: Math.round(safePro * factor * 10) / 10,
        carbs: Math.round(safeCarb * factor * 10) / 10,
        fat: Math.round(safeFat * factor * 10) / 10,
        fiber: Math.round(safeFib * factor * 10) / 10,
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

    if (logImmediately) {
      onAddLog({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uid,
        date: activeDate,
        mealType,
        foodId: newFood.id,
        foodName: newFood.name,
        servingUnit: customUnit,
        servingQty: 1,
        grams: safeG,
        calories: safeCal,
        protein: safePro,
        carbs: safeCarb,
        fat: safeFat,
        fiber: safeFib,
        source: 'custom',
        createdAt: new Date().toISOString(),
      });
      setQuickAddedBanner(
        isHi
          ? `${newFood.name} (${safeCal} kcal) ${t(language, mealType)} में जोड़ा गया`
          : `Added ${newFood.name} (${safeCal} kcal) to ${t(language, mealType)}`
      );
    } else {
      setSelectedFood(newFood);
      setSelectedServingIdx(0);
      setServingQty(1);
      setActiveTab('search');
      setQuery(newFood.name);
    }

    setCustomName('');
    setCustomCal(200);
    setCustomPro(0);
    setCustomCarb(0);
    setCustomFat(0);
    setCustomFib(0);
  };

  const hasTypedQuery = query.trim().length > 0;

  const filteredList = useMemo(() => {
    if (!hasTypedQuery) return [];
    return searchFoodsWithPriority({
      query,
      customFoods,
      localFoods: INDIAN_AND_GLOBAL_FOODS,
      remoteFoods: remoteSearchResults,
      categoryFilter: 'all',
      language,
    });
  }, [hasTypedQuery, query, customFoods, remoteSearchResults, language]);

  const activeServing = selectedFood?.servings[selectedServingIdx] || selectedFood?.servings[0];
  const activeMacros =
    selectedFood && activeServing ? computeMacrosForGrams(selectedFood, activeServing.grams * servingQty) : null;

  return (
    <div
      className={`bg-white dark:bg-[#111a15] text-slate-900 dark:text-slate-100 ${
        isStandaloneTab
          ? 'rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-4 sm:p-6'
          : 'rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto'
      } space-y-4`}
    >
      {/* Clean Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">
            {t(language, 'logFood')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num tabular-nums">
            {activeDate} · {t(language, mealType)}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 dark:bg-emerald-950/60 flex items-center justify-center hover:bg-stone-200 dark:hover:bg-emerald-900/50 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Step 1: Meal Slot Selector */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-[#090e0b]">
        {(['breakfast', 'lunch', 'snacks', 'dinner'] as MealType[]).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setMealType(slot)}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap truncate ${
              mealType === slot
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(language, slot)}
          </button>
        ))}
      </div>

      {/* Step 2: Simple Search / Manual Mode */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-[#090e0b]">
        {(
          [
            ['search', isHi ? 'भोजन खोजें' : 'Search Food', Search],
            ['custom', isHi ? 'मैनुअल जोड़ें' : 'Manual Entry', Edit3],
          ] as [LoggerTab, string, React.FC<{ className?: string }>][]
        ).map(([tabId, label, Icon]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === tabId
                ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Inline Added Confirmation */}
      {quickAddedBanner && (
        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
          <span className="flex items-center gap-2 min-w-0 truncate">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{quickAddedBanner}</span>
          </span>
          <button
            type="button"
            onClick={() => setQuickAddedBanner(null)}
            aria-label="Dismiss notice"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Food Portion Adjuster */}
      {selectedFood && activeMacros && activeServing && (
        <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                {isHi ? selectedFood.nameHi : selectedFood.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-num tabular-nums mt-0.5">
                {activeMacros.calories} kcal · P {activeMacros.protein}g · C {activeMacros.carbs}g · F {activeMacros.fat}g · Fib{' '}
                {activeMacros.fiber}g
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFood(null)}
              aria-label="Close portion adjuster"
              className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {isHi ? 'माप चुनें' : 'Serving Size'}
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {isHi ? 'मात्रा' : 'Quantity'}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setServingQty((q) => Math.max(0.25, Math.round((q - 0.5) * 100) / 100))}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#090e0b] flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                {[0.5, 1, 1.5, 2].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setServingQty(q)}
                    className={`flex-1 min-h-[44px] rounded-xl font-mono-num text-xs font-semibold border whitespace-nowrap ${
                      servingQty === q
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/50'
                    }`}
                  >
                    {q}×
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setServingQty((q) => Math.min(20, Math.round((q + 0.5) * 100) / 100))}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#090e0b] flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logSelectedFood}
            className="w-full min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isHi ? `${t(language, mealType)} में जोड़ें` : `Add to ${t(language, mealType)}`} · {activeMacros.calories} kcal
            </span>
          </button>
        </div>
      )}

      {/* Search Tab: Clean Search Bar First -> Filter List & Add Once User Types */}
      {activeTab === 'search' && (
        <div className="space-y-3.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isHi
                  ? 'भोजन लिखकर खोजें (रोटी, दाल, चावल, दलिया, पनीर, चाय)...'
                  : 'Type food name to search (roti, dal, rice, daliya, paneer)...'
              }
              className="w-full min-h-[48px] pl-10 pr-10 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!hasTypedQuery ? (
            <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-emerald-900/50 bg-stone-50/60 dark:bg-[#090e0b]/60">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                {isHi
                  ? 'भोजन जोड़ने के लिए ऊपर सर्च बॉक्स में नाम लिखें'
                  : 'Start typing a food name above to filter and add'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {isHi
                  ? 'जैसे: दलिया, दूध दलिया, रोटी, दाल, चावल, चाय, पनीर'
                  : 'e.g., milk daliya, mix veg daliya, roti, dal, rice, paneer'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {isSearching && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi ? 'खोजा जा रहा है...' : 'Searching food database...'}
                </p>
              )}

              <div className="divide-y divide-slate-100 dark:divide-emerald-950/70 max-h-[380px] overflow-y-auto">
                {filteredList.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {isHi ? 'कोई भोजन नहीं मिला।' : 'No matching foods found.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomName(query.trim());
                        setActiveTab('custom');
                      }}
                      className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {isHi ? `"${query.trim()}" को मैनुअल जोड़ें` : `Add "${query.trim()}" manually`}
                    </button>
                  </div>
                ) : (
                  filteredList.map((food) => {
                    const defaultSrv = food.servings[0];
                    const defaultMacros = computeMacrosForGrams(food, defaultSrv.grams);
                    const isFav = favoriteIds.includes(food.id);
                    return (
                      <div
                        key={food.id}
                        className="py-2.5 px-1.5 flex items-center justify-between gap-2.5 hover:bg-stone-50 dark:hover:bg-emerald-950/20 rounded-xl transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFood(food);
                            setSelectedServingIdx(0);
                            setServingQty(1);
                          }}
                          className="flex-1 text-left min-h-[52px] flex flex-col justify-center min-w-0"
                        >
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {isHi ? food.nameHi : food.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num tabular-nums mt-0.5 truncate">
                            {isHi ? defaultSrv.labelHi : defaultSrv.labelEn} · {defaultMacros.calories} kcal · P {defaultMacros.protein}g
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
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
                            onClick={() => quickLogFoodDefault(food, 1)}
                            className="min-h-[44px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isHi ? 'जोड़ें' : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simple Manual Food Entry Tab */}
      {activeTab === 'custom' && (
        <form onSubmit={(e) => handleSaveManualFood(e, true)} className="space-y-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHi ? 'भोजन का नाम' : 'Food Name'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={isHi ? 'जैसे: घर का बना पनीर सैंडविच' : 'e.g., Home Paneer Sandwich'}
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isHi ? 'कैलोरी (kcal)' : 'Calories (kcal)'}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={5000}
                  value={customCal}
                  onChange={(e) => setCustomCal(Number(e.target.value))}
                  className="w-full min-h-[46px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {isHi ? 'इकाई' : 'Serving'}
                </label>
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-medium"
                >
                  <option value="katori">{isHi ? 'कटोरी' : 'katori'}</option>
                  <option value="plate">{isHi ? 'प्लेट' : 'plate'}</option>
                  <option value="piece">{isHi ? 'पीस' : 'piece'}</option>
                  <option value="cup">{isHi ? 'कप' : 'cup'}</option>
                  <option value="gram">{isHi ? 'ग्राम' : 'gram'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {isHi ? 'वज़न (g)' : 'Weight (g)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={customGrams}
                  onChange={(e) => setCustomGrams(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {isHi ? 'डाइट' : 'Diet'}
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
            </div>
          </div>

          {/* Optional Macros */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isHi ? 'वैकल्पिक पोषण (Protein / Carbs / Fat)' : 'Optional Macros'}
              </span>
              <button
                type="button"
                onClick={() => setCustomCal(Math.round(customPro * 4 + customCarb * 4 + customFat * 9))}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {isHi ? 'मैक्रोज़ से कैलोरी जोड़ें' : 'Calculate kcal from macros'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                [isHi ? 'प्रोटीन (g)' : 'Protein (g)', customPro, setCustomPro],
                [isHi ? 'कार्ब्स (g)' : 'Carbs (g)', customCarb, setCustomCarb],
                [isHi ? 'फैट (g)' : 'Fat (g)', customFat, setCustomFat],
                [isHi ? 'फाइबर (g)' : 'Fiber (g)', customFib, setCustomFib],
              ].map(([lbl, val, setter]) => (
                <div key={String(lbl)}>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">{String(lbl)}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={Number(val)}
                    onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
                    className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="submit"
              className="flex-1 min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{isHi ? `${t(language, mealType)} में जोड़ें` : `Add to ${t(language, mealType)}`}</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleSaveManualFood(e, false)}
              className="min-h-[48px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500"
            >
              {isHi ? 'सेव करें व मात्रा चुनें' : 'Save & Adjust Qty'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
