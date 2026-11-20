import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Globe,
  Moon,
  ShieldCheck,
  Sunrise,
  Utensils,
} from 'lucide-react';
import type { ActivityLevel, DietType, Gender, Language, UserProfile } from '../types/fitplate';
import type { SocialPrefillData } from '../services/firebaseClient';
import { calculateNutritionPlan } from '../utils/nutritionMath';
import { deriveMealTimesFromWakeUp, isNightShiftWakeTime } from '../data/activitiesCatalog';
import { t } from '../i18n/translations';
import { BrandLogo } from './BrandLogo';

interface OnboardingFlowProps {
  initialProfile?: UserProfile | null;
  socialPrefill?: SocialPrefillData | null;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  onComplete: (profile: UserProfile) => void;
  onCancel?: () => void;
  onGoogleSignIn?: () => void;
  onFacebookSignIn?: () => void;
  isSignedIn?: boolean;
  userEmail?: string | null;
}

const ALLERGY_OPTIONS = ['Dairy', 'Nuts', 'Gluten', 'Soy', 'Eggs', 'Fish', 'Shellfish'];

export function calculateAgeFromDob(dobStr: string): number | null {
  if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const dob = new Date(`${dobStr}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 5 && age <= 120 ? age : null;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialProfile,
  socialPrefill,
  language,
  onChangeLanguage,
  onComplete,
  onCancel,
  onGoogleSignIn,
  onFacebookSignIn,
  isSignedIn,
  userEmail,
}) => {
  const [name, setName] = useState(initialProfile?.name || socialPrefill?.name || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    initialProfile?.dateOfBirth || socialPrefill?.dateOfBirth || ''
  );
  const [gender, setGender] = useState<Gender>(initialProfile?.gender || 'male');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightInput, setHeightInput] = useState<string>(
    initialProfile?.heightCm ? String(Math.round(initialProfile.heightCm * 100) / 100) : '170'
  );
  const [currentWeightKg, setCurrentWeightKg] = useState<string>(
    initialProfile?.currentWeightKg ? String(initialProfile.currentWeightKg) : ''
  );
  const [targetWeightKg, setTargetWeightKg] = useState<string>(
    initialProfile?.targetWeightKg ? String(initialProfile.targetWeightKg) : ''
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initialProfile?.activityLevel || 'moderate');
  const [dietType, setDietType] = useState<DietType>(initialProfile?.dietType || 'veg');
  const [allergies, setAllergies] = useState<string[]>(initialProfile?.allergies || []);
  const [customAllergy, setCustomAllergy] = useState('');
  const [timelineWeeks, setTimelineWeeks] = useState(initialProfile?.timelineWeeks || 12);
  const [wakeUpTime, setWakeUpTime] = useState(initialProfile?.wakeUpTime || '07:00');
  const [sleepTime, setSleepTime] = useState(
    initialProfile?.sleepTime ||
      deriveMealTimesFromWakeUp(initialProfile?.wakeUpTime || '07:00').sleepTime
  );
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [heroImgError, setHeroImgError] = useState(false);

  // Sync Facebook / Google prefill info when social login completes
  useEffect(() => {
    if (!socialPrefill) return;
    if (socialPrefill.name && !name.trim()) setName(socialPrefill.name);
    if (socialPrefill.dateOfBirth && !dateOfBirth) setDateOfBirth(socialPrefill.dateOfBirth);
  }, [socialPrefill]);

  const computedAge = useMemo(() => {
    const fromDob = calculateAgeFromDob(dateOfBirth);
    if (fromDob !== null) return fromDob;
    return initialProfile?.age || null;
  }, [dateOfBirth, initialProfile?.age]);

  const parsedHeightRaw = parseFloat(heightInput);
  const numericHeightCm = useMemo(() => {
    if (!heightInput.trim() || !Number.isFinite(parsedHeightRaw)) return NaN;
    const cmVal = heightUnit === 'cm' ? parsedHeightRaw : parsedHeightRaw * 30.48;
    return Math.round(cmVal * 100) / 100;
  }, [heightInput, heightUnit, parsedHeightRaw]);

  const previewHeightCm = Number.isFinite(numericHeightCm) ? numericHeightCm : 170;
  const numericCurrentWeight = Number(currentWeightKg) || 70;
  const numericTargetWeight = Number(targetWeightKg) || numericCurrentWeight;
  const effectiveAge = computedAge ?? 25;

  const handleSwitchHeightUnit = (nextUnit: 'cm' | 'ft') => {
    if (nextUnit === heightUnit) return;
    if (heightInput.trim() && Number.isFinite(parsedHeightRaw)) {
      if (nextUnit === 'ft') {
        const ftVal = Math.round((parsedHeightRaw / 30.48) * 100) / 100;
        setHeightInput(String(ftVal));
      } else {
        const cmVal = Math.round(parsedHeightRaw * 30.48 * 10) / 10;
        setHeightInput(String(cmVal));
      }
    }
    setHeightUnit(nextUnit);
  };

  const calc = useMemo(
    () =>
      calculateNutritionPlan({
        age: Math.max(13, Math.min(120, effectiveAge)),
        gender,
        heightCm: Math.max(90, Math.min(250, previewHeightCm)),
        currentWeightKg: Math.max(25, Math.min(350, numericCurrentWeight)),
        targetWeightKg: Math.max(25, Math.min(350, numericTargetWeight)),
        activityLevel,
        dietType,
        timelineWeeks: Math.max(1, Math.min(260, Number(timelineWeeks) || 12)),
      }),
    [effectiveAge, gender, previewHeightCm, numericCurrentWeight, numericTargetWeight, activityLevel, dietType, timelineWeeks]
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
    name: name.trim(),
    ...(dateOfBirth ? { dateOfBirth } : {}),
    age: Math.max(13, Math.min(120, Math.round(effectiveAge))),
    gender,
    heightCm: Math.round(Math.max(90, Math.min(250, previewHeightCm)) * 100) / 100,
    currentWeightKg: numericCurrentWeight,
    targetWeightKg: numericTargetWeight,
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
    sleepTime,
    authProvider: socialPrefill?.provider || initialProfile?.authProvider || 'local',
    reminders: {
      ...deriveMealTimesFromWakeUp(wakeUpTime, sleepTime),
      waterIntervalMin: initialProfile?.reminders?.waterIntervalMin ?? 90,
      enabled: initialProfile?.reminders?.enabled ?? true,
      alarmsEnabled: initialProfile?.reminders?.alarmsEnabled ?? true,
      waterAlarmsEnabled: initialProfile?.reminders?.waterAlarmsEnabled ?? true,
      soundEnabled: initialProfile?.reminders?.soundEnabled ?? true,
    },
    encryptionEnabled: true,
    under18Acknowledged: effectiveAge < 18,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(isHi ? 'कृपया अपना पूरा नाम दर्ज करें।' : 'Please enter your full name.');
      return;
    }
    if (!computedAge || computedAge < 13) {
      setFormError(
        isHi
          ? 'कृपया अपनी सही जन्मतिथि (Date of Birth) चुनें (न्यूनतम 13 वर्ष)।'
          : 'Please enter a valid Date of Birth (minimum age 13 years).'
      );
      return;
    }
    if (!Number.isFinite(numericHeightCm) || numericHeightCm < 90 || numericHeightCm > 250) {
      setFormError(
        isHi
          ? 'कृपया सही लंबाई दर्ज करें (90–250 cm या 3–8.2 ft, दशमलव मान्य है)।'
          : 'Please enter a valid height (90–250 cm or 3–8.2 ft; decimals allowed).'
      );
      return;
    }
    if (!currentWeightKg || Number(currentWeightKg) < 25 || Number(currentWeightKg) > 350) {
      setFormError(isHi ? 'कृपया अपना वर्तमान वज़न (kg) दर्ज करें।' : 'Please enter your current weight (kg).');
      return;
    }
    if (!targetWeightKg || Number(targetWeightKg) < 25 || Number(targetWeightKg) > 350) {
      setFormError(isHi ? 'कृपया अपना लक्ष्य वज़न (kg) दर्ज करें।' : 'Please enter your target weight (kg).');
      return;
    }
    if (!wakeUpTime || !sleepTime) {
      setFormError(isHi ? 'कृपया उठने और सोने का समय चुनें।' : 'Please enter your wake-up and sleep times.');
      return;
    }
    if (!disclaimerAccepted) return;

    onComplete(buildProfilePayload());
  };

  const isHi = language === 'hi';
  const maxDobStr = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#090e0b] text-slate-900 dark:text-slate-100 py-5 px-4 sm:px-6 lg:px-8 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
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
            <BrandLogo size={36} />
            <span className="font-display font-bold text-base sm:text-xl tracking-tight truncate">
              Fit-Plat with Karam
            </span>
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
            {isSignedIn && userEmail && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium truncate max-w-[180px]">
                {userEmail}
              </span>
            )}
          </div>
        </div>

        {/* Social Quick Login Card (Facebook & Google) */}
        {!isSignedIn && (onFacebookSignIn || onGoogleSignIn) && (
          <div className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {isHi
                  ? 'Facebook या Google ID से तुरंत प्रोफ़ाइल भरें'
                  : 'Sign in with Facebook or Google ID'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isHi
                  ? 'Facebook लॉगिन से आपका नाम और जन्मतिथि अपने आप भर जाएगी — बस वज़न, लक्ष्य वज़न और उठने का समय दर्ज करें।'
                  : 'Facebook imports your Name & Date of Birth automatically — then just enter your Weight, Target Weight & Wake-Up Time.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onFacebookSignIn && (
                <button
                  type="button"
                  onClick={onFacebookSignIn}
                  className="min-h-[44px] px-4 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-white text-[#1877F2] font-bold flex items-center justify-center text-xs">
                    f
                  </span>
                  {t(language, 'signInFacebook')}
                </button>
              )}
              {onGoogleSignIn && (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  {t(language, 'signInGoogle')}
                </button>
              )}
            </div>
          </div>
        )}

        {socialPrefill && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-900 dark:text-emerald-100">
            {socialPrefill.provider === 'facebook'
              ? isHi
                ? `Facebook ID से जुड़ गया${socialPrefill.name ? ` (${socialPrefill.name})` : ''}। कृपया अपना वज़न, लक्ष्य वज़न, उठने का समय${
                    socialPrefill.dateOfBirth ? '' : ' और जन्मतिथि'
                  } नीचे भरें।`
                : `Connected with Facebook${socialPrefill.name ? ` (${socialPrefill.name})` : ''}! Please complete your Current Weight, Target Weight, Wake-Up Time${
                    socialPrefill.dateOfBirth ? '' : ', and Date of Birth'
                  } below to create your profile.`
              : isHi
              ? 'Google अकाउंट से जुड़ गया! नीचे अपनी जानकारी भरें और सबमिट करें।'
              : 'Connected with Google! Please complete your profile details below to get started.'}
          </div>
        )}

        {/* Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tracking-wide">
                {isHi ? 'प्रोफ़ाइल सेटअप आवश्यक' : 'Create Your Personal Profile'}
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
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t(language, 'bodyNeedCalories')}
                </div>
                <div className="font-mono-num text-xl font-bold mt-0.5">{calc.tdee}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">TDEE kcal</div>
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

        {/* Profile Creation Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-6 sm:p-8 space-y-6"
        >
          {formError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'आपका पूरा नाम *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                maxLength={80}
                placeholder={isHi ? 'अपना नाम लिखें...' : 'Enter your name...'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Date of Birth with automatic Age display */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {isHi ? 'जन्मतिथि (DOB) *' : 'Date of Birth *'}
                </label>
                {computedAge !== null && (
                  <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {isHi ? `आयु: ${computedAge} वर्ष` : `Age: ${computedAge} yrs`}
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                min="1910-01-01"
                max={maxDobStr}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
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
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {heightUnit === 'cm'
                    ? isHi
                      ? 'लंबाई (cm) *'
                      : 'Height (cm) *'
                    : isHi
                    ? 'लंबाई (ft) *'
                    : 'Height (ft) *'}
                </label>
                <div className="inline-flex p-0.5 rounded-lg bg-stone-100 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/50">
                  {(['cm', 'ft'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => handleSwitchHeightUnit(unit)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                        heightUnit === unit
                          ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                required
                inputMode="decimal"
                step="any"
                min={heightUnit === 'cm' ? 90 : 3}
                max={heightUnit === 'cm' ? 250 : 8.2}
                placeholder={heightUnit === 'cm' ? 'e.g. 172.5' : 'e.g. 5.8'}
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {Number.isFinite(numericHeightCm) && numericHeightCm >= 90 && numericHeightCm <= 250 && (
                <p className="mt-1 text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                  {heightUnit === 'cm'
                    ? `≈ ${(numericHeightCm / 30.48).toFixed(2)} ft`
                    : `= ${Number(numericHeightCm.toFixed(1))} cm`}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'वर्तमान वज़न (kg) *' : 'Current Weight (kg) *'}
              </label>
              <input
                type="number"
                required
                step="0.1"
                min={25}
                max={350}
                placeholder="e.g. 74"
                value={currentWeightKg}
                onChange={(e) => setCurrentWeightKg(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isHi ? 'लक्ष्य वज़न (kg) *' : 'Target Weight (kg) *'}
              </label>
              <input
                type="number"
                required
                step="0.1"
                min={25}
                max={350}
                placeholder="e.g. 68"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
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

          {/* Wake-Up & Sleep Time Schedule */}
          <div className="pt-2 border-t border-slate-100 dark:border-emerald-950 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  {isNightShiftWakeTime(wakeUpTime) ? (
                    <Moon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Sunrise className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {isHi ? 'उठने और सोने का समय * (Day / Night Shift)' : 'Daily Wake-Up & Sleep Time * (Day or Night Shift)'}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isHi
                    ? 'आपका पूरा भोजन, पानी और ऑटोमैटिक नोटिफिकेशन शेड्यूल इसी के अनुसार चलेगा।'
                    : 'Your meal windows and automatic water notifications adapt across your wake-to-sleep schedule.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {isHi ? 'उठना' : 'Wake'}
                  </span>
                  <input
                    type="time"
                    required
                    value={wakeUpTime}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setWakeUpTime(e.target.value);
                    }}
                    className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5" />
                    {isHi ? 'सोना' : 'Sleep'}
                  </span>
                  <input
                    type="time"
                    required
                    value={sleepTime}
                    onChange={(e) => e.target.value && setSleepTime(e.target.value)}
                    className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
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
                  onClick={() => {
                    setWakeUpTime(presetTime);
                    setSleepTime(deriveMealTimesFromWakeUp(presetTime).sleepTime);
                  }}
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
          {effectiveAge < 18 && (
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
              disabled={!disclaimerAccepted}
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
