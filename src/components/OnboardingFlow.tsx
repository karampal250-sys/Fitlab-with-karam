import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Globe, Moon, ShieldCheck, Sunrise, Utensils } from 'lucide-react';
import type { ActivityLevel, DietType, Gender, Language, UserProfile } from '../types/fitplate';
import { calculateNutritionPlan } from '../utils/nutritionMath';
import { deriveMealTimesFromWakeUp, isNightShiftWakeTime } from '../data/activitiesCatalog';
import { t } from '../i18n/translations';

interface OnboardingFlowProps {
  initialProfile?: UserProfile | null;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  onComplete: (profile: UserProfile) => void;
  onCancel?: () => void;
  onGoogleSignIn?: () => void;
  isSignedIn?: boolean;
  userEmail?: string | null;
}

const ALLERGY_OPTIONS = ['Dairy', 'Nuts', 'Gluten', 'Soy', 'Eggs', 'Fish', 'Shellfish'];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialProfile,
  language,
  onChangeLanguage,
  onComplete,
  onCancel,
  onGoogleSignIn,
  isSignedIn,
  userEmail,
}) => {
  const [name, setName] = useState(initialProfile?.name || 'Aarav');
  const [age, setAge] = useState(initialProfile?.age || 28);
  const [gender, setGender] = useState<Gender>(initialProfile?.gender || 'male');
  const [heightCm, setHeightCm] = useState(initialProfile?.heightCm || 173);
  const [currentWeightKg, setCurrentWeightKg] = useState(initialProfile?.currentWeightKg || 78);
  const [targetWeightKg, setTargetWeightKg] = useState(initialProfile?.targetWeightKg || 70);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initialProfile?.activityLevel || 'moderate');
  const [dietType, setDietType] = useState<DietType>(initialProfile?.dietType || 'veg');
  const [allergies, setAllergies] = useState<string[]>(initialProfile?.allergies || []);
  const [customAllergy, setCustomAllergy] = useState('');
  const [timelineWeeks, setTimelineWeeks] = useState(initialProfile?.timelineWeeks || 12);
  const [wakeUpTime, setWakeUpTime] = useState(initialProfile?.wakeUpTime || '07:00');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);
  const [heroImgError, setHeroImgError] = useState(false);

  const calc = useMemo(
    () =>
      calculateNutritionPlan({
        age: Math.max(13, Math.min(120, Number(age) || 25)),
        gender,
        heightCm: Math.max(90, Math.min(250, Number(heightCm) || 170)),
        currentWeightKg: Math.max(25, Math.min(350, Number(currentWeightKg) || 70)),
        targetWeightKg: Math.max(25, Math.min(350, Number(targetWeightKg) || 65)),
        activityLevel,
        dietType,
        timelineWeeks: Math.max(1, Math.min(260, Number(timelineWeeks) || 12)),
      }),
    [age, gender, heightCm, currentWeightKg, targetWeightKg, activityLevel, dietType, timelineWeeks]
  );

  const toggleAllergy = (item: string) => {
    setAllergies((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev, trimmed]);
      setCustomAllergy('');
    }
  };

  const buildProfilePayload = (): UserProfile => ({
    uid: initialProfile?.uid || 'local_user',
    name: name.trim() || 'Karam User',
    age: Math.max(13, Math.min(120, Math.round(age))),
    gender,
    heightCm: Number(heightCm),
    currentWeightKg: Number(currentWeightKg),
    targetWeightKg: Number(targetWeightKg),
    activityLevel,
    dietType,
    allergies,
    timelineWeeks: Math.max(1, Math.round(timelineWeeks)),
    goalType: calc.goalType,
    bmi: calc.bmi,
    bmr: calc.bmr,
    tdee: calc.tdee,
    dailyCalorieTarget: calc.dailyCalorieTarget,
    proteinTargetG: calc.proteinTargetG,
    carbsTargetG: calc.carbsTargetG,
    fatTargetG: calc.fatTargetG,
    fiberTargetG: calc.fiberTargetG,
    language,
    darkMode: initialProfile?.darkMode ?? false,
    healthSyncEnabled: initialProfile?.healthSyncEnabled ?? false,
    wakeUpTime,
    reminders: {
      ...deriveMealTimesFromWakeUp(wakeUpTime),
      waterIntervalMin: initialProfile?.reminders?.waterIntervalMin ?? 90,
      enabled: initialProfile?.reminders?.enabled ?? true,
      alarmsEnabled: initialProfile?.reminders?.alarmsEnabled ?? true,
      soundEnabled: initialProfile?.reminders?.soundEnabled ?? true,
    },
    encryptionEnabled: true,
    under18Acknowledged: age < 18,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disclaimerAccepted || !name.trim()) return;
    onComplete(buildProfilePayload());
  };

  const isHi = language === 'hi';

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#090e0b] text-slate-900 dark:text-slate-100 py-5 px-4 sm:px-6 lg:px-8 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Compact Responsive Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Back"
                className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] flex items-center justify-center shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
              FK
            </div>
            <span className="font-display font-bold text-base sm:text-xl tracking-tight truncate">Fit-Plat with Karam</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeLanguage(isHi ? 'en' : 'hi')}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-emerald-950/50 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isHi ? 'English' : 'हिन्दी'}
            </button>
            {onGoogleSignIn && !isSignedIn && (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                {t(language, 'signInGoogle')}
              </button>
            )}
            {isSignedIn && userEmail && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium truncate max-w-[160px]">
                {userEmail}
              </span>
            )}
            {!onCancel && (
              <button
                type="button"
                onClick={() => onComplete(buildProfilePayload())}
                className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isHi ? 'सीधे शुरू करें' : 'Quick Start'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tracking-wide">
                {isHi ? 'व्यक्तिगत पोषण योजनाकार' : 'Personal Nutrition & Goal Engine'}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                {t(language, 'onboardingTitle')}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                {t(language, 'onboardingSubtitle')}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100 dark:border-emerald-950">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">BMI</div>
                <div className="font-mono-num text-xl font-bold mt-0.5">{calc.bmi}</div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 capitalize">{calc.bmiCategory}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">BMR</div>
                <div className="font-mono-num text-xl font-bold mt-0.5">{calc.bmr}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">kcal / day</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">TDEE</div>
                <div className="font-mono-num text-xl font-bold mt-0.5">{calc.tdee}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">maintenance</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isHi ? 'दैनिक लक्ष्य' : 'Daily Target'}
                </div>
                <div className="font-mono-num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {calc.dailyCalorieTarget}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {calc.goalType === 'lose'
                    ? t(language, 'goalLose')
                    : calc.goalType === 'gain'
                    ? t(language, 'goalGain')
                    : t(language, 'goalMaintain')}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 min-h-[220px] relative">
            {!heroImgError ? (
              <img
                src="/src/assets/images/fitplate_hero_thali_1794826405362.jpg"
                alt="Balanced Indian thali with whole wheat rotis, dal tadka, and palak paneer"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-emerald-800 dark:text-emerald-200">
                <Utensils className="w-10 h-10 mb-2" />
                <span className="font-display font-semibold text-sm">Balanced Indian & Global Meals</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-6 sm:p-8 space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'आपका नाम' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'आयु (वर्ष)' : 'Age (years)'}
              </label>
              <input
                type="number"
                min={13}
                max={100}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'लिंग' : 'Gender'}
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 dark:bg-[#090e0b] rounded-xl">
                {(['female', 'male', 'other'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`min-h-[38px] rounded-lg text-xs font-semibold capitalize transition-colors ${
                      gender === g
                        ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {g === 'female' ? (isHi ? 'महिला' : 'Female') : g === 'male' ? (isHi ? 'पुरुष' : 'Male') : isHi ? 'अन्य' : 'Other'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'लंबाई (cm)' : 'Height (cm)'}
              </label>
              <input
                type="number"
                min={100}
                max={240}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'वर्तमान वज़न (kg)' : 'Current Weight (kg)'}
              </label>
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'लक्ष्य वज़न (kg)' : 'Target Weight (kg)'}
              </label>
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'समयसीमा (सप्ताह)' : 'Timeline (weeks)'}
              </label>
              <input
                type="number"
                min={1}
                max={156}
                value={timelineWeeks}
                onChange={(e) => setTimelineWeeks(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'गतिविधि स्तर' : 'Activity Level'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-stone-100 dark:bg-[#090e0b] rounded-xl">
                {(
                  [
                    ['sedentary', isHi ? 'कम सक्रिय' : 'Sedentary'],
                    ['light', isHi ? 'हल्की' : 'Light'],
                    ['moderate', isHi ? 'मध्यम' : 'Moderate'],
                    ['active', isHi ? 'सक्रिय' : 'Active'],
                    ['very_active', isHi ? 'अधिक' : 'Athlete'],
                  ] as [ActivityLevel, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setActivityLevel(val)}
                    className={`min-h-[38px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      activityLevel === val
                        ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Wake-Up Time & Shift Schedule */}
          <div className="pt-2 border-t border-slate-100 dark:border-emerald-950 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  {isNightShiftWakeTime(wakeUpTime) ? (
                    <Moon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Sunrise className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {isHi ? 'उठने का समय (Day / Night Shift)' : 'Daily Wake-Up Time (Day or Night Shift)'}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isHi
                    ? 'नाइट शिफ्ट या डे शिफ्ट — आपका पूरा भोजन, पानी और अलार्म शेड्यूल आपके उठने के समय के अनुसार बनेगा।'
                    : 'Working night shift or day shift? Your meal, water, workout & alarm schedule adapts around when you wake up.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  value={wakeUpTime}
                  onChange={(e) => e.target.value && setWakeUpTime(e.target.value)}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ['06:30', isHi ? 'सुबह जल्दी (06:30)' : 'Early Morning (06:30)'],
                  ['07:00', isHi ? 'सामान्य दिन (07:00)' : 'Day Shift (07:00)'],
                  ['14:00', isHi ? 'दोपहर शिफ्ट (14:00)' : 'Afternoon Shift (14:00)'],
                  ['20:00', isHi ? 'नाइट शिफ्ट (20:00)' : 'Night Shift (20:00)'],
                ] as [string, string][]
              ).map(([presetTime, presetLabel]) => (
                <button
                  key={presetTime}
                  type="button"
                  onClick={() => setWakeUpTime(presetTime)}
                  className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    wakeUpTime === presetTime
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-50 dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {presetLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Diet Type */}
          <div className="pt-2 border-t border-slate-100 dark:border-emerald-950">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {isHi ? 'आहार का प्रकार' : 'Diet Preference'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ['veg', isHi ? 'शाकाहारी (Veg)' : 'Vegetarian'],
                  ['eggetarian', isHi ? 'अंडा-शाकाहारी' : 'Eggetarian'],
                  ['non-veg', isHi ? 'मांसाहारी (Non-Veg)' : 'Non-Vegetarian'],
                  ['vegan', isHi ? 'वीगन (Vegan)' : 'Vegan'],
                ] as [DietType, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDietType(val)}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    dietType === val
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-50 dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {isHi ? 'एलर्जी / परहेज (वैकल्पिक)' : 'Food Allergies / Exclusions (optional)'}
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {ALLERGY_OPTIONS.map((item) => {
                const active = allergies.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAllergy(item)}
                    className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-600 text-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-50 dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {active ? `✓ ${item}` : item}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 max-w-sm">
              <input
                type="text"
                placeholder={isHi ? 'अन्य एलर्जी जोड़ें...' : 'Add custom allergy...'}
                value={customAllergy}
                onChange={(e) => setCustomAllergy(e.target.value)}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs"
              />
              <button
                type="button"
                onClick={handleAddCustomAllergy}
                className="min-h-[44px] px-4 rounded-xl bg-slate-200 dark:bg-emerald-900/60 text-xs font-semibold"
              >
                {isHi ? 'जोड़ें' : 'Add'}
              </button>
            </div>
          </div>

          {/* Safety Limit Alert if goal is unrealistic */}
          {calc.isUnrealistic && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                  <div className="font-semibold">{t(language, 'safetyWarningTitle')}</div>
                  <p>
                    {isHi
                      ? `यह समयसीमा सुरक्षित सीमा (0.5–1 किग्रा/सप्ताह, न्यूनतम ${calc.minSafeCalories} kcal) से अधिक है। हमने आपका लक्ष्य सुरक्षित ${calc.dailyCalorieTarget} kcal पर सीमित कर दिया है और ${calc.suggestedWeeks} सप्ताह की सलाह दी है।`
                      : `This timeline exceeds safe limits (max 0.5–1 kg/week loss, minimum ${calc.minSafeCalories} kcal/day). We capped your target at a safe ${calc.dailyCalorieTarget} kcal/day and recommend ${calc.suggestedWeeks} weeks.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTimelineWeeks(calc.suggestedWeeks)}
                className="min-h-[44px] px-4 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0"
              >
                {t(language, 'useSuggestedTimeline')} ({calc.suggestedWeeks}w)
              </button>
            </div>
          )}

          {/* Under-18 Notice */}
          {age < 18 && (
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs sm:text-sm text-sky-900 dark:text-sky-100">
              {isHi
                ? '18 वर्ष से कम आयु के उपयोगकर्ताओं को किसी भी वज़न लक्ष्य से पहले डॉक्टर या माता-पिता से परामर्श लेना चाहिए।'
                : 'Users under 18 should consult a pediatrician or healthcare provider before starting any weight plan.'}
            </div>
          )}

          {/* Macro Summary Strip */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/50 flex flex-wrap items-center justify-between gap-4 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {isHi ? 'दैनिक मैक्रो लक्ष्य' : 'Daily Macro Targets'}
            </span>
            <div className="flex flex-wrap items-center gap-4 font-mono-num text-slate-700 dark:text-slate-200">
              <span>{t(language, 'protein')}: {calc.proteinTargetG}g</span>
              <span aria-hidden="true">·</span>
              <span>{t(language, 'carbs')}: {calc.carbsTargetG}g</span>
              <span aria-hidden="true">·</span>
              <span>{t(language, 'fat')}: {calc.fatTargetG}g</span>
              <span aria-hidden="true">·</span>
              <span>{t(language, 'fiber')}: {calc.fiberTargetG}g</span>
            </div>
          </div>

          {/* Disclaimer + Submit */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-emerald-950">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 accent-emerald-600 rounded"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                {t(language, 'medicalDisclaimer')}
              </span>
            </label>

            <button
              type="submit"
              disabled={!disclaimerAccepted || !name.trim()}
              className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              {t(language, 'saveAndStart')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
