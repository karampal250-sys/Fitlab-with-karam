import React, { useEffect, useRef, useState } from 'react';

interface CalorieRingProps {
  eaten: number;
  target: number;
  burned: number;
  labelRemaining: string;
  labelOver: string;
  labelTarget?: string;
}

export const CalorieHeroRing: React.FC<CalorieRingProps> = ({
  eaten,
  target,
  burned,
  labelRemaining,
  labelOver,
  labelTarget = 'Target',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  const effectiveTarget = target + burned;
  const remaining = effectiveTarget - eaten;
  const pct = mounted ? Math.min(1, Math.max(0, eaten / Math.max(1, effectiveTarget))) : 0;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const isOver = remaining < 0;

  return (
    <div className="relative flex items-center justify-center w-44 h-44 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 156 156" aria-hidden="true">
        <circle
          cx="78"
          cy="78"
          r={radius}
          fill="none"
          strokeWidth="12"
          className="stroke-slate-100 dark:stroke-emerald-950/80"
        />
        <circle
          cx="78"
          cy="78"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-all duration-1000 ease-out ${
            isOver ? 'stroke-amber-500' : 'stroke-emerald-600 dark:stroke-emerald-500'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          {labelTarget} {target}
        </span>
        <span
          className={`font-mono-num text-2xl sm:text-3xl font-bold tracking-tight leading-tight mt-0.5 ${
            isOver ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          }`}
        >
          {Math.abs(remaining)}
        </span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  const pct = mounted ? Math.min(1, Math.max(0, current / Math.max(1, target))) : 0;
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
            className={`transition-all duration-1000 ease-out ${colorClass}`}
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

interface WaterProgressRingProps {
  waterMl: number;
  waterGoalMl: number;
  labelGoalReached: string;
  labelOfGoal: string;
}

export const WaterProgressRing: React.FC<WaterProgressRingProps> = ({
  waterMl,
  waterGoalMl,
  labelGoalReached,
  labelOfGoal,
}) => {
  const targetPct = Math.min(100, Math.max(0, (waterMl / Math.max(500, waterGoalMl)) * 100));
  const [animatedPct, setAnimatedPct] = useState(0);
  const currentPctRef = useRef(0);

  useEffect(() => {
    const startVal = currentPctRef.current;
    const endVal = targetPct;
    if (Math.abs(endVal - startVal) < 0.05) {
      currentPctRef.current = endVal;
      setAnimatedPct(endVal);
      return;
    }

    const durationMs = 550;
    let startTime: number | null = null;
    let rafId = 0;

    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = startVal + (endVal - startVal) * eased;
      currentPctRef.current = nextVal;
      setAnimatedPct(nextVal);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        currentPctRef.current = endVal;
        setAnimatedPct(endVal);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [targetPct]);

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - animatedPct / 100);
  const goalMet = targetPct >= 100;
  const innerFillHeight = Math.min(100, Math.max(0, animatedPct));

  return (
    <div
      className="relative flex items-center justify-center w-32 h-32 shrink-0"
      role="progressbar"
      aria-valuenow={Math.round(targetPct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Daily water intake progress"
    >
      {/* Subtle rising liquid level inside the inner circle */}
      <div className="absolute inset-3 rounded-full overflow-hidden bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100/80 dark:border-sky-900/40 pointer-events-none">
        <div
          className={`absolute left-0 right-0 bottom-0 transition-colors duration-300 ${
            goalMet ? 'bg-emerald-400/20 dark:bg-emerald-500/20' : 'bg-sky-400/20 dark:bg-sky-500/25'
          }`}
          style={{ height: `${innerFillHeight}%` }}
        />
      </div>

      <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-100 dark:stroke-sky-950/70"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={
            goalMet ? 'stroke-emerald-500 dark:stroke-emerald-400' : 'stroke-sky-500 dark:stroke-sky-400'
          }
        />
      </svg>

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-2">
        <span
          className={`font-mono-num text-2xl font-bold leading-none ${
            goalMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
          }`}
        >
          {Math.round(animatedPct)}%
        </span>
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
          {goalMet ? labelGoalReached : labelOfGoal}
        </span>
      </div>
    </div>
  );
};

