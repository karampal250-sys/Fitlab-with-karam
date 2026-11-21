import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import type {
  DietType,
  FoodItem,
  FoodLogEntry,
  Language,
  MealType,
  RemindersConfig,
  ScheduleSlot,
} from '../types/fitplate';
import { computeMacrosForGrams, INDIAN_AND_GLOBAL_FOODS } from '../data/indianFoods';
import { buildDailySchedule } from '../data/activitiesCatalog';
import { searchFoodsWithPriority } from '../utils/foodSearch';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';
import {
  formatLoggedEntryQty,
  formatServingOptionTitle,
  formatServingSummary,
  formatSmartQtyLabel,
  getSmartQtyPresets,
  getSmartStepDelta,
  resolveSmartServingUnit,
  resolveStoredUnitInfo,
} from '../utils/foodPortion';
import { t } from '../i18n/translations';
import { DailyScheduleCard } from './DailyScheduleCard';

export type LoggerTab = 'search' | 'custom';

interface FoodLoggerSheetProps {
  language: Language;
  activeDate: string;
  initialMealType: MealType;
  initialTab?: LoggerTab;
  uid: string;
  customFoods: FoodItem[];
  favoriteIds?: string[];
  recentFoodIds?: string[];
  reminders?: RemindersConfig;
  waterGoalMl?: number;
  completedSlotIds?: string[];
  dayLogs?: FoodLogEntry[];
  onToggleFavorite?: (food: FoodItem) => void;
  onSaveCustomFood: (food: FoodItem) => void;
  onAddLog: (entry: FoodLogEntry, keepOpen?: boolean) => void;
  onUpdateLogQty?: (id: string, nextQty: number) => void;
  onDeleteLog?: (id: string) => void;
  onToggleScheduleSlot?: (slot: ScheduleSlot) => void;
  onUpdateReminders?: (next: RemindersConfig) => void;
  onTestAlarm?: () => void;
  onEnableAlarms?: () => void;
  onClose?: () => void;
  isStandaloneTab?: boolean;
}

const DEFAULT_SCHEDULE_REMINDERS: RemindersConfig = {
  wakeUpTime: '07:00',
  breakfast: '08:15',
  lunch: '13:00',
  dinner: '20:00',
  waterIntervalMin: 90,
  enabled: true,
};

export const FoodLoggerSheet: React.FC<FoodLoggerSheetProps> = ({
  language,
  activeDate,
  initialMealType,
  uid,
  customFoods,
  reminders,
  waterGoalMl = 2500,
  completedSlotIds = [],
  dayLogs = [],
  onSaveCustomFood,
  onAddLog,
  onUpdateLogQty,
  onDeleteLog,
  onToggleScheduleSlot,
  onUpdateReminders,
  onTestAlarm,
  onEnableAlarms,
  onClose,
  isStandaloneTab,
}) => {
  const isHi = language === 'hi';
  const effectiveReminders = reminders || DEFAULT_SCHEDULE_REMINDERS;
  const searchBoxRef = useRef<HTMLInputElement | null>(null);
  const topPanelRef = useRef<HTMLDivElement | null>(null);

  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const [query, setQuery] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected food portion & quantity adjuster
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [servingQty, setServingQty] = useState(1);
  const [rowQuantities, setRowQuantities] = useState<Record<string, number>>({});

  // Minimal Custom Food fallback state
  const [customName, setCustomName] = useState('');
  const [customDiet, setCustomDiet] = useState<DietType>('veg');
  const [customUnit, setCustomUnit] = useState<'bowl' | 'no' | 'plate' | 'cup' | 'glass' | 'gram'>('bowl');
  const [customQty, setCustomQty] = useState(1);
  const [customGrams, setCustomGrams] = useState(150);
  const [customCal, setCustomCal] = useState(200);
  const [customPro, setCustomPro] = useState(0);
  const [quickAddedBanner, setQuickAddedBanner] = useState<string | null>(null);

  const getRowQty = (foodId: string) => rowQuantities[foodId] ?? 1;
  const setRowQty = (foodId: string, nextQty: number) => {
    const clamped = Math.max(0.25, Math.min(50, Math.round(nextQty * 100) / 100));
    setRowQuantities((prev) => ({ ...prev, [foodId]: clamped }));
  };

  useEffect(() => {
    setMealType(initialMealType);
  }, [initialMealType]);

  const activeMealTime = useMemo(() => {
    const slots = buildDailySchedule(effectiveReminders, waterGoalMl);
    const match = slots.find((s) => s.kind === 'meal' && s.mealType === mealType);
    if (match) return match.time;
    if (mealType === 'breakfast') return effectiveReminders.breakfast || '08:15';
    if (mealType === 'lunch') return effectiveReminders.lunch || '13:00';
    if (mealType === 'dinner') return effectiveReminders.dinner || '20:00';
    return '16:30';
  }, [effectiveReminders, waterGoalMl, mealType]);

  const dateFilteredLogs = useMemo(
    () => dayLogs.filter((l) => l.date === activeDate),
    [dayLogs, activeDate]
  );

  const selectedMealLogs = useMemo(
    () => dateFilteredLogs.filter((l) => l.mealType === mealType),
    [dateFilteredLogs, mealType]
  );

  const selectedMealCalories = useMemo(
    () => selectedMealLogs.reduce((sum, item) => sum + item.calories, 0),
    [selectedMealLogs]
  );

  const handleScheduleLogClick = (targetMeal: MealType) => {
    setMealType(targetMeal);
    topPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      searchBoxRef.current?.focus();
    }, 180);
  };

  // Debounced hybrid search
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

  const quickLogFoodDefault = (food: FoodItem, qtyOverride?: number) => {
    const serving = food.servings[0];
    if (!serving) return;
    const qty = Math.max(0.25, Math.min(50, qtyOverride ?? getRowQty(food.id)));
    const totalGrams = Math.round(serving.grams * qty * 10) / 10;
    const macros = computeMacrosForGrams(food, totalGrams);
    const foodTitle = isHi ? food.nameHi : food.name;
    const unitInfo = resolveSmartServingUnit(food, serving);
    const storedQty = Math.round(qty * unitInfo.baseCount * 100) / 100;
    const qtyDisplay = formatSmartQtyLabel(qty, unitInfo, language, serving.grams);

    onAddLog(
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uid,
        date: activeDate,
        mealType,
        foodId: food.id,
        foodName: foodTitle,
        servingUnit: unitInfo.storedUnit,
        servingQty: storedQty,
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
      },
      true
    );
    setQuickAddedBanner(
      isHi
        ? `${qtyDisplay} ${foodTitle} (${macros.calories} kcal) ${t(language, mealType)} में जोड़ा गया`
        : `Added ${qtyDisplay} ${foodTitle} (${macros.calories} kcal) to ${t(language, mealType)}`
    );
  };

  const logSelectedFood = () => {
    if (!selectedFood) return;
    const serving = selectedFood.servings[selectedServingIdx] || selectedFood.servings[0];
    const safeQty = Math.max(0.25, Math.min(50, Number(servingQty) || 1));
    const totalGrams = Math.round(serving.grams * safeQty * 10) / 10;
    const macros = computeMacrosForGrams(selectedFood, totalGrams);
    const foodTitle = isHi ? selectedFood.nameHi : selectedFood.name;
    const unitInfo = resolveSmartServingUnit(selectedFood, serving);
    const storedQty = Math.round(safeQty * unitInfo.baseCount * 100) / 100;
    const qtyDisplay = formatSmartQtyLabel(safeQty, unitInfo, language, serving.grams);

    const entry: FoodLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid,
      date: activeDate,
      mealType,
      foodId: selectedFood.id,
      foodName: foodTitle,
      servingUnit: unitInfo.storedUnit,
      servingQty: storedQty,
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
    onAddLog(entry, true);
    setQuickAddedBanner(
      isHi
        ? `${qtyDisplay} ${foodTitle} (${macros.calories} kcal) ${t(language, mealType)} में जोड़ा गया`
        : `Added ${qtyDisplay} ${foodTitle} (${macros.calories} kcal) to ${t(language, mealType)}`
    );
    setSelectedFood(null);
    setServingQty(1);
  };

  const handleSaveManualFood = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = customName.trim().slice(0, 120);
    if (!cleanName) return;

    const safeG = Math.max(1, Math.min(5000, Math.round(customGrams || 100)));
    const safeQty = Math.max(0.25, Math.min(50, Math.round((customQty || 1) * 100) / 100));
    const safeCal = Math.max(0, Math.min(5000, Math.round(customCal || 0)));
    const safePro = Math.max(0, Math.min(500, Math.round((customPro || 0) * 10) / 10));
    const factor = 100 / safeG;

    const customUnitInfo = resolveStoredUnitInfo(customUnit);
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
        carbs: 0,
        fat: 0,
        fiber: 0,
      },
      servings: [
        {
          unit: customUnit,
          labelEn: customUnit === 'gram' ? `${safeG}g` : `1 ${customUnitInfo.singularEn} (${safeG}g)`,
          labelHi: customUnit === 'gram' ? `${safeG} ग्राम` : `1 ${customUnitInfo.labelHi} (${safeG}g)`,
          grams: safeG,
        },
      ],
    };

    onSaveCustomFood(newFood);

    const totalCalories = Math.round(safeCal * safeQty);
    const totalGrams = Math.round(safeG * safeQty * 10) / 10;
    const totalPro = Math.round(safePro * safeQty * 10) / 10;
    const customQtyDisplay = formatSmartQtyLabel(safeQty, customUnitInfo, language, safeG);

    onAddLog(
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uid,
        date: activeDate,
        mealType,
        foodId: newFood.id,
        foodName: newFood.name,
        servingUnit: customUnit,
        servingQty: safeQty,
        grams: totalGrams,
        calories: totalCalories,
        protein: totalPro,
        carbs: 0,
        fat: 0,
        fiber: 0,
        source: 'custom',
        createdAt: new Date().toISOString(),
      },
      true
    );
    setQuickAddedBanner(
      isHi
        ? `${customQtyDisplay} ${newFood.name} (${totalCalories} kcal) ${t(language, mealType)} में जोड़ा गया`
        : `Added ${customQtyDisplay} ${newFood.name} (${totalCalories} kcal) to ${t(language, mealType)}`
    );

    setCustomName('');
    setCustomQty(1);
    setCustomCal(200);
    setCustomPro(0);
    setShowCustomForm(false);
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
  const activeUnitInfo = useMemo(
    () => (selectedFood && activeServing ? resolveSmartServingUnit(selectedFood, activeServing) : null),
    [selectedFood, activeServing]
  );
  const activeMacros =
    selectedFood && activeServing ? computeMacrosForGrams(selectedFood, activeServing.grams * servingQty) : null;

  return (
    <div className={isStandaloneTab ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : 'space-y-4'}>
      {/* Search & Active Meal Food Entry Column */}
      <div
        ref={topPanelRef}
        className={`bg-white dark:bg-[#111a15] text-slate-900 dark:text-slate-100 ${
          isStandaloneTab
            ? 'lg:col-span-6 rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-4 sm:p-6'
            : 'rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto'
        } space-y-4`}
      >
        {/* Header showing active scheduled meal */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">
              {t(language, mealType)} · <span className="font-mono-num text-emerald-600 dark:text-emerald-400">{activeMealTime}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num tabular-nums">
              {activeDate} · {isHi ? 'शेड्यूल के अनुसार भोजन लॉग करें' : 'Tap Log on your schedule to switch meal'}
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
        {selectedFood && activeMacros && activeServing && activeUnitInfo && (
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                  {isHi ? selectedFood.nameHi : selectedFood.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-num tabular-nums mt-0.5">
                  {formatServingSummary(selectedFood, activeServing, servingQty, language)} · {activeMacros.calories} kcal · P {activeMacros.protein}g · C {activeMacros.carbs}g · F {activeMacros.fat}g
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
                  onChange={(e) => {
                    setSelectedServingIdx(Number(e.target.value));
                    setServingQty(1);
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#090e0b] text-xs font-medium"
                >
                  {selectedFood.servings.map((s, idx) => (
                    <option key={`${s.unit}_${idx}`} value={idx}>
                      {formatServingOptionTitle(selectedFood, s, language)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  {isHi
                    ? `मात्रा (${activeUnitInfo.labelHi})`
                    : `Quantity (${activeUnitInfo.pluralEn})`}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setServingQty((q) =>
                        Math.max(0.25, Math.round(getSmartStepDelta(q, 'dec', activeUnitInfo) * 100) / 100)
                      )
                    }
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#090e0b] flex items-center justify-center shrink-0"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-h-[44px] px-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#090e0b] flex items-center justify-center gap-1">
                    {activeUnitInfo.baseCount === 1 && activeUnitInfo.kind !== 'gram' ? (
                      <>
                        <input
                          type="number"
                          min={0.25}
                          max={50}
                          step={activeUnitInfo.isCountable ? 1 : 0.5}
                          aria-label={isHi ? 'मात्रा लिखें' : 'Quantity value'}
                          value={servingQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!Number.isNaN(val)) {
                              setServingQty(Math.max(0.25, Math.min(50, Math.round(val * 100) / 100)));
                            }
                          }}
                          className="w-12 text-center bg-transparent font-mono-num text-sm font-bold focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          {isHi
                            ? activeUnitInfo.labelHi
                            : servingQty === 1
                            ? activeUnitInfo.singularEn
                            : activeUnitInfo.pluralEn}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatSmartQtyLabel(servingQty, activeUnitInfo, language, activeServing.grams)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setServingQty((q) =>
                        Math.min(50, Math.round(getSmartStepDelta(q, 'inc', activeUnitInfo) * 100) / 100)
                      )
                    }
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#090e0b] flex items-center justify-center shrink-0"
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
                {isHi
                  ? `${formatSmartQtyLabel(servingQty, activeUnitInfo, language, activeServing.grams)} ${t(language, mealType)} में जोड़ें · ${activeMacros.calories} kcal`
                  : `Add ${formatSmartQtyLabel(servingQty, activeUnitInfo, language, activeServing.grams)} to ${t(language, mealType)} · ${activeMacros.calories} kcal`}
              </span>
            </button>
          </div>
        )}

        {/* Simple Search Input */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchBoxRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isHi
                  ? `${t(language, mealType)} (${activeMealTime}) के लिए भोजन खोजें...`
                  : `Search food for ${t(language, mealType)} (${activeMealTime})...`
              }
              className={`w-full min-h-[48px] pl-10 ${
                query ? 'pr-12' : 'pr-4'
              } rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500`}
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

          {hasTypedQuery && (
            <div className="space-y-2">
              {isSearching && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi ? 'खोजा जा रहा है...' : 'Searching food database...'}
                </p>
              )}

              <div className="divide-y divide-slate-100 dark:divide-emerald-950/70 max-h-[340px] overflow-y-auto">
                {filteredList.length === 0 ? (
                  <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {isHi ? 'कोई भोजन नहीं मिला।' : 'No matching foods found.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomName(query.trim());
                        setShowCustomForm(true);
                      }}
                      className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {isHi ? `"${query.trim()}" मैनुअल जोड़ें` : `Add "${query.trim()}" manually`}
                    </button>
                  </div>
                ) : (
                  filteredList.map((food) => {
                    const defaultSrv = food.servings[0];
                    const rowQty = getRowQty(food.id);
                    const scaledGrams = Math.round(defaultSrv.grams * rowQty * 10) / 10;
                    const scaledMacros = computeMacrosForGrams(food, scaledGrams);
                    const unitInfo = resolveSmartServingUnit(food, defaultSrv);
                    const qtyPresets = getSmartQtyPresets(unitInfo);
                    const isPresetMatch = qtyPresets.includes(rowQty);
                    return (
                      <div
                        key={food.id}
                        className="py-2.5 px-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50 dark:hover:bg-emerald-950/20 rounded-xl transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFood(food);
                            setSelectedServingIdx(0);
                            setServingQty(rowQty);
                          }}
                          className="flex-1 text-left min-h-[44px] flex flex-col justify-center min-w-0"
                        >
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {isHi ? food.nameHi : food.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num tabular-nums mt-0.5 truncate">
                            {formatServingSummary(food, defaultSrv, rowQty, language)} · {scaledMacros.calories} kcal · P {scaledMacros.protein}g
                          </div>
                        </button>

                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <div className="flex items-center rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#090e0b] p-0.5">
                            <button
                              type="button"
                              aria-label={isHi ? 'मात्रा घटाएं' : 'Decrease quantity'}
                              onClick={() => setRowQty(food.id, getSmartStepDelta(rowQty, 'dec', unitInfo))}
                              className="min-h-[36px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-emerald-950/60"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <select
                              aria-label={isHi ? 'मात्रा चुनें' : 'Select quantity'}
                              value={isPresetMatch ? rowQty : 'custom'}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (!Number.isNaN(val)) setRowQty(food.id, val);
                              }}
                              className="min-h-[36px] px-1.5 bg-transparent font-mono-num text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-none cursor-pointer"
                            >
                              {qtyPresets.map((q) => (
                                <option key={q} value={q} className="bg-white dark:bg-[#111a15]">
                                  {formatSmartQtyLabel(q, unitInfo, language, defaultSrv.grams)}
                                </option>
                              ))}
                              {!isPresetMatch && (
                                <option value="custom">
                                  {formatSmartQtyLabel(rowQty, unitInfo, language, defaultSrv.grams)}
                                </option>
                              )}
                            </select>
                            <button
                              type="button"
                              aria-label={isHi ? 'मात्रा बढ़ाएं' : 'Increase quantity'}
                              onClick={() => setRowQty(food.id, getSmartStepDelta(rowQty, 'inc', unitInfo))}
                              className="min-h-[36px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-emerald-950/60"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => quickLogFoodDefault(food, rowQty)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
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

          {/* Quiet fallback link for custom food if not in list */}
          {showCustomForm ? (
            <form
              onSubmit={handleSaveManualFood}
              className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isHi ? `${t(language, mealType)} में कस्टम भोजन जोड़ें` : `Add Custom Food to ${t(language, mealType)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  aria-label="Close custom food"
                  className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {isHi ? 'भोजन का नाम' : 'Food Name'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={isHi ? 'जैसे: घर का दलिया' : 'e.g., Home Daliya'}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {isHi ? 'कैलोरी (kcal)' : 'Calories (kcal)'}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={5000}
                    value={customCal}
                    onChange={(e) => setCustomCal(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {isHi ? 'मात्रा (Qty)' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    min={0.25}
                    max={50}
                    step={0.25}
                    value={customQty}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val)) setCustomQty(Math.max(0.25, Math.min(50, val)));
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isHi ? 'इकाई' : 'Unit'}</label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)}
                    className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs"
                  >
                    <option value="bowl">{isHi ? 'बाउल (Bowl)' : 'Bowl'}</option>
                    <option value="no">{isHi ? 'नग / पीस (No.)' : 'No. (Piece)'}</option>
                    <option value="plate">{isHi ? 'प्लेट (Plate)' : 'Plate'}</option>
                    <option value="cup">{isHi ? 'कप (Cup)' : 'Cup'}</option>
                    <option value="glass">{isHi ? 'गिलास (Glass)' : 'Glass'}</option>
                    <option value="gram">{isHi ? 'ग्राम (g)' : 'Gram (g)'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isHi ? 'वज़न (g)' : 'Grams'}</label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={customGrams}
                    onChange={(e) => setCustomGrams(Number(e.target.value))}
                    className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isHi ? 'प्रोटीन (g)' : 'Protein (g)'}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={customPro}
                    onChange={(e) => setCustomPro(Number(e.target.value))}
                    className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isHi ? 'डाइट' : 'Diet'}</label>
                  <select
                    value={customDiet}
                    onChange={(e) => setCustomDiet(e.target.value as DietType)}
                    className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs"
                  >
                    <option value="veg">Veg</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggetarian">Eggetarian</option>
                    <option value="non-veg">Non-Veg</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {(() => {
                    const customInfo = resolveStoredUnitInfo(customUnit);
                    const qtyText = formatSmartQtyLabel(customQty || 1, customInfo, language, customGrams || 100);
                    const totalKcal = Math.round((customCal || 0) * (customQty || 1));
                    return isHi
                      ? `${qtyText} ${t(language, mealType)} में जोड़ें (${totalKcal} kcal)`
                      : `Add ${qtyText} to ${t(language, mealType)} (${totalKcal} kcal)`;
                  })()}
                </span>
              </button>
            </form>
          ) : (
            hasTypedQuery && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(true)}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline py-1"
                >
                  {isHi ? 'भोजन सूची में नहीं है? मैनुअल जोड़ें' : 'Food not listed? Add manually'}
                </button>
              </div>
            )
          )}
        </div>

        {/* Logged Items for the Selected Scheduled Meal */}
        {selectedMealLogs.length > 0 && (
          <div className="rounded-2xl bg-slate-900 dark:bg-emerald-950 border border-slate-800 dark:border-emerald-700 text-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-semibold text-sm text-white">
                {t(language, mealType)} ({activeMealTime}) · {isHi ? 'लॉग किया गया भोजन' : 'Logged Items'}
              </h3>
              <span className="font-mono-num text-xs font-bold text-emerald-300">
                {selectedMealCalories} kcal
              </span>
            </div>
            <div className="divide-y divide-slate-800 dark:divide-emerald-900/70">
              {selectedMealLogs.map((item) => {
                const storedInfo = resolveStoredUnitInfo(item.servingUnit);
                const formattedQty = formatLoggedEntryQty(
                  item.servingQty,
                  item.servingUnit,
                  item.grams,
                  language
                );
                return (
                  <div key={item.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{item.foodName}</div>
                      <div className="text-xs text-slate-300 dark:text-emerald-200/80 font-mono-num">
                        {storedInfo.kind === 'gram' ? `${item.grams}g` : `${formattedQty} (${item.grams}g)`} · P {item.protein}g
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 shrink-0">
                      {onUpdateLogQty && (
                        <div className="flex items-center rounded-lg bg-slate-800 dark:bg-emerald-900/80 border border-slate-700 dark:border-emerald-700/80 p-0.5">
                          <button
                            type="button"
                            aria-label={isHi ? 'मात्रा घटाएं' : 'Decrease quantity'}
                            onClick={() =>
                              onUpdateLogQty(
                                item.id,
                                getSmartStepDelta(item.servingQty, 'dec', storedInfo)
                              )
                            }
                            className="min-h-[32px] min-w-[30px] rounded-md flex items-center justify-center text-slate-200 hover:bg-slate-700 dark:hover:bg-emerald-800"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-mono-num text-xs font-bold text-white whitespace-nowrap">
                            {formattedQty}
                          </span>
                          <button
                            type="button"
                            aria-label={isHi ? 'मात्रा बढ़ाएं' : 'Increase quantity'}
                            onClick={() =>
                              onUpdateLogQty(
                                item.id,
                                Math.min(50, getSmartStepDelta(item.servingQty, 'inc', storedInfo))
                              )
                            }
                            className="min-h-[32px] min-w-[30px] rounded-md flex items-center justify-center text-slate-200 hover:bg-slate-700 dark:hover:bg-emerald-800"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <span className="font-mono-num text-xs font-bold text-emerald-300 whitespace-nowrap">
                        {item.calories} kcal
                      </span>
                      {onDeleteLog && (
                        <button
                          type="button"
                          onClick={() => onDeleteLog(item.id)}
                          aria-label="Delete entry"
                          className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-rose-400 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Exact Chronological Daily Eating, Water & Alarm Schedule in Food Log Menu */}
      {isStandaloneTab && onToggleScheduleSlot && onUpdateReminders && onTestAlarm && onEnableAlarms && (
        <div className="lg:col-span-6">
          <DailyScheduleCard
            language={language}
            reminders={effectiveReminders}
            waterGoalMl={waterGoalMl}
            completedSlotIds={completedSlotIds}
            activeMealType={mealType}
            dayLogs={dateFilteredLogs}
            onToggleSlot={onToggleScheduleSlot}
            onOpenMealLogger={handleScheduleLogClick}
            onUpdateReminders={onUpdateReminders}
            onTestAlarm={onTestAlarm}
            onEnableAlarms={onEnableAlarms}
          />
        </div>
      )}
    </div>
  );
};
