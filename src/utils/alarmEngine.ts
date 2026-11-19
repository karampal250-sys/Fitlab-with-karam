import type { ScheduleSlot } from '../types/fitplate';
import { parseTimeToMinutes } from '../data/activitiesCatalog';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a pleasant offline alarm chime using Web Audio API.
 * Distinct melodic patterns for water, meals, and sports/workouts.
 */
export function playAlarmChime(kind: ScheduleSlot['kind']): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const patterns: Record<ScheduleSlot['kind'], number[]> = {
    water: [587.33, 783.99, 987.77, 783.99, 987.77, 1174.66], // Double droplet chime
    meal: [523.25, 659.25, 783.99, 1046.5], // C5 - E5 - G5 - C6 warm dining bell
    activity: [440, 554.37, 659.25, 880], // A4 - C#5 - E5 - A5 energizing chime
  };

  const notes = patterns[kind] || patterns.meal;
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.16;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'water' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });
}

export async function requestAlarmPermission(): Promise<NotificationPermission | 'unsupported'> {
  getAudioContext();
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function triggerBrowserNotification(title: string, body: string, tag: string): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([220, 100, 220, 100, 240]);
  }
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        tag,
        requireInteraction: true,
      });
    } catch {
      // Ignore environments that restrict Notification constructor
    }
  }
}

export function getCurrentHHMM(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function addMinutesToCurrentHHMM(minutesToAdd: number, now = new Date()): string {
  const d = new Date(now.getTime() + minutesToAdd * 60_000);
  return getCurrentHHMM(d);
}

/**
 * Finds the next uncompleted slot in the user's waking cycle (handling night-shift wrap-around).
 */
export function getNextUpcomingSlot(
  slots: ScheduleSlot[],
  wakeUpTime: string,
  completedSlotIds: string[],
  now = new Date()
): { slot: ScheduleSlot; minutesUntil: number } | null {
  if (slots.length === 0) return null;
  const wakeMin = parseTimeToMinutes(wakeUpTime, 420);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const elapsedSinceWake = (nowMin - wakeMin + 1440) % 1440;

  // Prefer uncompleted slots strictly ahead in the current waking cycle
  const upcomingInCycle = slots
    .filter((s) => !completedSlotIds.includes(s.id) && s.offsetMin >= elapsedSinceWake)
    .sort((a, b) => a.offsetMin - b.offsetMin);

  if (upcomingInCycle.length > 0) {
    const next = upcomingInCycle[0];
    return {
      slot: next,
      minutesUntil: Math.max(0, next.offsetMin - elapsedSinceWake),
    };
  }

  // Otherwise wrap to the first slot of the next waking cycle
  const firstSlot = slots[0];
  const minsUntilNextCycle = 1440 - elapsedSinceWake + firstSlot.offsetMin;
  return {
    slot: firstSlot,
    minutesUntil: minsUntilNextCycle,
  };
}
