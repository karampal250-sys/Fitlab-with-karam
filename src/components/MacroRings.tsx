import React from 'react';

interface CalorieRingProps {
  eaten: number;
  target: number;
  burned: number;
  labelRemaining: string;
  labelOver: string;
}

export const CalorieHeroRing: React.FC<CalorieRingProps> = ({
  eaten,
  target,
  burned,
  labelRemaining,
  labelOver,
}) => {
  const effectiveTarget = target + burned;
  const remaining = effectiveTarget - eaten;
  const pct = Math.min(1, Math.max(0, eaten / Math.max(1, effectiveTarget)));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const isOver = remaining < 0;

  return (
    <div className="relative flex items-center justify-center w-40 h-40 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 148 148" aria-hidden="true">
        <circle
          cx="74"
          cy="74"
          r={radius}
          fill="none"
          strokeWidth="12"
          className="stroke-slate-100 dark:stroke-emerald-950/80"
        />
        <circle
          cx="74"
          cy="74"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-all duration-500 ease-out ${
            isOver ? 'stroke-amber-500' : 'stroke-emerald-600 dark:stroke-emerald-500'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span
          className={`font-mono-num text-3xl font-bold tracking-tight ${
            isOver ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {Math.abs(remaining)}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
          {isOver ? labelOver : labelRemaining}
        </span>
      </div>
    </div>
  );
};

interface SmallMacroRingProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  colorClass: string;
}

export const SmallMacroRing: React.FC<SmallMacroRingProps> = ({
  label,
  current,
  target,
  unit = 'g',
  colorClass,
}) => {
  const pct = Math.min(1, Math.max(0, current / Math.max(1, target)));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center p-3 rounded-2xl bg-stone-50 dark:bg-emerald-950/30 border border-slate-200/80 dark:border-emerald-900/50">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            strokeWidth="5"
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`transition-all duration-500 ease-out ${colorClass}`}
          />
        </svg>
        <span className="absolute font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100">
          {Math.round(current)}
          {unit}
        </span>
      </div>
      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5">{label}</span>
      <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
        / {target}
        {unit}
      </span>
    </div>
  );
};
