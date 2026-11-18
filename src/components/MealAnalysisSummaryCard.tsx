import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Lightbulb,
  Plus,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  DailyMealAnalysis,
  FoodLogEntry,
  Language,
  MealType,
  UserProfile,
} from '../types/fitplate';
import { apiUrl, safeFetchJson } from '../utils/apiUrl';

interface MealAnalysisSummaryCardProps {
  activeDate: string;
  language: Language;
  profile: UserProfile;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  dayLogs: FoodLogEntry[];
  onOpenLogger: (mealType: MealType) => void;
}

interface MacroBreakdownItem {
  key: 'calories' | 'protein' | 'fiber' | 'carbs' | 'fat';
  label: string;
  current: number;
  target: number;
  unit: string;
  pct: number;
  score: number;
  barClass: string;
}

function scoreMacroAdherence(
  current: number,
  target: number,
  allowMildSurplus: boolean
): number {
  if (target <= 0) return 100;
  const ratio = current / target;
  if (ratio <= 0) return 0;
  if (ratio < 0.85) {
    return Math.round((ratio / 0.85) * 90);
  }
  const upperSweetSpot = allowMildSurplus ? 1.35 : 1.12;
  if (ratio <= upperSweetSpot) {
    return 100;
  }
  const excess = ratio - upperSweetSpot;
  return Math.max(20, Math.round(100 - excess * 110));
}

function getScoreTheme(score: number | null) {
  if (score === null) {
    return {
      ringStroke: 'stroke-slate-300 dark:stroke-slate-700',
      text: 'text-slate-400 dark:text-slate-500',
      badgeBg: 'bg-stone-100 dark:bg-[#090e0b] text-slate-600 dark:text-slate-400',
    };
  }
  if (score >= 80) {
    return {
      ringStroke: 'stroke-emerald-500 dark:stroke-emerald-400',
      text: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    };
  }
  if (score >= 60) {
    return {
      ringStroke: 'stroke-sky-500 dark:stroke-sky-400',
      text: 'text-sky-600 dark:text-sky-400',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
    };
  }
  if (score >= 40) {
    return {
      ringStroke: 'stroke-amber-500 dark:stroke-amber-400',
      text: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    };
  }
  return {
    ringStroke: 'stroke-rose-500 dark:stroke-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
  };
}

export const MealAnalysisSummaryCard: React.FC<MealAnalysisSummaryCardProps> = ({
  activeDate,
  language,
  profile,
  totals,
  dayLogs,
  onOpenLogger,
}) => {
  const isHi = language === 'hi';
  const hasLogs = dayLogs.length > 0;

  const logSignature = `${activeDate}|${dayLogs.length}|${totals.calories}|${totals.protein}|${totals.carbs}|${totals.fat}|${totals.fiber}`;

  const [aiAnalysis, setAiAnalysis] = useState<DailyMealAnalysis | null>(null);
  const [analyzedSignature, setAnalyzedSignature] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset analysis cleanly when activeDate changes or all meals for the day are removed
  useEffect(() => {
    setAiAnalysis(null);
    setAnalyzedSignature('');
    setErrorMsg(null);
  }, [activeDate]);

  useEffect(() => {
    if (!hasLogs) {
      setAiAnalysis(null);
      setAnalyzedSignature('');
      setErrorMsg(null);
    }
  }, [hasLogs]);

  const macroBreakdown: MacroBreakdownItem[] = useMemo(() => {
    const calTarget = Math.max(1, profile.dailyCalorieTarget);
    const proTarget = Math.max(1, profile.proteinTargetG);
    const fibTarget = Math.max(1, profile.fiberTargetG);
    const carbTarget = Math.max(1, profile.carbsTargetG);
    const fatTarget = Math.max(1, profile.fatTargetG);

    return [
      {
        key: 'calories',
        label: isHi ? 'कैलोरी' : 'Calories',
        current: Math.round(totals.calories),
        target: calTarget,
        unit: 'kcal',
        pct: Math.min(100, Math.round((totals.calories / calTarget) * 100)),
        score: scoreMacroAdherence(totals.calories, calTarget, false),
        barClass: 'bg-emerald-500',
      },
      {
        key: 'protein',
        label: isHi ? 'प्रोटीन' : 'Protein',
        current: totals.protein,
        target: proTarget,
        unit: 'g',
        pct: Math.min(100, Math.round((totals.protein / proTarget) * 100)),
        score: scoreMacroAdherence(totals.protein, proTarget, true),
        barClass: 'bg-emerald-600',
      },
      {
        key: 'fiber',
        label: isHi ? 'फाइबर' : 'Fiber',
        current: totals.fiber,
        target: fibTarget,
        unit: 'g',
        pct: Math.min(100, Math.round((totals.fiber / fibTarget) * 100)),
        score: scoreMacroAdherence(totals.fiber, fibTarget, true),
        barClass: 'bg-teal-500',
      },
      {
        key: 'carbs',
        label: isHi ? 'कार्ब्स' : 'Carbs',
        current: totals.carbs,
        target: carbTarget,
        unit: 'g',
        pct: Math.min(100, Math.round((totals.carbs / carbTarget) * 100)),
        score: scoreMacroAdherence(totals.carbs, carbTarget, false),
        barClass: 'bg-sky-500',
      },
      {
        key: 'fat',
        label: isHi ? 'फैट' : 'Fat',
        current: totals.fat,
        target: fatTarget,
        unit: 'g',
        pct: Math.min(100, Math.round((totals.fat / fatTarget) * 100)),
        score: scoreMacroAdherence(totals.fat, fatTarget, false),
        barClass: 'bg-amber-500',
      },
    ];
  }, [totals, profile, isHi]);

  const liveMacroScore = useMemo(() => {
    if (!hasLogs) return null;
    const weights: Record<MacroBreakdownItem['key'], number> = {
      protein: 0.3,
      calories: 0.25,
      fiber: 0.2,
      carbs: 0.15,
      fat: 0.1,
    };
    const weighted = macroBreakdown.reduce(
      (sum, item) => sum + item.score * weights[item.key],
      0
    );
    return Math.max(0, Math.min(100, Math.round(weighted)));
  }, [hasLogs, macroBreakdown]);

  const liveGradeLabel = useMemo(() => {
    if (liveMacroScore === null) return isHi ? 'कोई डेटा नहीं' : 'No meals yet';
    if (liveMacroScore >= 85) return isHi ? 'उत्कृष्ट संतुलन' : 'Excellent';
    if (liveMacroScore >= 70) return isHi ? 'सही ट्रैक पर' : 'On Track';
    if (liveMacroScore >= 50) return isHi ? 'मध्यम संतुलन' : 'Moderate';
    return isHi ? 'सुधार की आवश्यकता' : 'Needs Balance';
  }, [liveMacroScore, isHi]);

  const displayedScore = aiAnalysis ? aiAnalysis.nutritionScore : liveMacroScore;
  const displayedGrade = aiAnalysis?.gradeLabel || liveGradeLabel;
  const isStale = Boolean(aiAnalysis && analyzedSignature !== logSignature);
  const theme = getScoreTheme(displayedScore);

  // SVG Ring geometry
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    displayedScore === null
      ? ringCircumference
      : ringCircumference * (1 - displayedScore / 100);

  const runAiMealAnalysis = async () => {
    if (!hasLogs || loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { ok, data } = await safeFetchJson<DailyMealAnalysis & { error?: string }>(
        apiUrl('/api/ai/meal-analysis'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeDate,
            goalType: profile.goalType,
            dietType: profile.dietType,
            language,
            totals,
            targets: {
              calories: profile.dailyCalorieTarget,
              protein: profile.proteinTargetG,
              carbs: profile.carbsTargetG,
              fat: profile.fatTargetG,
              fiber: profile.fiberTargetG,
            },
            meals: dayLogs.map((entry) => ({
              mealType: entry.mealType,
              foodName: entry.foodName,
              servingQty: entry.servingQty,
              servingUnit: entry.servingUnit,
              calories: entry.calories,
              protein: entry.protein,
              carbs: entry.carbs,
              fat: entry.fat,
              fiber: entry.fiber,
            })),
          }),
        }
      );

      if (!ok || !data || typeof data.nutritionScore !== 'number') {
        setErrorMsg(
          data?.error ||
            (isHi
              ? 'AI मील विश्लेषण उपलब्ध नहीं हो सका। कृपया पुनः प्रयास करें।'
              : 'Unable to complete AI meal analysis right now.')
        );
        return;
      }

      setAiAnalysis(data);
      setAnalyzedSignature(logSignature);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isHi
          ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।'
          : 'Network error while analyzing meals.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-label={isHi ? 'AI मील विश्लेषण और पोषण स्कोर' : 'AI Meal Analysis & Nutrition Score'}
      className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/90 dark:border-emerald-900/60 p-5 sm:p-6 space-y-5 shadow-sm"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              {isHi ? 'AI मील विश्लेषण और पोषण स्कोर' : 'AI Meal Analysis & Nutrition Score'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {aiAnalysis
                ? isHi
                  ? 'Gemini AI द्वारा आज के मैक्रोज़ का मूल्यांकन'
                  : 'Evaluated from today’s logged macros'
                : isHi
                ? 'लॉग किए गए भोजन मैक्रोज़ पर आधारित लाइव स्कोर'
                : 'Live macro adherence score from today’s logged foods'}
            </p>
          </div>
        </div>

        {hasLogs && (
          <button
            type="button"
            disabled={loading}
            onClick={runAiMealAnalysis}
            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {loading
                ? isHi
                  ? 'विश्लेषण जारी...'
                  : 'Analyzing...'
                : aiAnalysis
                ? isHi
                  ? 'AI स्कोर अपडेट करें'
                  : 'Refresh AI Analysis'
                : isHi
                ? 'AI से विश्लेषण करें'
                : 'Analyze Meals with AI'}
            </span>
          </button>
        )}
      </div>

      {/* Empty State when no meals logged for activeDate */}
      {!hasLogs ? (
        <div className="rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-dashed border-slate-200 dark:border-emerald-900/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48"
                  cy="48"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="8"
                  className="stroke-slate-200 dark:stroke-emerald-950"
                />
              </svg>
              <span className="absolute font-mono-num text-base font-bold text-slate-400 dark:text-slate-500">
                --
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <UtensilsCrossed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {isHi ? 'आज का पोषण स्कोर प्रतीक्षारत है' : 'Daily Nutrition Score awaiting meals'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isHi
                  ? 'आज के प्रोटीन, फाइबर, कार्ब्स और कैलोरी के आधार पर अपना स्कोर देखने के लिए कम से कम एक भोजन जोड़ें।'
                  : 'Log at least one meal today to calculate your macro-based Nutrition Score and unlock personalized AI insights.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenLogger('breakfast')}
            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isHi ? 'भोजन जोड़ें' : 'Log Meal'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Score Gauge + 5 Macro Progress Bars */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5 p-4 rounded-2xl bg-stone-50/90 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/50">
            {/* Circular Nutrition Score Gauge */}
            <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-3 sm:min-w-[128px] sm:pr-4 sm:border-r border-slate-200/80 dark:border-emerald-900/50">
              <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r={ringRadius}
                    fill="none"
                    strokeWidth="8"
                    className="stroke-slate-200 dark:stroke-emerald-950"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={ringRadius}
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className={`${theme.ringStroke} transition-all duration-500`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`font-mono-num text-2xl font-bold leading-none ${theme.text}`}>
                    {displayedScore}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                    / 100
                  </span>
                </div>
              </div>

              <div className="text-right sm:text-center space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isHi ? 'पोषण स्कोर' : 'Nutrition Score'}
                </div>
                <div className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${theme.badgeBg}`}>
                  {displayedGrade}
                </div>
              </div>
            </div>

            {/* 5 Macro Adherence Bars */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
              {macroBreakdown.map((m) => (
                <div key={m.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{m.label}</span>
                    <span className="font-mono-num text-slate-500 dark:text-slate-400">
                      <strong className="text-slate-900 dark:text-white">{m.current}</strong> / {m.target} {m.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-emerald-950/70 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.barClass} transition-all duration-300`}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>
                  {dayLogs.length} {isHi ? 'लॉग आइटम विश्लेषित' : dayLogs.length === 1 ? 'logged food item' : 'logged food items'}
                </span>
                {isStale && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {isHi ? 'भोजन अपडेट हुए — AI विश्लेषण रीफ्रेश करें' : 'Meals updated — refresh AI analysis'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* API Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* AI Analysis Details */}
          {aiAnalysis ? (
            <div className="space-y-3 pt-1">
              <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                {aiAnalysis.summary}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Strengths */}
                {aiAnalysis.strengths.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 space-y-2">
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isHi ? 'आज के मजबूत बिंदु' : 'Macro Highlights'}
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {aiAnalysis.strengths.map((s, idx) => (
                        <li key={idx} className="leading-snug">
                          • {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps */}
                {aiAnalysis.gaps.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/50 space-y-2">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {isHi ? 'सुधार के क्षेत्र' : 'Nutrient Gaps'}
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {aiAnalysis.gaps.map((g, idx) => (
                        <li key={idx} className="leading-snug">
                          • {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {aiAnalysis.nextStepAdvice && (
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/80 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs">
                  <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {isHi ? 'अगला स्मार्ट कदम:' : 'Recommended Next Step:'}
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{aiAnalysis.nextStepAdvice}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                {isHi
                  ? 'प्रोटीन, फाइबर, कार्ब्स और कैलोरी संतुलन का विस्तृत AI रिव्यू पाने के लिए "AI से विश्लेषण करें" दबाएं।'
                  : 'Tap "Analyze Meals with AI" for a personalized breakdown of strengths, macro gaps, and your next meal tip.'}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
