import type { ActivityCategory, ActivityIntensity, RemindersConfig, ScheduleSlot } from '../types/fitplate';

export interface ActivityPreset {
  id: string;
  nameEn: string;
  nameHi: string;
  category: ActivityCategory;
  metLight: number;
  metModerate: number;
  metVigorous: number;
}

export const SPORTS_AND_ACTIVITIES: ActivityPreset[] = [
  {
    id: 'cricket',
    nameEn: 'Cricket',
    nameHi: 'क्रिकेट',
    category: 'sports',
    metLight: 3.8,
    metModerate: 5.0,
    metVigorous: 7.0,
  },
  {
    id: 'badminton',
    nameEn: 'Badminton',
    nameHi: 'बैडमिंटन',
    category: 'sports',
    metLight: 4.5,
    metModerate: 5.5,
    metVigorous: 7.5,
  },
  {
    id: 'football',
    nameEn: 'Football / Soccer',
    nameHi: 'फ़ुटबॉल',
    category: 'sports',
    metLight: 5.0,
    metModerate: 7.0,
    metVigorous: 9.8,
  },
  {
    id: 'basketball',
    nameEn: 'Basketball',
    nameHi: 'बास्केटबॉल',
    category: 'sports',
    metLight: 4.5,
    metModerate: 6.5,
    metVigorous: 8.5,
  },
  {
    id: 'tennis',
    nameEn: 'Lawn Tennis',
    nameHi: 'टेनिस',
    category: 'sports',
    metLight: 5.0,
    metModerate: 6.8,
    metVigorous: 8.2,
  },
  {
    id: 'table_tennis',
    nameEn: 'Table Tennis',
    nameHi: 'टेबल टेनिस',
    category: 'sports',
    metLight: 3.0,
    metModerate: 4.0,
    metVigorous: 5.5,
  },
  {
    id: 'swimming',
    nameEn: 'Swimming',
    nameHi: 'तैराकी',
    category: 'sports',
    metLight: 4.8,
    metModerate: 6.0,
    metVigorous: 8.8,
  },
  {
    id: 'running',
    nameEn: 'Running / Jogging',
    nameHi: 'दौड़ / जॉगिंग',
    category: 'cardio',
    metLight: 6.0,
    metModerate: 8.3,
    metVigorous: 10.5,
  },
  {
    id: 'brisk_walk',
    nameEn: 'Brisk Walking',
    nameHi: 'तेज़ चलना',
    category: 'cardio',
    metLight: 2.8,
    metModerate: 3.8,
    metVigorous: 4.8,
  },
  {
    id: 'cycling',
    nameEn: 'Cycling',
    nameHi: 'साइकिल चलाना',
    category: 'cardio',
    metLight: 4.0,
    metModerate: 6.8,
    metVigorous: 9.2,
  },
  {
    id: 'skipping',
    nameEn: 'Jump Rope / HIIT',
    nameHi: 'रस्सी कूदना / HIIT',
    category: 'cardio',
    metLight: 6.5,
    metModerate: 9.0,
    metVigorous: 11.5,
  },
  {
    id: 'gym_strength',
    nameEn: 'Gym Strength Training',
    nameHi: 'जिम वेट ट्रेनिंग',
    category: 'strength',
    metLight: 3.5,
    metModerate: 5.0,
    metVigorous: 6.5,
  },
  {
    id: 'yoga_surya',
    nameEn: 'Yoga / Surya Namaskar',
    nameHi: 'योग / सूर्य नमस्कार',
    category: 'strength',
    metLight: 2.5,
    metModerate: 3.5,
    metVigorous: 5.0,
  },
  {
    id: 'dance_zumba',
    nameEn: 'Dance / Aerobics',
    nameHi: 'डांस / एरोबिक्स',
    category: 'cardio',
    metLight: 4.0,
    metModerate: 5.5,
    metVigorous: 7.3,
  },
  {
    id: 'household_chores',
    nameEn: 'Active Housework / Stairs',
    nameHi: 'घरेलू काम / सीढ़ियाँ',
    category: 'daily',
    metLight: 2.3,
    metModerate: 3.3,
    metVigorous: 4.5,
  },
];

export function calculateActivityCaloriesBurned(
  preset: ActivityPreset,
  intensity: ActivityIntensity,
  durationMin: number,
  weightKg: number
): number {
  const met =
    intensity === 'light'
      ? preset.metLight
      : intensity === 'vigorous'
      ? preset.metVigorous
      : preset.metModerate;
  const safeWeight = Math.max(30, Math.min(250, weightKg || 70));
  const safeMin = Math.max(1, Math.min(720, durationMin || 30));
  return Math.max(1, Math.round(met * safeWeight * (safeMin / 60)));
}

export function parseTimeToMinutes(hhmm: string | undefined, fallbackMin = 420): number {
  if (!hhmm || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return fallbackMin;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesToHHMM(totalMin: number): string {
  const wrapped = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesFromWake(wakeUpTime: string, offsetMin: number): { time: string; dayOffset: 0 | 1 } {
  const wakeMin = parseTimeToMinutes(wakeUpTime, 420);
  const absMin = wakeMin + offsetMin;
  return {
    time: formatMinutesToHHMM(absMin),
    dayOffset: absMin >= 1440 ? 1 : 0,
  };
}

export function getOffsetFromWake(wakeUpTime: string, targetTime: string, fallbackOffsetMin: number): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(targetTime || '')) return fallbackOffsetMin;
  const wakeMin = parseTimeToMinutes(wakeUpTime, 420);
  const targetMin = parseTimeToMinutes(targetTime, 420 + fallbackOffsetMin);
  return (targetMin - wakeMin + 1440) % 1440;
}

export function isNightShiftWakeTime(wakeUpTime: string): boolean {
  const m = parseTimeToMinutes(wakeUpTime, 420);
  return m >= 15 * 60 || m < 4 * 60;
}

export function deriveMealTimesFromWakeUp(wakeUpTime: string): {
  wakeUpTime: string;
  breakfast: string;
  lunch: string;
  dinner: string;
} {
  const safeWake = /^([01]\d|2[0-3]):[0-5]\d$/.test(wakeUpTime) ? wakeUpTime : '07:00';
  return {
    wakeUpTime: safeWake,
    breakfast: addMinutesFromWake(safeWake, 75).time, // +1h 15m after waking up
    lunch: addMinutesFromWake(safeWake, 360).time, // +6h after waking up
    dinner: addMinutesFromWake(safeWake, 780).time, // +13h after waking up
  };
}

export const DEFAULT_WORKOUT_REMINDERS = {
  plannedWorkoutTime: '18:00',
  workoutDurationMin: 45,
  dayWorkoutTimes: {} as Record<string, string>,
  preWorkoutEnabled: true,
  preWorkoutOffsetMin: 45,
  preWorkoutSnackNote: 'Banana + Black Coffee or Soaked Almonds',
  postWorkoutEnabled: true,
  postWorkoutOffsetMin: 30,
  postWorkoutSnackNote: 'Whey / Paneer / Boiled Eggs + Fruit',
};

const WEEKDAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_NAMES_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

export function computeWorkoutSnackTriggerTimes(params: {
  plannedWorkoutTime: string;
  workoutDurationMin: number;
  preWorkoutOffsetMin: number;
  postWorkoutOffsetMin: number;
}): {
  workoutStart: string;
  workoutEnd: string;
  preWorkoutTime: string;
  postWorkoutTime: string;
} {
  const startMin = parseTimeToMinutes(params.plannedWorkoutTime || '18:00', 18 * 60);
  const duration = Math.max(10, Math.min(240, Math.round(params.workoutDurationMin || 45)));
  const preOffset = Math.max(5, Math.min(180, Math.round(params.preWorkoutOffsetMin || 45)));
  const postOffset = Math.max(5, Math.min(180, Math.round(params.postWorkoutOffsetMin || 30)));

  return {
    workoutStart: formatMinutesToHHMM(startMin),
    workoutEnd: formatMinutesToHHMM(startMin + duration),
    preWorkoutTime: formatMinutesToHHMM(startMin - preOffset),
    postWorkoutTime: formatMinutesToHHMM(startMin + duration + postOffset),
  };
}

export function resolveEffectiveWorkoutTime(reminders: RemindersConfig, now = new Date()): string {
  const wr = reminders.workoutReminders;
  if (!wr) return '';
  const overrides = wr.dayWorkoutTimes || {};
  const dow = now.getDay();
  const todayEn = WEEKDAY_NAMES_EN[dow].toLowerCase();
  const todayHi = WEEKDAY_NAMES_HI[dow];
  const dayIndex = dow === 0 ? 7 : dow; // Monday = 1 .. Sunday = 7

  const matchingKey = Object.keys(overrides).find((key) => {
    const k = key.trim().toLowerCase();
    return (
      k === todayEn ||
      k.includes(todayEn) ||
      todayEn.startsWith(k) ||
      key.includes(todayHi) ||
      new RegExp(`\\bday\\s*${dayIndex}\\b`, 'i').test(key) ||
      key.includes(`दिन ${dayIndex}`)
    );
  });
  const candidate = matchingKey ? overrides[matchingKey] : wr.plannedWorkoutTime;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate || '') ? candidate : wr.plannedWorkoutTime || '18:00';
}

export function buildDailySchedule(
  reminders: RemindersConfig,
  waterGoalMl: number,
  now = new Date()
): ScheduleSlot[] {
  const wakeUpTime = reminders.wakeUpTime || '07:00';
  const wakeMin = parseTimeToMinutes(wakeUpTime, 420);
  const nightShift = isNightShiftWakeTime(wakeUpTime);

  const breakfastOffset = getOffsetFromWake(wakeUpTime, reminders.breakfast, 75);
  const lunchOffset = getOffsetFromWake(wakeUpTime, reminders.lunch, 360);
  const dinnerOffset = getOffsetFromWake(wakeUpTime, reminders.dinner, 780);
  const snackOffset = Math.min(840, Math.max(lunchOffset + 150, Math.round((lunchOffset + dinnerOffset) / 2)));
  const defaultActivityOffset = Math.min(840, snackOffset + 75);

  const wr = reminders.workoutReminders;
  const effectiveWorkoutTime = wr ? resolveEffectiveWorkoutTime(reminders, now) : '';
  const activityOffset = effectiveWorkoutTime
    ? getOffsetFromWake(wakeUpTime, effectiveWorkoutTime, defaultActivityOffset)
    : defaultActivityOffset;

  const breakfastSlotTime = addMinutesFromWake(wakeUpTime, breakfastOffset);
  const lunchSlotTime = addMinutesFromWake(wakeUpTime, lunchOffset);
  const snackSlotTime = addMinutesFromWake(wakeUpTime, snackOffset);
  const activitySlotTime = addMinutesFromWake(wakeUpTime, activityOffset);
  const dinnerSlotTime = addMinutesFromWake(wakeUpTime, dinnerOffset);

  const interval = Math.max(60, Math.min(180, reminders.waterIntervalMin || 90));
  const waterOffsets: number[] = [0]; // Always start with wake-up hydration at +0m
  const mealOffsets = [breakfastOffset, lunchOffset, dinnerOffset];

  for (let off = interval; off <= 870 && waterOffsets.length < 8; off += interval) {
    // Avoid overlapping right on top of breakfast/lunch/dinner; nudge 25m earlier before main meal
    const nearMeal = mealOffsets.find((mo) => Math.abs(mo - off) < 25);
    const candidate = nearMeal !== undefined ? Math.max(30, nearMeal - 25) : off;
    if (!waterOffsets.some((existing) => Math.abs(existing - candidate) < 35)) {
      waterOffsets.push(candidate);
    }
  }
  if (waterOffsets[waterOffsets.length - 1] < 810 && waterOffsets.length < 8) {
    waterOffsets.push(Math.min(870, dinnerOffset + 75));
  }

  const glassMl = Math.max(200, Math.round(waterGoalMl / Math.max(1, waterOffsets.length) / 50) * 50);

  const waterLabels = [
    {
      en: 'Wake-Up Hydration',
      hi: 'उठने के बाद पहला पानी',
      detailEn: `Start your ${nightShift ? 'shift' : 'day'} with ${glassMl} ml water`,
      detailHi: `उठने के तुरंत बाद ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Early-Day Hydration',
      hi: 'शुरुआती हाइड्रेशन',
      detailEn: `Drink ${glassMl} ml water to stay sharp and hydrated`,
      detailHi: `ऊर्जा और ताज़गी के लिए ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Mid-Day Water Break',
      hi: 'मिड-डे पानी ब्रेक',
      detailEn: `Drink ${glassMl} ml water between meals`,
      detailHi: `भोजन के बीच ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Pre-Meal Hydration',
      hi: 'भोजन से पहले पानी',
      detailEn: `Drink ${glassMl} ml water 25–30 min before eating`,
      detailHi: `खाने से 25–30 मिनट पहले ${glassMl} मिली पानी`,
    },
    {
      en: 'Mid-Shift Hydration',
      hi: 'दोपहर/शिफ्ट हाइड्रेशन',
      detailEn: `Drink ${glassMl} ml water to prevent fatigue`,
      detailHi: `थकान से बचने के लिए ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Pre-Workout / Active Sip',
      hi: 'व्यायाम से पहले पानी',
      detailEn: `Drink ${glassMl} ml water before activity`,
      detailHi: `गतिविधि से पहले ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Pre-Dinner Water',
      hi: 'आख़िरी भोजन से पहले पानी',
      detailEn: `Drink ${glassMl} ml water before your last meal`,
      detailHi: `अंतिम भोजन से पहले ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Pre-Sleep Final Sip',
      hi: 'सोने से पहले पानी',
      detailEn: `Finish remaining ${glassMl} ml water 60 min before sleep`,
      detailHi: `सोने से 60 मिनट पहले शेष ${glassMl} मिली पानी पिएं`,
    },
  ];

  const slots: ScheduleSlot[] = waterOffsets.map((off, idx) => {
    const t = addMinutesFromWake(wakeUpTime, off);
    const lbl = waterLabels[Math.min(idx, waterLabels.length - 1)];
    return {
      id: idx === 0 ? 'water_wake' : `water_${idx}`,
      time: t.time,
      offsetMin: off,
      dayOffset: wakeMin + off >= 1440 ? 1 : 0,
      kind: 'water',
      titleEn: lbl.en,
      titleHi: lbl.hi,
      detailEn: lbl.detailEn,
      detailHi: lbl.detailHi,
      waterMl: glassMl,
    };
  });

  slots.push(
    {
      id: 'meal_breakfast',
      time: breakfastSlotTime.time,
      offsetMin: breakfastOffset,
      dayOffset: breakfastSlotTime.dayOffset,
      kind: 'meal',
      mealType: 'breakfast',
      titleEn: nightShift ? 'First Meal (Shift Start)' : 'Breakfast Window',
      titleHi: nightShift ? 'पहला भोजन (शिफ्ट शुरुआत)' : 'नाश्ते का समय',
      detailEn: 'Balanced protein + complex carbs after waking up',
      detailHi: 'उठने के बाद प्रोटीन और फाइबर युक्त संतुलित भोजन',
    },
    {
      id: 'meal_lunch',
      time: lunchSlotTime.time,
      offsetMin: lunchOffset,
      dayOffset: lunchSlotTime.dayOffset,
      kind: 'meal',
      mealType: 'lunch',
      titleEn: nightShift ? 'Mid-Shift Main Meal' : 'Lunch Window',
      titleHi: nightShift ? 'मिड-शिफ्ट मुख्य भोजन' : 'दोपहर के भोजन का समय',
      detailEn: 'Dal, roti/rice, sabzi & salad or balanced protein bowl',
      detailHi: 'दाल, रोटी/चावल, सब्ज़ी और सलाद',
    },
    {
      id: 'meal_snacks',
      time: snackSlotTime.time,
      offsetMin: snackOffset,
      dayOffset: snackSlotTime.dayOffset,
      kind: 'meal',
      mealType: 'snacks',
      titleEn: nightShift ? 'Light Snack / Tea Break' : 'Evening Snack / Chai',
      titleHi: nightShift ? 'हल्का स्नैक / चाय ब्रेक' : 'शाम का स्नैक / चाय',
      detailEn: 'Light snack (sprouts, makhana, fruit, or unsweetened chai)',
      detailHi: 'हल्का स्नैक (स्प्राउट्स, मखाना, फल या चाय)',
    },
    {
      id: 'activity_burn',
      time: activitySlotTime.time,
      offsetMin: activityOffset,
      dayOffset: activitySlotTime.dayOffset,
      kind: 'activity',
      titleEn: effectiveWorkoutTime ? 'Planned Coach Workout' : 'Sports / Workout Burn',
      titleHi: effectiveWorkoutTime ? 'नियोजित कोच वर्कआउट' : 'खेल या व्यायाम का समय',
      detailEn: effectiveWorkoutTime
        ? `${wr?.workoutDurationMin || 45} min Coach workout scheduled at ${activitySlotTime.time}`
        : '30–45 min sport, brisk walk, or strength session',
      detailHi: effectiveWorkoutTime
        ? `${activitySlotTime.time} बजे ${wr?.workoutDurationMin || 45} मिनट का कोच वर्कआउट`
        : '30–45 मिनट खेल, तेज़ वॉक या वर्कआउट',
    },
    {
      id: 'meal_dinner',
      time: dinnerSlotTime.time,
      offsetMin: dinnerOffset,
      dayOffset: dinnerSlotTime.dayOffset,
      kind: 'meal',
      mealType: 'dinner',
      titleEn: nightShift ? 'Last Meal (Pre-Sleep)' : 'Dinner Window',
      titleHi: nightShift ? 'अंतिम भोजन (सोने से पहले)' : 'रात के खाने का समय',
      detailEn: 'Light, protein-rich meal 2+ hours before sleep',
      detailHi: 'सोने से 2 घंटे पहले हल्का व प्रोटीन युक्त भोजन',
    }
  );

  // Add Pre-Workout & Post-Workout Snack triggers anchored to planned Coach workout time
  if (wr && effectiveWorkoutTime) {
    const durationMin = Math.max(10, Math.min(240, wr.workoutDurationMin || 45));
    const preOffsetMin = Math.max(5, Math.min(180, wr.preWorkoutOffsetMin || 45));
    const postOffsetMin = Math.max(5, Math.min(180, wr.postWorkoutOffsetMin || 30));

    if (wr.preWorkoutEnabled) {
      const preRawOffset = activityOffset - preOffsetMin;
      const preWrappedOffset = ((preRawOffset % 1440) + 1440) % 1440;
      const preTimeObj = addMinutesFromWake(wakeUpTime, preRawOffset);
      const snackHint = wr.preWorkoutSnackNote?.trim() || 'Banana + black coffee, oats, or soaked almonds';
      slots.push({
        id: 'meal_pre_workout',
        time: preTimeObj.time,
        offsetMin: preWrappedOffset,
        dayOffset: preTimeObj.dayOffset,
        kind: 'meal',
        mealType: 'snacks',
        titleEn: 'Pre-Workout Snack',
        titleHi: 'प्री-वर्कआउट स्नैक',
        detailEn: `${preOffsetMin}m before ${activitySlotTime.time} workout · ${snackHint}`,
        detailHi: `${activitySlotTime.time} वर्कआउट से ${preOffsetMin} मि पहले · ${snackHint}`,
      });
    }

    if (wr.postWorkoutEnabled) {
      const postRawOffset = activityOffset + durationMin + postOffsetMin;
      const postWrappedOffset = ((postRawOffset % 1440) + 1440) % 1440;
      const postTimeObj = addMinutesFromWake(wakeUpTime, postRawOffset);
      const snackHint = wr.postWorkoutSnackNote?.trim() || 'Whey shake, paneer bhurji, boiled eggs, or sprouts';
      slots.push({
        id: 'meal_post_workout',
        time: postTimeObj.time,
        offsetMin: postWrappedOffset,
        dayOffset: postTimeObj.dayOffset,
        kind: 'meal',
        mealType: 'snacks',
        titleEn: 'Post-Workout Snack',
        titleHi: 'पोस्ट-वर्कआउट स्नैक',
        detailEn: `${postOffsetMin}m after ${durationMin}m workout · ${snackHint}`,
        detailHi: `वर्कआउट के ${postOffsetMin} मि बाद · ${snackHint}`,
      });
    }
  }

  return slots.sort((a, b) => a.offsetMin - b.offsetMin);
}

