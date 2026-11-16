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
  const [mealError, setMealError] = useState<string | null>(null);

  const [workoutMode, setWorkoutMode] = useState<'home' | 'gym'>(workoutPlan?.mode || 'home');
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [workoutImgError, setWorkoutImgError] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const generateMealPlan = async () => {
    setMealLoading(true);
    setMealError(null);
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
            goalType: profile.goalType,
            language,
          },
          budget,
        }),
      });
      if (!ok || !data || !Array.isArray(data.days)) {
        setMealError(data?.error || (isHi ? 'AI मील प्लान अभी उपलब्ध नहीं है।' : 'Could not generate meal plan right now.'));
      } else {
        onSaveMealPlan(data);
        setSelectedDayIdx(0);
      }
    } catch {
      setMealError(isHi ? 'नेटवर्क त्रुटि।' : 'Network error generating plan.');
    } finally {
      setMealLoading(false);
    }
  };

  const generateWorkoutPlan = async () => {
    setWorkoutLoading(true);
    setWorkoutError(null);
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
      if (!ok || !data || !Array.isArray(data.days)) {
        setWorkoutError(data?.error || (isHi ? 'वर्कआउट प्लान अभी उपलब्ध नहीं है।' : 'Could not generate workout plan right now.'));
      } else {
        onSaveWorkoutPlan(data);
      }
    } catch {
      setWorkoutError(isHi ? 'नेटवर्क त्रुटि।' : 'Network error generating workout.');
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

      {/* 7-Day Meal Plan Tab */}
      {subTab === 'meal' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">{t(language, 'mealPlan7Day')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile.dietType.toUpperCase()} · {profile.dailyCalorieTarget} kcal/day · {profile.proteinTargetG}g protein
                {profile.allergies.length > 0 ? ` · Excludes: ${profile.allergies.join(', ')}` : ''}
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

          {mealError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
              {mealError}
            </div>
          )}

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

              {activeDay && (
                <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-emerald-950">
                    <h3 className="font-display font-bold text-base">{activeDay.day}</h3>
                    <span className="font-mono-num text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      {activeDay.totalCalories} kcal · {activeDay.estimatedCostInr}
                    </span>
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
                          <span className="font-mono-num text-xs text-slate-600 dark:text-slate-300">
                            {meal.calories} kcal · P {meal.protein}g
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
                            className="min-h-[38px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
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
                  {isHi ? 'आपका 7-दिन का प्लान तैयार है' : 'Generate Your 7-Day Personalized Menu'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isHi
                    ? 'अपना बजट चुनें और AI कोच से अपने आहार, एलर्जी और कैलोरी लक्ष्य के अनुसार 7 दिन का भारतीय व संतुलित मील प्लान प्राप्त करें।'
                    : 'Choose your grocery budget tier and generate a complete 7-day Indian and global menu tailored to your calories, protein, diet preference, and allergies.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workout Plans Tab */}
      {subTab === 'workout' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">{t(language, 'workoutPlans')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile.goalType.toUpperCase()} · {profile.activityLevel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex p-1 bg-stone-100 dark:bg-[#090e0b] rounded-xl">
                <button
                  type="button"
                  onClick={() => setWorkoutMode('home')}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold ${
                    workoutMode === 'home' ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t(language, 'homeWorkout')}
                </button>
                <button
                  type="button"
                  onClick={() => setWorkoutMode('gym')}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold ${
                    workoutMode === 'gym' ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t(language, 'gymWorkout')}
                </button>
              </div>
              <button
                type="button"
                disabled={workoutLoading}
                onClick={generateWorkoutPlan}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                {workoutLoading ? (isHi ? 'तैयार...' : 'Building...') : t(language, 'generatePlan')}
              </button>
            </div>
          </div>

          {workoutError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-200">
              {workoutError}
            </div>
          )}

          {workoutPlan && workoutPlan.days?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workoutPlan.days.map((day, i) => (
                <div
                  key={`${day.day}_${i}`}
                  className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-emerald-950">
                    <div>
                      <h3 className="font-display font-bold text-base">{day.day}</h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{day.focus}</p>
                    </div>
                    <span className="font-mono-num text-xs text-slate-500">{day.durationMin} min</span>
                  </div>
                  <div className="space-y-2.5">
                    {day.exercises.map((ex, j) => (
                      <div key={`${ex.name}_${j}`} className="p-3 rounded-xl bg-stone-50 dark:bg-[#090e0b]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{ex.name}</span>
                          <span className="font-mono-num text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {ex.setsReps}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Rest {ex.restSec}s · ~{ex.caloriesEstimate} kcal · {ex.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
                  {isHi ? 'होम या जिम वर्कआउट प्लान बनाएं' : 'Simple Home & Gym Training Splits'}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isHi
                    ? 'घर पर बिना उपकरण या जिम में वेट ट्रेनिंग के लिए अपने लक्ष्य के अनुसार 5-दिन का प्लान पाएं।'
                    : 'Switch between Home (no-equipment) and Gym routines calibrated to your weight loss, maintenance, or muscle gain goal.'}
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
