import React, { useState } from 'react';
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Droplets,
  Globe,
  Lock,
  LogIn,
  LogOut,
  Moon,
  ShieldAlert,
  Sun,
  Sunrise,
  Trash2,
  UserCog,
} from 'lucide-react';
import type { Language, RemindersConfig, UserProfile } from '../types/fitplate';
import { deriveMealTimesFromWakeUp, isNightShiftWakeTime } from '../data/activitiesCatalog';
import { t } from '../i18n/translations';
import { PWAInstallButton } from './PWAInstallButton';

interface ProfileSettingsViewProps {
  profile: UserProfile;
  language: Language;
  darkMode: boolean;
  isOnline: boolean;
  isSignedIn: boolean;
  userEmail?: string | null;
  reminders: RemindersConfig;
  onUpdateReminders: (next: RemindersConfig) => void;
  onEnableAlarms?: () => void;
  onChangeLanguage: (lang: Language) => void;
  onToggleDarkMode: () => void;
  onToggleHealthSync: () => void;
  onEditOnboarding: () => void;
  onGoogleSignIn: () => void;
  onFacebookSignIn: () => void;
  onSignOut: () => void;
  onExportJson: () => void;
  onDeleteAllData: () => Promise<void>;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  profile,
  language,
  darkMode,
  isOnline,
  isSignedIn,
  userEmail,
  reminders,
  onUpdateReminders,
  onEnableAlarms,
  onChangeLanguage,
  onToggleDarkMode,
  onToggleHealthSync,
  onEditOnboarding,
  onGoogleSignIn,
  onFacebookSignIn,
  onSignOut,
  onExportJson,
  onDeleteAllData,
}) => {
  const isHi = language === 'hi';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [routineSavedNotice, setRoutineSavedNotice] = useState(false);

  const wakeTime = reminders.wakeUpTime || profile.wakeUpTime || '07:00';
  const sleepTime =
    reminders.sleepTime ||
    profile.sleepTime ||
    deriveMealTimesFromWakeUp(wakeTime).sleepTime;
  const alarmsActive =
    reminders.enabled !== false &&
    reminders.alarmsEnabled !== false &&
    reminders.waterAlarmsEnabled !== false;

  const updateWakeSleep = (nextWake: string, nextSleep?: string) => {
    const derived = deriveMealTimesFromWakeUp(nextWake, nextSleep);
    onUpdateReminders({
      ...reminders,
      wakeUpTime: derived.wakeUpTime,
      sleepTime: derived.sleepTime,
      breakfast: derived.breakfast,
      lunch: derived.lunch,
      dinner: derived.dinner,
    });
    setRoutineSavedNotice(true);
    setTimeout(() => setRoutineSavedNotice(false), 2000);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteAllData();
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const userInitial = (profile.name || 'K').trim().charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Profile Summary */}
      <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {isHi ? 'मेरी प्रोफ़ाइल और सेटिंग्स' : 'My Profile & Settings'}
            </div>
            <h2 className="font-display text-xl font-bold truncate">
              {profile.name} · {profile.age} {isHi ? 'वर्ष' : 'yrs'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num mt-0.5">
              {profile.dailyCalorieTarget} kcal/day · TDEE {profile.tdee} · BMI {profile.bmi} · {Number(Number(profile.heightCm).toFixed(2))} cm ·{' '}
              {profile.currentWeightKg} → {profile.targetWeightKg} kg
              {` · Wake ${wakeTime} · Sleep ${sleepTime}`}
              {profile.dateOfBirth ? ` · DOB ${profile.dateOfBirth}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEditOnboarding}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 shrink-0"
        >
          <UserCog className="w-4 h-4" />
          {isHi ? 'प्रोफ़ाइल और लक्ष्य बदलें' : 'Edit Profile & Goals'}
        </button>
      </section>

      {/* Wake-Up Time, Sleep Time & Automatic Notification Schedule */}
      <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {isNightShiftWakeTime(wakeTime) ? (
                <Moon className="w-4.5 h-4.5" />
              ) : (
                <Sunrise className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                {isHi ? 'उठने व सोने का समय और ऑटो नोटिफिकेशन' : 'Wake-Up, Sleep Time & Auto Notifications'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isHi
                  ? 'पानी और भोजन की सूचनाएं आपके उठने से सोने के समय तक अपने आप भेजी जाती हैं।'
                  : 'Automatic water & meal schedule notifications run silently from wake-up to sleep time.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!alarmsActive && onEnableAlarms) {
                onEnableAlarms();
              } else {
                onUpdateReminders({
                  ...reminders,
                  enabled: !alarmsActive,
                  alarmsEnabled: !alarmsActive,
                  waterAlarmsEnabled: !alarmsActive,
                });
              }
            }}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
              alarmsActive
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            {alarmsActive
              ? isHi
                ? 'नोटिफिकेशन चालू'
                : 'Auto Alerts ON'
              : isHi
              ? 'नोटिफिकेशन चालू करें'
              : 'Enable Auto Alerts'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {isHi ? 'उठने का समय (Wake-Up)' : 'Wake-Up Time'}
            </label>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => {
                if (!e.target.value) return;
                updateWakeSleep(e.target.value, sleepTime);
              }}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Moon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {isHi ? 'सोने का समय (Sleep Time)' : 'Sleep Time'}
            </label>
            <input
              type="time"
              value={sleepTime}
              onChange={(e) => {
                if (!e.target.value) return;
                updateWakeSleep(wakeTime, e.target.value);
              }}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] font-mono-num text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              {isHi ? 'पानी नोटिफिकेशन अंतराल' : 'Water Notify Every'}
            </label>
            <select
              value={reminders.waterIntervalMin}
              onChange={(e) => {
                onUpdateReminders({ ...reminders, waterIntervalMin: Number(e.target.value) });
                setRoutineSavedNotice(true);
                setTimeout(() => setRoutineSavedNotice(false), 2000);
              }}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#111a15] text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['06:30', isHi ? '06:30 सुबह' : '06:30 Early'],
                ['07:00', isHi ? '07:00 दिन' : '07:00 Day'],
                ['14:00', isHi ? '14:00 दोपहर' : '14:00 Afternoon'],
                ['20:00', isHi ? '20:00 नाइट' : '20:00 Night'],
              ] as [string, string][]
            ).map(([preset, lbl]) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateWakeSleep(preset)}
                className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  wakeTime === preset
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {routineSavedNotice && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {isHi ? 'समय सहेजा गया' : 'Schedule updated'}
            </span>
          )}
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 divide-y divide-slate-100 dark:divide-emerald-950/70">
        {/* Language */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-sm font-semibold">{t(language, 'languageLabel')}</div>
              <div className="text-xs text-slate-500">English / हिन्दी</div>
            </div>
          </div>
          <div className="flex p-1 bg-stone-100 dark:bg-[#090e0b] rounded-xl">
            <button
              type="button"
              onClick={() => onChangeLanguage('en')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold ${
                language === 'en' ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onChangeLanguage('hi')}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold ${
                language === 'hi' ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Dark Mode */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {darkMode ? (
              <Moon className="w-5 h-5 text-emerald-400" />
            ) : (
              <Sun className="w-5 h-5 text-emerald-600" />
            )}
            <div>
              <div className="text-sm font-semibold">{t(language, 'themeLabel')}</div>
              <div className="text-xs text-slate-500">
                {darkMode ? (isHi ? 'डार्क मोड' : 'Dark Mode') : isHi ? 'लाइट मोड' : 'Light Mode'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold"
          >
            {darkMode ? (isHi ? 'लाइट चुनें' : 'Switch to Light') : isHi ? 'डार्क चुनें' : 'Switch to Dark'}
          </button>
        </div>

        {/* Google Fit / Apple Health Sync */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-sm font-semibold">Google Fit / Apple Health</div>
              <div className="text-xs text-slate-500">
                {profile.healthSyncEnabled
                  ? isHi
                    ? 'कदम और सक्रिय कैलोरी सिंक चालू है'
                    : 'Steps & active burn sync enabled'
                  : isHi
                  ? 'कनेक्ट नहीं है'
                  : 'Not connected'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleHealthSync}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold ${
              profile.healthSyncEnabled
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-200 dark:border-emerald-900/60'
            }`}
          >
            {profile.healthSyncEnabled ? (isHi ? 'कनेक्टेड' : 'Connected') : isHi ? 'कनेक्ट करें' : 'Connect'}
          </button>
        </div>

        {/* Cloud Auth & Offline Status */}
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-sm font-semibold">
                {isSignedIn ? userEmail || 'Firebase Cloud Sync' : isHi ? 'ऑफ़लाइन एन्क्रिप्टेड मोड' : 'Offline Encrypted Mode'}
              </div>
              <div className="text-xs text-slate-500">
                {isOnline ? (isHi ? 'नेटवर्क ऑनलाइन · AES-GCM सुरक्षित' : 'Online · AES-GCM encrypted local cache') : t(language, 'offlineReady')}
              </div>
            </div>
          </div>
          {isSignedIn ? (
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              {t(language, 'signOut')}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onFacebookSignIn}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#1877F2] text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <span className="font-bold">f</span>
                {t(language, 'signInFacebook')}
              </button>
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                {t(language, 'signInGoogle')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile / Android PWA Install */}
        <PWAInstallButton language={language} variant="card" />
      </section>

      {/* Privacy, Export & Delete Account */}
      <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base">{isHi ? 'गोपनीयता और डेटा नियंत्रण' : 'Privacy & Data Control'}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isHi
                ? 'आपका स्वास्थ्य डेटा डिवाइस पर AES-GCM से एन्क्रिप्टेड है।'
                : 'Health records are encrypted locally via Web Crypto AES-GCM and secured by strict Firebase owner-only rules.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExportJson}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              {t(language, 'exportData')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[44px] px-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {t(language, 'deleteAccount')}
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
            <p className="text-xs font-medium text-rose-900 dark:text-rose-100">
              {isHi
                ? 'क्या आप वाकई अपना खाता और सारा स्वास्थ्य डेटा स्थायी रूप से हटाना चाहते हैं?'
                : 'Permanently delete your account, cloud Firestore records, and encrypted local data? This cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {deleting ? '...' : isHi ? 'हाँ, सब हटाएं' : 'Confirm Permanent Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[40px] px-4 rounded-xl bg-white dark:bg-[#111a15] text-xs font-semibold border border-slate-200 dark:border-emerald-900/50"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Medical Disclaimer */}
      <section className="p-5 rounded-3xl bg-stone-100 dark:bg-[#111a15] border border-slate-200/80 dark:border-emerald-900/50 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {t(language, 'medicalDisclaimer')}
        </p>
      </section>

      {/* Mobile / Flutter Architecture Blueprint Accordion */}
      <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowBlueprint((v) => !v)}
          className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left text-sm font-semibold"
        >
          <span>{isHi ? 'सिस्टम आर्किटेक्चर, स्क्रीन सूची और डेटाबेस स्कीमा' : 'App Screen List, Firestore Schema & Mobile Architecture'}</span>
          {showBlueprint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showBlueprint && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-emerald-950 text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
            <div>
              <strong className="text-slate-900 dark:text-white">Screens:</strong> 1. Onboarding & Goal Calculator · 2. Daily Dashboard · 3. Food Search / Barcode / AI Photo Logger · 4. Quick Manual Food Entry · 5. Progress & Weekly Report · 6. AI Coach (7-Day Meal Plan, Home/Gym Workouts, Chat) · 7. Settings & Privacy.
            </div>
            <div>
              <strong className="text-slate-900 dark:text-white">Firestore Collections:</strong>{' '}
              <code>/users/&#123;uid&#125;</code>, <code>foodLogs/&#123;logId&#125;</code>, <code>dailyMetrics/&#123;YYYY-MM-DD&#125;</code>,{' '}
              <code>customFoods/&#123;foodId&#125;</code>, <code>favorites/&#123;foodId&#125;</code>, <code>progressEntries/&#123;entryId&#125;</code>,{' '}
              <code>coachPlans/&#123;planId&#125;</code>, <code>activityLogs/&#123;activityId&#125;</code>, <code>dailySchedules/&#123;YYYY-MM-DD&#125;</code>.
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
