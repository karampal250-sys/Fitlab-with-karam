import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Check, Clock, Droplets, Dumbbell, Utensils, Volume2 } from 'lucide-react';
import type { FoodLogEntry, Language, MealType, RemindersConfig, ScheduleSlot } from '../types/fitplate';
import { buildDailySchedule, deriveMealTimesFromWakeUp, isNightShiftWakeTime } from '../data/activitiesCatalog';
import { getNextUpcomingSlot } from '../utils/alarmEngine';

interface DailyScheduleCardProps {
  language: Language;
  reminders: RemindersConfig;
  waterGoalMl: number;
  completedSlotIds: string[];
  activeMealType?: MealType;
  dayLogs?: FoodLogEntry[];
  onToggleSlot: (slot: ScheduleSlot) => void;
  onOpenMealLogger: (mealType: MealType) => void;
  onUpdateReminders: (next: RemindersConfig) => void;
  onTestAlarm: () => void;
  onEnableAlarms: () => void;
}

export const DailyScheduleCard: React.FC<DailyScheduleCardProps> = ({
  language,
  reminders,
  waterGoalMl,
  completedSlotIds,
  activeMealType,
  dayLogs = [],
  onToggleSlot,
  onOpenMealLogger,
  onUpdateReminders,
  onTestAlarm,
  onEnableAlarms,
}) => {
  const isHi = language === 'hi';
  const [filter, setFilter] = useState<'all' | 'meal' | 'water'>('all');
  const [editingTimes, setEditingTimes] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const wakeUpTime = reminders.wakeUpTime || '07:00';
  const sleepTime = reminders.sleepTime || deriveMealTimesFromWakeUp(wakeUpTime).sleepTime;
  const nightShift = isNightShiftWakeTime(wakeUpTime);
  const alarmsOn = reminders.alarmsEnabled !== false && reminders.enabled !== false;

  const slots = useMemo(() => buildDailySchedule(reminders, waterGoalMl, nowTick), [reminders, waterGoalMl, nowTick]);
  const visibleSlots = useMemo(
    () => (filter === 'all' ? slots : slots.filter((s) => s.kind === filter)),
    [slots, filter]
  );

  const nextAlarm = useMemo(
    () => getNextUpcomingSlot(slots, wakeUpTime, completedSlotIds, nowTick),
    [slots, wakeUpTime, completedSlotIds, nowTick]
  );

  const completedCount = slots.filter((s) => completedSlotIds.includes(s.id)).length;

  const formatCountdown = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return isHi ? `${m} मिनट में` : `in ${m}m`;
    return isHi ? `${h}घं ${m}मि में` : `in ${h}h ${m}m`;
  };

  return (
    <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base sm:text-lg">
            {isHi ? 'दैनिक भोजन, पानी और अलार्म शेड्यूल' : 'Daily Eating, Water & Alarm Schedule'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {completedCount}/{slots.length} {isHi ? 'पूर्ण' : 'completed'} ·{' '}
            {nightShift ? (isHi ? 'नाइट शिफ्ट' : 'Night Shift') : isHi ? 'डे शिफ्ट' : 'Day Shift'} ·{' '}
            Wake {wakeUpTime} · Sleep {sleepTime}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-stone-100 dark:bg-[#090e0b] rounded-xl">
            {(
              [
                ['all', isHi ? 'सभी' : 'All'],
                ['meal', isHi ? 'भोजन' : 'Meals'],
                ['water', isHi ? 'पानी' : 'Water'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFilter(val)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                  filter === val
                    ? 'bg-white dark:bg-emerald-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditingTimes((v) => !v)}
            aria-label="Customize schedule times"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-emerald-900/60 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-emerald-500"
          >
            <Clock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alarm Status + Next Alarm Strip */}
      <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {alarmsOn ? (
            <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          ) : (
            <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0 text-xs">
            {alarmsOn && nextAlarm ? (
              <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {isHi ? 'अगला अलार्म: ' : 'Next Alarm: '}
                </span>
                <span className="font-mono-num font-bold">{nextAlarm.slot.time}</span> ·{' '}
                {isHi ? nextAlarm.slot.titleHi : nextAlarm.slot.titleEn} ({formatCountdown(nextAlarm.minutesUntil)})
              </div>
            ) : (
              <div className="text-slate-600 dark:text-slate-400">
                {isHi ? 'शेड्यूल अलार्म बंद हैं' : 'Schedule alarms paused'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onTestAlarm}
            className="min-h-[34px] px-2.5 rounded-lg bg-white dark:bg-[#111a15] border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
          >
            <Volume2 className="w-3.5 h-3.5" />
            {isHi ? 'टेस्ट अलार्म' : 'Test'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!alarmsOn) {
                onEnableAlarms();
              } else {
                onUpdateReminders({ ...reminders, alarmsEnabled: false });
              }
            }}
            className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold transition-colors ${
              alarmsOn
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-[#111a15] border border-slate-200 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300'
            }`}
          >
            {alarmsOn ? (isHi ? 'अलार्म चालू' : 'Alarms ON') : isHi ? 'अलार्म चालू करें' : 'Enable Alarms'}
          </button>
        </div>
      </div>

      {editingTimes && (
        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200 dark:border-emerald-900/50 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">{isHi ? 'पहला भोजन' : 'Meal 1 / Breakfast'}</label>
            <input
              type="time"
              value={reminders.breakfast}
              onChange={(e) => onUpdateReminders({ ...reminders, breakfast: e.target.value })}
              className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15]"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">{isHi ? 'मुख्य भोजन' : 'Meal 2 / Lunch'}</label>
            <input
              type="time"
              value={reminders.lunch}
              onChange={(e) => onUpdateReminders({ ...reminders, lunch: e.target.value })}
              className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15]"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">{isHi ? 'अंतिम भोजन' : 'Meal 3 / Dinner'}</label>
            <input
              type="time"
              value={reminders.dinner}
              onChange={(e) => onUpdateReminders({ ...reminders, dinner: e.target.value })}
              className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15]"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">{isHi ? 'पानी अंतराल' : 'Water Every'}</label>
            <select
              value={reminders.waterIntervalMin}
              onChange={(e) => onUpdateReminders({ ...reminders, waterIntervalMin: Number(e.target.value) })}
              className="w-full min-h-[38px] px-2 rounded-lg border border-slate-200 dark:border-emerald-900/50 bg-white dark:bg-[#111a15]"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 dark:divide-emerald-950/60 max-h-[380px] overflow-y-auto pr-1">
        {visibleSlots.map((slot) => {
          const done = completedSlotIds.includes(slot.id);
          const isNext = nextAlarm?.slot.id === slot.id && !done;
          const isSelectedMeal = Boolean(
            activeMealType && slot.kind === 'meal' && slot.mealType === activeMealType
          );
          const mealCalories =
            slot.kind === 'meal' && slot.mealType
              ? dayLogs
                  .filter((l) => l.mealType === slot.mealType)
                  .reduce((sum, entry) => sum + entry.calories, 0)
              : 0;
          return (
            <div
              key={slot.id}
              className={`py-2.5 flex items-center justify-between gap-3 ${
                isSelectedMeal
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/45 -mx-2 px-2 rounded-xl ring-1 ring-emerald-500/40'
                  : isNext
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 -mx-2 px-2 rounded-xl'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => onToggleSlot(slot)}
                  aria-label={`Mark ${slot.titleEn} complete`}
                  className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
                    done
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : slot.kind === 'water'
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400'
                      : slot.kind === 'activity'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {done ? (
                    <Check className="w-4 h-4" />
                  ) : slot.kind === 'water' ? (
                    <Droplets className="w-4 h-4" />
                  ) : slot.kind === 'activity' ? (
                    <Dumbbell className="w-4 h-4" />
                  ) : (
                    <Utensils className="w-4 h-4" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                      {slot.time}
                      {slot.dayOffset === 1 ? (
                        <span className="ml-1 text-[10px] font-normal text-slate-400">
                          {isHi ? '(+1 दिन)' : '(+1d)'}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`text-sm font-semibold truncate ${
                        done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {isHi ? slot.titleHi : slot.titleEn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {mealCalories > 0
                      ? `${mealCalories} kcal ${isHi ? 'लॉग' : 'logged'} · ${isHi ? slot.detailHi : slot.detailEn}`
                      : isHi
                      ? slot.detailHi
                      : slot.detailEn}
                  </p>
                </div>
              </div>

              {slot.kind === 'meal' && slot.mealType && (
                <button
                  type="button"
                  onClick={() => onOpenMealLogger(slot.mealType!)}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                    isSelectedMeal
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-100 dark:bg-[#090e0b] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isHi ? 'लॉग' : 'Log'}
                </button>
              )}

              {slot.kind === 'water' && slot.waterMl && (
                <button
                  type="button"
                  onClick={() => onToggleSlot(slot)}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-mono-num font-semibold shrink-0 transition-colors ${
                    done
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                  }`}
                >
                  {done ? (isHi ? 'पूर्ण' : 'Done') : `+${slot.waterMl}ml`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
