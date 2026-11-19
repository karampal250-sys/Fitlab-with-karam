import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon, Plus } from 'lucide-react';
import type { Language, MealType } from '../types/fitplate';
import { t } from '../i18n/translations';

interface MacroDistributionChartProps {
  language: Language;
  carbsG: number;
  proteinG: number;
  fatG: number;
  carbsTargetG: number;
  proteinTargetG: number;
  fatTargetG: number;
  itemCount: number;
  onLogFood: (mealType: MealType) => void;
}

interface MacroSlice {
  key: 'carbs' | 'protein' | 'fat';
  name: string;
  grams: number;
  kcal: number;
  targetG: number;
  value: number;
  pct: number;
  color: string;
  dotClass: string;
  textClass: string;
}

interface TooltipPayloadItem {
  payload?: MacroSlice;
}

const MacroTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  isHi: boolean;
}> = ({ active, payload, isHi }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/70 px-3 py-2 shadow-lg text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
        <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass}`} />
        <span>{item.name}</span>
      </div>
      <div className="font-mono-num text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
        <div>
          {item.grams}g · {item.kcal} kcal ({item.pct}%)
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? 'लक्ष्य' : 'Target'}: {item.targetG}g
        </div>
      </div>
    </div>
  );
};

export const MacroDistributionChart: React.FC<MacroDistributionChartProps> = ({
  language,
  carbsG,
  proteinG,
  fatG,
  carbsTargetG,
  proteinTargetG,
  fatTargetG,
  itemCount,
  onLogFood,
}) => {
  const isHi = language === 'hi';
  const [basis, setBasis] = useState<'kcal' | 'grams'>('kcal');

  const safeCarbs = Math.max(0, Math.round(carbsG * 10) / 10);
  const safeProtein = Math.max(0, Math.round(proteinG * 10) / 10);
  const safeFat = Math.max(0, Math.round(fatG * 10) / 10);

  const carbsKcal = Math.round(safeCarbs * 4);
  const proteinKcal = Math.round(safeProtein * 4);
  const fatKcal = Math.round(safeFat * 9);

  const totalMacroKcal = carbsKcal + proteinKcal + fatKcal;
  const totalMacroGrams = Math.round((safeCarbs + safeProtein + safeFat) * 10) / 10;
  const hasData = totalMacroGrams > 0 && totalMacroKcal > 0;

  const slices = useMemo<MacroSlice[]>(() => {
    const raw: Omit<MacroSlice, 'value' | 'pct'>[] = [
      {
        key: 'carbs',
        name: t(language, 'carbs'),
        grams: safeCarbs,
        kcal: carbsKcal,
        targetG: carbsTargetG,
        color: '#0ea5e9',
        dotClass: 'bg-sky-500',
        textClass: 'text-sky-600 dark:text-sky-400',
      },
      {
        key: 'protein',
        name: t(language, 'protein'),
        grams: safeProtein,
        kcal: proteinKcal,
        targetG: proteinTargetG,
        color: '#10b981',
        dotClass: 'bg-emerald-500',
        textClass: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        key: 'fat',
        name: t(language, 'fat'),
        grams: safeFat,
        kcal: fatKcal,
        targetG: fatTargetG,
        color: '#f59e0b',
        dotClass: 'bg-amber-500',
        textClass: 'text-amber-600 dark:text-amber-400',
      },
    ];

    const denom = basis === 'kcal' ? totalMacroKcal : totalMacroGrams;
    return raw.map((item) => {
      const value = basis === 'kcal' ? item.kcal : item.grams;
      const pct = denom > 0 ? Math.round((value / denom) * 100) : 0;
      return { ...item, value, pct };
    });
  }, [
    language,
    safeCarbs,
    safeProtein,
    safeFat,
    carbsKcal,
    proteinKcal,
    fatKcal,
    carbsTargetG,
    proteinTargetG,
    fatTargetG,
    basis,
    totalMacroKcal,
    totalMacroGrams,
  ]);

  const emptyPlaceholder = [{ name: 'Empty', value: 1 }];

  return (
    <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PieChartIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              {isHi ? 'दैनिक मैक्रो वितरण (चार्ट)' : 'Daily Macro Distribution'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isHi
                ? `आज के ${itemCount} भोजन से कार्ब्स, प्रोटीन व फैट अनुपात`
                : `Carbs, protein & fat split across today's ${itemCount} logged ${itemCount === 1 ? 'item' : 'items'}`}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center p-0.5 rounded-xl bg-stone-100 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/50">
          <button
            type="button"
            onClick={() => setBasis('kcal')}
            className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
              basis === 'kcal'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'कैलोरी %' : 'Calorie %'}
          </button>
          <button
            type="button"
            onClick={() => setBasis('grams')}
            className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
              basis === 'grams'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isHi ? 'ग्राम (g)' : 'Grams (g)'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="w-44 h-44 sm:w-48 sm:h-48 shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {hasData ? (
                <Pie
                  data={slices.filter((s) => s.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                >
                  {slices
                    .filter((s) => s.value > 0)
                    .map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                </Pie>
              ) : (
                <Pie
                  data={emptyPlaceholder}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="88%"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill="currentColor" className="text-slate-200 dark:text-emerald-950/80" />
                </Pie>
              )}
              {hasData && <Tooltip content={<MacroTooltip isHi={isHi} />} />}
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
            {hasData ? (
              <>
                <span className="font-mono-num text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {basis === 'kcal' ? totalMacroKcal : totalMacroGrams}
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {basis === 'kcal' ? 'kcal macros' : isHi ? 'कुल ग्राम (g)' : 'total grams'}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono-num text-sm font-bold text-slate-400 dark:text-slate-500">0g</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {isHi ? 'कोई डेटा नहीं' : 'No meals yet'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 w-full space-y-2.5">
          {slices.map((slice) => (
            <div
              key={slice.key}
              className="p-2.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-3 h-3 rounded-full shrink-0 ${slice.dotClass}`} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {slice.name}
                  </div>
                  <div className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                    {slice.grams}g / {slice.targetG}g · {slice.kcal} kcal
                  </div>
                </div>
              </div>
              <span className={`font-mono-num text-sm font-bold shrink-0 ${slice.textClass}`}>
                {slice.pct}%
              </span>
            </div>
          ))}

          {!hasData && (
            <button
              type="button"
              onClick={() => onLogFood('breakfast')}
              className="w-full min-h-[40px] rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {isHi ? 'मैक्रो चार्ट देखने के लिए भोजन जोड़ें' : 'Log food to view macro chart'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
