import type { ActivityLevel, DietType, Gender, GoalType, ProgressEntry } from '../types/fitplate';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export interface NutritionCalculationResult {
  bmi: number;
  bmiCategory: 'underweight' | 'normal' | 'overweight' | 'obese';
  bmr: number;
  tdee: number;
  goalType: GoalType;
  dailyCalorieTarget: number;
  rawCalorieTarget: number;
  weeklyRateKg: number;
  minSafeCalories: number;
  isUnrealistic: boolean;
  warningReason: 'too_fast_loss' | 'below_calorie_floor' | 'too_fast_gain' | null;
  suggestedWeeks: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
}

export function calculateNutritionPlan(params: {
  age: number;
  gender: Gender;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  dietType: DietType;
  timelineWeeks: number;
}): NutritionCalculationResult {
  const { age, gender, heightCm, currentWeightKg, targetWeightKg, activityLevel, dietType, timelineWeeks } = params;
  const safeHeightM = Math.max(heightCm, 90) / 100;
  const bmi = Math.round((currentWeightKg / (safeHeightM * safeHeightM)) * 10) / 10;

  let bmiCategory: NutritionCalculationResult['bmiCategory'] = 'normal';
  if (bmi < 18.5) bmiCategory = 'underweight';
  else if (bmi < 25) bmiCategory = 'normal';
  else if (bmi < 30) bmiCategory = 'overweight';
  else bmiCategory = 'obese';

  // Mifflin-St Jeor Equation
  const genderOffset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  const bmr = Math.round(10 * currentWeightKg + 6.25 * heightCm - 5 * age + genderOffset);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);

  const weightDiff = targetWeightKg - currentWeightKg; // negative = loss, positive = gain
  let goalType: GoalType = 'maintain';
  if (weightDiff <= -0.5) goalType = 'lose';
  else if (weightDiff >= 0.5) goalType = 'gain';

  const minSafeCalories = gender === 'male' ? 1500 : 1200;
  const safeWeeks = Math.max(1, timelineWeeks);

  // 1 kg body weight ≈ 7700 kcal
  const dailyDeltaNeeded = Math.round((weightDiff * 7700) / (safeWeeks * 7));
  const rawCalorieTarget = goalType === 'maintain' ? tdee : tdee + dailyDeltaNeeded;
  const weeklyRateKg = Math.round((Math.abs(weightDiff) / safeWeeks) * 100) / 100;

  let isUnrealistic = false;
  let warningReason: NutritionCalculationResult['warningReason'] = null;
  let suggestedWeeks = safeWeeks;
  let dailyCalorieTarget = rawCalorieTarget;

  if (goalType === 'lose') {
    const absKgToLose = Math.abs(weightDiff);
    const maxSafeLossPerWeek = 1.0; // max 0.5-1 kg/week
    const minWeeksForRate = Math.ceil(absKgToLose / 0.75); // healthy ~0.75 kg/wk
    const maxSafeDeficitForFloor = Math.max(150, tdee - minSafeCalories);
    const minWeeksForFloor = Math.ceil((absKgToLose * 7700) / (maxSafeDeficitForFloor * 7));

    if (rawCalorieTarget < minSafeCalories) {
      isUnrealistic = true;
      warningReason = 'below_calorie_floor';
      dailyCalorieTarget = minSafeCalories;
      suggestedWeeks = Math.max(safeWeeks + 1, minWeeksForRate, minWeeksForFloor);
    } else if (weeklyRateKg > maxSafeLossPerWeek) {
      isUnrealistic = true;
      warningReason = 'too_fast_loss';
      dailyCalorieTarget = Math.max(minSafeCalories, tdee - Math.round((1.0 * 7700) / 7));
      suggestedWeeks = Math.max(safeWeeks + 1, minWeeksForRate);
    }
  } else if (goalType === 'gain') {
    const absKgToGain = Math.abs(weightDiff);
    if (weeklyRateKg > 0.6) {
      isUnrealistic = true;
      warningReason = 'too_fast_gain';
      dailyCalorieTarget = Math.min(6000, tdee + 500);
      suggestedWeeks = Math.max(safeWeeks + 1, Math.ceil(absKgToGain / 0.4));
    }
  }

  dailyCalorieTarget = Math.max(minSafeCalories, Math.min(6000, Math.round(dailyCalorieTarget)));

  // Macro distribution calibrated for Indian & balanced diets
  const proteinRatio = goalType === 'lose' ? 0.28 : goalType === 'gain' ? 0.25 : 0.22;
  const fatRatio = dietType === 'vegan' ? 0.25 : 0.27;
  const proteinTargetG = Math.round((dailyCalorieTarget * proteinRatio) / 4);
  const fatTargetG = Math.round((dailyCalorieTarget * fatRatio) / 9);
  const remainingKcal = Math.max(100, dailyCalorieTarget - proteinTargetG * 4 - fatTargetG * 9);
  const carbsTargetG = Math.round(remainingKcal / 4);
  const fiberTargetG = Math.round((dailyCalorieTarget / 1000) * 14);

  return {
    bmi,
    bmiCategory,
    bmr,
    tdee,
    goalType,
    dailyCalorieTarget,
    rawCalorieTarget,
    weeklyRateKg,
    minSafeCalories,
    isUnrealistic,
    warningReason,
    suggestedWeeks,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    fiberTargetG,
  };
}

export interface WeeklyReportAnalysis {
  status: 'on_track' | 'behind' | 'ahead' | 'insufficient_data';
  actualWeeklyChangeKg: number;
  plannedWeeklyChangeKg: number;
  suggestedCalorieAdjustment: number;
  recommendedDailyTarget: number;
}

export function evaluateWeeklyProgress(
  entries: ProgressEntry[],
  goalType: GoalType,
  currentWeightKg: number,
  targetWeightKg: number,
  timelineWeeks: number,
  currentDailyTarget: number,
  gender: Gender
): WeeklyReportAnalysis {
  const minFloor = gender === 'male' ? 1500 : 1200;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    return {
      status: 'insufficient_data',
      actualWeeklyChangeKg: 0,
      plannedWeeklyChangeKg: Math.round(((targetWeightKg - currentWeightKg) / Math.max(1, timelineWeeks)) * 100) / 100,
      suggestedCalorieAdjustment: 0,
      recommendedDailyTarget: currentDailyTarget,
    };
  }

  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const dayDiff = Math.max(
    1,
    Math.round((new Date(latest.date).getTime() - new Date(prev.date).getTime()) / (1000 * 60 * 60 * 24))
  );
  const rawChange = latest.weightKg - prev.weightKg;
  const actualWeeklyChangeKg = Math.round(((rawChange / dayDiff) * 7) * 100) / 100;
  const plannedWeeklyChangeKg = Math.round(((targetWeightKg - sorted[0].weightKg) / Math.max(1, timelineWeeks)) * 100) / 100;

  if (goalType === 'lose') {
    if (actualWeeklyChangeKg > -0.2) {
      const nextTarget = Math.max(minFloor, currentDailyTarget - 120);
      return {
        status: 'behind',
        actualWeeklyChangeKg,
        plannedWeeklyChangeKg,
        suggestedCalorieAdjustment: nextTarget - currentDailyTarget,
        recommendedDailyTarget: nextTarget,
      };
    }
    if (actualWeeklyChangeKg < -1.05) {
      const nextTarget = currentDailyTarget + 150;
      return {
        status: 'ahead',
        actualWeeklyChangeKg,
        plannedWeeklyChangeKg,
        suggestedCalorieAdjustment: 150,
        recommendedDailyTarget: nextTarget,
      };
    }
    return {
      status: 'on_track',
      actualWeeklyChangeKg,
      plannedWeeklyChangeKg,
      suggestedCalorieAdjustment: 0,
      recommendedDailyTarget: currentDailyTarget,
    };
  }

  if (goalType === 'gain') {
    if (actualWeeklyChangeKg < 0.15) {
      return {
        status: 'behind',
        actualWeeklyChangeKg,
        plannedWeeklyChangeKg,
        suggestedCalorieAdjustment: 150,
        recommendedDailyTarget: currentDailyTarget + 150,
      };
    }
    return {
      status: 'on_track',
      actualWeeklyChangeKg,
      plannedWeeklyChangeKg,
      suggestedCalorieAdjustment: 0,
      recommendedDailyTarget: currentDailyTarget,
    };
  }

  // maintain
  if (Math.abs(actualWeeklyChangeKg) > 0.5) {
    const adj = actualWeeklyChangeKg > 0 ? -100 : 100;
    const nextTarget = Math.max(minFloor, currentDailyTarget + adj);
    return {
      status: 'behind',
      actualWeeklyChangeKg,
      plannedWeeklyChangeKg: 0,
      suggestedCalorieAdjustment: nextTarget - currentDailyTarget,
      recommendedDailyTarget: nextTarget,
    };
  }

  return {
    status: 'on_track',
    actualWeeklyChangeKg,
    plannedWeeklyChangeKg: 0,
    suggestedCalorieAdjustment: 0,
    recommendedDailyTarget: currentDailyTarget,
  };
}
