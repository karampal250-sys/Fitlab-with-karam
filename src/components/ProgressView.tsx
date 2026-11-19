import React, { useMemo, useRef, useState } from 'react';
import { Calendar, Camera, CheckCircle2, Droplets, Flame, Plus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  ActivityLogEntry,
  DailyMetrics,
  FoodLogEntry,
  Language,
  ProgressEntry,
  UserProfile,
} from '../types/fitplate';
import { evaluateWeeklyProgress } from '../utils/nutritionMath';
import { t } from '../i18n/translations';
import { WeeklyWeightChart, type WeightChartRangeKey } from './WeeklyWeightChart';

type ReportPeriod = '1w' | '1m' | 'all';

interface ProgressViewProps {
  profile: UserProfile;
  language: Language;
  entries: ProgressEntry[];
  foodLogs?: FoodLogEntry[];
  dailyMetricsMap?: Record<string, DailyMetrics>;
  activityLogs?: ActivityLogEntry[];
  onAddEntry: (entry: ProgressEntry) => void;
  onApplyAdjustedTarget: (newCalories: number) => void;
}

function shiftIsoDate(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  if (!y || !m || !d) return baseIso;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  profile,
  language,
  entries,
  foodLogs = [],
  dailyMetricsMap = {},
  activityLogs = [],
  onAddEntry,
  onApplyAdjustedTarget,
}) => {
  const isHi = language === 'hi';
  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);
  const latestWeight = sorted.length > 0 ? sorted[sorted.length - 1].weightKg : profile.currentWeightKg;

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('1w');
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

  // Build 1-Week (7d), 1-Month (30d), or All-Time Progress Report summary
  const periodSummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const windowDays = reportPeriod === '1w' ? 7 : reportPeriod === '1m' ? 30 : null;
    const cutoffDate = windowDays ? shiftIsoDate(todayStr, -(windowDays - 1)) : null;

    const inPeriod = (iso: string) => (!cutoffDate ? true : iso >= cutoffDate && iso <= todayStr);

    const periodWeightEntries = sorted.filter((e) => inPeriod(e.date));
    const startW =
      periodWeightEntries.length > 0
        ? periodWeightEntries[0].weightKg
        : sorted.length > 0
        ? sorted[0].weightKg
        : profile.currentWeightKg;
    const endW =
      periodWeightEntries.length > 0 ? periodWeightEntries[periodWeightEntries.length - 1].weightKg : latestWeight;
    const weightDelta = Math.round((endW - startW) * 10) / 10;

    // Group food logs by day within selected period
    const dayTotals = new Map<
      string,
      { calories: number; protein: number; carbs: number; fat: number; fiber: number }
    >();
    for (const log of foodLogs) {
      if (!inPeriod(log.date)) continue;
      const curr = dayTotals.get(log.date) || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      curr.calories += log.calories || 0;
      curr.protein += log.protein || 0;
      curr.carbs += log.carbs || 0;
      curr.fat += log.fat || 0;
      curr.fiber += log.fiber || 0;
      dayTotals.set(log.date, curr);
    }

    const trackedFoodDays = dayTotals.size;
    let sumCal = 0;
    let sumPro = 0;
    let proteinHitDays = 0;
    let calorieGoalDays = 0;
    for (const d of dayTotals.values()) {
      sumCal += d.calories;
      sumPro += d.protein;
      if (profile.proteinTargetG > 0 && d.protein >= profile.proteinTargetG * 0.9) {
        proteinHitDays++;
      }
      if (
        profile.dailyCalorieTarget > 0 &&
        d.calories >= profile.dailyCalorieTarget * 0.85 &&
        d.calories <= profile.dailyCalorieTarget * 1.15
      ) {
        calorieGoalDays++;
      }
    }

    const avgCalories = trackedFoodDays > 0 ? Math.round(sumCal / trackedFoodDays) : 0;
    const avgProtein = trackedFoodDays > 0 ? Math.round(sumPro / trackedFoodDays) : 0;

    // Water & activity burn in period
    const metricEntries = Object.values(dailyMetricsMap).filter((m) => inPeriod(m.date));
    const waterDays = metricEntries.filter((m) => m.waterMl > 0);
    const avgWaterMl =
      waterDays.length > 0
        ? Math.round(waterDays.reduce((s, m) => s + m.waterMl, 0) / waterDays.length)
        : 0;

    const activityBurnInLogs = activityLogs
      .filter((a) => inPeriod(a.date))
      .reduce((s, a) => s + (a.caloriesBurned || 0), 0);
    const metricBurn = metricEntries.reduce((s, m) => s + (m.exerciseCalories || 0), 0);
    const totalBurnedKcal = Math.max(activityBurnInLogs, metricBurn);

    // Build chronological daily rows for the selected window (most recent first, max 30 days)
    const allDatesSet = new Set<string>([
      ...dayTotals.keys(),
      ...waterDays.map((m) => m.date),
      ...periodWeightEntries.map((e) => e.date),
    ]);
    const dailyBreakdown = Array.from(allDatesSet)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, windowDays || 30)
      .map((dIso) => {
        const macros = dayTotals.get(dIso);
        const m = dailyMetricsMap[dIso];
        const wEntry = periodWeightEntries.find((e) => e.date === dIso);
        return {
          date: dIso,
          calories: macros ? Math.round(macros.calories) : 0,
          protein: macros ? Math.round(macros.protein) : 0,
          waterMl: m?.waterMl || 0,
          burnedKcal: m?.exerciseCalories || 0,
          weightKg: wEntry?.weightKg,
        };
      });

    return {
      windowDays,
      startW,
      endW,
      weightDelta,
      trackedFoodDays,
      avgCalories,
      avgProtein,
      avgWaterMl,
      totalBurnedKcal,
      proteinHitDays,
      calorieGoalDays,
      checkInCount: periodWeightEntries.length,
      dailyBreakdown,
    };
  }, [reportPeriod, sorted, foodLogs, dailyMetricsMap, activityLogs, profile, latestWeight]);

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

  const chartSelectedRange: WeightChartRangeKey = reportPeriod;
  const handleChartRangeChange = (next: WeightChartRangeKey) => {
    if (next === '1w' || next === '1m' || next === 'all') {
      setReportPeriod(next);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: 1 Week / 1 Month / All Time Progress Report + Weight Graph */}
      <div className="lg:col-span-7 space-y-5">
        {/* Selectable 1 Week / 1 Month / All Time Progress Report Card */}
        <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">
                {reportPeriod === '1w'
                  ? isHi
                    ? '1 सप्ताह प्रगति रिपोर्ट'
                    : '1-Week Progress Report'
                  : reportPeriod === '1m'
                  ? isHi
                    ? '1 माह प्रगति रिपोर्ट'
                    : '1-Month Progress Report'
                  : isHi
                  ? 'संपूर्ण प्रगति रिपोर्ट'
                  : 'All-Time Progress Report'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {reportPeriod === '1w'
                  ? isHi
                    ? 'पिछले 7 दिनों का वज़न, पोषण और पानी सारांश'
                    : 'Last 7 days weight, nutrition, hydration & burn summary'
                  : reportPeriod === '1m'
                  ? isHi
                    ? 'पिछले 30 दिनों का वज़न, पोषण और पानी सारांश'
                    : 'Last 30 days weight, nutrition, hydration & burn summary'
                  : isHi
                  ? 'शुरुआत से अब तक की कुल प्रगति'
                  : 'Full history calibrated against your goal timeline'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Period Choice Segmented Control */}
              <div className="inline-flex p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
                {(
                  [
                    ['1w', isHi ? '1 सप्ताह' : '1 Week'],
                    ['1m', isHi ? '1 माह' : '1 Month'],
                    ['all', isHi ? 'सभी' : 'All Time'],
                  ] as [ReportPeriod, string][]
                ).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setReportPeriod(val)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      reportPeriod === val
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
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
          </div>

          {/* Primary Weight & Rate Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
              <div className="text-xs text-slate-500">{isHi ? 'वर्तमान वज़न' : 'Current'}</div>
              <div className="font-mono-num text-xl font-bold mt-0.5">{latestWeight} kg</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
              <div className="text-xs text-slate-500">
                {reportPeriod === '1w'
                  ? isHi
                    ? '7-दिन बदलाव'
                    : '7-Day Change'
                  : reportPeriod === '1m'
                  ? isHi
                    ? '30-दिन बदलाव'
                    : '30-Day Change'
                  : isHi
                  ? 'साप्ताहिक बदलाव'
                  : 'Weekly Rate'}
              </div>
              <div className="font-mono-num text-xl font-bold mt-0.5 flex items-center gap-1">
                {(() => {
                  const val = reportPeriod === 'all' ? report.actualWeeklyChangeKg : periodSummary.weightDelta;
                  return (
                    <>
                      <span>
                        {val > 0 ? '+' : ''}
                        {val} kg
                      </span>
                      {val <= 0 ? (
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-sky-600" />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b]">
              <div className="text-xs text-slate-500">{isHi ? 'लक्ष्य वज़न' : 'Goal'}</div>
              <div className="font-mono-num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {profile.targetWeightKg} kg
              </div>
            </div>
          </div>

          {/* Nutrition, Hydration & Activity Consistency Metrics for Selected Period */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-stone-50/90 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{isHi ? 'लॉग किए दिन' : 'Days Logged'}</span>
              </div>
              <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-1">
                {periodSummary.trackedFoodDays}
                {periodSummary.windowDays ? ` / ${periodSummary.windowDays}` : ''}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {periodSummary.proteinHitDays} {isHi ? 'दिन प्रोटीन लक्ष्य पूर्ण' : 'protein goal days'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50/90 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>{isHi ? 'औसत कैलोरी' : 'Avg Calories'}</span>
              </div>
              <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-1">
                {periodSummary.avgCalories} <span className="text-[11px] font-normal">kcal</span>
              </div>
              <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                {isHi ? 'लक्ष्य' : 'Target'} {profile.dailyCalorieTarget}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50/90 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{isHi ? 'औसत प्रोटीन' : 'Avg Protein'}</span>
              </div>
              <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-1">
                {periodSummary.avgProtein} <span className="text-[11px] font-normal">g/day</span>
              </div>
              <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                {isHi ? 'लक्ष्य' : 'Target'} {profile.proteinTargetG} g
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50/90 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Droplets className="w-3.5 h-3.5 text-sky-500" />
                <span>{isHi ? 'औसत पानी / बर्न' : 'Water & Burn'}</span>
              </div>
              <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-1">
                {(periodSummary.avgWaterMl / 1000).toFixed(1)} L
              </div>
              <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                {periodSummary.totalBurnedKcal} kcal {isHi ? 'बर्न' : 'burned'}
              </div>
            </div>
          </div>

          {/* Daily Breakdown List for Chosen Period */}
          {periodSummary.dailyBreakdown.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-emerald-900/50 overflow-hidden">
              <div className="px-3.5 py-2 bg-stone-50 dark:bg-[#090e0b] border-b border-slate-200/70 dark:border-emerald-900/40 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span>
                  {reportPeriod === '1w'
                    ? isHi
                      ? 'पिछले 7 दिनों का दैनिक विवरण'
                      : 'Daily Breakdown (Last 7 Days)'
                    : reportPeriod === '1m'
                    ? isHi
                      ? 'पिछले 30 दिनों का दैनिक विवरण'
                      : 'Daily Breakdown (Last 30 Days)'
                    : isHi
                    ? 'हालिया दैनिक विवरण'
                    : 'Recent Daily Breakdown'}
                </span>
                <span className="font-mono-num">
                  {periodSummary.dailyBreakdown.length} {isHi ? 'दिन' : 'days'}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-emerald-950/60 max-h-56 overflow-y-auto">
                {periodSummary.dailyBreakdown.map((row) => (
                  <div
                    key={row.date}
                    className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-mono-num"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{row.date}</span>
                    <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                      <span>{row.calories} kcal</span>
                      <span>P {row.protein}g</span>
                      <span className="text-sky-600 dark:text-sky-400">
                        {(row.waterMl / 1000).toFixed(1)}L
                      </span>
                      {row.weightKg !== undefined && (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {row.weightKg}kg
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

        {/* Synced Weight Trend Chart (supports 1W, 1M, 12W, All) */}
        <WeeklyWeightChart
          entries={entries}
          targetWeightKg={profile.targetWeightKg}
          goalType={profile.goalType}
          language={language}
          selectedRange={chartSelectedRange}
          onRangeChange={handleChartRangeChange}
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
