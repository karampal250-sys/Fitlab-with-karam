import React, { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { GoalType, Language, ProgressEntry } from '../types/fitplate';

export type WeightChartRangeKey = '1w' | '1m' | '12w' | 'all';
type SeriesMode = 'weekly' | 'daily';

interface WeeklyWeightChartProps {
  entries: ProgressEntry[];
  targetWeightKg: number;
  goalType: GoalType;
  language: Language;
  selectedRange?: WeightChartRangeKey;
  onRangeChange?: (range: WeightChartRangeKey) => void;
  onFocusLogForm?: () => void;
}

interface ChartPoint {
  key: string;
  label: string;
  shortLabel: string;
  weightKg: number;
  minKg: number;
  maxKg: number;
  count: number;
  deltaFromPrevKg: number | null;
}

function getMondayIso(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dateStr;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function formatShortDate(isoDate: string, lang: Language): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function buildWeeklyPoints(sortedEntries: ProgressEntry[], lang: Language): ChartPoint[] {
  const buckets = new Map<string, ProgressEntry[]>();
  for (const entry of sortedEntries) {
    const wk = getMondayIso(entry.date);
    const list = buckets.get(wk);
    if (list) list.push(entry);
    else buckets.set(wk, [entry]);
  }

  const weekKeys = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));
  return weekKeys.map((wk, idx) => {
    const group = buckets.get(wk)!;
    const sum = group.reduce((acc, item) => acc + item.weightKg, 0);
    const avg = Math.round((sum / group.length) * 10) / 10;
    const minKg = Math.min(...group.map((g) => g.weightKg));
    const maxKg = Math.max(...group.map((g) => g.weightKg));
    const prevAvg =
      idx > 0
        ? Math.round(
            (buckets.get(weekKeys[idx - 1])!.reduce((a, b) => a + b.weightKg, 0) /
              buckets.get(weekKeys[idx - 1])!.length) *
              10
          ) / 10
        : null;

    const short = formatShortDate(wk, lang);
    return {
      key: wk,
      label: lang === 'hi' ? `सप्ताह ${short}` : `Week of ${short}`,
      shortLabel: short,
      weightKg: avg,
      minKg,
      maxKg,
      count: group.length,
      deltaFromPrevKg: prevAvg !== null ? Math.round((avg - prevAvg) * 10) / 10 : null,
    };
  });
}

function buildDailyPoints(sortedEntries: ProgressEntry[], lang: Language): ChartPoint[] {
  return sortedEntries.map((entry, idx) => {
    const prev = idx > 0 ? sortedEntries[idx - 1].weightKg : null;
    const short = formatShortDate(entry.date, lang);
    return {
      key: entry.id,
      label: entry.date,
      shortLabel: short,
      weightKg: Math.round(entry.weightKg * 10) / 10,
      minKg: entry.weightKg,
      maxKg: entry.weightKg,
      count: 1,
      deltaFromPrevKg: prev !== null ? Math.round((entry.weightKg - prev) * 10) / 10 : null,
    };
  });
}

function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export const WeeklyWeightChart: React.FC<WeeklyWeightChartProps> = ({
  entries,
  targetWeightKg,
  goalType,
  language,
  selectedRange,
  onRangeChange,
  onFocusLogForm,
}) => {
  const isHi = language === 'hi';
  const [internalRange, setInternalRange] = useState<WeightChartRangeKey>('1m');
  const range = selectedRange ?? internalRange;
  const setRange = (next: WeightChartRangeKey) => {
    setInternalRange(next);
    if (onRangeChange) onRangeChange(next);
  };
  const [mode, setMode] = useState<SeriesMode>('weekly');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sorted = useMemo(() => [...entries].sort((a, b) => a.date.localeCompare(b.date)), [entries]);

  const effectiveMode: SeriesMode = range === '1w' ? 'daily' : mode;

  const allPoints = useMemo(
    () => (effectiveMode === 'weekly' ? buildWeeklyPoints(sorted, language) : buildDailyPoints(sorted, language)),
    [sorted, effectiveMode, language]
  );

  const visiblePoints = useMemo(() => {
    if (range === 'all') return allPoints;
    const daysLimit = range === '1w' ? 7 : range === '1m' ? 30 : 84;
    if (effectiveMode === 'weekly') {
      const weeksLimit = range === '1m' ? 4 : 12;
      return allPoints.slice(-weeksLimit);
    }
    if (allPoints.length === 0) return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const latestEntryDate = sorted[sorted.length - 1].date;
    const anchorDate = latestEntryDate > todayStr ? latestEntryDate : todayStr;
    const [y, m, d] = anchorDate.split('-').map(Number);
    const cutoff = new Date(Date.UTC(y, m - 1, d - (daysLimit - 1))).toISOString().slice(0, 10);
    return allPoints.filter((_, idx) => sorted[idx].date >= cutoff);
  }, [allPoints, range, effectiveMode, sorted]);

  // SVG Geometry
  const SVG_W = 640;
  const SVG_H = 248;
  const PAD_L = 48;
  const PAD_R = 22;
  const PAD_T = 22;
  const PAD_B = 34;
  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;

  const { coords, yTicks, targetY, minW, maxW } = useMemo(() => {
    if (visiblePoints.length === 0) {
      return { coords: [], yTicks: [], targetY: PAD_T + PLOT_H / 2, minW: 60, maxW: 80 };
    }
    const vals = visiblePoints.map((p) => p.weightKg).concat([targetWeightKg]);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const margin = Math.max(1, (rawMax - rawMin) * 0.16);
    const computedMin = Math.floor((rawMin - margin) * 2) / 2;
    const computedMax = Math.ceil((rawMax + margin) * 2) / 2;
    const span = Math.max(2, computedMax - computedMin);

    const pts = visiblePoints.map((pt, idx) => {
      const x =
        visiblePoints.length === 1
          ? PAD_L + PLOT_W / 2
          : PAD_L + (idx / (visiblePoints.length - 1)) * PLOT_W;
      const y = PAD_T + PLOT_H - ((pt.weightKg - computedMin) / span) * PLOT_H;
      return { x, y, pt };
    });

    const tickCount = 4;
    const ticks: { val: number; y: number }[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const val = Math.round((computedMin + (span * i) / tickCount) * 10) / 10;
      const y = PAD_T + PLOT_H - (i / tickCount) * PLOT_H;
      ticks.push({ val, y });
    }

    const tY = PAD_T + PLOT_H - ((targetWeightKg - computedMin) / span) * PLOT_H;
    return { coords: pts, yTicks: ticks, targetY: tY, minW: computedMin, maxW: computedMax };
  }, [visiblePoints, targetWeightKg, PLOT_H, PLOT_W]);

  const linePath = useMemo(() => buildSmoothPath(coords), [coords]);
  const areaPath = useMemo(() => {
    if (coords.length < 2) return '';
    const baseBottom = PAD_T + PLOT_H;
    return `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseBottom} L ${coords[0].x.toFixed(1)} ${baseBottom} Z`;
  }, [coords, linePath, PLOT_H]);

  const selectedIndex =
    activeIndex !== null && activeIndex >= 0 && activeIndex < visiblePoints.length
      ? activeIndex
      : visiblePoints.length > 0
      ? visiblePoints.length - 1
      : null;
  const inspected = selectedIndex !== null ? coords[selectedIndex] : null;

  const summary = useMemo(() => {
    if (visiblePoints.length === 0) return null;
    const first = visiblePoints[0].weightKg;
    const last = visiblePoints[visiblePoints.length - 1].weightKg;
    const totalDelta = Math.round((last - first) * 10) / 10;
    const avgWeeklyDelta =
      visiblePoints.length > 1
        ? Math.round((totalDelta / (visiblePoints.length - 1)) * 10) / 10
        : 0;
    const toGoal = Math.round((targetWeightKg - last) * 10) / 10;
    return { first, last, totalDelta, avgWeeklyDelta, toGoal };
  }, [visiblePoints, targetWeightKg]);

  const isPositiveTrend = (delta: number) => {
    if (delta === 0) return true;
    if (goalType === 'lose') return delta < 0;
    if (goalType === 'gain') return delta > 0;
    return Math.abs(delta) <= 0.5;
  };

  const labelStep = visiblePoints.length <= 7 ? 1 : Math.ceil(visiblePoints.length / 6);

  return (
    <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-5">
      {/* Header + Segmented Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
            {range === '1w'
              ? isHi
                ? '1 सप्ताह का वज़न ट्रेंड'
                : '1-Week Weight Trend'
              : range === '1m'
              ? isHi
                ? '1 माह का वज़न ट्रेंड'
                : '1-Month Weight Trend'
              : isHi
              ? 'साप्ताहिक वज़न ट्रेंड'
              : 'Weight Progress Trend'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {effectiveMode === 'weekly'
              ? isHi
                ? 'दीर्घकालिक प्रगति के लिए साप्ताहिक औसत वज़न'
                : 'Weekly average weigh-ins for long-term trajectory'
              : isHi
              ? 'प्रत्येक लॉग किया गया वज़न'
              : 'Every individual check-in plotted chronologically'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Weekly vs All Check-ins */}
          <div className="inline-flex p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
            {(
              [
                ['weekly', isHi ? 'साप्ताहिक' : 'Weekly'],
                ['daily', isHi ? 'दैनिक' : 'Daily'],
              ] as [SeriesMode, string][]
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setMode(val);
                  setActiveIndex(null);
                }}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  effectiveMode === val
                    ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Time Range Filter: 1W / 1M / 12W / All */}
          <div className="inline-flex p-1 rounded-xl bg-stone-100 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
            {(
              [
                ['1w', isHi ? '1 सप्ताह' : '1W'],
                ['1m', isHi ? '1 माह' : '1M'],
                ['12w', '12W'],
                ['all', isHi ? 'सभी' : 'All'],
              ] as [WeightChartRangeKey, string][]
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setRange(val);
                  setActiveIndex(null);
                }}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-mono-num font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  range === val
                    ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Long-Term Summary Metrics Strip (unboxed tabular figures with hairline divider) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-100 dark:border-emerald-950/80">
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? 'शुरुआती औसत' : 'Period Start'}
            </div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {summary.first} kg
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {mode === 'weekly'
                ? isHi
                  ? 'नवीनतम सप्ताह'
                  : 'Latest Week'
                : isHi
                ? 'नवीनतम वज़न'
                : 'Latest Log'}
            </div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {summary.last} kg
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? 'कुल बदलाव' : 'Total Change'}
            </div>
            <div
              className={`font-mono-num text-base font-bold mt-0.5 flex items-center gap-1 ${
                isPositiveTrend(summary.totalDelta)
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <span>
                {summary.totalDelta > 0 ? '+' : ''}
                {summary.totalDelta} kg
              </span>
              {summary.totalDelta <= 0 ? (
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isHi ? 'लक्ष्य से दूरी' : 'To Target'} ({targetWeightKg} kg)
            </div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {summary.toGoal === 0
                ? isHi
                  ? 'लक्ष्य पूरा'
                  : 'At Goal'
                : `${summary.toGoal > 0 ? '+' : ''}${summary.toGoal} kg`}
            </div>
          </div>
        </div>
      )}

      {/* Interactive SVG Line Chart */}
      {visiblePoints.length > 0 ? (
        <div className="space-y-3">
          {/* Inspected Point Readout Bar */}
          {inspected && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex flex-wrap items-center gap-2 font-mono-num">
                <span className="font-semibold text-slate-900 dark:text-white">{inspected.pt.label}</span>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {inspected.pt.weightKg} kg
                </span>
                {inspected.pt.deltaFromPrevKg !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        isPositiveTrend(inspected.pt.deltaFromPrevKg)
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-amber-600 dark:text-amber-400 font-semibold'
                      }
                    >
                      {inspected.pt.deltaFromPrevKg > 0 ? '+' : ''}
                      {inspected.pt.deltaFromPrevKg} kg {isHi ? 'पिछले से' : 'vs prev'}
                    </span>
                  </>
                )}
              </div>
              {inspected.pt.count > 1 && (
                <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                  {inspected.pt.count} {isHi ? 'चेक-इन' : 'check-ins'} ({inspected.pt.minKg}–{inspected.pt.maxKg} kg)
                </span>
              )}
            </div>
          )}

          <div className="w-full">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              role="img"
              aria-label={isHi ? 'साप्ताहिक वज़न ट्रेंड चार्ट' : 'Weekly weight trend line chart'}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id="weightTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Y-Axis Gridlines & Labels */}
              {yTicks.map((tick) => (
                <g key={tick.val}>
                  <line
                    x1={PAD_L}
                    y1={tick.y}
                    x2={SVG_W - PAD_R}
                    y2={tick.y}
                    className="stroke-slate-200/80 dark:stroke-emerald-950/80"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_L - 8}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono-num"
                  >
                    {tick.val}
                  </text>
                </g>
              ))}

              {/* Target Weight Dashed Reference Line */}
              {targetWeightKg >= minW && targetWeightKg <= maxW && (
                <g>
                  <line
                    x1={PAD_L}
                    y1={targetY}
                    x2={SVG_W - PAD_R}
                    y2={targetY}
                    strokeDasharray="5 4"
                    className="stroke-emerald-600/60 dark:stroke-emerald-400/50"
                    strokeWidth="1.5"
                  />
                  <text
                    x={SVG_W - PAD_R}
                    y={Math.max(PAD_T + 10, targetY - 6)}
                    textAnchor="end"
                    className="fill-emerald-700 dark:fill-emerald-400 text-[10px] font-mono-num font-semibold"
                  >
                    {isHi ? 'लक्ष्य' : 'Goal'} {targetWeightKg} kg
                  </text>
                </g>
              )}

              {/* Subtle Area Fill under Trend Line */}
              {areaPath && <path d={areaPath} fill="url(#weightTrendAreaGrad)" />}

              {/* Smooth Trend Line */}
              {coords.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-emerald-600 dark:stroke-emerald-400"
                />
              )}

              {/* Active Vertical Crosshair */}
              {inspected && (
                <line
                  x1={inspected.x}
                  y1={PAD_T}
                  x2={inspected.x}
                  y2={PAD_T + PLOT_H}
                  strokeDasharray="3 3"
                  className="stroke-slate-400/60 dark:stroke-slate-600/70"
                  strokeWidth="1"
                />
              )}

              {/* Data Nodes & X-Axis Labels */}
              {coords.map((c, idx) => {
                const isSelected = selectedIndex === idx;
                const showXLabel =
                  idx === 0 || idx === coords.length - 1 || idx % labelStep === 0;
                return (
                  <g key={c.pt.key}>
                    {/* Generous invisible hit target for easy touch/hover */}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="16"
                      fill="transparent"
                      className="cursor-pointer"
                      tabIndex={0}
                      role="button"
                      aria-label={`${c.pt.label}: ${c.pt.weightKg} kg`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onFocus={() => setActiveIndex(idx)}
                      onClick={() => setActiveIndex(idx)}
                    />
                    {isSelected && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r="8"
                        className="fill-emerald-500/20 dark:fill-emerald-400/20 pointer-events-none"
                      />
                    )}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isSelected ? 5 : 3.75}
                      className={`pointer-events-none transition-all duration-150 ${
                        isSelected
                          ? 'fill-emerald-600 dark:fill-emerald-400 stroke-white dark:stroke-[#111a15]'
                          : 'fill-white dark:fill-[#111a15] stroke-emerald-600 dark:stroke-emerald-400'
                      }`}
                      strokeWidth="2.25"
                    />
                    {(isSelected || visiblePoints.length <= 8) && (
                      <text
                        x={c.x}
                        y={Math.max(12, c.y - 10)}
                        textAnchor="middle"
                        className={`pointer-events-none text-[10px] font-mono-num ${
                          isSelected
                            ? 'fill-slate-900 dark:fill-white font-bold'
                            : 'fill-slate-600 dark:fill-slate-300 font-medium'
                        }`}
                      >
                        {c.pt.weightKg}
                      </text>
                    )}
                    {showXLabel && (
                      <text
                        x={c.x}
                        y={SVG_H - 8}
                        textAnchor="middle"
                        className={`text-[10px] font-mono-num ${
                          isSelected
                            ? 'fill-slate-800 dark:fill-slate-200 font-semibold'
                            : 'fill-slate-400 dark:fill-slate-500'
                        }`}
                      >
                        {c.pt.shortLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {visiblePoints.length === 1 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {isHi
                ? 'साप्ताहिक ट्रेंड लाइन देखने के लिए अगले सप्ताह एक और वज़न दर्ज करें।'
                : 'Log weigh-ins across multiple weeks to draw your long-term trend curve.'}
            </p>
          )}
        </div>
      ) : (
        <div className="py-10 px-4 text-center space-y-3 border border-dashed border-slate-200 dark:border-emerald-900/50 rounded-2xl">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isHi
              ? 'अपना साप्ताहिक वज़न ट्रेंड ग्राफ़ देखने के लिए पहला चेक-इन दर्ज करें।'
              : 'Log your first weigh-in to plot your weekly weight trend chart.'}
          </p>
          {onFocusLogForm && (
            <button
              type="button"
              onClick={onFocusLogForm}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              {isHi ? 'पहला वज़न दर्ज करें' : 'Log First Check-In'}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
