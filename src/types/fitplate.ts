export type Gender = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'veg' | 'non-veg' | 'vegan' | 'eggetarian';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export type Language = 'en' | 'hi';
export type FoodSource = 'indian_db' | 'open_food_facts' | 'ai_photo' | 'custom' | 'coach';

export interface ServingOption {
  unit: 'bowl' | 'no' | 'katori' | 'piece' | 'gram' | 'cup' | 'tbsp' | 'glass' | 'plate' | 'scoop';
  labelEn: string;
  labelHi: string;
  grams: number;
}

export interface FoodItem {
  id: string;
  name: string;
  nameHi: string;
  category: 'bread_rice' | 'dal_curry' | 'raita_salad' | 'breakfast' | 'snack_street' | 'beverage' | 'fruit_nut' | 'protein_dairy' | 'sweets' | 'indo_chinese' | 'sauces_dips' | 'pasta' | 'pizza_fastfood' | 'rolls_wraps' | 'packaged' | 'custom';
  dietType: DietType;
  barcode?: string;
  allergens?: string[];
  // Nutrition per 100g
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  servings: ServingOption[];
  isRecipe?: boolean;
  ingredientsSummary?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  dateOfBirth?: string; // YYYY-MM-DD
  age: number;
  gender: Gender;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  dietType: DietType;
  allergies: string[];
  timelineWeeks: number;
  goalType: GoalType;
  bmi: number;
  bmr: number;
  tdee: number;
  dailyCalorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
  language: Language;
  darkMode: boolean;
  healthSyncEnabled: boolean;
  wakeUpTime?: string; // HH:MM (24h), supports day and night shifts
  sleepTime?: string; // HH:MM (24h), bedtime boundary for daily schedule
  authProvider?: 'google' | 'facebook' | 'local';
  encryptionEnabled?: boolean;
  under18Acknowledged?: boolean;
  reminders?: RemindersConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemindersConfig {
  wakeUpTime: string; // HH:MM (24h)
  sleepTime?: string; // HH:MM (24h)
  breakfast: string;
  lunch: string;
  dinner: string;
  waterIntervalMin: number;
  enabled: boolean;
  alarmsEnabled?: boolean;
  waterAlarmsEnabled?: boolean;
  soundEnabled?: boolean;
}

export interface FoodLogEntry {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  foodId: string;
  foodName: string;
  servingUnit: string;
  servingQty: number;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: FoodSource;
  createdAt: string;
}

export interface DailyMetrics {
  uid: string;
  date: string;
  waterMl: number;
  waterGoalMl: number;
  steps: number;
  exerciseCalories: number;
  exerciseLogs?: { id: string; label: string; minutes: number; calories: number }[];
  updatedAt: string;
}

export interface ProgressEntry {
  id: string;
  uid: string;
  date: string;
  weightKg: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armsCm?: number;
  note?: string;
  photoDataUrl?: string;
  createdAt: string;
}

export interface CoachDayMeal {
  mealType: MealType;
  title: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface CoachDayPlan {
  day: string;
  totalCalories: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
  estimatedCostInr: string;
  meals: CoachDayMeal[];
}

export interface CoachMealPlan {
  id: string;
  title: string;
  budget: 'budget' | 'moderate' | 'flexible';
  dailyTargetCalories: number;
  days: CoachDayPlan[];
  tips: string[];
  createdAt: string;
}

export interface CoachWorkoutExercise {
  name: string;
  exerciseType?: 'muscle' | 'cardio';
  setsReps: string;
  restSec: number;
  caloriesEstimate: number;
  note: string;
}

export interface CoachWorkoutDay {
  day: string;
  focus: string;
  durationMin: number;
  plannedTime?: string;
  exercises: CoachWorkoutExercise[];
}

export interface CoachWorkoutPlan {
  id: string;
  title: string;
  mode: 'home' | 'gym' | 'both';
  goalType: GoalType;
  days: CoachWorkoutDay[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

export type ActivityCategory = 'sports' | 'cardio' | 'strength' | 'daily';
export type ActivityIntensity = 'light' | 'moderate' | 'vigorous';

export interface ActivityLogEntry {
  id: string;
  uid: string;
  date: string;
  activityId: string;
  activityName: string;
  category: ActivityCategory;
  durationMin: number;
  intensity: ActivityIntensity;
  caloriesBurned: number;
  createdAt: string;
}

export interface ScheduleSlot {
  id: string;
  time: string; // HH:MM
  offsetMin: number; // minutes since wake-up time (chronological sorting across midnight)
  dayOffset?: 0 | 1; // 1 when slot falls on next calendar day (e.g. night shift)
  kind: 'meal' | 'water' | 'activity';
  titleEn: string;
  titleHi: string;
  detailEn: string;
  detailHi: string;
  mealType?: MealType;
  waterMl?: number;
}

export interface DailyScheduleState {
  uid: string;
  date: string;
  completedSlotIds: string[];
  updatedAt: string;
}

export interface DailyMealAnalysis {
  nutritionScore: number;
  gradeLabel: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  nextStepAdvice: string;
  analyzedAt: string;
}
