import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  BookOpen,
  Check,
  Clock,
  Dumbbell,
  Flame,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  CoachMealPlan,
  CoachWorkoutPlan,
  DietType,
  FoodItem,
  Language,
  MealType,
  RemindersConfig,
  ServingOption,
  UserProfile,
  WorkoutSnackTriggersConfig,
} from '../types/fitplate';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';
import { buildLocal5DayWorkoutPlan, buildLocal7DayMealPlan } from '../data/coachPlansCatalog';
import { computeWorkoutSnackTriggerTimes, DEFAULT_WORKOUT_REMINDERS } from '../data/activitiesCatalog';
import { computeMacrosForGrams, INDIAN_AND_GLOBAL_FOODS } from '../data/indianFoods';
import { searchFoodsWithPriority } from '../utils/foodSearch';
import { t } from '../i18n/translations';

interface CoachViewProps {
  profile: UserProfile;
  language: Language;
  eatenTodayCalories: number;
  eatenTodayProtein: number;
  mealPlan: CoachMealPlan | null;
  workoutPlan: CoachWorkoutPlan | null;
  chatMessages: ChatMessage[];
  customFoods: FoodItem[];
  reminders: RemindersConfig;
  onUpdateReminders: (next: RemindersConfig) => void;
  onEnableAlarms?: () => void;
  onTestWorkoutSnackAlarm?: (kind: 'pre' | 'post') => void;
  onSaveCustomFood: (food: FoodItem) => void;
  onDeleteCustomFood?: (foodId: string) => void;
  onSaveMealPlan: (plan: CoachMealPlan) => void;
  onSaveWorkoutPlan: (plan: CoachWorkoutPlan) => void;
  onAppendChat: (msgs: ChatMessage[]) => void;
  onLogPlannedMeal: (meal: {
    mealType: MealType;
    title: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    foodId?: string;
    servingUnit?: string;
    servingQty?: number;
    grams?: number;
    source?: 'coach' | 'custom';
  }) => void;
}

type CoachSubTab = 'meal' | 'workout' | 'recipes' | 'chat';

const RECIPE_UNIT_OPTIONS: Array<{ unit: ServingOption['unit']; labelEn: string; labelHi: string }> = [
  { unit: 'plate', labelEn: 'Plate / Bowl', labelHi: 'प्लेट / बाउल' },
  { unit: 'katori', labelEn: 'Katori', labelHi: 'कटोरी' },
  { unit: 'cup', labelEn: 'Cup', labelHi: 'कप' },
  { unit: 'piece', labelEn: 'Piece / Wrap', labelHi: 'पीस' },
  { unit: 'glass', labelEn: 'Glass / Shake', labelHi: 'गिलास' },
  { unit: 'scoop', labelEn: 'Scoop', labelHi: 'स्कूप' },
  { unit: 'gram', labelEn: 'Gram Portion', labelHi: 'ग्राम' },
];

const QUICK_INGREDIENT_QUERIES = [
  'Paneer',
  'Oats',
  'Moong Dal',
  'Curd',
  'Chicken Breast',
  'Boiled Egg',
  'Brown Rice',
  'Almonds',
];

export const CoachView: React.FC<CoachViewProps> = ({
  profile,
  language,
  eatenTodayCalories,
  eatenTodayProtein,
  mealPlan,
  workoutPlan,
  chatMessages,
  customFoods,
  reminders,
  onUpdateReminders,
  onEnableAlarms,
  onTestWorkoutSnackAlarm,
  onSaveCustomFood,
  onDeleteCustomFood,
  onSaveMealPlan,
  onSaveWorkoutPlan,
  onAppendChat,
  onLogPlannedMeal,
}) => {
  const isHi = language === 'hi';
  const [subTab, setSubTab] = useState<CoachSubTab>('meal');
  const [budget, setBudget] = useState<'budget' | 'moderate' | 'flexible'>(mealPlan?.budget || 'budget');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [mealLoading, setMealLoading] = useState(false);

  const [workoutMode, setWorkoutMode] = useState<'home' | 'gym' | 'both'>(workoutPlan?.mode || 'both');
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutImgError, setWorkoutImgError] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Custom Healthy Recipe Builder state
  const [recipeName, setRecipeName] = useState('');
  const [recipeDiet, setRecipeDiet] = useState<DietType>(profile.dietType);
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<Array<{ food: FoodItem; grams: number }>>([]);
  const [recipeUnit, setRecipeUnit] = useState<ServingOption['unit']>('plate');
  const [autoServingGrams, setAutoServingGrams] = useState(true);
  const [customTotalGrams, setCustomTotalGrams] = useState(250);
  const [servingsCount, setServingsCount] = useState(1);
  const [builderMealType, setBuilderMealType] = useState<MealType>('lunch');
  const [recipeFeedback, setRecipeFeedback] = useState<string | null>(null);
  const [recipeLogMeals, setRecipeLogMeals] = useState<Record<string, MealType>>({});
  const [recipeLogQtys, setRecipeLogQtys] = useState<Record<string, number>>({});

  const ingredientMatches = useMemo(() => {
    if (!ingredientQuery.trim()) return [];
    return searchFoodsWithPriority({
      query: ingredientQuery,
      customFoods,
      localFoods: INDIAN_AND_GLOBAL_FOODS,
      language,
      limit: 8,
    });
  }, [ingredientQuery, customFoods, language]);

  const quickStaples = useMemo(
    () =>
      QUICK_INGREDIENT_QUERIES.map((q) => {
        const hit = searchFoodsWithPriority({
          query: q,
          localFoods: INDIAN_AND_GLOBAL_FOODS,
          language,
          limit: 1,
        })[0];
        return hit ? { label: q, food: hit } : null;
      }).filter((x): x is { label: string; food: FoodItem } => x !== null),
    [language]
  );

  const savedRecipes = useMemo(
    () => customFoods.filter((f) => f.isRecipe || f.category === 'custom'),
    [customFoods]
  );

  const rawIngredientSumGrams = useMemo(
    () => selectedIngredients.reduce((sum, item) => sum + Math.max(1, item.grams), 0),
    [selectedIngredients]
  );

  const effectiveTotalGrams = useMemo(() => {
    if (selectedIngredients.length === 0) return 0;
    const raw = autoServingGrams ? rawIngredientSumGrams : customTotalGrams;
    return Math.max(1, Math.min(5000, Math.round(raw || 1)));
  }, [selectedIngredients.length, autoServingGrams, rawIngredientSumGrams, customTotalGrams]);

  const safeServingsCount = Math.max(1, Math.min(12, Math.round(servingsCount || 1)));
  const perServingGrams =
    effectiveTotalGrams > 0 ? Math.max(1, Math.min(5000, Math.round(effectiveTotalGrams / safeServingsCount))) : 0;

  const totalRecipeMacros = useMemo(() => {
    return selectedIngredients.reduce(
      (acc, item) => {
        const m = computeMacrosForGrams(item.food, item.grams);
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
  }, [selectedIngredients]);

  const perServingMacros = useMemo(() => {
    return {
      calories: Math.min(5000, Math.max(0, Math.round(totalRecipeMacros.calories / safeServingsCount))),
      protein: Math.min(500, Math.max(0, Math.round((totalRecipeMacros.protein / safeServingsCount) * 10) / 10)),
      carbs: Math.min(500, Math.max(0, Math.round((totalRecipeMacros.carbs / safeServingsCount) * 10) / 10)),
      fat: Math.min(500, Math.max(0, Math.round((totalRecipeMacros.fat / safeServingsCount) * 10) / 10)),
      fiber: Math.min(200, Math.max(0, Math.round((totalRecipeMacros.fiber / safeServingsCount) * 10) / 10)),
    };
  }, [totalRecipeMacros, safeServingsCount]);

  const handleAddIngredient = (food: FoodItem) => {
    const defaultGrams = Math.max(1, Math.min(1000, Math.round(food.servings[0]?.grams || 100)));
    setSelectedIngredients((prev) => {
      const existingIdx = prev.findIndex((x) => x.food.id === food.id);
      if (existingIdx >= 0) {
        return prev.map((x, idx) =>
          idx === existingIdx ? { ...x, grams: Math.min(2500, x.grams + defaultGrams) } : x
        );
      }
      return [...prev, { food, grams: defaultGrams }];
    });
    setIngredientQuery('');
    setRecipeFeedback(null);
  };

  const handleUpdateIngredientGrams = (foodId: string, nextGrams: number) => {
    const safeG = Math.max(1, Math.min(2500, Math.round(nextGrams || 1)));
    setSelectedIngredients((prev) => prev.map((x) => (x.food.id === foodId ? { ...x, grams: safeG } : x)));
  };

  const handleRemoveIngredient = (foodId: string) => {
    setSelectedIngredients((prev) => prev.filter((x) => x.food.id !== foodId));
  };

  const handleSaveRecipe = (logImmediately = false) => {
    const cleanName = recipeName.trim().slice(0, 120);
    if (!cleanName || selectedIngredients.length === 0 || perServingGrams <= 0) return;

    const factor = 100 / perServingGrams;
    const ingredientsSummary = selectedIngredients
      .map((item) => `${item.food.name} ${item.grams}g`)
      .join(' + ')
      .slice(0, 220);

    const newRecipe: FoodItem = {
      id: `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      nameHi: cleanName,
      category: 'custom',
      dietType: recipeDiet,
      allergens: Array.from(new Set(selectedIngredients.flatMap((x) => x.food.allergens || []))),
      servings: [
        {
          unit: recipeUnit,
          labelEn: `1 ${recipeUnit} (${perServingGrams}g)`,
          labelHi: `1 ${recipeUnit} (${perServingGrams}g)`,
          grams: perServingGrams,
        },
      ],
      per100g: {
        calories: Math.round(perServingMacros.calories * factor),
        protein: Math.round(perServingMacros.protein * factor * 10) / 10,
        carbs: Math.round(perServingMacros.carbs * factor * 10) / 10,
        fat: Math.round(perServingMacros.fat * factor * 10) / 10,
        fiber: Math.round(perServingMacros.fiber * factor * 10) / 10,
      },
      isRecipe: true,
      ingredientsSummary,
    };

    onSaveCustomFood(newRecipe);

    if (logImmediately) {
      onLogPlannedMeal({
        mealType: builderMealType,
        title: newRecipe.name,
        portion: `1 ${recipeUnit} (${perServingGrams}g)`,
        calories: perServingMacros.calories,
        protein: perServingMacros.protein,
        carbs: perServingMacros.carbs,
        fat: perServingMacros.fat,
        fiber: perServingMacros.fiber,
        foodId: newRecipe.id,
        servingUnit: `1 ${recipeUnit}`.slice(0, 32),
        servingQty: 1,
        grams: perServingGrams,
        source: 'custom',
      });
    }

    setRecipeName('');
    setSelectedIngredients([]);
    setAutoServingGrams(true);
    setServingsCount(1);
    setRecipeFeedback(
      logImmediately
        ? isHi
          ? `"${cleanName}" सेव और आज के ${builderMealType} में लॉग हो गई!`
          : `Saved "${cleanName}" & logged 1 ${recipeUnit} to ${builderMealType}!`
        : isHi
        ? `"${cleanName}" आपकी कस्टम रेसिपी सूची में सेव हो गई!`
        : `Saved "${cleanName}" to your Custom Recipes list!`
    );
  };

  const workoutReminders: WorkoutSnackTriggersConfig = {
    ...DEFAULT_WORKOUT_REMINDERS,
    ...(reminders.workoutReminders || {}),
    dayWorkoutTimes: { ...(reminders.workoutReminders?.dayWorkoutTimes || {}) },
  };

  const updateWorkoutReminders = (patch: Partial<WorkoutSnackTriggersConfig>) => {
    onUpdateReminders({
      ...reminders,
      workoutReminders: {
        ...workoutReminders,
        ...patch,
      },
    });
  };

  const updateDayWorkoutTime = (dayLabel: string, timeValue: string) => {
    const nextOverrides = { ...(workoutReminders.dayWorkoutTimes || {}) };
    if (!timeValue) {
      delete nextOverrides[dayLabel];
    } else {
      nextOverrides[dayLabel] = timeValue;
    }
    updateWorkoutReminders({ dayWorkoutTimes: nextOverrides });
  };

  const alarmsActive = reminders.enabled !== false && reminders.alarmsEnabled !== false;
  const globalTriggerTimes = computeWorkoutSnackTriggerTimes({
    plannedWorkoutTime: workoutReminders.plannedWorkoutTime,
    workoutDurationMin: workoutReminders.workoutDurationMin,
    preWorkoutOffsetMin: workoutReminders.preWorkoutOffsetMin,
    postWorkoutOffsetMin: workoutReminders.postWorkoutOffsetMin,
  });

  const generateMealPlan = async () => {
    setMealLoading(true);
    try {
      const { ok, data } = await safeFetchJson<CoachMealPlan & { error?: string }>(apiUrl('/api/ai/meal-plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            name: profile.name,
            dietType: profile.dietType,
            allergies: profile.allergies,
            dailyCalorieTarget: profile.dailyCalorieTarget,
            proteinTargetG: profile.proteinTargetG,
            carbsTargetG: profile.carbsTargetG,
            fatTargetG: profile.fatTargetG,
            fiberTargetG: profile.fiberTargetG,
            goalType: profile.goalType,
            language,
          },
          budget,
        }),
      });
      if (ok && data && Array.isArray(data.days) && data.days.length > 0) {
        onSaveMealPlan(data);
        setSelectedDayIdx(0);
      } else {
        onSaveMealPlan(
          buildLocal7DayMealPlan({
            dietType: profile.dietType,
            budget,
            dailyCalorieTarget: profile.dailyCalorieTarget,
            proteinTargetG: profile.proteinTargetG,
            carbsTargetG: profile.carbsTargetG,
            fatTargetG: profile.fatTargetG,
            fiberTargetG: profile.fiberTargetG,
            allergies: profile.allergies,
            language,
          })
        );
        setSelectedDayIdx(0);
      }
    } catch {
      onSaveMealPlan(
        buildLocal7DayMealPlan({
          dietType: profile.dietType,
          budget,
          dailyCalorieTarget: profile.dailyCalorieTarget,
          proteinTargetG: profile.proteinTargetG,
          carbsTargetG: profile.carbsTargetG,
          fatTargetG: profile.fatTargetG,
          fiberTargetG: profile.fiberTargetG,
          allergies: profile.allergies,
          language,
        })
      );
      setSelectedDayIdx(0);
    } finally {
      setMealLoading(false);
    }
  };

  const generateWorkoutPlan = async () => {
    setWorkoutLoading(true);
    try {
      const { ok, data } = await safeFetchJson<CoachWorkoutPlan & { error?: string }>(
        apiUrl('/api/ai/workout-plan'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              goalType: profile.goalType,
              activityLevel: profile.activityLevel,
              age: profile.age,
              language,
            },
            mode: workoutMode,
          }),
        }
      );
      if (ok && data && Array.isArray(data.days) && data.days.length > 0) {
        onSaveWorkoutPlan(data);
      } else {
        onSaveWorkoutPlan(
          buildLocal5DayWorkoutPlan({
            mode: workoutMode,
            goalType: profile.goalType,
            language,
          })
        );
      }
    } catch {
      onSaveWorkoutPlan(
        buildLocal5DayWorkoutPlan({
          mode: workoutMode,
          goalType: profile.goalType,
          language,
        })
      );
    } finally {
      setWorkoutLoading(false);
    }
  };

  const sendChatMessage = async (textOverride?: string) => {
    const content = (textOverride ?? chatInput).trim();
    if (!content || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: content,
      createdAt: new Date().toISOString(),
    };
    if (!textOverride) setChatInput('');
    onAppendChat([userMsg]);
    setChatLoading(true);

    try {
      const { ok, data } = await safeFetchJson<{ reply?: string; error?: string }>(apiUrl('/api/ai/coach-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: chatMessages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          context: {
            name: profile.name,
            age: profile.age,
            dietType: profile.dietType,
            allergies: profile.allergies,
            goalType: profile.goalType,
            dailyCalorieTarget: profile.dailyCalorieTarget,
            eatenCalories: eatenTodayCalories,
            proteinEaten: eatenTodayProtein,
            proteinTarget: profile.proteinTargetG,
            language,
          },
        }),
      });
      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: ok && data?.reply ? data.reply : data?.error || (isHi ? 'AI चैट अभी ऑफ़लाइन है।' : 'Unable to reply right now.'),
        createdAt: new Date().toISOString(),
      };
      onAppendChat([assistantMsg]);
    } catch {
      onAppendChat([
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: isHi ? 'ऑफ़लाइन होने के कारण AI चैट उपलब्ध नहीं है।' : 'AI chat is unavailable while offline.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const activeDay = mealPlan?.days?.[selectedDayIdx];
  const dayMacros = activeDay
    ? {
        calories: activeDay.meals.reduce((s, m) => s + m.calories, 0) || activeDay.totalCalories,
        protein: Math.round(activeDay.meals.reduce((s, m) => s + m.protein, 0)) || activeDay.totalProtein || 0,
        carbs: Math.round(activeDay.meals.reduce((s, m) => s + m.carbs, 0)) || activeDay.totalCarbs || 0,
        fat: Math.round(activeDay.meals.reduce((s, m) => s + m.fat, 0)) || activeDay.totalFat || 0,
        fiber: Math.round(activeDay.meals.reduce((s, m) => s + m.fiber, 0)) || activeDay.totalFiber || 0,
      }
    : null;

  return (
    <div className="space-y-5">
      {/* Sub-navigation tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-white dark:bg-[#111a15] rounded-2xl border border-slate-200/80 dark:border-emerald-900/50">
        {(
          [
            ['meal', t(language, 'mealPlan7Day'), Utensils, undefined],
            ['workout', t(language, 'workoutPlans'), Dumbbell, undefined],
            ['recipes', isHi ? 'कस्टम रेसिपी' : 'Custom Recipes', BookOpen, savedRecipes.length || undefined],
            ['chat', t(language, 'dietChat'), MessageCircle, undefined],
          ] as [CoachSubTab, string, React.FC<{ className?: string }>, number | undefined][]
        ).map(([id, label, Icon, badge]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              subTab === id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono-num text-[10px] font-bold ${
                  subTab === id
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 7-Day Macro-Targeted Meal Plan Tab */}
      {subTab === 'meal' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">{t(language, 'mealPlan7Day')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                {profile.dietType.toUpperCase()} · {profile.dailyCalorieTarget} kcal · P {profile.proteinTargetG}g · C{' '}
                {profile.carbsTargetG}g · Fib {profile.fiberTargetG}g
                {profile.allergies.length > 0 ? ` · No ${profile.allergies.join(', ')}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value as typeof budget)}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-semibold"
              >
                <option value="budget">{isHi ? 'किफ़ायती बजट' : 'Budget-Friendly'}</option>
                <option value="moderate">{isHi ? 'मध्यम बजट' : 'Moderate Budget'}</option>
                <option value="flexible">{isHi ? 'लचीला बजट' : 'Flexible'}</option>
              </select>
              <button
                type="button"
                disabled={mealLoading}
                onClick={generateMealPlan}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                {mealLoading ? (isHi ? 'तैयार हो रहा है...' : 'Generating...') : t(language, 'generatePlan')}
              </button>
            </div>
          </div>

          {mealPlan && mealPlan.days?.length > 0 ? (
            <div className="space-y-4">
              {/* Day Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {mealPlan.days.map((d, idx) => (
                  <button
                    key={`${d.day}_${idx}`}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                      selectedDayIdx === idx
                        ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                        : 'bg-white dark:bg-[#111a15] border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {d.day}
                  </button>
                ))}
              </div>

              {activeDay && dayMacros && (
                <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-emerald-950">
                    <h3 className="font-display font-bold text-base">{activeDay.day}</h3>
                    <span className="font-mono-num text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      {dayMacros.calories} kcal · {activeDay.estimatedCostInr}
                    </span>
                  </div>

                  {/* Daily Protein / Carbs / Fiber Target Achievement Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      [isHi ? 'कैलोरी' : 'Calories', dayMacros.calories, profile.dailyCalorieTarget, 'kcal', 'bg-emerald-600'],
                      [t(language, 'protein'), dayMacros.protein, profile.proteinTargetG, 'g', 'bg-emerald-500'],
                      [t(language, 'carbs'), dayMacros.carbs, profile.carbsTargetG, 'g', 'bg-sky-500'],
                      [t(language, 'fiber'), dayMacros.fiber, profile.fiberTargetG, 'g', 'bg-teal-500'],
                    ].map(([lbl, actual, tgt, unit, barColor]) => {
                      const pct = Math.min(100, Math.round((Number(actual) / Math.max(1, Number(tgt))) * 100));
                      return (
                        <div key={String(lbl)} className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090e0b] space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{String(lbl)}</span>
                            <span className="font-mono-num font-bold text-slate-800 dark:text-slate-100">
                              {actual}/{tgt}
                              {String(unit)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-emerald-950 overflow-hidden">
                            <div className={`h-full rounded-full ${String(barColor)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeDay.meals.map((meal, mIdx) => (
                      <div
                        key={`${meal.mealType}_${mIdx}`}
                        className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
                            {meal.mealType}
                          </div>
                          <div className="font-semibold text-sm mt-0.5">{meal.title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{meal.portion}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-emerald-950">
                          <span className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300">
                            {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · Fib {meal.fiber}g
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onLogPlannedMeal({
                                mealType: (['breakfast', 'lunch', 'snacks', 'dinner'].includes(meal.mealType)
                                  ? meal.mealType
                                  : 'lunch') as MealType,
                                title: meal.title,
                                portion: meal.portion,
                                calories: meal.calories,
                                protein: meal.protein,
                                carbs: meal.carbs,
                                fat: meal.fat,
                                fiber: meal.fiber,
                              })
                            }
                            className="min-h-[38px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isHi ? 'लॉग करें' : 'Log'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-5 rounded-2xl overflow-hidden aspect-square bg-stone-100">
                <img
                  src="/src/assets/images/fitplate_protein_bowl_1794826405972.jpg"
                  alt="High protein paneer quinoa bowl"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:col-span-7 space-y-2">
                <h3 className="font-display font-bold text-lg">
                  {isHi ? 'आपका दिन-वार मैक्रो डाइट प्लान' : 'Day-Wise Diet Plan for Protein, Carbs & Fiber'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isHi
                    ? `अपने बजट के अनुसार 7 दिन का भारतीय व संतुलित मील प्लान बनाएं जो रोज़ाना ${profile.proteinTargetG}g प्रोटीन, ${profile.carbsTargetG}g कार्ब्स और ${profile.fiberTargetG}g फाइबर का लक्ष्य पूरा करे।`
                    : `Generate a complete 7-day day-wise menu calibrated to hit your daily ${profile.proteinTargetG}g protein, ${profile.carbsTargetG}g carbs, and ${profile.fiberTargetG}g fiber targets.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5-Day Combined Muscle + Cardio Workout Plans Tab */}
      {subTab === 'workout' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold">
                  {isHi ? '5-दिवसीय मसल + कार्डियो वर्कआउट प्लान' : '5-Day Muscle + Cardio Workout Plan'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi
                    ? 'जिम, होम या दोनों चुनें — हर दिन मसल ट्रेनिंग और कार्डियो के सेट्स के साथ।'
                    : 'Choose Gym, Home, or Both — every day combines Strength/Muscle sets and Cardio conditioning.'}
                </p>
              </div>
              <button
                type="button"
                disabled={workoutLoading}
                onClick={generateWorkoutPlan}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                {workoutLoading
                  ? isHi
                    ? 'तैयार...'
                    : 'Building 5-Day Plan...'
                  : isHi
                  ? '5-दिन प्लान बनाएं'
                  : 'Generate 5-Day Plan'}
              </button>
            </div>

            {/* Mode Selector: Home / Gym / Both */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 dark:bg-[#090e0b] rounded-xl">
              {(
                [
                  ['gym', t(language, 'gymWorkout')],
                  ['home', t(language, 'homeWorkout')],
                  ['both', t(language, 'bothWorkout')],
                ] as ['gym' | 'home' | 'both', string][]
              ).map(([mId, mLabel]) => (
                <button
                  key={mId}
                  type="button"
                  onClick={() => setWorkoutMode(mId)}
                  className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold transition-colors ${
                    workoutMode === mId
                      ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {mLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Planned Workout Time & Pre/Post-Workout Snack Triggers */}
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base">
                    {isHi ? 'प्री व पोस्ट-वर्कआउट स्नैक रिमाइंडर' : 'Pre & Post-Workout Snack Triggers'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isHi
                      ? 'अपने वर्कआउट समय के अनुसार कस्टम स्नैक नोटिफिकेशन सेट करें।'
                      : 'Trigger custom snack notifications anchored to your planned Coach workout schedule.'}
                  </p>
                </div>
              </div>

              {onEnableAlarms && (
                <button
                  type="button"
                  onClick={() => {
                    if (!alarmsActive) {
                      onEnableAlarms();
                    } else {
                      onUpdateReminders({ ...reminders, alarmsEnabled: false });
                    }
                  }}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    alarmsActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {alarmsActive ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  {alarmsActive ? (isHi ? 'अलार्म चालू' : 'Alarms ON') : isHi ? 'अलार्म चालू करें' : 'Enable Alarms'}
                </button>
              )}
            </div>

            {/* Planned Workout Time & Session Duration */}
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {isHi ? 'नियोजित वर्कआउट समय' : 'Planned Workout Start'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      aria-label="Planned workout start time"
                      value={workoutReminders.plannedWorkoutTime}
                      onChange={(e) => {
                        if (e.target.value) updateWorkoutReminders({ plannedWorkoutTime: e.target.value });
                      }}
                      className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-sm font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ['06:30', isHi ? 'सुबह 06:30' : '06:30 AM'],
                          ['18:00', isHi ? 'शाम 18:00' : '06:00 PM'],
                          ['20:30', isHi ? 'रात 20:30' : '08:30 PM'],
                        ] as [string, string][]
                      ).map(([presetVal, presetLbl]) => (
                        <button
                          key={presetVal}
                          type="button"
                          onClick={() => updateWorkoutReminders({ plannedWorkoutTime: presetVal })}
                          className={`min-h-[36px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
                            workoutReminders.plannedWorkoutTime === presetVal
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {presetLbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  {isHi ? 'वर्कआउट अवधि' : 'Session Duration'}
                </label>
                <div className="flex items-center gap-1">
                  {[30, 45, 60, 75].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => updateWorkoutReminders({ workoutDurationMin: dur })}
                      className={`min-h-[36px] px-2.5 rounded-lg font-mono-num text-xs font-semibold transition-colors ${
                        workoutReminders.workoutDurationMin === dur
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                          : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pre-Workout & Post-Workout Snack Trigger Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pre-Workout Trigger Card */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {isHi ? 'प्री-वर्कआउट स्नैक' : 'Pre-Workout Snack'}
                      </div>
                      <div className="text-[11px] font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                        {workoutReminders.preWorkoutEnabled
                          ? isHi
                            ? `अलर्ट समय: ${globalTriggerTimes.preWorkoutTime} (शुरू होने से ${workoutReminders.preWorkoutOffsetMin} मि पहले)`
                            : `Fires at ${globalTriggerTimes.preWorkoutTime} (${workoutReminders.preWorkoutOffsetMin}m before start)`
                          : isHi
                          ? 'रिमाइंडर बंद है'
                          : 'Trigger disabled'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onTestWorkoutSnackAlarm && (
                      <button
                        type="button"
                        onClick={() => onTestWorkoutSnackAlarm('pre')}
                        className="min-h-[32px] px-2 rounded-lg bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        {isHi ? 'टेस्ट' : 'Test'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateWorkoutReminders({ preWorkoutEnabled: !workoutReminders.preWorkoutEnabled })}
                      className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold ${
                        workoutReminders.preWorkoutEnabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-500'
                      }`}
                    >
                      {workoutReminders.preWorkoutEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {workoutReminders.preWorkoutEnabled && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {isHi ? 'वर्कआउट से कितने मिनट पहले याद दिलाएं:' : 'Notify before workout:'}
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[15, 30, 45, 60, 90].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => updateWorkoutReminders({ preWorkoutOffsetMin: mins })}
                            className={`min-h-[32px] px-2.5 rounded-lg font-mono-num text-xs font-semibold ${
                              workoutReminders.preWorkoutOffsetMin === mins
                                ? 'bg-amber-600 text-white'
                                : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={5}
                            max={180}
                            aria-label="Custom pre-workout minutes"
                            value={workoutReminders.preWorkoutOffsetMin}
                            onChange={(e) => {
                              const v = Math.max(5, Math.min(180, Number(e.target.value) || 15));
                              updateWorkoutReminders({ preWorkoutOffsetMin: v });
                            }}
                            className="w-16 min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] font-mono-num text-xs text-center"
                          />
                          <span className="text-[11px] text-slate-500">min</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {isHi ? 'प्री-वर्कआउट स्नैक नोट' : 'Custom Snack Prompt'}
                      </label>
                      <input
                        type="text"
                        value={workoutReminders.preWorkoutSnackNote || ''}
                        onChange={(e) => updateWorkoutReminders({ preWorkoutSnackNote: e.target.value })}
                        placeholder={isHi ? 'उदा. केला + ब्लैक कॉफी' : 'e.g. Banana + Black Coffee'}
                        className="w-full min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[
                          'Banana + Black Coffee',
                          'Oats + Peanut Butter',
                          'Soaked Almonds + Dates',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateWorkoutReminders({ preWorkoutSnackNote: preset })}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-[#111a15] border border-slate-200/80 dark:border-emerald-900/40 text-[10px] text-slate-600 dark:text-slate-300 hover:border-emerald-500"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Post-Workout Trigger Card */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {isHi ? 'पोस्ट-वर्कआउट स्नैक' : 'Post-Workout Snack'}
                      </div>
                      <div className="text-[11px] font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                        {workoutReminders.postWorkoutEnabled
                          ? isHi
                            ? `अलर्ट समय: ${globalTriggerTimes.postWorkoutTime} (खत्म होने के ${workoutReminders.postWorkoutOffsetMin} मि बाद)`
                            : `Fires at ${globalTriggerTimes.postWorkoutTime} (${workoutReminders.postWorkoutOffsetMin}m after ${globalTriggerTimes.workoutEnd} end)`
                          : isHi
                          ? 'रिमाइंडर बंद है'
                          : 'Trigger disabled'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onTestWorkoutSnackAlarm && (
                      <button
                        type="button"
                        onClick={() => onTestWorkoutSnackAlarm('post')}
                        className="min-h-[32px] px-2 rounded-lg bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        {isHi ? 'टेस्ट' : 'Test'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateWorkoutReminders({ postWorkoutEnabled: !workoutReminders.postWorkoutEnabled })}
                      className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold ${
                        workoutReminders.postWorkoutEnabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-500'
                      }`}
                    >
                      {workoutReminders.postWorkoutEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {workoutReminders.postWorkoutEnabled && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {isHi ? 'वर्कआउट खत्म होने के कितने मिनट बाद:' : 'Notify after workout ends:'}
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[15, 30, 45, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => updateWorkoutReminders({ postWorkoutOffsetMin: mins })}
                            className={`min-h-[32px] px-2.5 rounded-lg font-mono-num text-xs font-semibold ${
                              workoutReminders.postWorkoutOffsetMin === mins
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            +{mins}m
                          </button>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={5}
                            max={180}
                            aria-label="Custom post-workout minutes"
                            value={workoutReminders.postWorkoutOffsetMin}
                            onChange={(e) => {
                              const v = Math.max(5, Math.min(180, Number(e.target.value) || 30));
                              updateWorkoutReminders({ postWorkoutOffsetMin: v });
                            }}
                            className="w-16 min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] font-mono-num text-xs text-center"
                          />
                          <span className="text-[11px] text-slate-500">min</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {isHi ? 'पोस्ट-वर्कआउट स्नैक नोट' : 'Custom Recovery Snack Prompt'}
                      </label>
                      <input
                        type="text"
                        value={workoutReminders.postWorkoutSnackNote || ''}
                        onChange={(e) => updateWorkoutReminders({ postWorkoutSnackNote: e.target.value })}
                        placeholder={isHi ? 'उदा. व्हे प्रोटीन / पनीर / अंडे' : 'e.g. Whey Shake / Paneer / Eggs'}
                        className="w-full min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15] text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[
                          'Whey Shake + Banana',
                          'Paneer Bhurji / 3 Boiled Eggs',
                          'Sprouts & Roasted Chana',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateWorkoutReminders({ postWorkoutSnackNote: preset })}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-[#111a15] border border-slate-200/80 dark:border-emerald-900/40 text-[10px] text-slate-600 dark:text-slate-300 hover:border-emerald-500"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {workoutPlan && workoutPlan.days?.length > 0 ? (
            <div className="space-y-4">
              <div className="px-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">{workoutPlan.title}</h3>
                <span className="text-xs font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                  {workoutPlan.days.length} {isHi ? 'दिन / सप्ताह' : 'Days / Week'} · {workoutPlan.mode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workoutPlan.days.map((day, i) => {
                  const dayKey = day.day;
                  const dayPlannedStart =
                    workoutReminders.dayWorkoutTimes?.[dayKey] || day.plannedTime || workoutReminders.plannedWorkoutTime;
                  const dayTimes = computeWorkoutSnackTriggerTimes({
                    plannedWorkoutTime: dayPlannedStart,
                    workoutDurationMin: day.durationMin || workoutReminders.workoutDurationMin,
                    preWorkoutOffsetMin: workoutReminders.preWorkoutOffsetMin,
                    postWorkoutOffsetMin: workoutReminders.postWorkoutOffsetMin,
                  });
                  const hasCustomDayTime = Boolean(workoutReminders.dayWorkoutTimes?.[dayKey]);

                  return (
                    <div
                      key={`${day.day}_${i}`}
                      className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-emerald-950">
                        <div>
                          <h3 className="font-display font-bold text-base">{day.day}</h3>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{day.focus}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="time"
                              aria-label={`Planned workout time for ${day.day}`}
                              value={dayPlannedStart}
                              onChange={(e) => updateDayWorkoutTime(dayKey, e.target.value)}
                              className={`min-h-[32px] px-2 rounded-lg border font-mono-num text-xs font-semibold ${
                                hasCustomDayTime
                                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b] text-slate-700 dark:text-slate-200'
                              }`}
                            />
                          </div>
                          <span className="font-mono-num text-xs text-slate-500">{day.durationMin}m</span>
                        </div>
                      </div>

                      {(workoutReminders.preWorkoutEnabled || workoutReminders.postWorkoutEnabled) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#090e0b] text-[11px] font-mono-num">
                          <div className="flex flex-wrap items-center gap-3">
                            {workoutReminders.preWorkoutEnabled && (
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                {isHi ? 'प्री:' : 'Pre:'} {dayTimes.preWorkoutTime}
                              </span>
                            )}
                            {workoutReminders.postWorkoutEnabled && (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                {isHi ? 'पोस्ट:' : 'Post:'} {dayTimes.postWorkoutTime}
                              </span>
                            )}
                          </div>
                          {hasCustomDayTime && (
                            <button
                              type="button"
                              onClick={() => updateDayWorkoutTime(dayKey, '')}
                              className="text-[10px] font-sans font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                            >
                              {isHi ? 'डिफ़ॉल्ट' : 'Reset'}
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {day.exercises.map((ex, j) => {
                          const isCardio =
                            ex.exerciseType === 'cardio' ||
                            /cardio|treadmill|row|cycle|cycling|bike|elliptical|jump|burpee|jog|walk|climber|boxing|surya/i.test(
                              ex.name
                            );
                          return (
                            <div key={`${ex.name}_${j}`} className="p-3 rounded-xl bg-stone-50 dark:bg-[#090e0b] space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {isCardio ? (isHi ? 'कार्डियो' : 'Cardio') : isHi ? 'मसल / स्ट्रेंथ' : 'Muscle'}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {ex.name}
                                  </span>
                                </div>
                                <span
                                  className={`font-mono-num text-xs font-bold shrink-0 ${
                                    isCardio
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-emerald-700 dark:text-emerald-400'
                                  }`}
                                >
                                  {ex.setsReps}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Rest {ex.restSec}s · ~{ex.caloriesEstimate} kcal · {ex.note}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-5 rounded-2xl overflow-hidden aspect-[4/3] bg-emerald-50">
                {!workoutImgError ? (
                  <img
                    src="/src/assets/images/fitplate_workout_space_1794826406172.jpg"
                    alt="Sunlit home workout mat and dumbbells"
                    referrerPolicy="no-referrer"
                    onError={() => setWorkoutImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Dumbbell className="w-10 h-10 text-emerald-600" />
                  </div>
                )}
              </div>
              <div className="md:col-span-7 space-y-2">
                <h3 className="font-display font-bold text-lg">
                  {isHi ? '5-दिन जिम, होम या दोनों प्लान बनाएं' : '5-Day Gym, Home & Combined Splits'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isHi
                    ? 'ऊपर जिम, होम या दोनों विकल्प चुनें और हर दिन के लिए मसल एक्सरसाइज व कार्डियो सेट्स के साथ 5 दिन का साप्ताहिक प्लान पाएं।'
                    : 'Select Gym, Home, or Both above to generate a 5-day weekly plan pairing muscle hypertrophy sets with cardio intervals every day.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Healthy Recipes Tab */}
      {subTab === 'recipes' && (
        <div className="space-y-5">
          {/* Healthy Recipe Builder Card */}
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  {isHi ? 'अपनी हेल्दी रेसिपी बनाएं' : 'Healthy Recipe Builder'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isHi
                    ? 'कई सामग्रियां चुनें, कुल सर्विंग साइज सेट करें और आसान लॉगिंग के लिए कस्टम रेसिपी सूची में सेव करें।'
                    : 'Combine multiple ingredients, set your total serving size, and save to your Custom Recipes list for 1-tap logging.'}
                </p>
              </div>
              {selectedIngredients.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIngredients([]);
                    setRecipeName('');
                    setAutoServingGrams(true);
                    setServingsCount(1);
                    setRecipeFeedback(null);
                  }}
                  className="min-h-[34px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/50 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600"
                >
                  {isHi ? 'साफ़ करें' : 'Clear Draft'}
                </button>
              )}
            </div>

            {recipeFeedback && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{recipeFeedback}</span>
              </div>
            )}

            {/* Recipe Name + Diet Type */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  {isHi ? 'रेसिपी का नाम' : 'Recipe Name'}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder={isHi ? 'जैसे: हाई-प्रोटीन पनीर ओट्स चीला' : 'e.g., High-Protein Paneer Oats Bowl'}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  {isHi ? 'डाइट प्रकार' : 'Diet Type'}
                </label>
                <select
                  value={recipeDiet}
                  onChange={(e) => setRecipeDiet(e.target.value as DietType)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-semibold"
                >
                  <option value="veg">{isHi ? 'शाकाहारी (Veg)' : 'Vegetarian'}</option>
                  <option value="vegan">{isHi ? 'वीगन (Vegan)' : 'Vegan'}</option>
                  <option value="eggetarian">{isHi ? 'एगेटेरियन (Egg)' : 'Eggetarian'}</option>
                  <option value="non-veg">{isHi ? 'मांसाहारी (Non-Veg)' : 'Non-Veg'}</option>
                </select>
              </div>
            </div>

            {/* Ingredient Search & Quick Staples */}
            <div className="space-y-2.5">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {isHi ? 'सामग्री खोजें और जोड़ें' : 'Select Multiple Ingredients'}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={ingredientQuery}
                  onChange={(e) => setIngredientQuery(e.target.value)}
                  placeholder={
                    isHi
                      ? 'पनीर, ओट्स, मूंग दाल, अंडा, चिकन, दही खोजें...'
                      : 'Search ingredients (paneer, oats, dal, curd, chicken, almonds...)'
                  }
                  className="w-full min-h-[44px] pl-10 pr-9 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {ingredientQuery && (
                  <button
                    type="button"
                    aria-label="Clear ingredient search"
                    onClick={() => setIngredientQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Live Ingredient Search Results */}
              {ingredientQuery.trim() && (
                <div className="rounded-2xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b] divide-y divide-slate-200/70 dark:divide-emerald-950 max-h-60 overflow-y-auto">
                  {ingredientMatches.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                      {isHi ? 'कोई सामग्री नहीं मिली' : 'No matching ingredients found'}
                    </div>
                  ) : (
                    ingredientMatches.map((food) => {
                      const defGrams = food.servings[0]?.grams || 100;
                      const preview = computeMacrosForGrams(food, defGrams);
                      const alreadyAdded = selectedIngredients.some((x) => x.food.id === food.id);
                      return (
                        <button
                          key={food.id}
                          type="button"
                          onClick={() => handleAddIngredient(food)}
                          className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-white dark:hover:bg-[#111a15] transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {isHi ? food.nameHi : food.name}
                            </div>
                            <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                              {food.servings[0]?.labelEn || `${defGrams}g`} · {preview.calories} kcal · P {preview.protein}g
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0">
                            <Plus className="w-3 h-3" />
                            {alreadyAdded ? (isHi ? 'और जोड़ें' : '+ Add More') : isHi ? 'जोड़ें' : 'Add'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Quick Healthy Staple Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                  {isHi ? 'त्वरित सामग्री:' : 'Quick Add:'}
                </span>
                {quickStaples.map((staple) => (
                  <button
                    key={staple.food.id}
                    type="button"
                    onClick={() => handleAddIngredient(staple.food)}
                    className="px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    {staple.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Ingredients List */}
            {selectedIngredients.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {isHi ? 'चुनी गई सामग्री' : 'Selected Ingredients'} ({selectedIngredients.length})
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                    {isHi ? 'कुल वजन:' : 'Ingredient sum:'} {rawIngredientSumGrams}g
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedIngredients.map(({ food, grams }) => {
                    const m = computeMacrosForGrams(food, grams);
                    return (
                      <div
                        key={food.id}
                        className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {isHi ? food.nameHi : food.name}
                          </div>
                          <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 mt-0.5">
                            {m.calories} kcal · P {m.protein}g · C {m.carbs}g · F {m.fat}g · Fib {m.fiber}g
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateIngredientGrams(food.id, Math.max(5, grams - 25))}
                            className="min-h-[34px] px-2 rounded-lg bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-xs font-mono-num font-semibold"
                          >
                            -25g
                          </button>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={2500}
                              aria-label={`Grams for ${food.name}`}
                              value={grams}
                              onChange={(e) => handleUpdateIngredientGrams(food.id, Number(e.target.value))}
                              className="w-16 min-h-[34px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs font-bold text-center"
                            />
                            <span className="text-[11px] text-slate-500">g</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateIngredientGrams(food.id, Math.min(2500, grams + 25))}
                            className="min-h-[34px] px-2 rounded-lg bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-xs font-mono-num font-semibold"
                          >
                            +25g
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${food.name}`}
                            onClick={() => handleRemoveIngredient(food.id)}
                            className="min-h-[34px] min-w-[34px] rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Serving Size Controls */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {isHi ? 'कुल सर्विंग साइज सेट करें' : 'Total Serving Size & Yield'}
                    </span>
                    {!autoServingGrams && (
                      <button
                        type="button"
                        onClick={() => setAutoServingGrams(true)}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 underline"
                      >
                        {isHi
                          ? `सामग्री योग उपयोग करें (${rawIngredientSumGrams}g)`
                          : `Use ingredient sum (${rawIngredientSumGrams}g)`}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {isHi ? 'कुल तैयार वजन (ग्राम)' : 'Total Cooked / Recipe Weight (g)'}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          aria-label="Total serving size in grams"
                          value={effectiveTotalGrams}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(5000, Number(e.target.value) || 1));
                            setAutoServingGrams(false);
                            setCustomTotalGrams(val);
                          }}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-sm font-bold text-emerald-700 dark:text-emerald-400"
                        />
                        <span className="text-xs font-mono-num text-slate-500">g</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {isHi ? 'सर्विंग यूनिट' : 'Serving Unit'}
                      </label>
                      <select
                        value={recipeUnit}
                        onChange={(e) => setRecipeUnit(e.target.value as ServingOption['unit'])}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs font-semibold"
                      >
                        {RECIPE_UNIT_OPTIONS.map((opt) => (
                          <option key={opt.unit} value={opt.unit}>
                            {isHi ? opt.labelHi : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {isHi ? 'कितनी सर्विंग्स बनती हैं' : 'Number of Servings'}
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setServingsCount(count)}
                            className={`flex-1 min-h-[40px] rounded-xl font-mono-num text-xs font-bold transition-colors ${
                              safeServingsCount === count
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={12}
                          aria-label="Custom number of servings"
                          value={safeServingsCount}
                          onChange={(e) => setServingsCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                          className="w-12 min-h-[40px] px-1.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Nutrition Preview & Save Buttons */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      {isHi
                        ? `प्रति सर्विंग (1 ${recipeUnit} = ${perServingGrams}g)`
                        : `Per Serving (1 ${recipeUnit} = ${perServingGrams}g)`}
                    </span>
                    {safeServingsCount > 1 && (
                      <span className="font-mono-num text-[11px] text-emerald-700 dark:text-emerald-400">
                        {isHi ? 'पूरी रेसिपी:' : 'Full batch:'} {Math.round(totalRecipeMacros.calories)} kcal ·{' '}
                        {effectiveTotalGrams}g
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      [isHi ? 'कैलोरी' : 'Calories', `${perServingMacros.calories}`, 'kcal'],
                      [t(language, 'protein'), `${perServingMacros.protein}g`, ''],
                      [t(language, 'carbs'), `${perServingMacros.carbs}g`, ''],
                      [t(language, 'fat'), `${perServingMacros.fat}g`, ''],
                      [t(language, 'fiber'), `${perServingMacros.fiber}g`, ''],
                    ].map(([lbl, val, suffix]) => (
                      <div key={String(lbl)} className="p-2 rounded-xl bg-white dark:bg-[#111a15]">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{String(lbl)}</div>
                        <div className="font-mono-num text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {val}
                          {suffix ? ` ${suffix}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {isHi ? 'मील स्लॉट:' : 'Log into:'}
                      </label>
                      <select
                        value={builderMealType}
                        onChange={(e) => setBuilderMealType(e.target.value as MealType)}
                        className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs font-semibold capitalize"
                      >
                        <option value="breakfast">{isHi ? 'नाश्ता' : 'Breakfast'}</option>
                        <option value="lunch">{isHi ? 'दोपहर का खाना' : 'Lunch'}</option>
                        <option value="snacks">{isHi ? 'स्नैक्स' : 'Snacks'}</option>
                        <option value="dinner">{isHi ? 'रात का खाना' : 'Dinner'}</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!recipeName.trim() || selectedIngredients.length === 0}
                        onClick={() => handleSaveRecipe(false)}
                        className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {isHi ? 'कस्टम रेसिपी में सेव करें' : 'Save to Custom Recipes'}
                      </button>
                      <button
                        type="button"
                        disabled={!recipeName.trim() || selectedIngredients.length === 0}
                        onClick={() => handleSaveRecipe(true)}
                        className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isHi ? 'सेव व लॉग करें' : 'Save & Log Now'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-dashed border-slate-300 dark:border-emerald-900/50 text-center text-xs text-slate-500 dark:text-slate-400">
                {isHi
                  ? 'ऊपर खोजें या किसी सामग्री चिप पर टैप करके अपनी हेल्दी रेसिपी बनाना शुरू करें।'
                  : 'Search above or tap a quick staple chip to start adding ingredients to your recipe.'}
              </div>
            )}
          </div>

          {/* Saved Custom Recipes List */}
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-base">
                  {isHi ? 'मेरी कस्टम रेसिपी सूची' : 'Custom Recipes'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi
                    ? 'सेव की गई रेसिपी को एक टैप में अपनी दैनिक डायरी में लॉग करें।'
                    : 'Log your saved healthy recipes to today’s diary in one tap.'}
                </p>
              </div>
              <span className="font-mono-num text-xs font-bold px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#090e0b] text-emerald-700 dark:text-emerald-400">
                {savedRecipes.length}
              </span>
            </div>

            {savedRecipes.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {isHi
                  ? 'अभी कोई कस्टम रेसिपी सेव नहीं है। ऊपर अपनी पहली हेल्दी रेसिपी बनाएं!'
                  : 'No custom recipes saved yet. Build your first healthy recipe above!'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedRecipes.map((recipe) => {
                  const defaultServing = recipe.servings[0] || {
                    unit: 'plate' as ServingOption['unit'],
                    labelEn: '1 serving (200g)',
                    labelHi: '1 सर्विंग (200g)',
                    grams: 200,
                  };
                  const qty = recipeLogQtys[recipe.id] ?? 1;
                  const targetMeal = recipeLogMeals[recipe.id] ?? 'lunch';
                  const scaledGrams = Math.max(1, Math.round(defaultServing.grams * qty));
                  const macros = computeMacrosForGrams(recipe, scaledGrams);

                  return (
                    <div
                      key={recipe.id}
                      className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/40 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {isHi ? recipe.nameHi : recipe.name}
                            </div>
                            <div className="text-[11px] font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                              {isHi ? defaultServing.labelHi : defaultServing.labelEn} · {recipe.dietType.toUpperCase()}
                            </div>
                          </div>
                          {onDeleteCustomFood && (
                            <button
                              type="button"
                              aria-label={`Delete ${recipe.name}`}
                              onClick={() => onDeleteCustomFood(recipe.id)}
                              className="min-h-[32px] min-w-[32px] rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {recipe.ingredientsSummary && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {recipe.ingredientsSummary}
                          </p>
                        )}

                        <div className="font-mono-num text-[11px] text-slate-700 dark:text-slate-200 font-medium pt-1">
                          {macros.calories} kcal · P {macros.protein}g · C {macros.carbs}g · F {macros.fat}g · Fib{' '}
                          {macros.fiber}g
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-emerald-950">
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Quantity for ${recipe.name}`}
                            value={qty}
                            onChange={(e) =>
                              setRecipeLogQtys((prev) => ({ ...prev, [recipe.id]: Number(e.target.value) || 1 }))
                            }
                            className="min-h-[36px] px-2 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs font-semibold"
                          >
                            {[0.5, 1, 1.5, 2].map((q) => (
                              <option key={q} value={q}>
                                {q}x
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={`Meal slot for ${recipe.name}`}
                            value={targetMeal}
                            onChange={(e) =>
                              setRecipeLogMeals((prev) => ({ ...prev, [recipe.id]: e.target.value as MealType }))
                            }
                            className="min-h-[36px] px-2 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs font-semibold capitalize"
                          >
                            <option value="breakfast">{isHi ? 'नाश्ता' : 'Breakfast'}</option>
                            <option value="lunch">{isHi ? 'लंच' : 'Lunch'}</option>
                            <option value="snacks">{isHi ? 'स्नैक' : 'Snacks'}</option>
                            <option value="dinner">{isHi ? 'डिनर' : 'Dinner'}</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onLogPlannedMeal({
                              mealType: targetMeal,
                              title: isHi ? recipe.nameHi : recipe.name,
                              portion: `${qty} × ${defaultServing.unit} (${scaledGrams}g)`,
                              calories: macros.calories,
                              protein: macros.protein,
                              carbs: macros.carbs,
                              fat: macros.fat,
                              fiber: macros.fiber,
                              foodId: recipe.id,
                              servingUnit: `${qty} ${defaultServing.unit}`.slice(0, 32),
                              servingQty: qty,
                              grams: scaledGrams,
                              source: 'custom',
                            })
                          }
                          className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {isHi ? 'लॉग करें' : 'Log'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diet Chat Assistant Tab */}
      {subTab === 'chat' && (
        <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-4 sm:p-6 flex flex-col h-[540px]">
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100 dark:border-emerald-950">
            {[
              isHi ? 'मेरे बचे हुए कैलोरी के लिए डिनर सुझाव दें' : 'Suggest a high-protein dinner for my remaining calories',
              isHi ? 'रोटी और चावल में बेहतर विकल्प क्या है?' : 'How can I hit my protein target on a vegetarian Indian diet?',
              isHi ? 'शाम की चाय के साथ हेल्दी स्नैक बताएं' : 'Healthy snacks to pair with evening masala chai',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendChatMessage(prompt)}
                className="min-h-[36px] px-3 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 text-xs font-medium hover:border-emerald-500 text-left"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-12 max-w-md mx-auto">
                {isHi
                  ? 'नमस्ते! अपने आहार, प्रोटीन, भारतीय भोजन या फिटनेस लक्ष्य से जुड़ा कोई भी प्रश्न पूछें।'
                  : 'Ask your Fit-Plat with Karam Coach anything about Indian meals, macros, cravings, or safe calorie balance.'}
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 dark:bg-[#090e0b] text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-emerald-900/40'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isHi ? 'कोच सोच रहा है...' : 'Coach is typing...'}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChatMessage();
            }}
            className="pt-3 border-t border-slate-100 dark:border-emerald-950 flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isHi ? 'अपना सवाल पूछें...' : 'Ask about diet, calories, or swaps...'}
              className="flex-1 min-h-[46px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              aria-label="Send message"
              className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
