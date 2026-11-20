import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlarmClock,
  BarChart3,
  BellRing,
  Check,
  Download,
  Globe,
  Home,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sparkles,
  Sun,
  User as UserIcon,
  UserCog,
  UtensilsCrossed,
  Volume2,
  X,
} from 'lucide-react';
import type {
  ActivityLogEntry,
  ChatMessage,
  CoachMealPlan,
  CoachWorkoutPlan,
  DailyMetrics,
  DailyScheduleState,
  FoodItem,
  FoodLogEntry,
  Language,
  MealType,
  ProgressEntry,
  RemindersConfig,
  ScheduleSlot,
  UserProfile,
} from './types/fitplate';
import {
  auth,
  googleProvider,
  facebookProvider,
  extractSocialProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  deleteUser,
  testFirestoreConnection,
  type SocialPrefillData,
} from './services/firebaseClient';
import {
  deleteActivityLogFromCloud,
  deleteAllCloudUserData,
  deleteFoodLogFromCloud,
  fetchUserCloudBundle,
  syncActivityLogToCloud,
  syncCoachPlanToCloud,
  syncCustomFoodToCloud,
  syncDailyMetricToCloud,
  syncDailyScheduleToCloud,
  syncFoodLogToCloud,
  syncProfileToCloud,
  syncProgressEntryToCloud,
  toggleFavoriteInCloud,
} from './services/firestoreSync';
import { loadEncryptedState, saveEncryptedState, wipeAllLocalHealthData } from './utils/cryptoStorage';
import { calculateNutritionPlan } from './utils/nutritionMath';
import {
  buildDailySchedule,
  deriveMealTimesFromWakeUp,
  parseTimeToMinutes,
} from './data/activitiesCatalog';
import {
  addMinutesToCurrentHHMM,
  getCurrentHHMM,
  playAlarmChime,
  requestAlarmPermission,
  triggerBrowserNotification,
} from './utils/alarmEngine';
import { t } from './i18n/translations';
import { OnboardingFlow } from './components/OnboardingFlow';
import { DashboardView } from './components/DashboardView';
import { FoodLoggerSheet } from './components/FoodLoggerSheet';
import { ProgressView } from './components/ProgressView';
import { CoachView } from './components/CoachView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { BrandLogo } from './components/BrandLogo';

type AppTab = 'today' | 'log' | 'progress' | 'coach' | 'settings';

interface PersistedAppState {
  profile: UserProfile | null;
  foodLogs: FoodLogEntry[];
  dailyMetrics: Record<string, DailyMetrics>;
  customFoods: FoodItem[];
  favoriteIds: string[];
  recentFoodIds: string[];
  progressEntries: ProgressEntry[];
  mealPlan: CoachMealPlan | null;
  workoutPlan: CoachWorkoutPlan | null;
  chatMessages: ChatMessage[];
  activityLogs?: ActivityLogEntry[];
  dailySchedules?: Record<string, DailyScheduleState>;
  reminders: RemindersConfig;
  language: Language;
  darkMode: boolean;
}

const DEFAULT_REMINDERS: RemindersConfig = {
  wakeUpTime: '07:00',
  sleepTime: '23:00',
  breakfast: '08:15',
  lunch: '13:00',
  dinner: '20:00',
  waterIntervalMin: 90,
  enabled: true,
  alarmsEnabled: true,
  waterAlarmsEnabled: true,
  soundEnabled: true,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDateIso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [activeDate, setActiveDate] = useState<string>(() => todayIso());
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socialPrefill, setSocialPrefill] = useState<SocialPrefillData | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const profileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);
  const [dailyMetricsMap, setDailyMetricsMap] = useState<Record<string, DailyMetrics>>({});
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(['roti_wheat', 'dal_tadka', 'paneer_bhurji']);
  const [recentFoodIds, setRecentFoodIds] = useState<string[]>(['kanda_poha', 'roti_wheat', 'dal_tadka']);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [mealPlan, setMealPlan] = useState<CoachMealPlan | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<CoachWorkoutPlan | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [dailySchedulesMap, setDailySchedulesMap] = useState<Record<string, DailyScheduleState>>({});
  const [reminders, setReminders] = useState<RemindersConfig>(DEFAULT_REMINDERS);
  const [language, setLanguage] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const [selectedLogMeal, setSelectedLogMeal] = useState<MealType>('breakfast');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<{ slot: ScheduleSlot; isTest?: boolean } | null>(null);
  const [snoozedSlots, setSnoozedSlots] = useState<Record<string, string>>({});
  const firedAlarmsRef = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 3200);
  };

  // Sync .dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Monitor online/offline state
  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  // Load encrypted offline state + verify Firestore connectivity on mount
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    getRedirectResult(auth)
      .then(async (res) => {
        if (res) {
          const info = await extractSocialProfile(res);
          if (info) setSocialPrefill(info);
        }
      })
      .catch(() => {});
    loadEncryptedState<PersistedAppState>().then((saved) => {
      if (saved && saved.profile) {
        setProfile(saved.profile);
        setFoodLogs(saved.foodLogs || []);
        setDailyMetricsMap(saved.dailyMetrics || {});
        setCustomFoods(saved.customFoods || []);
        setFavoriteIds(saved.favoriteIds || []);
        setRecentFoodIds(saved.recentFoodIds || []);
        setProgressEntries(saved.progressEntries || []);
        setMealPlan(saved.mealPlan || null);
        setWorkoutPlan(saved.workoutPlan || null);
        setChatMessages(saved.chatMessages || []);
        setActivityLogs(saved.activityLogs || []);
        setDailySchedulesMap(saved.dailySchedules || {});
        const savedRem = saved.reminders;
        const fallbackWake = saved.profile?.wakeUpTime || '07:00';
        const fallbackSleep =
          saved.profile?.sleepTime || deriveMealTimesFromWakeUp(fallbackWake).sleepTime;
        setReminders(
          savedRem
            ? {
                ...DEFAULT_REMINDERS,
                ...savedRem,
                wakeUpTime: savedRem.wakeUpTime || fallbackWake,
                sleepTime: savedRem.sleepTime || fallbackSleep,
              }
            : {
                ...DEFAULT_REMINDERS,
                ...deriveMealTimesFromWakeUp(fallbackWake, fallbackSleep),
              }
        );
        setLanguage(saved.language || 'en');
        setDarkMode(Boolean(saved.darkMode));
      } else if (saved) {
        setLanguage(saved.language || 'en');
        setDarkMode(Boolean(saved.darkMode));
      }
      setHydrated(true);
    });
  }, []);

  // Save encrypted offline state on changes
  useEffect(() => {
    if (!hydrated) return;
    const stateToSave: PersistedAppState = {
      profile,
      foodLogs,
      dailyMetrics: dailyMetricsMap,
      customFoods,
      favoriteIds,
      recentFoodIds,
      progressEntries,
      mealPlan,
      workoutPlan,
      chatMessages,
      activityLogs,
      dailySchedules: dailySchedulesMap,
      reminders,
      language,
      darkMode,
    };
    saveEncryptedState(stateToSave);
  }, [
    hydrated,
    profile,
    foodLogs,
    dailyMetricsMap,
    customFoods,
    favoriteIds,
    recentFoodIds,
    progressEntries,
    mealPlan,
    workoutPlan,
    chatMessages,
    activityLogs,
    dailySchedulesMap,
    reminders,
    language,
    darkMode,
  ]);

  // Firebase Auth listener -> hydrate cloud data if signed in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const cloud = await fetchUserCloudBundle(user.uid);
          if (cloud.profile) {
            setProfile(cloud.profile);
            setFoodLogs(cloud.foodLogs);
            setDailyMetricsMap(cloud.dailyMetrics);
            setCustomFoods(cloud.customFoods);
            if (cloud.favoriteIds.length > 0) setFavoriteIds(cloud.favoriteIds);
            setProgressEntries(cloud.progressEntries);
            if (cloud.mealPlan) setMealPlan(cloud.mealPlan);
            if (cloud.workoutPlan) setWorkoutPlan(cloud.workoutPlan);
            if (cloud.activityLogs.length > 0) setActivityLogs(cloud.activityLogs);
            if (Object.keys(cloud.dailySchedules).length > 0) setDailySchedulesMap(cloud.dailySchedules);
            if (cloud.profile.wakeUpTime) {
              setReminders((prev) => ({
                ...prev,
                ...deriveMealTimesFromWakeUp(cloud.profile!.wakeUpTime!, cloud.profile!.sleepTime),
              }));
            }
            setLanguage(cloud.profile.language);
            setDarkMode(cloud.profile.darkMode);
          } else if (profileRef.current) {
            const migrated = { ...profileRef.current, uid: user.uid };
            setProfile(migrated);
            await syncProfileToCloud(migrated);
          } else {
            // New social user without saved health profile: populate name/DOB prefill for profile setup
            const providerId = user.providerData?.[0]?.providerId || '';
            setSocialPrefill((prev) => ({
              name: prev?.name || user.displayName || undefined,
              dateOfBirth: prev?.dateOfBirth,
              email: prev?.email || user.email || null,
              provider: providerId.includes('facebook') ? 'facebook' : prev?.provider || 'google',
            }));
          }
        } catch {
          // Keep offline encrypted state seamlessly
        }
      }
    });
    return () => unsub();
  }, []);

  const currentUid = firebaseUser?.uid || profile?.uid || 'local_user';

  const activeMetrics: DailyMetrics = useMemo(() => {
    return (
      dailyMetricsMap[activeDate] || {
        uid: currentUid,
        date: activeDate,
        waterMl: 750,
        waterGoalMl: 2500,
        steps: 3400,
        exerciseCalories: 0,
        updatedAt: new Date().toISOString(),
      }
    );
  }, [dailyMetricsMap, activeDate, currentUid]);

  const streakDays = useMemo(() => {
    const loggedDates = new Set(foodLogs.map((l) => l.date));
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const iso = shiftDateIso(-i);
      if (loggedDates.has(iso)) {
        count++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    return Math.max(count, profile ? 1 : 0);
  }, [foodLogs, profile]);

  const todayStats = useMemo(() => {
    const tDate = todayIso();
    return foodLogs
      .filter((l) => l.date === tDate)
      .reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          protein: acc.protein + l.protein,
        }),
        { calories: 0, protein: 0 }
      );
  }, [foodLogs]);

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const info = await extractSocialProfile(cred);
      if (info) setSocialPrefill(info);
      showToast(language === 'hi' ? 'Google से सिंक हो गया' : 'Signed in with Google');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirErr) {
          showToast(redirErr instanceof Error ? redirErr.message : 'Sign-in failed');
          return;
        }
      }
      showToast(err instanceof Error ? err.message : 'Sign-in cancelled');
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, facebookProvider);
      const info = await extractSocialProfile(cred);
      if (info) setSocialPrefill(info);
      showToast(language === 'hi' ? 'Facebook ID से लॉगिन हो गया' : 'Signed in with Facebook');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, facebookProvider);
          return;
        } catch (redirErr) {
          showToast(redirErr instanceof Error ? redirErr.message : 'Facebook login failed');
          return;
        }
      }
      showToast(err instanceof Error ? err.message : 'Facebook login requires enabling Facebook Auth in Firebase Console');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast(language === 'hi' ? 'साइन आउट हो गया' : 'Signed out');
  };

  const handleCompleteOnboarding = async (nextProfile: UserProfile) => {
    const uid = firebaseUser?.uid || nextProfile.uid || 'local_user';
    const finalized: UserProfile = {
      ...nextProfile,
      uid,
      language,
      darkMode,
    };
    setProfile(finalized);
    if (nextProfile.reminders) {
      setReminders(nextProfile.reminders);
    } else if (nextProfile.wakeUpTime) {
      setReminders((prev) => ({
        ...prev,
        ...deriveMealTimesFromWakeUp(nextProfile.wakeUpTime!, nextProfile.sleepTime),
      }));
    }
    setEditingOnboarding(false);

    if (progressEntries.length === 0) {
      const initialEntry: ProgressEntry = {
        id: `prog_${Date.now()}`,
        uid,
        date: todayIso(),
        weightKg: finalized.currentWeightKg,
        note: 'Starting weight',
        createdAt: new Date().toISOString(),
      };
      setProgressEntries([initialEntry]);
      if (firebaseUser) {
        syncProfileToCloud(finalized)
          .then(() => syncProgressEntryToCloud(uid, initialEntry))
          .catch(() => {});
      }
    } else if (firebaseUser) {
      syncProfileToCloud(finalized).catch(() => {});
    }
  };

  const getDefaultMealForNow = (): MealType => {
    const slots = buildDailySchedule(reminders, 2500).filter(
      (s) =>
        s.kind === 'meal' &&
        (s.id === 'meal_breakfast' || s.id === 'meal_lunch' || s.id === 'meal_snacks' || s.id === 'meal_dinner')
    );
    if (slots.length === 0) return 'breakfast';
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const wakeMin = parseTimeToMinutes(reminders.wakeUpTime || '07:00', 420);
    const nowOffset = (nowMin - wakeMin + 1440) % 1440;
    let activeSlot = slots[0];
    for (const s of slots) {
      if (nowOffset >= Math.max(0, s.offsetMin - 45)) {
        activeSlot = s;
      }
    }
    return activeSlot.mealType || 'breakfast';
  };

  const openFoodLogger = (meal: MealType) => {
    setSelectedLogMeal(meal);
    setActiveTab('log');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const selectAppTab = (tab: AppTab) => {
    if (tab === 'log') {
      setSelectedLogMeal(getDefaultMealForNow());
    }
    setActiveTab(tab);
  };

  const handleAddFoodLog = (entry: FoodLogEntry, _keepOpen = false) => {
    const withUid = { ...entry, uid: currentUid };
    setFoodLogs((prev) => [withUid, ...prev]);
    setRecentFoodIds((prev) => [entry.foodId, ...prev.filter((id) => id !== entry.foodId)].slice(0, 15));
    showToast(`${entry.foodName} · ${entry.calories} kcal`);
    if (firebaseUser) {
      syncFoodLogToCloud(currentUid, withUid).catch(() => {});
    }
  };

  const handleUpdateFoodLogQty = (id: string, nextQty: number) => {
    const target = foodLogs.find((item) => item.id === id);
    if (!target) return;
    const safeNextQty = Math.max(0.25, Math.min(50, Math.round(nextQty * 100) / 100));
    const oldQty = target.servingQty > 0 ? target.servingQty : 1;
    const ratio = safeNextQty / oldQty;
    const updatedEntry: FoodLogEntry = {
      ...target,
      servingQty: safeNextQty,
      grams: Math.round(target.grams * ratio * 10) / 10,
      calories: Math.round(target.calories * ratio),
      protein: Math.round(target.protein * ratio * 10) / 10,
      carbs: Math.round(target.carbs * ratio * 10) / 10,
      fat: Math.round(target.fat * ratio * 10) / 10,
      fiber: Math.round(target.fiber * ratio * 10) / 10,
    };
    setFoodLogs((prev) => prev.map((item) => (item.id === id ? updatedEntry : item)));
    if (firebaseUser) {
      syncFoodLogToCloud(currentUid, updatedEntry).catch(() => {});
    }
  };

  const handleDeleteFoodLog = (id: string) => {
    setFoodLogs((prev) => prev.filter((l) => l.id !== id));
    if (firebaseUser) {
      deleteFoodLogFromCloud(currentUid, id).catch(() => {});
    }
  };

  const handleUpdateMetrics = (next: DailyMetrics) => {
    const withUid = { ...next, uid: currentUid };
    setDailyMetricsMap((prev) => ({ ...prev, [activeDate]: withUid }));
    if (firebaseUser) {
      syncDailyMetricToCloud(currentUid, withUid).catch(() => {});
    }
  };

  const handleAddActivity = (entry: ActivityLogEntry) => {
    const withUid = { ...entry, uid: currentUid };
    setActivityLogs((prev) => [withUid, ...prev]);
    handleUpdateMetrics({
      ...activeMetrics,
      exerciseCalories: activeMetrics.exerciseCalories + entry.caloriesBurned,
      updatedAt: new Date().toISOString(),
    });
    showToast(`${entry.activityName} · -${entry.caloriesBurned} kcal`);
    if (firebaseUser) {
      syncActivityLogToCloud(currentUid, withUid).catch(() => {});
    }
  };

  const handleDeleteActivity = (id: string) => {
    const target = activityLogs.find((a) => a.id === id);
    setActivityLogs((prev) => prev.filter((a) => a.id !== id));
    if (target) {
      handleUpdateMetrics({
        ...activeMetrics,
        exerciseCalories: Math.max(0, activeMetrics.exerciseCalories - target.caloriesBurned),
        updatedAt: new Date().toISOString(),
      });
    }
    if (firebaseUser) {
      deleteActivityLogFromCloud(currentUid, id).catch(() => {});
    }
  };

  const activeCompletedSlotIds = dailySchedulesMap[activeDate]?.completedSlotIds || [];

  const handleToggleScheduleSlot = (slot: ScheduleSlot) => {
    const isAlreadyDone = activeCompletedSlotIds.includes(slot.id);
    const nextIds = isAlreadyDone
      ? activeCompletedSlotIds.filter((id) => id !== slot.id)
      : [...activeCompletedSlotIds, slot.id];

    const nextSchedule: DailyScheduleState = {
      uid: currentUid,
      date: activeDate,
      completedSlotIds: nextIds,
      updatedAt: new Date().toISOString(),
    };
    setDailySchedulesMap((prev) => ({ ...prev, [activeDate]: nextSchedule }));
    if (firebaseUser) {
      syncDailyScheduleToCloud(currentUid, nextSchedule).catch(() => {});
    }

    if (slot.kind === 'water' && slot.waterMl) {
      const delta = isAlreadyDone ? -slot.waterMl : slot.waterMl;
      handleUpdateMetrics({
        ...activeMetrics,
        waterMl: Math.max(0, Math.min(15000, activeMetrics.waterMl + delta)),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleUpdateReminders = (next: RemindersConfig) => {
    const wakeChanged = Boolean(next.wakeUpTime && next.wakeUpTime !== reminders.wakeUpTime);
    const sleepChanged = Boolean(next.sleepTime && next.sleepTime !== reminders.sleepTime);
    setReminders(next);
    if ((wakeChanged || sleepChanged) && profile) {
      const updatedProfile: UserProfile = {
        ...profile,
        wakeUpTime: next.wakeUpTime || profile.wakeUpTime,
        sleepTime: next.sleepTime || profile.sleepTime,
      };
      setProfile(updatedProfile);
      if (firebaseUser) {
        syncProfileToCloud(updatedProfile).catch(() => {});
      }
    }
  };

  const handleEnableAlarms = async () => {
    const perm = await requestAlarmPermission();
    setReminders((prev) => ({
      ...prev,
      enabled: true,
      alarmsEnabled: true,
      waterAlarmsEnabled: true,
    }));
    if (reminders.soundEnabled !== false) {
      playAlarmChime('water');
    }
    showToast(
      perm === 'granted'
        ? language === 'hi'
          ? 'पानी और शेड्यूल अलार्म चालू हो गए'
          : 'Water & schedule alarms enabled'
        : language === 'hi'
        ? 'इन-ऐप पानी और शेड्यूल अलार्म चालू हो गए'
        : 'In-app water & schedule alarms enabled'
    );
  };

  const handleTestAlarm = () => {
    const slots = buildDailySchedule(reminders, activeMetrics.waterGoalMl, new Date());
    const sample = slots.find((s) => !activeCompletedSlotIds.includes(s.id)) || slots[0];
    if (!sample) return;
    if (reminders.soundEnabled !== false) {
      playAlarmChime(sample.kind);
    }
    triggerBrowserNotification(
      language === 'hi'
        ? `Fit-Plat with Karam अलार्म: ${sample.titleHi}`
        : `Fit-Plat with Karam Alarm: ${sample.titleEn}`,
      language === 'hi' ? sample.detailHi : sample.detailEn,
      `test_${sample.id}`
    );
    setActiveAlarm({ slot: sample, isTest: true });
  };

  // Monitor scheduled eating, hydration & activity alarms every 10 seconds
  useEffect(() => {
    if (!hydrated || !profile) return;
    if (reminders.enabled === false || reminders.alarmsEnabled === false) return;

    const checkAlarms = () => {
      const now = new Date();
      const nowHHMM = getCurrentHHMM(now);
      const todayKey = todayIso();
      const todayCompletedIds = dailySchedulesMap[todayKey]?.completedSlotIds || [];
      const slots = buildDailySchedule(reminders, activeMetrics.waterGoalMl, now);

      for (const slot of slots) {
        if (slot.kind === 'water' && reminders.waterAlarmsEnabled === false) continue;
        if (todayCompletedIds.includes(slot.id)) continue;

        const snoozedHHMM = snoozedSlots[slot.id];
        const dueBySchedule = slot.time === nowHHMM;
        const dueBySnooze = snoozedHHMM === nowHHMM;

        if (!dueBySchedule && !dueBySnooze) continue;

        const fireKey = `${todayKey}_${slot.id}_${nowHHMM}`;
        if (firedAlarmsRef.current.has(fireKey)) continue;
        firedAlarmsRef.current.add(fireKey);

        if (dueBySnooze) {
          setSnoozedSlots((prev) => {
            const copy = { ...prev };
            delete copy[slot.id];
            return copy;
          });
        }

        if (reminders.soundEnabled !== false) {
          playAlarmChime(slot.kind);
        }
        triggerBrowserNotification(
          language === 'hi'
            ? slot.kind === 'water'
              ? `पानी पीने का अलार्म: ${slot.titleHi}`
              : `Fit-Plat with Karam अलार्म: ${slot.titleHi}`
            : slot.kind === 'water'
            ? `Drink Water Alarm: ${slot.titleEn}`
            : `Fit-Plat with Karam Alarm: ${slot.titleEn}`,
          language === 'hi' ? slot.detailHi : slot.detailEn,
          fireKey
        );
        setActiveAlarm({ slot });
        break;
      }
    };

    checkAlarms();
    const timer = setInterval(checkAlarms, 10_000);
    return () => clearInterval(timer);
  }, [hydrated, profile, reminders, activeMetrics.waterGoalMl, dailySchedulesMap, snoozedSlots, language]);

  // Automatically unlock audio & browser notifications on first user interaction when alarms are enabled
  useEffect(() => {
    if (!hydrated || !profile) return;
    if (reminders.enabled === false || reminders.alarmsEnabled === false) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const unlockNotifications = () => {
      requestAlarmPermission().catch(() => {});
    };
    window.addEventListener('pointerdown', unlockNotifications, { once: true });
    return () => window.removeEventListener('pointerdown', unlockNotifications);
  }, [hydrated, profile, reminders.enabled, reminders.alarmsEnabled]);

  const handleToggleFavorite = (food: FoodItem) => {
    const exists = favoriteIds.includes(food.id);
    const next = exists ? favoriteIds.filter((x) => x !== food.id) : [...favoriteIds, food.id];
    setFavoriteIds(next);
    if (firebaseUser) {
      const cal = Math.round((food.per100g.calories * (food.servings[0]?.grams || 100)) / 100);
      toggleFavoriteInCloud(currentUid, { id: food.id, name: food.name, calories: cal }, !exists).catch(() => {});
    }
  };

  const handleSaveCustomFood = (food: FoodItem) => {
    setCustomFoods((prev) => [food, ...prev.filter((f) => f.id !== food.id)]);
    if (firebaseUser) {
      syncCustomFoodToCloud(currentUid, food).catch(() => {});
    }
    showToast(
      language === 'hi'
        ? `"${food.name}" सेव किया गया`
        : `Saved "${food.name}" for quick logging`
    );
  };

  const handleAddProgressEntry = (entry: ProgressEntry) => {
    const withUid = { ...entry, uid: currentUid };
    setProgressEntries((prev) => [...prev, withUid]);
    if (profile) {
      const updatedProfile = { ...profile, currentWeightKg: entry.weightKg };
      setProfile(updatedProfile);
      if (firebaseUser) {
        syncProfileToCloud(updatedProfile).catch(() => {});
      }
    }
    if (firebaseUser) {
      syncProgressEntryToCloud(currentUid, withUid).catch(() => {});
    }
    showToast(language === 'hi' ? 'प्रगति सहेजी गई' : 'Check-in saved');
  };

  const handleApplyAdjustedTarget = (newCalories: number) => {
    if (!profile) return;
    const recalc = calculateNutritionPlan({
      age: profile.age,
      gender: profile.gender,
      heightCm: profile.heightCm,
      currentWeightKg: profile.currentWeightKg,
      targetWeightKg: profile.targetWeightKg,
      activityLevel: profile.activityLevel,
      dietType: profile.dietType,
      timelineWeeks: profile.timelineWeeks,
    });
    const ratio = newCalories / Math.max(1, recalc.dailyCalorieTarget);
    const nextProfile: UserProfile = {
      ...profile,
      dailyCalorieTarget: newCalories,
      proteinTargetG: Math.round(recalc.proteinTargetG * ratio),
      carbsTargetG: Math.round(recalc.carbsTargetG * ratio),
      fatTargetG: Math.round(recalc.fatTargetG * ratio),
    };
    setProfile(nextProfile);
    if (firebaseUser) {
      syncProfileToCloud(nextProfile).catch(() => {});
    }
    showToast(`${newCalories} kcal/day applied`);
  };

  const handleChangeLanguage = (nextLang: Language) => {
    setLanguage(nextLang);
    if (profile) {
      const next = { ...profile, language: nextLang };
      setProfile(next);
      if (firebaseUser) syncProfileToCloud(next).catch(() => {});
    }
  };

  const handleToggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (profile) {
      const next = { ...profile, darkMode: nextDark };
      setProfile(next);
      if (firebaseUser) syncProfileToCloud(next).catch(() => {});
    }
  };

  const handleToggleHealthSync = () => {
    if (!profile) return;
    const next = { ...profile, healthSyncEnabled: !profile.healthSyncEnabled };
    setProfile(next);
    if (!profile.healthSyncEnabled) {
      handleUpdateMetrics({
        ...activeMetrics,
        steps: activeMetrics.steps + 2450,
        exerciseCalories: activeMetrics.exerciseCalories + 95,
        updatedAt: new Date().toISOString(),
      });
    }
    if (firebaseUser) syncProfileToCloud(next).catch(() => {});
  };

  const handleExportJson = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      profile,
      foodLogs,
      dailyMetrics: dailyMetricsMap,
      activityLogs,
      dailySchedules: dailySchedulesMap,
      customFoods,
      progressEntries,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitplate-export-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAllData = async () => {
    if (firebaseUser) {
      await deleteAllCloudUserData(firebaseUser.uid).catch(() => {});
      await deleteUser(firebaseUser).catch(() => {});
    }
    wipeAllLocalHealthData();
    setProfile(null);
    setFoodLogs([]);
    setDailyMetricsMap({});
    setCustomFoods([]);
    setProgressEntries([]);
    setMealPlan(null);
    setWorkoutPlan(null);
    setChatMessages([]);
    setActivityLogs([]);
    setDailySchedulesMap({});
    setActiveTab('today');
    showToast(language === 'hi' ? 'सभी डेटा हटाया गया' : 'All health data deleted');
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-[#090e0b] flex items-center justify-center">
        <div className="font-display font-bold text-lg text-emerald-600">Fit-Plat with Karam</div>
      </div>
    );
  }

  if (!profile || editingOnboarding) {
    return (
      <OnboardingFlow
        initialProfile={profile}
        socialPrefill={socialPrefill}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        onComplete={handleCompleteOnboarding}
        onCancel={editingOnboarding && profile ? () => setEditingOnboarding(false) : undefined}
        onGoogleSignIn={handleGoogleSignIn}
        onFacebookSignIn={handleFacebookSignIn}
        isSignedIn={Boolean(firebaseUser)}
        userEmail={firebaseUser?.email}
      />
    );
  }

  const navItems: [AppTab, string, React.FC<{ className?: string }>][] = [
    ['today', t(language, 'today'), Home],
    ['log', t(language, 'logFood'), UtensilsCrossed],
    ['progress', t(language, 'progress'), BarChart3],
    ['coach', t(language, 'aiCoach'), Sparkles],
    ['settings', t(language, 'profile'), UserIcon],
  ];

  const userInitial = (profile.name || 'K').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#090e0b] text-slate-900 dark:text-slate-100 pb-32 md:pb-10">
      {/* Top Bar: Mobile Menu + Brand — Desktop Nav — Profile + Add Food CTA */}
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-white/95 dark:bg-[#111a15]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-emerald-950">
        <div className="max-w-6xl mx-auto h-13 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t(language, 'menu')}
              className="md:hidden min-h-[38px] min-w-[38px] rounded-xl border border-slate-200/80 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className="font-display font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-2 min-w-0"
            >
              <BrandLogo size={30} />
              <span className="truncate">Fit-Plat with Karam</span>
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium shrink-0">
            {navItems.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => selectAppTab(id)}
                className={`min-h-[40px] whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  activeTab === id
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden md:block">
              <PWAInstallButton language={language} />
            </div>
            <button
              type="button"
              onClick={() => selectAppTab('settings')}
              aria-label={t(language, 'profile')}
              className={`min-h-[38px] px-2.5 sm:px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'settings'
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#090e0b] text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                {userInitial}
              </span>
              <span className="hidden sm:inline">{t(language, 'profile')}</span>
            </button>
            <button
              type="button"
              onClick={() => openFoodLogger(getDefaultMealForNow())}
              className="min-h-[38px] px-2.5 sm:px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t(language, 'addFood')}</span>
            </button>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4">
          {language === 'hi'
            ? 'ऑफ़लाइन मोड — आपका डेटा सुरक्षित रूप से डिवाइस पर सहेजा जा रहा है'
            : 'Offline Mode — Logging continues locally with AES-GCM encryption'}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
        {activeTab === 'today' && (
          <DashboardView
            profile={profile}
            language={language}
            activeDate={activeDate}
            onChangeDate={setActiveDate}
            logs={foodLogs}
            metrics={activeMetrics}
            activities={activityLogs}
            streakDays={streakDays}
            onUpdateMetrics={handleUpdateMetrics}
            onOpenLogger={(meal) => openFoodLogger(meal)}
            onQuickLogSuggestion={(idea) =>
              handleAddFoodLog({
                id: `log_${Date.now()}`,
                uid: currentUid,
                date: activeDate,
                mealType: 'dinner',
                foodId: `idea_${Date.now()}`,
                foodName: idea.foodName,
                servingUnit: idea.servingUnit,
                servingQty: 1,
                grams: 200,
                calories: idea.calories,
                protein: idea.protein,
                carbs: idea.carbs,
                fat: idea.fat,
                fiber: idea.fiber,
                source: 'coach',
                createdAt: new Date().toISOString(),
              })
            }
            onAddActivity={handleAddActivity}
            onDeleteActivity={handleDeleteActivity}
          />
        )}

        {activeTab === 'log' && (
          <FoodLoggerSheet
            language={language}
            activeDate={activeDate}
            initialMealType={selectedLogMeal}
            uid={currentUid}
            customFoods={customFoods}
            reminders={reminders}
            waterGoalMl={activeMetrics.waterGoalMl}
            completedSlotIds={activeCompletedSlotIds}
            dayLogs={foodLogs}
            onSaveCustomFood={handleSaveCustomFood}
            onAddLog={handleAddFoodLog}
            onUpdateLogQty={handleUpdateFoodLogQty}
            onDeleteLog={handleDeleteFoodLog}
            onToggleScheduleSlot={handleToggleScheduleSlot}
            onUpdateReminders={handleUpdateReminders}
            onTestAlarm={handleTestAlarm}
            onEnableAlarms={handleEnableAlarms}
            isStandaloneTab
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            profile={profile}
            language={language}
            entries={progressEntries}
            foodLogs={foodLogs}
            dailyMetricsMap={dailyMetricsMap}
            activityLogs={activityLogs}
            onAddEntry={handleAddProgressEntry}
            onApplyAdjustedTarget={handleApplyAdjustedTarget}
          />
        )}

        {activeTab === 'coach' && (
          <CoachView
            profile={profile}
            language={language}
            eatenTodayCalories={todayStats.calories}
            eatenTodayProtein={Math.round(todayStats.protein)}
            mealPlan={mealPlan}
            workoutPlan={workoutPlan}
            chatMessages={chatMessages}
            onSaveMealPlan={(plan) => {
              setMealPlan(plan);
              if (firebaseUser) syncCoachPlanToCloud(currentUid, 'meal_plan', plan.title, plan).catch(() => {});
            }}
            onSaveWorkoutPlan={(plan) => {
              setWorkoutPlan(plan);
              if (firebaseUser) syncCoachPlanToCloud(currentUid, 'workout_plan', plan.title, plan).catch(() => {});
            }}
            onAppendChat={(msgs) => setChatMessages((prev) => [...prev, ...msgs])}
            onLogPlannedMeal={(m) =>
              handleAddFoodLog({
                id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                uid: currentUid,
                date: activeDate,
                mealType: m.mealType,
                foodId: `coach_${Date.now()}`,
                foodName: m.title,
                servingUnit: m.portion.slice(0, 32),
                servingQty: 1,
                grams: 200,
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
                fiber: m.fiber,
                source: 'coach',
                createdAt: new Date().toISOString(),
              })
            }
          />
        )}

        {activeTab === 'settings' && (
          <ProfileSettingsView
            profile={profile}
            language={language}
            darkMode={darkMode}
            isOnline={isOnline}
            isSignedIn={Boolean(firebaseUser)}
            userEmail={firebaseUser?.email}
            reminders={reminders}
            onUpdateReminders={handleUpdateReminders}
            onEnableAlarms={handleEnableAlarms}
            onChangeLanguage={handleChangeLanguage}
            onToggleDarkMode={handleToggleDarkMode}
            onToggleHealthSync={handleToggleHealthSync}
            onEditOnboarding={() => setEditingOnboarding(true)}
            onGoogleSignIn={handleGoogleSignIn}
            onFacebookSignIn={handleFacebookSignIn}
            onSignOut={handleSignOut}
            onExportJson={handleExportJson}
            onDeleteAllData={handleDeleteAllData}
          />
        )}
      </main>

      {/* Active Schedule Alarm Banner / Modal */}
      {activeAlarm && (
        <div className="fixed inset-x-0 top-15 z-50 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-lg rounded-3xl bg-white dark:bg-[#111a15] border-2 border-emerald-600 shadow-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <AlarmClock className="w-3.5 h-3.5" />
                    <span className="font-mono-num">{activeAlarm.slot.time}</span>
                    {activeAlarm.isTest && (
                      <span>· {language === 'hi' ? 'टेस्ट अलार्म' : 'Test Preview'}</span>
                    )}
                  </div>
                  <h4 className="font-display font-bold text-base text-slate-900 dark:text-white mt-0.5">
                    {language === 'hi' ? activeAlarm.slot.titleHi : activeAlarm.slot.titleEn}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {language === 'hi' ? activeAlarm.slot.detailHi : activeAlarm.slot.detailEn}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAlarm(null)}
                aria-label="Dismiss alarm"
                className="min-h-[36px] min-w-[36px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const slot = activeAlarm.slot;
                  if (!activeCompletedSlotIds.includes(slot.id)) {
                    handleToggleScheduleSlot(slot);
                  }
                  if (slot.kind === 'meal' && slot.mealType) {
                    openFoodLogger(slot.mealType);
                  }
                  setActiveAlarm(null);
                }}
                className="flex-1 min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {activeAlarm.slot.kind === 'meal'
                  ? language === 'hi'
                    ? 'पूर्ण करें व खाना जोड़ें'
                    : 'Done & Log Meal'
                  : activeAlarm.slot.kind === 'water'
                  ? language === 'hi'
                    ? `पिया (+${activeAlarm.slot.waterMl}ml)`
                    : `Drank (+${activeAlarm.slot.waterMl}ml)`
                  : language === 'hi'
                  ? 'पूर्ण करें'
                  : 'Mark Done'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetTime = addMinutesToCurrentHHMM(10);
                  setSnoozedSlots((prev) => ({ ...prev, [activeAlarm.slot.id]: targetTime }));
                  setActiveAlarm(null);
                  showToast(
                    language === 'hi'
                      ? `10 मिनट बाद (${targetTime}) फिर याद दिलाया जाएगा`
                      : `Snoozed for 10 min (${targetTime})`
                  );
                }}
                className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {language === 'hi' ? '10 मि स्नूज़' : 'Snooze 10m'}
              </button>

              <button
                type="button"
                onClick={() => playAlarmChime(activeAlarm.slot.kind)}
                aria-label="Replay alarm chime"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-stone-100 dark:bg-[#090e0b] text-slate-700 dark:text-slate-200 flex items-center justify-center"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-18 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold shadow-lg whitespace-nowrap">
          {toastMsg}
        </div>
      )}

      {/* Mobile Slide-Over Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-80 max-w-[85vw] h-full bg-white dark:bg-[#111a15] border-r border-slate-200 dark:border-emerald-900/60 flex flex-col pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto">
            <div className="px-4 pb-4 border-b border-slate-100 dark:border-emerald-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm truncate">{profile.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num truncate">
                    {profile.dailyCalorieTarget} kcal · Wake {reminders.wakeUpTime || '07:00'} · Sleep {reminders.sleepTime || '23:00'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="min-h-[36px] min-w-[36px] rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 space-y-1">
              {navItems.map(([id, label, Icon]) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      selectAppTab(id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-emerald-950/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-3 py-3 border-t border-slate-100 dark:border-emerald-950 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setEditingOnboarding(true);
                }}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5"
              >
                <UserCog className="w-4 h-4 shrink-0" />
                {language === 'hi' ? 'प्रोफ़ाइल और लक्ष्य बदलें' : 'Edit Profile & Wake-Up Goals'}
              </button>

              <button
                type="button"
                onClick={() => handleChangeLanguage(language === 'hi' ? 'en' : 'hi')}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold flex items-center justify-between"
              >
                <span className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t(language, 'languageLabel')}
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  {language === 'hi' ? 'हिन्दी → EN' : 'EN → हिन्दी'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleDarkMode}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold flex items-center justify-between"
              >
                <span className="flex items-center gap-2.5">
                  {darkMode ? <Moon className="w-4 h-4 text-emerald-400" /> : <Sun className="w-4 h-4 text-emerald-600" />}
                  {t(language, 'themeLabel')}
                </span>
                <span>{darkMode ? (language === 'hi' ? 'डार्क' : 'Dark') : language === 'hi' ? 'लाइट' : 'Light'}</span>
              </button>

              {firebaseUser ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4" />
                  {t(language, 'signOut')}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleFacebookSignIn();
                    }}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#1877F2] text-white text-xs font-semibold flex items-center gap-2.5"
                  >
                    <span className="font-bold text-sm">f</span>
                    {t(language, 'signInFacebook')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleGoogleSignIn();
                    }}
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2.5"
                  >
                    <LogIn className="w-4 h-4" />
                    {t(language, 'signInGoogle')}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  handleExportJson();
                  setMobileMenuOpen(false);
                }}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold flex items-center gap-2.5"
              >
                <Download className="w-4 h-4" />
                {t(language, 'exportData')}
              </button>
            </div>

            <div className="mt-auto border-t border-slate-100 dark:border-emerald-950">
              <PWAInstallButton language={language} variant="card" />
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar — Cleared above Android system Back/Home/Menu keys */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 mobile-bottom-safe-nav bg-white/95 dark:bg-[#111a15]/95 backdrop-blur-md border-t border-slate-200 dark:border-emerald-950 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="h-14 grid grid-cols-5 items-center">
          {navItems.map(([id, label, Icon]) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectAppTab(id)}
                className={`h-full flex flex-col items-center justify-center transition-colors ${
                  active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight mt-0.5 truncate max-w-[64px]">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
