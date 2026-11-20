import React, { useState } from 'react';
import { Dumbbell, MessageCircle, Plus, Send, Sparkles, Utensils } from 'lucide-react';
import type {
  ChatMessage,
  CoachMealPlan,
  CoachWorkoutPlan,
  Language,
  MealType,
  UserProfile,
} from '../types/fitplate';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';
import { buildLocal5DayWorkoutPlan, buildLocal7DayMealPlan } from '../data/coachPlansCatalog';
import { t } from '../i18n/translations';

interface CoachViewProps {
  profile: UserProfile;
  language: Language;
  eatenTodayCalories: number;
  eatenTodayProtein: number;
  mealPlan: CoachMealPlan | null;
  workoutPlan: CoachWorkoutPlan | null;
  chatMessages: ChatMessage[];
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
  }) => void;
}

type CoachSubTab = 'meal' | 'workout' | 'chat';

export const CoachView: React.FC<CoachViewProps> = ({
  profile,
  language,
  eatenTodayCalories,
  eatenTodayProtein,
  mealPlan,
  workoutPlan,
  chatMessages,
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
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-[#111a15] rounded-2xl border border-slate-200/80 dark:border-emerald-900/50">
        {(
          [
            ['meal', t(language, 'mealPlan7Day'), Utensils],
            ['workout', t(language, 'workoutPlans'), Dumbbell],
            ['chat', t(language, 'dietChat'), MessageCircle],
          ] as [CoachSubTab, string, React.FC<{ className?: string }>][]
        ).map(([id, label, Icon]) => (
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

          {workoutPlan && workoutPlan.days?.length > 0 ? (
            <div className="space-y-4">
              <div className="px-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">{workoutPlan.title}</h3>
                <span className="text-xs font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                  {workoutPlan.days.length} {isHi ? 'दिन / सप्ताह' : 'Days / Week'} · {workoutPlan.mode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workoutPlan.days.map((day, i) => (
                    <div
                      key={`${day.day}_${i}`}
                      className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-emerald-950">
                        <div>
                          <h3 className="font-display font-bold text-base">{day.day}</h3>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{day.focus}</p>
                        </div>
                        <span className="font-mono-num text-xs text-slate-500 shrink-0">{day.durationMin}m</span>
                      </div>

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
                ))}
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
