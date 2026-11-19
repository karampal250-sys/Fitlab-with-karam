import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlarmClock,
  Bell,
  BellOff,
  Check,
  Droplets,
  Flame,
  Footprints,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import type {
  ActivityLogEntry,
  DailyMetrics,
  FoodLogEntry,
  Language,
  MealType,
  RemindersConfig,
  ScheduleSlot,
  UserProfile,
} from '../types/fitplate';
import { CalorieHeroRing, SmallMacroRing, WaterProgressRing } from './MacroRings';
import { MacroDistributionChart } from './MacroDistributionChart';
import { DailyScheduleCard } from './DailyScheduleCard';
import { ActivityBurnTracker } from './ActivityBurnTracker';
import { MealAnalysisSummaryCard } from './MealAnalysisSummaryCard';
import { ConfettiOverlay, type CelebrationKind } from './ConfettiOverlay';
import {
  computeWorkoutSnackTriggerTimes,
  DEFAULT_WORKOUT_REMINDERS,
  deriveMealTimesFromWakeUp,
  getWaterScheduleSlots,
} from '../data/activitiesCatalog';
import { getNextUpcomingSlot } from '../utils/alarmEngine';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';
import { t } from '../i18n/translations';

interface DashboardViewProps {
  profile: UserProfile;
  language: Language;
  activeDate: string;
  onChangeDate: (date: string) => void;
  logs: FoodLogEntry[];
  metrics: DailyMetrics;
  activities: ActivityLogEntry[];
  completedSlotIds: string[];
  streakDays: number;
  reminders: RemindersConfig;
  onUpdateMetrics: (next: DailyMetrics) => void;
  onDeleteLog: (id: string) => void;
  onOpenLogger: (mealType: MealType) => void;
  onQuickLogSuggestion: (item: {
    foodName: string;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }) => void;
  onUpdateReminders: (next: RemindersConfig) => void;
  onAddActivity: (entry: ActivityLogEntry) => void;
  onDeleteActivity: (id: string) => void;
  onToggleScheduleSlot: (slot: ScheduleSlot) => void;
  onTestAlarm: () => void;
  onTestWaterAlarm?: () => void;
  onEnableAlarms: () => void;
}

function getLast7Days(baseDateStr: string): { date: string; dayShort: string; dayNum: string }[] {
  const days: { date: string; dayShort: string; dayNum: string }[] = [];
  const today = new Date();
  for (let i = -5; i <= 1; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayShort = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNum = String(d.getDate());
    days.push({ date: iso, dayShort, dayNum });
  }
  if (!days.some((d) => d.date === baseDateStr)) {
    const d = new Date(baseDateStr);
    days.push({
      date: baseDateStr,
      dayShort: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dayNum: String(d.getDate()),
    });
  }
  return days;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  language,
  activeDate,
  onChangeDate,
  logs,
  metrics,
  activities,
  completedSlotIds,
  streakDays,
  reminders,
  onUpdateMetrics,
  onDeleteLog,
  onOpenLogger,
  onQuickLogSuggestion,
  onUpdateReminders,
  onAddActivity,
  onDeleteActivity,
  onToggleScheduleSlot,
  onTestAlarm,
  onTestWaterAlarm,
  onEnableAlarms,
}) => {
  const isHi = language === 'hi';
  const dateChips = useMemo(() => getLast7Days(activeDate), [activeDate]);

  const dayLogs = useMemo(() => logs.filter((l) => l.date === activeDate), [logs, activeDate]);

  const totals = useMemo(
    () =>
      dayLogs.reduce(
        (acc, item) => ({
          calories: acc.calories + item.calories,
          protein: Math.round((acc.protein + item.protein) * 10) / 10,
          carbs: Math.round((acc.carbs + item.carbs) * 10) / 10,
          fat: Math.round((acc.fat + item.fat) * 10) / 10,
          fiber: Math.round((acc.fiber + item.fiber) * 10) / 10,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      ),
    [dayLogs]
  );

  const remainingKcal = profile.dailyCalorieTarget + metrics.exerciseCalories - totals.calories;
  const remainingProtein = Math.max(0, Math.round(profile.proteinTargetG - totals.protein));

  const [smartIdea, setSmartIdea] = useState<{
    suggestionText: string;
    foodName: string;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  } | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [celebration, setCelebration] = useState<{ id: number; kind: CelebrationKind } | null>(null);
  const calorieGoalMet = profile.dailyCalorieTarget > 0 && totals.calories >= profile.dailyCalorieTarget;
  const waterGoalMet = metrics.waterGoalMl > 0 && metrics.waterMl >= metrics.waterGoalMl;

  const prevGoalStateRef = useRef<{ date: string; calorie: boolean; water: boolean }>({
    date: activeDate,
    calorie: calorieGoalMet,
    water: waterGoalMet,
  });

  useEffect(() => {
    const prev = prevGoalStateRef.current;
    if (prev.date !== activeDate) {
      prevGoalStateRef.current = {
        date: activeDate,
        calorie: calorieGoalMet,
        water: waterGoalMet,
      };
      return;
    }

    if (!prev.water && waterGoalMet) {
      setCelebration({ id: Date.now(), kind: 'water' });
    } else if (!prev.calorie && calorieGoalMet) {
      setCelebration({ id: Date.now(), kind: 'calorie' });
    }

    prevGoalStateRef.current = {
      date: activeDate,
      calorie: calorieGoalMet,
      water: waterGoalMet,
    };
  }, [activeDate, calorieGoalMet, waterGoalMet]);

  const handleCelebrationDone = useCallback(() => {
    setCelebration(null);
  }, []);

  const defaultLocalIdea = useMemo(() => {
    const rem = Math.max(150, remainingKcal);
    if (profile.dietType === 'vegan') {
      return rem >= 350
        ? {
            suggestionText: isHi
              ? `आपके पास ${rem} kcal शेष हैं: 1 कटोरी मूंग स्प्राउट्स + 1 मल्टीग्रेन रोटी + टोफू ट्राई करें।`
              : `You have ${rem} kcal left: try grilled tofu + 1 multigrain roti.`,
            foodName: 'Grilled Tofu + 1 Multigrain Roti',
            servingUnit: 'plate',
            calories: 320,
            protein: 21,
            carbs: 28,
            fat: 12,
            fiber: 6,
          }
        : {
            suggestionText: isHi
              ? `आपके पास ${rem} kcal शेष हैं: 1 कप भुना मखाना + 1 कटोरी स्प्राउट्स लें।`
              : `You have ${rem} kcal left: try 1 katori Moong Sprouts Chaat.`,
            foodName: 'Moong Sprouts Salad',
            servingUnit: 'katori',
            calories: 140,
            protein: 9,
            carbs: 20,
            fat: 1.5,
            fiber: 6,
          };
    }
    return rem >= 350
      ? {
          suggestionText: isHi
            ? `आपके पास ${rem} kcal शेष हैं: 1 कटोरी पनीर भुर्जी + 1 रोटी आज़माएं।`
            : `You have ${rem} kcal left: try 1 katori Paneer Bhurji + 1 Roti.`,
          foodName: 'Paneer Bhurji + 1 Whole Wheat Roti',
          servingUnit: 'plate',
          calories: 392,
          protein: 20.5,
          carbs: 27,
          fat: 22.3,
          fiber: 4.8,
        }
      : {
          suggestionText: isHi
            ? `आपके पास ${rem} kcal शेष हैं: 1 कटोरी ताज़ा दही + 10 भीगे बादाम लें।`
            : `You have ${rem} kcal left: try 1 katori Curd + 10 Almonds.`,
          foodName: 'Fresh Curd + 10 Almonds',
          servingUnit: 'katori',
          calories: 160,
          protein: 7.2,
          carbs: 9.2,
          fat: 10.9,
          fiber: 1.5,
        };
  }, [remainingKcal, profile.dietType, isHi]);

  const activeIdea = smartIdea || defaultLocalIdea;

  const fetchAiSuggestion = async () => {
    setIdeaLoading(true);
    try {
      const { ok, data } = await safeFetchJson<typeof smartIdea>(apiUrl('/api/ai/quick-suggestion'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remainingCalories: Math.max(120, remainingKcal),
          remainingProteinG: remainingProtein,
          dietType: profile.dietType,
          allergies: profile.allergies,
          language,
        }),
      });
      if (ok && data?.foodName) setSmartIdea(data);
    } catch {
      // keep local smart fallback offline
    } finally {
      setIdeaLoading(false);
    }
  };

  const addWater = (deltaMl: number) => {
    const nextWater = Math.max(0, Math.min(12000, metrics.waterMl + deltaMl));
    onUpdateMetrics({ ...metrics, waterMl: nextWater, updatedAt: new Date().toISOString() });
  };

  const addStepsOrExercise = (addSteps: number, addKcal: number) => {
    onUpdateMetrics({
      ...metrics,
      steps: Math.max(0, metrics.steps + addSteps),
      exerciseCalories: Math.max(0, metrics.exerciseCalories + addKcal),
      updatedAt: new Date().toISOString(),
    });
    setShowExercisePicker(false);
  };

  const waterPct = Math.min(100, Math.round((metrics.waterMl / Math.max(500, metrics.waterGoalMl)) * 100));

  const [waterTick, setWaterTick] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setWaterTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const wakeTime = reminders.wakeUpTime || '07:00';
  const waterSlots = useMemo(
    () => getWaterScheduleSlots(reminders, metrics.waterGoalMl, waterTick),
    [reminders, metrics.waterGoalMl, waterTick]
  );
  const nextWaterAlarm = useMemo(
    () => getNextUpcomingSlot(waterSlots, wakeTime, completedSlotIds, waterTick),
    [waterSlots, wakeTime, completedSlotIds, waterTick]
  );
  const waterAlarmsOn =
    reminders.enabled !== false &&
    reminders.alarmsEnabled !== false &&
    reminders.waterAlarmsEnabled !== false;

  // BMI Bar calculations (clamped across 14 to 38 scale)
  const safeBmi = Number(profile.bmi) || 22;
  const bmiPct = Math.max(2, Math.min(98, ((safeBmi - 14) / (38 - 14)) * 100));
  const bmiStatus =
    safeBmi < 18.5
      ? { label: isHi ? 'कम वज़न' : 'Underweight', tone: 'text-sky-600 dark:text-sky-400' }
      : safeBmi < 25
      ? { label: isHi ? 'स्वस्थ (Normal)' : 'Healthy Normal', tone: 'text-emerald-600 dark:text-emerald-400' }
      : safeBmi < 30
      ? { label: isHi ? 'अधिक वज़न' : 'Overweight', tone: 'text-amber-600 dark:text-amber-400' }
      : { label: isHi ? 'मोटापा (Obese)' : 'Obese', tone: 'text-rose-600 dark:text-rose-400' };

  return (
    <div className="space-y-5">
      <ConfettiOverlay
        celebration={celebration}
        language={language}
        onDone={handleCelebrationDone}
      />

      {/* Greeting & Horizontal Date Scroller */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {isHi ? `नमस्ते, ${profile.name}` : `Welcome back, ${profile.name}`} · {profile.age}{' '}
            {isHi ? 'वर्ष' : 'yrs'}
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isHi ? 'दैनिक फिटनेस और पोषण डैशबोर्ड' : 'Daily Nutrition & Vitality'}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="min-h-[42px] px-3.5 rounded-2xl bg-white dark:bg-[#111a15] border border-slate-200/80 dark:border-emerald-900/50 flex items-center gap-1.5 shadow-2xs">
            <Flame className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-mono-num text-sm font-bold">{streakDays}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              {t(language, 'streakLabel')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowReminders((v) => !v)}
            aria-label="Meal & water reminders"
            className="min-h-[42px] min-w-[42px] rounded-2xl bg-white dark:bg-[#111a15] border border-slate-200/80 dark:border-emerald-900/50 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-emerald-500 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Date Scroller */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {dateChips.map((d) => {
          const active = d.date === activeDate;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onChangeDate(d.date)}
              className={`min-h-[50px] min-w-[46px] px-3 py-1.5 rounded-2xl flex flex-col items-center justify-center transition-colors shrink-0 ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#111a15] border border-slate-200/80 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
              }`}
            >
              <span className="text-[10px] font-medium opacity-80">{d.dayShort}</span>
              <span className="font-mono-num text-sm font-bold">{d.dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Reminders Drawer */}
      {showReminders && (
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {isHi ? 'भोजन और पानी रिमाइंडर' : 'Meal & Water Reminders'}
            </span>
            <button
              type="button"
              onClick={() => onUpdateReminders({ ...reminders, enabled: !reminders.enabled })}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold ${
                reminders.enabled ? 'bg-emerald-600 text-white' : 'bg-stone-100 dark:bg-[#090e0b] text-slate-600'
              }`}
            >
              {reminders.enabled ? (isHi ? 'चालू' : 'Active') : isHi ? 'बंद' : 'Paused'}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">{isHi ? 'उठने का समय' : 'Wake-Up Time'}</label>
              <input
                type="time"
                value={reminders.wakeUpTime || '07:00'}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const derived = deriveMealTimesFromWakeUp(e.target.value);
                  onUpdateReminders({
                    ...reminders,
                    wakeUpTime: derived.wakeUpTime,
                    breakfast: derived.breakfast,
                    lunch: derived.lunch,
                    dinner: derived.dinner,
                  });
                }}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b]"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{t(language, 'breakfast')}</label>
              <input
                type="time"
                value={reminders.breakfast}
                onChange={(e) => onUpdateReminders({ ...reminders, breakfast: e.target.value })}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b]"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{t(language, 'lunch')}</label>
              <input
                type="time"
                value={reminders.lunch}
                onChange={(e) => onUpdateReminders({ ...reminders, lunch: e.target.value })}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b]"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{t(language, 'dinner')}</label>
              <input
                type="time"
                value={reminders.dinner}
                onChange={(e) => onUpdateReminders({ ...reminders, dinner: e.target.value })}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b]"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{isHi ? 'पानी (मिनट)' : 'Water every'}</label>
              <select
                value={reminders.waterIntervalMin}
                onChange={(e) => onUpdateReminders({ ...reminders, waterIntervalMin: Number(e.target.value) })}
                className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b]"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>
          {(() => {
            const wr = { ...DEFAULT_WORKOUT_REMINDERS, ...(reminders.workoutReminders || {}) };
            const times = computeWorkoutSnackTriggerTimes({
              plannedWorkoutTime: wr.plannedWorkoutTime,
              workoutDurationMin: wr.workoutDurationMin,
              preWorkoutOffsetMin: wr.preWorkoutOffsetMin,
              postWorkoutOffsetMin: wr.postWorkoutOffsetMin,
            });
            const updateWr = (patch: Partial<typeof wr>) =>
              onUpdateReminders({ ...reminders, workoutReminders: { ...wr, ...patch } });
            return (
              <div className="pt-2 border-t border-slate-100 dark:border-emerald-950 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">
                    {isHi ? 'वर्कआउट समय (Coach)' : 'Planned Workout (Coach)'}
                  </label>
                  <input
                    type="time"
                    value={wr.plannedWorkoutTime}
                    onChange={(e) => e.target.value && updateWr({ plannedWorkoutTime: e.target.value })}
                    className="w-full min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b]"
                  />
                </div>
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40 cursor-pointer">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {isHi ? 'प्री-वर्कआउट स्नैक' : 'Pre-Workout Snack'}
                    </div>
                    <div className="font-mono-num text-[11px] text-amber-700 dark:text-amber-400">
                      {times.preWorkoutTime} (-{wr.preWorkoutOffsetMin}m)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wr.preWorkoutEnabled}
                    onChange={(e) => updateWr({ preWorkoutEnabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40 cursor-pointer">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {isHi ? 'पोस्ट-वर्कआउट स्नैक' : 'Post-Workout Snack'}
                    </div>
                    <div className="font-mono-num text-[11px] text-emerald-700 dark:text-emerald-400">
                      {times.postWorkoutTime} (+{wr.postWorkoutOffsetMin}m)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={wr.postWorkoutEnabled}
                    onChange={(e) => updateWr({ postWorkoutEnabled: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                </label>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-emerald-950 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reminders.soundEnabled !== false}
                onChange={(e) => onUpdateReminders({ ...reminders, soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              <span>{isHi ? 'अलार्म ध्वनि चालू रखें' : 'Play alarm chime sound'}</span>
            </label>
            <button
              type="button"
              onClick={onTestAlarm}
              className="min-h-[34px] px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold"
            >
              {isHi ? 'अलार्म टेस्ट करें' : 'Test Alarm Now'}
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid (2-col on lg+, stacked on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Primary Focal Anchor (Calories + Body Need + BMI Bar + Macro Rings + Smart Suggestion) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Hero Calorie, Body Need & Macro Card */}
          <section className="bg-gradient-to-br from-white via-white to-emerald-50/40 dark:from-[#111a15] dark:via-[#111a15] dark:to-emerald-950/30 rounded-3xl border border-slate-200/90 dark:border-emerald-900/60 p-5 sm:p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <CalorieHeroRing
                eaten={totals.calories}
                target={profile.dailyCalorieTarget}
                burned={metrics.exerciseCalories}
                labelRemaining={t(language, 'caloriesRemaining')}
                labelOver={isHi ? 'अधिक' : 'Over'}
                labelTarget={t(language, 'caloriesTarget')}
              />

              <div className="flex-1 w-full grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50">
                  <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                    {t(language, 'bodyNeedCalories')} (TDEE)
                  </div>
                  <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {profile.tdee} <span className="text-xs font-normal text-slate-500">kcal</span>
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                    BMR {profile.bmr} kcal/day
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t(language, 'caloriesTarget')}
                  </div>
                  <div className="font-mono-num text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {profile.dailyCalorieTarget} <span className="text-xs font-normal text-slate-500">kcal</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {profile.currentWeightKg} → {profile.targetWeightKg} kg
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t(language, 'caloriesEaten')}
                  </div>
                  <div className="font-mono-num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {totals.calories} <span className="text-xs font-normal text-slate-500">kcal</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t(language, 'caloriesBurned')}
                  </div>
                  <div className="font-mono-num text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {metrics.exerciseCalories} <span className="text-xs font-normal text-slate-500">kcal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Macro Rings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SmallMacroRing
                label={t(language, 'protein')}
                current={totals.protein}
                target={profile.proteinTargetG}
                colorClass="stroke-emerald-600 dark:stroke-emerald-400"
              />
              <SmallMacroRing
                label={t(language, 'carbs')}
                current={totals.carbs}
                target={profile.carbsTargetG}
                colorClass="stroke-sky-500 dark:stroke-sky-400"
              />
              <SmallMacroRing
                label={t(language, 'fat')}
                current={totals.fat}
                target={profile.fatTargetG}
                colorClass="stroke-amber-500 dark:stroke-amber-400"
              />
              <SmallMacroRing
                label={t(language, 'fiber')}
                current={totals.fiber}
                target={profile.fiberTargetG}
                colorClass="stroke-teal-500 dark:stroke-teal-400"
              />
            </div>
          </section>

          {/* Daily Macro Distribution Doughnut Chart (Recharts) */}
          <MacroDistributionChart
            language={language}
            carbsG={totals.carbs}
            proteinG={totals.protein}
            fatG={totals.fat}
            carbsTargetG={profile.carbsTargetG}
            proteinTargetG={profile.proteinTargetG}
            fatTargetG={profile.fatTargetG}
            itemCount={dayLogs.length}
            onLogFood={onOpenLogger}
          />

          {/* BMI Scale Bar Card highlighting user's exact position */}
          <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  {t(language, 'bmiStatus')} · <span className="font-mono-num">{safeBmi.toFixed(1)}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                  {Number(Number(profile.heightCm).toFixed(2))} cm · {Number(Number(profile.currentWeightKg).toFixed(1))} kg
                </p>
              </div>
              <span className={`text-xs font-bold ${bmiStatus.tone}`}>{bmiStatus.label}</span>
            </div>

            {/* BMI Visual Bar with User Position Marker */}
            <div className="relative pt-7 pb-1">
              {/* Highlighted User Marker Pin */}
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                style={{ left: `${bmiPct}%` }}
              >
                <span className="px-2 py-0.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono-num text-[11px] font-bold whitespace-nowrap shadow-sm">
                  {isHi ? 'आप' : 'You'}: {safeBmi.toFixed(1)}
                </span>
                <span className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-white" />
              </div>

              {/* Segmented BMI Spectrum Track (14 -> 38) */}
              <div className="relative h-4 w-full rounded-full overflow-hidden flex bg-stone-100 dark:bg-[#090e0b]">
                {/* Underweight: 14 to 18.5 = 4.5 / 24 = 18.75% */}
                <div className="h-full bg-sky-400" style={{ width: '18.75%' }} title="Underweight <18.5" />
                {/* Normal: 18.5 to 25 = 6.5 / 24 = 27.08% */}
                <div className="h-full bg-emerald-500" style={{ width: '27.08%' }} title="Normal 18.5–24.9" />
                {/* Overweight: 25 to 30 = 5 / 24 = 20.83% */}
                <div className="h-full bg-amber-400" style={{ width: '20.83%' }} title="Overweight 25–29.9" />
                {/* Obese: 30 to 38 = 8 / 24 = 33.34% */}
                <div className="h-full bg-rose-500" style={{ width: '33.34%' }} title="Obese 30+" />

                {/* Active vertical thumb line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-slate-950 dark:bg-white ring-2 ring-white dark:ring-slate-900 rounded-full -translate-x-1/2"
                  style={{ left: `${bmiPct}%` }}
                />
              </div>

              {/* Scale Ticks & Labels */}
              <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-500 dark:text-slate-400 mt-1.5">
                <span>14</span>
                <span>18.5 ({isHi ? 'कम' : 'Under'})</span>
                <span>25 ({isHi ? 'सामान्य' : 'Normal'})</span>
                <span>30 ({isHi ? 'अधिक' : 'Over'})</span>
                <span>38+</span>
              </div>
            </div>
          </section>

          {/* AI Meal Analysis & Daily Nutrition Score */}
          <MealAnalysisSummaryCard
            activeDate={activeDate}
            language={language}
            profile={profile}
            totals={totals}
            dayLogs={dayLogs}
            onOpenLogger={onOpenLogger}
          />

          {/* Smart AI Suggestion Banner */}
          <section className="bg-emerald-50/80 dark:bg-emerald-950/30 rounded-3xl border border-emerald-200 dark:border-emerald-900/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                {t(language, 'smartSuggestionTitle')}
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                {activeIdea.suggestionText}
              </p>
              <p className="text-xs font-mono-num text-slate-600 dark:text-slate-400">
                {activeIdea.calories} kcal · P {activeIdea.protein}g · C {activeIdea.carbs}g · F {activeIdea.fat}g
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={ideaLoading}
                onClick={fetchAiSuggestion}
                aria-label="Refresh meal idea"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white dark:bg-[#111a15] border border-emerald-200 dark:border-emerald-800 flex items-center justify-center hover:bg-emerald-100/50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-700 dark:text-emerald-400 ${ideaLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onQuickLogSuggestion(activeIdea)}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap transition-colors"
              >
                {t(language, 'logThisIdea')}
              </button>
            </div>
          </section>

          {/* Meal Slots */}
          <section className="space-y-3">
            {(['breakfast', 'lunch', 'snacks', 'dinner'] as MealType[]).map((slot) => {
              const slotItems = dayLogs.filter((l) => l.mealType === slot);
              const slotCals = slotItems.reduce((s, x) => s + x.calories, 0);
              return (
                <div
                  key={slot}
                  className="bg-white dark:bg-[#111a15] rounded-2xl border border-slate-200/80 dark:border-emerald-900/50 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display font-semibold text-base">{t(language, slot)}</h3>
                      <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        {slotCals} kcal · {slotItems.length} {isHi ? 'आइटम' : slotItems.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenLogger(slot)}
                        className="min-h-[44px] px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {t(language, 'addFood')}
                      </button>
                    </div>
                  </div>

                  {slotItems.length > 0 && (
                    <div className="divide-y divide-slate-100 dark:divide-emerald-950/60 pt-1">
                      {slotItems.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {item.foodName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                              {item.servingQty} {item.servingUnit} ({item.grams}g) · P {item.protein}g · C {item.carbs}g · F{' '}
                              {item.fat}g
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono-num text-sm font-semibold">{item.calories} kcal</span>
                            <button
                              type="button"
                              onClick={() => onDeleteLog(item.id)}
                              aria-label="Delete entry"
                              className="min-h-[40px] min-w-[40px] rounded-lg text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        {/* Right Column: Water Tracker + Steps & Exercise */}
        <div className="lg:col-span-5 space-y-5">
          {/* Water Intake Card */}
          <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">{t(language, 'waterTracker')}</h3>
                  <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                    {metrics.waterMl} / {metrics.waterGoalMl} ml
                  </p>
                </div>
              </div>
              <span
                className={`font-mono-num text-xs font-bold px-2.5 py-1 rounded-lg ${
                  waterPct >= 100
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                }`}
              >
                {waterPct}%
              </span>
            </div>

            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-stone-50/80 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
              <WaterProgressRing
                waterMl={metrics.waterMl}
                waterGoalMl={metrics.waterGoalMl}
                labelGoalReached={isHi ? 'लक्ष्य पूर्ण' : 'Goal Met'}
                labelOfGoal={isHi ? 'दैनिक लक्ष्य' : 'of daily goal'}
              />

              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {isHi ? 'आज पिया गया पानी' : 'Consumed Today'}
                  </div>
                  <div className="font-mono-num text-lg font-bold text-slate-900 dark:text-white">
                    {(metrics.waterMl / 1000).toFixed(2)} L
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {metrics.waterMl >= metrics.waterGoalMl
                      ? isHi
                        ? 'बधाई! दैनिक हाइड्रेशन पूर्ण'
                        : 'Hydration Goal Reached'
                      : isHi
                      ? 'शेष लक्ष्य'
                      : 'Remaining to Goal'}
                  </div>
                  <div className="font-mono-num text-xs font-semibold text-sky-600 dark:text-sky-400">
                    {metrics.waterMl >= metrics.waterGoalMl
                      ? `+${metrics.waterMl - metrics.waterGoalMl} ml ${isHi ? 'अतिरिक्त' : 'extra'}`
                      : `${Math.max(0, metrics.waterGoalMl - metrics.waterMl)} ml`}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addWater(-250)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/50 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-emerald-950/30"
              >
                -250 ml
              </button>
              <button
                type="button"
                onClick={() => addWater(250)}
                className="flex-1 min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
              >
                {t(language, 'addWater')}
              </button>
              <button
                type="button"
                onClick={() => addWater(500)}
                className="min-h-[44px] px-4 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-semibold"
              >
                +500 ml
              </button>
            </div>

            {/* Water Drinking Alarm Schedule Anchored to Wake-Up Time */}
            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-900/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {waterAlarmsOn ? (
                    <AlarmClock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {isHi ? 'पानी पीने का अलार्म शेड्यूल' : 'Water Drinking Alarm'}
                    </div>
                    <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 truncate">
                      {waterAlarmsOn && nextWaterAlarm
                        ? `${isHi ? 'अगला' : 'Next'} ${nextWaterAlarm.slot.time} (${
                            Math.floor(nextWaterAlarm.minutesUntil / 60) > 0
                              ? `${Math.floor(nextWaterAlarm.minutesUntil / 60)}h ${nextWaterAlarm.minutesUntil % 60}m`
                              : `${nextWaterAlarm.minutesUntil}m`
                          }) · +${nextWaterAlarm.slot.waterMl}ml`
                        : isHi
                        ? 'पानी अलार्म बंद हैं'
                        : 'Water alarms paused'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => (onTestWaterAlarm ? onTestWaterAlarm() : onTestAlarm())}
                    className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-[#111a15] border border-sky-200 dark:border-sky-800 text-[11px] font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1 whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isHi ? 'टेस्ट' : 'Test'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!waterAlarmsOn) {
                        onEnableAlarms();
                      } else {
                        onUpdateReminders({ ...reminders, waterAlarmsEnabled: false });
                      }
                    }}
                    className={`min-h-[36px] px-3 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      waterAlarmsOn
                        ? 'bg-sky-600 text-white'
                        : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {waterAlarmsOn
                      ? isHi
                        ? 'अलार्म चालू'
                        : 'Alarm ON'
                      : isHi
                      ? 'अलार्म चालू करें'
                      : 'Enable Alarm'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {isHi ? 'उठने का समय' : 'Wake-Up Time'}
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const derived = deriveMealTimesFromWakeUp(e.target.value);
                      onUpdateReminders({
                        ...reminders,
                        wakeUpTime: derived.wakeUpTime,
                        breakfast: derived.breakfast,
                        lunch: derived.lunch,
                        dinner: derived.dinner,
                      });
                    }}
                    className="w-full min-h-[38px] px-2.5 rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-white dark:bg-[#111a15] font-mono-num text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {isHi ? 'हर कितने समय में' : 'Remind Every'}
                  </label>
                  <select
                    value={reminders.waterIntervalMin}
                    onChange={(e) => onUpdateReminders({ ...reminders, waterIntervalMin: Number(e.target.value) })}
                    className="w-full min-h-[38px] px-2.5 rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-white dark:bg-[#111a15] text-xs font-semibold"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
              </div>

              {/* Scrollable Wake-Up-Anchored Water Alarm Times */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {waterSlots.map((slot) => {
                  const done = completedSlotIds.includes(slot.id);
                  const isNext = nextWaterAlarm?.slot.id === slot.id && !done;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onToggleScheduleSlot(slot)}
                      title={`${slot.time} · ${isHi ? slot.titleHi : slot.titleEn} (+${slot.waterMl}ml)`}
                      className={`min-h-[36px] px-2.5 rounded-xl border text-[11px] font-mono-num font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                        done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isNext
                          ? 'bg-sky-600 border-sky-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-[#111a15] border-sky-200/80 dark:border-sky-900/50 text-slate-700 dark:text-slate-300 hover:border-sky-400'
                      }`}
                    >
                      {done && <Check className="w-3 h-3 shrink-0" />}
                      <span>{slot.time}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Steps & Exercise Card */}
          <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Footprints className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">{t(language, 'stepsAndActivity')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {profile.healthSyncEnabled
                      ? isHi
                        ? 'Google Fit / Apple Health सिंक सक्रिय'
                        : 'Google Fit / Apple Health connected'
                      : isHi
                      ? 'मैन्युअल और सिंक ट्रैकिंग'
                      : 'Manual & Health Sync'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExercisePicker((v) => !v)}
                className="min-h-[44px] px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1"
              >
                <Activity className="w-3.5 h-3.5" />
                {isHi ? 'व्यायाम जोड़ें' : 'Log Workout'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
                <div className="text-xs text-slate-500">{isHi ? 'कदम' : 'Steps'}</div>
                <div className="font-mono-num text-xl font-bold mt-0.5">{metrics.steps.toLocaleString()}</div>
                <button
                  type="button"
                  onClick={() => addStepsOrExercise(2000, 75)}
                  className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  +2,000 {isHi ? 'कदम' : 'steps'}
                </button>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
                <div className="text-xs text-slate-500">{isHi ? 'एक्सरसाइज बर्न' : 'Exercise Burned'}</div>
                <div className="font-mono-num text-xl font-bold mt-0.5">{metrics.exerciseCalories} kcal</div>
                <button
                  type="button"
                  onClick={() => addStepsOrExercise(3500, 140)}
                  className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {isHi ? 'हेल्थ सिंक (+3.5k)' : 'Sync Health (+3.5k)'}
                </button>
              </div>
            </div>

            {showExercisePicker && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-emerald-950">
                {[
                  [isHi ? '30 मिनट तेज़ चलना' : '30m Brisk Walk', 3600, 145],
                  [isHi ? '30 मिनट सूर्य नमस्कार / योग' : '30m Yoga / Mobility', 400, 110],
                  [isHi ? '45 मिनट जिम स्ट्रेंथ' : '45m Strength Training', 900, 240],
                  [isHi ? '30 मिनट साइकिलिंग' : '30m Cycling', 1200, 220],
                ].map(([lbl, stp, cal]) => (
                  <button
                    key={String(lbl)}
                    type="button"
                    onClick={() => addStepsOrExercise(Number(stp), Number(cal))}
                    className="min-h-[44px] p-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/50 text-left hover:border-emerald-500 transition-colors"
                  >
                    <div className="text-xs font-semibold">{String(lbl)}</div>
                    <div className="font-mono-num text-[11px] text-emerald-600 dark:text-emerald-400">+{cal} kcal</div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Sports & Daily Calorie Burn Tracker */}
          <ActivityBurnTracker
            uid={profile.uid}
            activeDate={activeDate}
            weightKg={profile.currentWeightKg}
            language={language}
            activities={activities}
            onAddActivity={onAddActivity}
            onDeleteActivity={onDeleteActivity}
          />

          {/* Daily Eating & Hydration Schedule */}
          <DailyScheduleCard
            language={language}
            reminders={reminders}
            waterGoalMl={metrics.waterGoalMl}
            completedSlotIds={completedSlotIds}
            onToggleSlot={onToggleScheduleSlot}
            onOpenMealLogger={onOpenLogger}
            onUpdateReminders={onUpdateReminders}
            onTestAlarm={onTestAlarm}
            onEnableAlarms={onEnableAlarms}
          />
        </div>
      </div>
    </div>
  );
};
