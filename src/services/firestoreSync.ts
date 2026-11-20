import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebaseClient';
import { deriveMealTimesFromWakeUp } from '../data/activitiesCatalog';
import type {
  ActivityLogEntry,
  CoachMealPlan,
  CoachWorkoutPlan,
  DailyMetrics,
  DailyScheduleState,
  FoodItem,
  FoodLogEntry,
  ProgressEntry,
  UserProfile,
} from '../types/fitplate';

export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  const ref = doc(db, 'users', profile.uid);
  try {
    const existing = await getDoc(ref);
    const payload = {
      uid: profile.uid,
      name: profile.name.slice(0, 80),
      age: Math.round(profile.age),
      gender: profile.gender,
      heightCm: Math.round(Number(profile.heightCm) * 100) / 100,
      currentWeightKg: Number(profile.currentWeightKg),
      targetWeightKg: Number(profile.targetWeightKg),
      activityLevel: profile.activityLevel,
      dietType: profile.dietType,
      allergies: (profile.allergies || []).slice(0, 15),
      timelineWeeks: Math.round(profile.timelineWeeks),
      goalType: profile.goalType,
      bmi: Number(profile.bmi),
      bmr: Number(profile.bmr),
      tdee: Number(profile.tdee),
      dailyCalorieTarget: Math.max(1200, Math.min(6000, Math.round(profile.dailyCalorieTarget))),
      proteinTargetG: Math.round(profile.proteinTargetG),
      carbsTargetG: Math.round(profile.carbsTargetG),
      fatTargetG: Math.round(profile.fatTargetG),
      fiberTargetG: Math.round(profile.fiberTargetG),
      language: profile.language,
      darkMode: Boolean(profile.darkMode),
      healthSyncEnabled: Boolean(profile.healthSyncEnabled),
      wakeUpTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(profile.wakeUpTime || '') ? profile.wakeUpTime : '07:00',
      sleepTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(profile.sleepTime || '')
        ? profile.sleepTime
        : deriveMealTimesFromWakeUp(profile.wakeUpTime || '07:00').sleepTime,
      ...(profile.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(profile.dateOfBirth)
        ? { dateOfBirth: profile.dateOfBirth }
        : {}),
      ...(profile.authProvider ? { authProvider: profile.authProvider } : {}),
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserCloudBundle(uid: string): Promise<{
  profile: UserProfile | null;
  foodLogs: FoodLogEntry[];
  dailyMetrics: Record<string, DailyMetrics>;
  customFoods: FoodItem[];
  favoriteIds: string[];
  progressEntries: ProgressEntry[];
  mealPlan: CoachMealPlan | null;
  workoutPlan: CoachWorkoutPlan | null;
  activityLogs: ActivityLogEntry[];
  dailySchedules: Record<string, DailyScheduleState>;
}> {
  const userPath = `users/${uid}`;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      return {
        profile: null,
        foodLogs: [],
        dailyMetrics: {},
        customFoods: [],
        favoriteIds: [],
        progressEntries: [],
        mealPlan: null,
        workoutPlan: null,
        activityLogs: [],
        dailySchedules: {},
      };
    }

    const d = userSnap.data();
    const profile: UserProfile = {
      uid: d.uid,
      name: d.name,
      age: d.age,
      gender: d.gender,
      heightCm: d.heightCm,
      currentWeightKg: d.currentWeightKg,
      targetWeightKg: d.targetWeightKg,
      activityLevel: d.activityLevel,
      dietType: d.dietType,
      allergies: d.allergies ?? [],
      timelineWeeks: d.timelineWeeks,
      goalType: d.goalType,
      bmi: d.bmi,
      bmr: d.bmr,
      tdee: d.tdee,
      dailyCalorieTarget: d.dailyCalorieTarget,
      proteinTargetG: d.proteinTargetG,
      carbsTargetG: d.carbsTargetG,
      fatTargetG: d.fatTargetG,
      fiberTargetG: d.fiberTargetG,
      language: d.language ?? 'en',
      darkMode: Boolean(d.darkMode),
      healthSyncEnabled: Boolean(d.healthSyncEnabled),
      wakeUpTime: typeof d.wakeUpTime === 'string' ? d.wakeUpTime : '07:00',
      sleepTime:
        typeof d.sleepTime === 'string'
          ? d.sleepTime
          : deriveMealTimesFromWakeUp(typeof d.wakeUpTime === 'string' ? d.wakeUpTime : '07:00').sleepTime,
      ...(typeof d.dateOfBirth === 'string' ? { dateOfBirth: d.dateOfBirth } : {}),
      ...(d.authProvider ? { authProvider: d.authProvider } : {}),
    };

    const [logsSnap, metricsSnap, customSnap, favSnap, progSnap, plansSnap, actSnap, schedSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'foodLogs')),
      getDocs(collection(db, 'users', uid, 'dailyMetrics')),
      getDocs(collection(db, 'users', uid, 'customFoods')),
      getDocs(collection(db, 'users', uid, 'favorites')),
      getDocs(collection(db, 'users', uid, 'progressEntries')),
      getDocs(collection(db, 'users', uid, 'coachPlans')),
      getDocs(collection(db, 'users', uid, 'activityLogs')),
      getDocs(collection(db, 'users', uid, 'dailySchedules')),
    ]);

    const foodLogs: FoodLogEntry[] = logsSnap.docs.map((docSnap) => {
      const x = docSnap.data();
      return {
        id: docSnap.id,
        uid: x.uid,
        date: x.date,
        mealType: x.mealType,
        foodId: x.foodId,
        foodName: x.foodName,
        servingUnit: x.servingUnit,
        servingQty: x.servingQty,
        grams: x.grams,
        calories: x.calories,
        protein: x.protein,
        carbs: x.carbs,
        fat: x.fat,
        fiber: x.fiber,
        source: x.source,
        createdAt: x.createdAt?.toDate ? x.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    const dailyMetrics: Record<string, DailyMetrics> = {};
    metricsSnap.docs.forEach((docSnap) => {
      const x = docSnap.data();
      dailyMetrics[docSnap.id] = {
        uid: x.uid,
        date: x.date,
        waterMl: x.waterMl,
        waterGoalMl: x.waterGoalMl,
        steps: x.steps,
        exerciseCalories: x.exerciseCalories,
        updatedAt: x.updatedAt?.toDate ? x.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    const customFoods: FoodItem[] = customSnap.docs.map((docSnap) => {
      const x = docSnap.data();
      const g = Math.max(1, Number(x.servingGrams || 100));
      const factor = 100 / g;
      return {
        id: docSnap.id,
        name: x.name,
        nameHi: x.name,
        category: 'custom',
        dietType: x.dietType,
        isRecipe: Boolean(x.isRecipe),
        per100g: {
          calories: Math.round(x.calories * factor),
          protein: Math.round(x.protein * factor * 10) / 10,
          carbs: Math.round(x.carbs * factor * 10) / 10,
          fat: Math.round(x.fat * factor * 10) / 10,
          fiber: Math.round(x.fiber * factor * 10) / 10,
        },
        servings: [
          {
            unit: (x.servingUnit as FoodItem['servings'][0]['unit']) || 'gram',
            labelEn: `1 ${x.servingUnit} (${g}g)`,
            labelHi: `1 ${x.servingUnit} (${g}g)`,
            grams: g,
          },
        ],
      };
    });

    const favoriteIds = favSnap.docs.map((dSnap) => dSnap.data().foodId as string);

    const progressEntries: ProgressEntry[] = progSnap.docs.map((docSnap) => {
      const x = docSnap.data();
      return {
        id: docSnap.id,
        uid: x.uid,
        date: x.date,
        weightKg: x.weightKg,
        waistCm: x.waistCm,
        chestCm: x.chestCm,
        hipsCm: x.hipsCm,
        armsCm: x.armsCm,
        note: x.note,
        photoDataUrl: x.photoDataUrl,
        createdAt: x.createdAt?.toDate ? x.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    let mealPlan: CoachMealPlan | null = null;
    let workoutPlan: CoachWorkoutPlan | null = null;
    plansSnap.docs.forEach((docSnap) => {
      const x = docSnap.data();
      try {
        const parsed = JSON.parse(x.payload);
        if (x.planType === 'meal_plan') mealPlan = parsed;
        if (x.planType === 'workout_plan') workoutPlan = parsed;
      } catch {
        // Ignore malformed saved plan
      }
    });

    const activityLogs: ActivityLogEntry[] = actSnap.docs.map((docSnap) => {
      const x = docSnap.data();
      return {
        id: docSnap.id,
        uid: x.uid,
        date: x.date,
        activityId: x.activityId,
        activityName: x.activityName,
        category: x.category,
        durationMin: x.durationMin,
        intensity: x.intensity,
        caloriesBurned: x.caloriesBurned,
        createdAt: x.createdAt?.toDate ? x.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    const dailySchedules: Record<string, DailyScheduleState> = {};
    schedSnap.docs.forEach((docSnap) => {
      const x = docSnap.data();
      dailySchedules[docSnap.id] = {
        uid: x.uid,
        date: x.date,
        completedSlotIds: x.completedSlotIds ?? [],
        updatedAt: x.updatedAt?.toDate ? x.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    return {
      profile,
      foodLogs,
      dailyMetrics,
      customFoods,
      favoriteIds,
      progressEntries,
      mealPlan,
      workoutPlan,
      activityLogs,
      dailySchedules,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export async function syncFoodLogToCloud(uid: string, log: FoodLogEntry): Promise<void> {
  const path = `users/${uid}/foodLogs/${log.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'foodLogs', log.id), {
      uid,
      date: log.date,
      mealType: log.mealType,
      foodId: log.foodId.slice(0, 128),
      foodName: log.foodName.slice(0, 120),
      servingUnit: log.servingUnit.slice(0, 32),
      servingQty: Number(log.servingQty),
      grams: Number(log.grams),
      calories: Math.round(log.calories),
      protein: Number(log.protein),
      carbs: Number(log.carbs),
      fat: Number(log.fat),
      fiber: Number(log.fiber),
      source: log.source,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFoodLogFromCloud(uid: string, logId: string): Promise<void> {
  const path = `users/${uid}/foodLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'foodLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDailyMetricToCloud(uid: string, metric: DailyMetrics): Promise<void> {
  const path = `users/${uid}/dailyMetrics/${metric.date}`;
  try {
    await setDoc(doc(db, 'users', uid, 'dailyMetrics', metric.date), {
      uid,
      date: metric.date,
      waterMl: Math.round(metric.waterMl),
      waterGoalMl: Math.round(metric.waterGoalMl),
      steps: Math.round(metric.steps),
      exerciseCalories: Math.round(metric.exerciseCalories),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncCustomFoodToCloud(uid: string, food: FoodItem): Promise<void> {
  const path = `users/${uid}/customFoods/${food.id}`;
  const srv = food.servings[0] ?? { unit: 'gram', grams: 100 };
  const ratio = srv.grams / 100;
  try {
    await setDoc(doc(db, 'users', uid, 'customFoods', food.id), {
      uid,
      name: food.name.slice(0, 120),
      dietType: food.dietType,
      servingUnit: srv.unit.slice(0, 32),
      servingGrams: Math.min(5000, Math.max(1, Number(srv.grams))),
      calories: Math.min(5000, Math.max(0, Math.round(food.per100g.calories * ratio))),
      protein: Math.min(500, Math.max(0, Math.round(food.per100g.protein * ratio * 10) / 10)),
      carbs: Math.min(500, Math.max(0, Math.round(food.per100g.carbs * ratio * 10) / 10)),
      fat: Math.min(500, Math.max(0, Math.round(food.per100g.fat * ratio * 10) / 10)),
      fiber: Math.min(200, Math.max(0, Math.round(food.per100g.fiber * ratio * 10) / 10)),
      isRecipe: Boolean(food.isRecipe),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCustomFoodFromCloud(uid: string, foodId: string): Promise<void> {
  const path = `users/${uid}/customFoods/${foodId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customFoods', foodId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleFavoriteInCloud(
  uid: string,
  food: { id: string; name: string; calories: number },
  isFavorite: boolean
): Promise<void> {
  const safeId = food.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${uid}/favorites/${safeId}`;
  try {
    if (isFavorite) {
      await setDoc(doc(db, 'users', uid, 'favorites', safeId), {
        uid,
        foodId: food.id.slice(0, 128),
        foodName: food.name.slice(0, 120),
        calories: Math.round(food.calories),
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'users', uid, 'favorites', safeId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncProgressEntryToCloud(uid: string, entry: ProgressEntry): Promise<void> {
  const path = `users/${uid}/progressEntries/${entry.id}`;
  try {
    const payload: Record<string, unknown> = {
      uid,
      date: entry.date,
      weightKg: Number(entry.weightKg),
      createdAt: serverTimestamp(),
    };
    if (entry.waistCm) payload.waistCm = Number(entry.waistCm);
    if (entry.chestCm) payload.chestCm = Number(entry.chestCm);
    if (entry.hipsCm) payload.hipsCm = Number(entry.hipsCm);
    if (entry.armsCm) payload.armsCm = Number(entry.armsCm);
    if (entry.note) payload.note = entry.note.slice(0, 300);
    if (entry.photoDataUrl && entry.photoDataUrl.length <= 390000) payload.photoDataUrl = entry.photoDataUrl;
    await setDoc(doc(db, 'users', uid, 'progressEntries', entry.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncCoachPlanToCloud(
  uid: string,
  planType: 'meal_plan' | 'workout_plan',
  title: string,
  planObj: unknown
): Promise<void> {
  const planId = `${planType}_latest`;
  const path = `users/${uid}/coachPlans/${planId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'coachPlans', planId), {
      uid,
      planType,
      title: title.slice(0, 120),
      payload: JSON.stringify(planObj).slice(0, 99000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncActivityLogToCloud(uid: string, entry: ActivityLogEntry): Promise<void> {
  const path = `users/${uid}/activityLogs/${entry.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'activityLogs', entry.id), {
      uid,
      date: entry.date,
      activityId: entry.activityId.slice(0, 64),
      activityName: entry.activityName.slice(0, 100),
      category: entry.category,
      durationMin: Math.max(1, Math.min(720, Math.round(entry.durationMin))),
      intensity: entry.intensity,
      caloriesBurned: Math.max(1, Math.min(6000, Math.round(entry.caloriesBurned))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteActivityLogFromCloud(uid: string, activityId: string): Promise<void> {
  const path = `users/${uid}/activityLogs/${activityId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'activityLogs', activityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDailyScheduleToCloud(uid: string, schedule: DailyScheduleState): Promise<void> {
  const path = `users/${uid}/dailySchedules/${schedule.date}`;
  try {
    await setDoc(doc(db, 'users', uid, 'dailySchedules', schedule.date), {
      uid,
      date: schedule.date,
      completedSlotIds: schedule.completedSlotIds.slice(0, 20).map((s) => s.slice(0, 64)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAllCloudUserData(uid: string): Promise<void> {
  const subcollections = [
    'foodLogs',
    'dailyMetrics',
    'customFoods',
    'favorites',
    'progressEntries',
    'coachPlans',
    'activityLogs',
    'dailySchedules',
  ];
  try {
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}
