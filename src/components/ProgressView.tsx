import React, { useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Plus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import type { Language, ProgressEntry, UserProfile } from '../types/fitplate';
import { evaluateWeeklyProgress } from '../utils/nutritionMath';
import { t } from '../i18n/translations';
import { WeeklyWeightChart } from './WeeklyWeightChart';

interface ProgressViewProps {
  profile: UserProfile;
  language: Language;
  entries: ProgressEntry[];
  onAddEntry: (entry: ProgressEntry) => void;
  onApplyAdjustedTarget: (newCalories: number) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  profile,
  language,
  entries,
  onAddEntry,
  onApplyAdjustedTarget,
}) => {
  const isHi = language === 'hi';
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const latestWeight = sorted.length > 0 ? sorted[sorted.length - 1].weightKg : profile.currentWeightKg;

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weightKg, setWeightKg] = useState(latestWeight);
  const [waistCm, setWaistCm] = useState<string>('');
  const [chestCm, setChestCm] = useState<string>('');
  const [hipsCm, setHipsCm] = useState<string>('');
  const [armsCm, setArmsCm] = useState<string>('');
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const weightInputRef = useRef<HTMLInputElement | null>(null);

  const report = useMemo(
    () =>
      evaluateWeeklyProgress(
        entries,
        profile.goalType,
        profile.currentWeightKg,
        profile.targetWeightKg,
        profile.timelineWeeks,
        profile.dailyCalorieTarget,
        profile.gender
      ),
    [entries, profile]
  );

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 480;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.72));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ProgressEntry = {
      id: `prog_${Date.now()}`,
      uid: profile.uid,
      date,
      weightKg: Number(weightKg),
      waistCm: waistCm ? Number(waistCm) : undefined,
      chestCm: chestCm ? Number(chestCm) : undefined,
      hipsCm: hipsCm ? Number(hipsCm) : undefined,
      armsCm: armsCm ? Number(armsCm) : undefined,
      note: note.trim() || undefined,
      photoDataUrl,
      createdAt: new Date().toISOString(),
    };
    onAddEntry(entry);
    setNote('');
    setPhotoDataUrl(undefined);
  };

  const handleFocusLogForm = () => {
    weightInputRef.current?.focus();
    weightInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Graph + Weekly Report */}
      <div className="lg:col-span-7 space-y-5">
        {/* Weekly Report Card */}
        <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">
                {isHi ? 'साप्ताहिक प्रगति रिपोर्ट' : 'Weekly Progress Report'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isHi ? 'वज़न के रुझान के अनुसार स्मार्ट कैलोरी समायोजन' : 'Auto-calibrated against your goal timeline'}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                report.status === 'on_track'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : report.status === 'behind'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : report.status === 'ahead'
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                  : 'bg-stone-100 dark:bg-[#090e0b] text-slate-600 dark:text-slate-400'
              }`}
            >
              {report.status === 'on_track'
                ? t(language, 'onTrack')
                : report.status === 'behind'
                ? t(language, 'behind')
                : report.status === 'ahead'
                ? t(language, 'ahead')
                : t(language, 'insufficientData')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
              <div className="text-xs text-slate-500">{isHi ? 'वर्तमान वज़न' : 'Current'}</div>
              <div className="font-mono-num text-xl font-bold mt-0.5">{latestWeight} kg</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
              <div className="text-xs text-slate-500">{isHi ? 'साप्ताहिक बदलाव' : 'Weekly Rate'}</div>
              <div className="font-mono-num text-xl font-bold mt-0.5 flex items-center gap-1">
                {report.actualWeeklyChangeKg > 0 ? '+' : ''}
                {report.actualWeeklyChangeKg} kg
                {report.actualWeeklyChangeKg <= 0 ? (
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                )}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
              <div className="text-xs text-slate-500">{isHi ? 'लक्ष्य वज़न' : 'Goal'}</div>
              <div className="font-mono-num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {profile.targetWeightKg} kg
              </div>
            </div>
          </div>

          {report.suggestedCalorieAdjustment !== 0 &&
            report.recommendedDailyTarget !== profile.dailyCalorieTarget && (
              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs sm:text-sm">
                  <span className="font-semibold">
                    {isHi ? 'अनुशंसित कैलोरी अपडेट:' : 'Suggested Target Adjustment:'}
                  </span>{' '}
                  <span className="font-mono-num font-bold text-emerald-700 dark:text-emerald-300">
                    {profile.dailyCalorieTarget} → {report.recommendedDailyTarget} kcal/day
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyAdjustedTarget(report.recommendedDailyTarget)}
                  className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t(language, 'applyTarget')}
                </button>
              </div>
            )}
        </section>

        {/* Weekly Weight Trend Chart */}
        <WeeklyWeightChart
          entries={entries}
          targetWeightKg={profile.targetWeightKg}
          goalType={profile.goalType}
          language={language}
          onFocusLogForm={handleFocusLogForm}
        />

        {/* History & Photos */}
        <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-3">
          <h3 className="font-display font-semibold text-base">
            {isHi ? 'पिछली प्रविष्टियाँ और फ़ोटो' : 'Check-in History & Progress Photos'}
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-emerald-950/60">
            {[...sorted].reverse().map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {e.photoDataUrl ? (
                    <img
                      src={e.photoDataUrl}
                      alt={`Progress on ${e.date}`}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-emerald-900/50 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-[#090e0b] flex items-center justify-center text-slate-400 shrink-0">
                      <Scale className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-mono-num text-sm font-bold">{e.weightKg} kg</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
                      {e.date}
                      {e.waistCm ? ` · Waist ${e.waistCm}cm` : ''}
                      {e.chestCm ? ` · Chest ${e.chestCm}cm` : ''}
                      {e.hipsCm ? ` · Hips ${e.hipsCm}cm` : ''}
                    </div>
                    {e.note && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">{e.note}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right: Log Weekly Weight & Measurements Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4"
      >
        <h3 className="font-display text-lg font-bold">{isHi ? 'नया चेक-इन जोड़ें' : 'Log Weekly Check-In'}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              {isHi ? 'तारीख' : 'Date'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              {isHi ? 'वज़न (kg)' : 'Weight (kg)'}
            </label>
            <input
              ref={weightInputRef}
              type="number"
              step="0.1"
              min="25"
              max="350"
              required
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-sm font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            [isHi ? 'कमर (cm)' : 'Waist (cm)', waistCm, setWaistCm],
            [isHi ? 'छाती (cm)' : 'Chest (cm)', chestCm, setChestCm],
            [isHi ? 'हिप्स (cm)' : 'Hips (cm)', hipsCm, setHipsCm],
            [isHi ? 'बांह (cm)' : 'Arms (cm)', armsCm, setArmsCm],
          ].map(([lbl, val, setter]) => (
            <div key={String(lbl)}>
              <label className="block text-[11px] text-slate-500 mb-1">{String(lbl)}</label>
              <input
                type="number"
                step="0.5"
                placeholder="--"
                value={String(val)}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] font-mono-num text-xs"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            {isHi ? 'नोट (वैकल्पिक)' : 'Note (optional)'}
          </label>
          <input
            type="text"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isHi ? 'ऊर्जा स्तर, नींद या टिप्पणी...' : 'Energy levels, sleep, or milestone...'}
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-semibold flex items-center gap-2 cursor-pointer">
            <Camera className="w-4 h-4 text-emerald-600" />
            {isHi ? 'प्रोग्रेस फ़ोटो जोड़ें' : 'Add Progress Photo'}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
          {photoDataUrl && <span className="text-xs text-emerald-600 font-medium">Photo ready</span>}
        </div>

        <button
          type="submit"
          className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isHi ? 'वज़न और माप सेव करें' : 'Save Check-In'}
        </button>
      </form>
    </div>
  );
};
