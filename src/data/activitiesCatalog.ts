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

export function deriveMealTimesFromWakeUp(
  wakeUpTime: string,
  customSleepTime?: string
): {
  wakeUpTime: string;
  sleepTime: string;
  breakfast: string;
  lunch: string;
  dinner: string;
} {
  const safeWake = /^([01]\d|2[0-3]):[0-5]\d$/.test(wakeUpTime) ? wakeUpTime : '07:00';
  const safeSleep =
    customSleepTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(customSleepTime)
      ? customSleepTime
      : addMinutesFromWake(safeWake, 960).time; // Default +16h waking day (e.g., 07:00 -> 23:00)

  const wakeMin = parseTimeToMinutes(safeWake, 420);
  const sleepMin = parseTimeToMinutes(safeSleep, (wakeMin + 960) % 1440);
  const rawSpan = (sleepMin - wakeMin + 1440) % 1440;
  const awakeSpan = rawSpan >= 360 && rawSpan <= 1200 ? rawSpan : 960;

  const breakfastOff = Math.min(120, Math.round(awakeSpan * 0.08));
  const lunchOff = Math.round(awakeSpan * 0.38);
  const dinnerOff = Math.max(lunchOff + 180, Math.min(awakeSpan - 90, Math.round(awakeSpan * 0.81)));

  return {
    wakeUpTime: safeWake,
    sleepTime: safeSleep,
    breakfast: addMinutesFromWake(safeWake, breakfastOff).time,
    lunch: addMinutesFromWake(safeWake, lunchOff).time,
    dinner: addMinutesFromWake(safeWake, dinnerOff).time,
  };
}

export function buildDailySchedule(
  reminders: RemindersConfig,
  waterGoalMl: number,
  _now = new Date()
): ScheduleSlot[] {
  const wakeUpTime = reminders.wakeUpTime || '07:00';
  const wakeMin = parseTimeToMinutes(wakeUpTime, 420);
  const nightShift = isNightShiftWakeTime(wakeUpTime);
  const sleepTime =
    reminders.sleepTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(reminders.sleepTime)
      ? reminders.sleepTime
      : addMinutesFromWake(wakeUpTime, 960).time;
  const sleepMin = parseTimeToMinutes(sleepTime, (wakeMin + 960) % 1440);
  const rawAwakeSpan = (sleepMin - wakeMin + 1440) % 1440;
  const awakeSpanMin = rawAwakeSpan >= 360 && rawAwakeSpan <= 1200 ? rawAwakeSpan : 960;

  const breakfastOffset = getOffsetFromWake(wakeUpTime, reminders.breakfast, 75);
  const lunchOffset = getOffsetFromWake(wakeUpTime, reminders.lunch, 360);
  const rawDinnerOffset = getOffsetFromWake(wakeUpTime, reminders.dinner, Math.min(780, awakeSpanMin - 90));
  const dinnerOffset = Math.min(rawDinnerOffset, Math.max(lunchOffset + 120, awakeSpanMin - 60));
  const snackOffset = Math.min(awakeSpanMin - 120, Math.max(lunchOffset + 150, Math.round((lunchOffset + dinnerOffset) / 2)));
  const activityOffset = Math.min(awakeSpanMin - 120, snackOffset + 75);

  const breakfastSlotTime = addMinutesFromWake(wakeUpTime, breakfastOffset);
  const lunchSlotTime = addMinutesFromWake(wakeUpTime, lunchOffset);
  const snackSlotTime = addMinutesFromWake(wakeUpTime, snackOffset);
  const activitySlotTime = addMinutesFromWake(wakeUpTime, activityOffset);
  const dinnerSlotTime = addMinutesFromWake(wakeUpTime, dinnerOffset);

  const interval = Math.max(30, Math.min(180, reminders.waterIntervalMin || 90));
  const maxWaterEndOffset = Math.max(300, awakeSpanMin - 45);
  const waterOffsets: number[] = [0]; // Always start with wake-up hydration at +0m
  const mealOffsets = [breakfastOffset, lunchOffset, dinnerOffset];

  for (let off = interval; off <= maxWaterEndOffset && waterOffsets.length < 16; off += interval) {
    // Avoid overlapping right on top of breakfast/lunch/dinner; nudge 25m earlier before main meal
    const nearMeal = mealOffsets.find((mo) => Math.abs(mo - off) < 25);
    const candidate = nearMeal !== undefined ? Math.max(20, nearMeal - 25) : off;
    const minGap = interval <= 45 ? 20 : 35;
    if (!waterOffsets.some((existing) => Math.abs(existing - candidate) < minGap)) {
      waterOffsets.push(candidate);
    }
  }
  if (waterOffsets[waterOffsets.length - 1] < maxWaterEndOffset - 60 && waterOffsets.length < 16) {
    waterOffsets.push(maxWaterEndOffset);
  }

  const glassMl = Math.max(150, Math.round(waterGoalMl / Math.max(1, waterOffsets.length) / 50) * 50);

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
      en: 'Mid-Morning Water Break',
      hi: 'सुबह का पानी ब्रेक',
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
      en: 'Mid-Day Water Break',
      hi: 'दोपहर पानी ब्रेक',
      detailEn: `Drink ${glassMl} ml water to stay energized`,
      detailHi: `दिन में ताज़गी के लिए ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Afternoon Hydration',
      hi: 'दोपहर/शिफ्ट हाइड्रेशन',
      detailEn: `Drink ${glassMl} ml water to prevent fatigue`,
      detailHi: `थकान से बचने के लिए ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Mid-Afternoon Hydration',
      hi: 'दोपहर बाद पानी ब्रेक',
      detailEn: `Drink ${glassMl} ml water to stay refreshed`,
      detailHi: `ताज़गी के लिए ${glassMl} मिली पानी पिएं`,
    },
    {
      en: 'Evening Hydration',
      hi: 'शाम का पानी ब्रेक',
      detailEn: `Drink ${glassMl} ml water to keep hydration on track`,
      detailHi: `शाम को नियमित ${glassMl} मिली पानी पिएं`,
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
    const lbl =
      idx === 0
        ? waterLabels[0]
        : idx === waterOffsets.length - 1
        ? waterLabels[waterLabels.length - 1]
        : waterLabels[1 + ((idx - 1) % (waterLabels.length - 2))];
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
      titleEn: 'Sports / Workout Burn',
      titleHi: 'खेल या व्यायाम का समय',
      detailEn: '30–45 min sport, brisk walk, or strength session',
      detailHi: '30–45 मिनट खेल, तेज़ वॉक या वर्कआउट',
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

  return slots.sort((a, b) => a.offsetMin - b.offsetMin);
}

export function getWaterScheduleSlots(
  reminders: RemindersConfig,
  waterGoalMl: number,
  now = new Date()
): ScheduleSlot[] {
  return buildDailySchedule(reminders, waterGoalMl, now).filter((s) => s.kind === 'water');
}
