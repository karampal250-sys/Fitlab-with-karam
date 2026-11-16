import React, { useMemo, useState } from 'react';
import { Flame, Plus, Trash2, Trophy } from 'lucide-react';
import type {
  ActivityCategory,
  ActivityIntensity,
  ActivityLogEntry,
  Language,
} from '../types/fitplate';
import {
  calculateActivityCaloriesBurned,
  SPORTS_AND_ACTIVITIES,
  type ActivityPreset,
} from '../data/activitiesCatalog';

interface ActivityBurnTrackerProps {
  uid: string;
  activeDate: string;
  weightKg: number;
  language: Language;
  activities: ActivityLogEntry[];
  onAddActivity: (entry: ActivityLogEntry) => void;
  onDeleteActivity: (id: string) => void;
}

export const ActivityBurnTracker: React.FC<ActivityBurnTrackerProps> = ({
  uid,
  activeDate,
  weightKg,
  language,
  activities,
  onAddActivity,
  onDeleteActivity,
}) => {
  const isHi = language === 'hi';
  const [catFilter, setCatFilter] = useState<'all' | ActivityCategory>('all');
  const [selectedPreset, setSelectedPreset] = useState<ActivityPreset>(SPORTS_AND_ACTIVITIES[1]); // Badminton default
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBurn, setCustomBurn] = useState(200);
  const [durationMin, setDurationMin] = useState(30);
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');

  const dayActivities = useMemo(
    () => activities.filter((a) => a.date === activeDate),
    [activities, activeDate]
  );

  const totalBurned = useMemo(
    () => dayActivities.reduce((sum, a) => sum + a.caloriesBurned, 0),
    [dayActivities]
  );

  const totalMinutes = useMemo(
    () => dayActivities.reduce((sum, a) => sum + a.durationMin, 0),
    [dayActivities]
  );

  const filteredPresets = useMemo(
    () =>
      catFilter === 'all'
        ? SPORTS_AND_ACTIVITIES
        : SPORTS_AND_ACTIVITIES.filter((p) => p.category === catFilter),
    [catFilter]
  );

  const calculatedBurn = useMemo(
    () =>
      customMode
        ? Math.max(1, Math.round(customBurn))
        : calculateActivityCaloriesBurned(selectedPreset, intensity, durationMin, weightKg),
    [customMode, customBurn, selectedPreset, intensity, durationMin, weightKg]
  );

  const handleLogActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const label = customMode
      ? customName.trim() || (isHi ? 'कस्टम गतिविधि' : 'Custom Activity')
      : isHi
      ? selectedPreset.nameHi
      : selectedPreset.nameEn;

    const entry: ActivityLogEntry = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uid,
      date: activeDate,
      activityId: customMode ? 'custom_activity' : selectedPreset.id,
      activityName: label.slice(0, 100),
      category: customMode ? 'sports' : selectedPreset.category,
      durationMin: Math.max(1, Math.min(720, Math.round(durationMin))),
      intensity,
      caloriesBurned: calculatedBurn,
      createdAt: new Date().toISOString(),
    };
    onAddActivity(entry);
    if (customMode) setCustomName('');
  };

  return (
    <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm sm:text-base">
              {isHi ? 'खेल और कैलोरी बर्न ट्रैकर' : 'Sports & Calorie Burn Tracker'}
            </h3>
            <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
              {totalBurned} kcal · {totalMinutes} {isHi ? 'मिनट' : 'min'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCustomMode((v) => !v)}
          className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold hover:border-emerald-500"
        >
          {customMode ? (isHi ? 'लिस्ट चुनें' : 'Pick Sport') : isHi ? '+ कस्टम' : '+ Custom'}
        </button>
      </div>

      {/* Category Filters */}
      {!customMode && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                ['all', isHi ? 'सभी' : 'All'],
                ['sports', isHi ? 'खेल' : 'Sports'],
                ['cardio', isHi ? 'कार्डियो' : 'Cardio'],
                ['strength', isHi ? 'जिम / योग' : 'Strength & Yoga'],
                ['daily', isHi ? 'दैनिक' : 'Daily'],
              ] as const
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                  catFilter === cat
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                    : 'bg-stone-50 dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/50 text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {filteredPresets.map((preset) => {
              const active = selectedPreset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPreset(preset)}
                  className={`min-h-[42px] px-2.5 py-1.5 rounded-xl border text-left text-xs font-medium transition-colors ${
                    active
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-200 font-semibold'
                      : 'bg-stone-50 dark:bg-[#090e0b] border-slate-200/80 dark:border-emerald-900/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="truncate">{isHi ? preset.nameHi : preset.nameEn}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Duration, Intensity & Log Form */}
      <form onSubmit={handleLogActivity} className="space-y-3 pt-1">
        {customMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              maxLength={100}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={isHi ? 'खेल या गतिविधि का नाम (जैसे: कबड्डी)' : 'Sport or activity (e.g. Kabaddi, Trekking)'}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs"
            />
            <input
              type="number"
              min={1}
              max={6000}
              value={customBurn}
              onChange={(e) => setCustomBurn(Number(e.target.value))}
              placeholder="Calories burned"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {isHi ? 'अवधि (मिनट)' : 'Duration (minutes)'}
            </label>
            <div className="flex items-center gap-1.5">
              {[15, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMin(m)}
                  className={`flex-1 min-h-[40px] rounded-xl font-mono-num text-xs font-semibold border ${
                    durationMin === m
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-50 dark:bg-[#090e0b] border-slate-200 dark:border-emerald-900/50'
                  }`}
                >
                  {m}m
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={720}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, Number(e.target.value) || 15))}
                className="w-14 min-h-[40px] px-2 rounded-xl border border-slate-200 dark:border-emerald-900/50 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {isHi ? 'तीव्रता' : 'Intensity'}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b]">
              {(
                [
                  ['light', isHi ? 'हल्का' : 'Light'],
                  ['moderate', isHi ? 'मध्यम' : 'Moderate'],
                  ['vigorous', isHi ? 'तेज़' : 'Vigorous'],
                ] as [ActivityIntensity, string][]
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setIntensity(val)}
                  className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors ${
                    intensity === val ? 'bg-white dark:bg-emerald-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isHi ? 'बर्न लॉग करें' : 'Log Burn'} ·{' '}
          <span className="font-mono-num">{calculatedBurn} kcal</span>
        </button>
      </form>

      {/* Logged Sports / Activities Today */}
      {dayActivities.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-emerald-950/60 pt-2 border-t border-slate-100 dark:border-emerald-950">
          {dayActivities.map((act) => (
            <div key={act.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {act.activityName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                  {act.durationMin} min · {act.intensity}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono-num text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  {act.caloriesBurned} kcal
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteActivity(act.id)}
                  aria-label="Delete activity"
                  className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-rose-500 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
