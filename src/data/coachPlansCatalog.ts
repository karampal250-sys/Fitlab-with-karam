import type {
  CoachDayMeal,
  CoachDayPlan,
  CoachMealPlan,
  CoachWorkoutDay,
  CoachWorkoutPlan,
  DietType,
  GoalType,
  Language,
} from '../types/fitplate';

export function buildLocal5DayWorkoutPlan(params: {
  mode: 'home' | 'gym' | 'both';
  goalType: GoalType;
  language: Language;
}): CoachWorkoutPlan {
  const { mode, goalType, language } = params;
  const isHi = language === 'hi';
  const repScheme = goalType === 'gain' ? '8–10 reps' : goalType === 'lose' ? '12–15 reps' : '10–12 reps';

  const gymDays: CoachWorkoutDay[] = [
    {
      day: isHi ? 'दिन 1 · सोमवार' : 'Day 1 · Monday',
      focus: isHi ? 'चेस्ट + ट्राइसेप्स + ट्रेडमिल HIIT कार्डियो' : 'Chest & Triceps (Muscle) + Treadmill Intervals (Cardio)',
      durationMin: 55,
      exercises: [
        { name: 'Barbell / Dumbbell Bench Press', exerciseType: 'muscle', setsReps: `4 sets × ${repScheme}`, restSec: 75, caloriesEstimate: 95, note: 'Keep shoulder blades retracted and control the descent.' },
        { name: 'Incline Dumbbell Press', exerciseType: 'muscle', setsReps: `3 sets × ${repScheme}`, restSec: 60, caloriesEstimate: 70, note: 'Upper chest focus with full stretch at bottom.' },
        { name: 'Cable Triceps Rope Pushdown', exerciseType: 'muscle', setsReps: '3 sets × 12–15 reps', restSec: 45, caloriesEstimate: 50, note: 'Lock elbows by your sides.' },
        { name: 'Incline Treadmill Brisk Walk / Jog Intervals', exerciseType: 'cardio', setsReps: '4 sets × 3 min fast / 1 min walk', restSec: 30, caloriesEstimate: 165, note: 'Incline 5–7% for fat burn and stamina.' },
      ],
    },
    {
      day: isHi ? 'दिन 2 · मंगलवार' : 'Day 2 · Tuesday',
      focus: isHi ? 'बैक + बाइसेप्स + रोइंग मशीन कार्डियो' : 'Back & Biceps (Muscle) + Rowing Ergometer (Cardio)',
      durationMin: 55,
      exercises: [
        { name: 'Lat Pulldown (Wide Grip)', exerciseType: 'muscle', setsReps: `4 sets × ${repScheme}`, restSec: 75, caloriesEstimate: 85, note: 'Pull bar to upper chest without swinging.' },
        { name: 'Seated Cable Row', exerciseType: 'muscle', setsReps: `3 sets × ${repScheme}`, restSec: 60, caloriesEstimate: 75, note: 'Squeeze shoulder blades together for 1 second.' },
        { name: 'Dumbbell Hammer Curls', exerciseType: 'muscle', setsReps: '3 sets × 12 reps', restSec: 45, caloriesEstimate: 45, note: 'Controlled tempo up and down.' },
        { name: 'Rowing Machine Cardio Intervals', exerciseType: 'cardio', setsReps: '5 sets × 2 min moderate-hard', restSec: 45, caloriesEstimate: 155, note: 'Drive with legs first, then pull with back.' },
      ],
    },
    {
      day: isHi ? 'दिन 3 · बुधवार' : 'Day 3 · Wednesday',
      focus: isHi ? 'लेग्स + कोर + साइकिलिंग कार्डियो' : 'Legs & Core (Muscle) + Stationary Cycling (Cardio)',
      durationMin: 60,
      exercises: [
        { name: 'Leg Press / Barbell Squats', exerciseType: 'muscle', setsReps: `4 sets × ${repScheme}`, restSec: 90, caloriesEstimate: 120, note: 'Push through heels and keep core tight.' },
        { name: 'Seated Leg Curl + Calf Raises', exerciseType: 'muscle', setsReps: '3 sets × 12–15 reps', restSec: 60, caloriesEstimate: 75, note: 'Pause at peak contraction.' },
        { name: 'Hanging Knee Raises / Plank', exerciseType: 'muscle', setsReps: '3 sets × 15 reps / 45s', restSec: 45, caloriesEstimate: 45, note: 'Avoid lower-back arching.' },
        { name: 'Spin Bike Cardio Sprint & Cruise', exerciseType: 'cardio', setsReps: '4 sets × 4 min steady + sprint finish', restSec: 30, caloriesEstimate: 160, note: 'Moderate-high cadence for lower-body conditioning.' },
      ],
    },
    {
      day: isHi ? 'दिन 4 · गुरुवार' : 'Day 4 · Thursday',
      focus: isHi ? 'शोल्डर्स + अपर बैक + एलिप्टिकल कार्डियो' : 'Shoulders & Upper Back (Muscle) + Elliptical Cross-Trainer (Cardio)',
      durationMin: 50,
      exercises: [
        { name: 'Seated Dumbbell Shoulder Press', exerciseType: 'muscle', setsReps: `4 sets × ${repScheme}`, restSec: 75, caloriesEstimate: 80, note: 'Press overhead smoothly without shrugging neck.' },
        { name: 'Dumbbell Lateral Raises', exerciseType: 'muscle', setsReps: '4 sets × 12–15 reps', restSec: 45, caloriesEstimate: 50, note: 'Lead with elbows to shoulder height.' },
        { name: 'Face Pulls (Rope)', exerciseType: 'muscle', setsReps: '3 sets × 15 reps', restSec: 45, caloriesEstimate: 45, note: 'Great for posture and rear delts.' },
        { name: 'Elliptical Cross-Trainer Cardio', exerciseType: 'cardio', setsReps: '3 sets × 6 min continuous', restSec: 45, caloriesEstimate: 170, note: 'Use arm handles to engage upper and lower body.' },
      ],
    },
    {
      day: isHi ? 'दिन 5 · शुक्रवार' : 'Day 5 · Friday',
      focus: isHi ? 'फुल बॉडी स्ट्रेंथ + कंडीशनिंग कार्डियो' : 'Full-Body Compound (Muscle) + Conditioning Finisher (Cardio)',
      durationMin: 55,
      exercises: [
        { name: 'Romanian Dumbbell Deadlift', exerciseType: 'muscle', setsReps: `4 sets × ${repScheme}`, restSec: 75, caloriesEstimate: 95, note: 'Hinge at hips keeping spine neutral.' },
        { name: 'Dumbbell Goblet Squat + Push-Ups Superset', exerciseType: 'muscle', setsReps: '3 sets × 12 reps each', restSec: 60, caloriesEstimate: 90, note: 'Smooth transition between squat and push-ups.' },
        { name: 'Plank Shoulder Taps', exerciseType: 'muscle', setsReps: '3 sets × 20 taps', restSec: 45, caloriesEstimate: 40, note: 'Keep hips square to the floor.' },
        { name: 'Treadmill / Battle Rope Metabolic Finisher', exerciseType: 'cardio', setsReps: '6 sets × 45s work / 30s rest', restSec: 30, caloriesEstimate: 165, note: 'Sustained heart-rate zone 3–4 burn.' },
      ],
    },
  ];

  const homeDays: CoachWorkoutDay[] = [
    {
      day: isHi ? 'दिन 1 · सोमवार' : 'Day 1 · Monday',
      focus: isHi ? 'अपर बॉडी पुश + जंपिंग जैक्स कार्डियो' : 'Upper Body Push (Muscle) + High-Knees & Jacks (Cardio)',
      durationMin: 45,
      exercises: [
        { name: 'Standard or Knee Push-Ups', exerciseType: 'muscle', setsReps: '4 sets × 10–15 reps', restSec: 60, caloriesEstimate: 70, note: 'Hands slightly wider than shoulders, brace core.' },
        { name: 'Incline / Pike Shoulder Push-Ups', exerciseType: 'muscle', setsReps: '3 sets × 10–12 reps', restSec: 60, caloriesEstimate: 55, note: 'Targets shoulders and upper chest.' },
        { name: 'Chair Triceps Dips', exerciseType: 'muscle', setsReps: '3 sets × 12 reps', restSec: 45, caloriesEstimate: 45, note: 'Lower elbows to 90 degrees.' },
        { name: 'Jumping Jacks + High Knees Circuit', exerciseType: 'cardio', setsReps: '4 sets × 60s work / 30s rest', restSec: 30, caloriesEstimate: 140, note: 'Light on toes; substitute march-in-place if knee sensitive.' },
      ],
    },
    {
      day: isHi ? 'दिन 2 · मंगलवार' : 'Day 2 · Tuesday',
      focus: isHi ? 'लोअर बॉडी स्क्वाट्स + बर्पी/स्टेप कार्डियो' : 'Lower Body Strength (Muscle) + Step/Shadow Boxing (Cardio)',
      durationMin: 45,
      exercises: [
        { name: 'Bodyweight Sumo & Air Squats', exerciseType: 'muscle', setsReps: '4 sets × 15 reps', restSec: 60, caloriesEstimate: 85, note: 'Sit back into heels, chest lifted.' },
        { name: 'Alternating Reverse Lunges', exerciseType: 'muscle', setsReps: '3 sets × 12 reps/leg', restSec: 60, caloriesEstimate: 75, note: 'Keep front knee stacked over ankle.' },
        { name: 'Single-Leg Glute Bridges', exerciseType: 'muscle', setsReps: '3 sets × 15 reps', restSec: 45, caloriesEstimate: 50, note: 'Squeeze glutes at top for 1 second.' },
        { name: 'Shadow Boxing + Fast Spot Jog', exerciseType: 'cardio', setsReps: '4 sets × 3 min continuous', restSec: 45, caloriesEstimate: 155, note: 'Keep arms moving continuously for aerobic burn.' },
      ],
    },
    {
      day: isHi ? 'दिन 3 · बुधवार' : 'Day 3 · Wednesday',
      focus: isHi ? 'बैक पोस्टर + कोर + माउंटेन क्लाइंबर्स' : 'Back Posture & Core (Muscle) + Mountain Climbers (Cardio)',
      durationMin: 40,
      exercises: [
        { name: 'Prone Superman Back Extensions', exerciseType: 'muscle', setsReps: '4 sets × 15 reps', restSec: 45, caloriesEstimate: 45, note: 'Lift chest and thighs gently to strengthen lower back.' },
        { name: 'Towel / Backpack Bent-Over Rows', exerciseType: 'muscle', setsReps: '4 sets × 12–15 reps', restSec: 60, caloriesEstimate: 65, note: 'Fill a backpack with books for resistance.' },
        { name: 'Forearm Plank + Dead Bug', exerciseType: 'muscle', setsReps: '3 sets × 45s + 12 reps', restSec: 45, caloriesEstimate: 45, note: 'Keep lower back pressed smoothly.' },
        { name: 'Mountain Climbers + Skater Hops', exerciseType: 'cardio', setsReps: '5 sets × 45s work / 20s rest', restSec: 20, caloriesEstimate: 145, note: 'Steep heart-rate cardio boost at home.' },
      ],
    },
    {
      day: isHi ? 'दिन 4 · गुरुवार' : 'Day 4 · Thursday',
      focus: isHi ? 'फुल बॉडी मसल + स्किपिंग / स्टेयर कार्डियो' : 'Full-Body Conditioning (Muscle) + Rope / Step-Up (Cardio)',
      durationMin: 45,
      exercises: [
        { name: 'Tempo Push-Ups (3s lower)', exerciseType: 'muscle', setsReps: '4 sets × 10 reps', restSec: 60, caloriesEstimate: 65, note: 'Slow 3-second negative increases muscle tension.' },
        { name: 'Wall Sit Hold + Calf Raises', exerciseType: 'muscle', setsReps: '3 sets × 45s + 20 raises', restSec: 45, caloriesEstimate: 60, note: 'Thighs parallel to floor on wall sit.' },
        { name: 'Bicycle Crunches', exerciseType: 'muscle', setsReps: '3 sets × 20 reps/side', restSec: 45, caloriesEstimate: 45, note: 'Rotate ribcage slowly, avoid pulling neck.' },
        { name: 'Jump Rope / Stair Climb Intervals', exerciseType: 'cardio', setsReps: '5 sets × 2 min active / 40s rest', restSec: 40, caloriesEstimate: 165, note: 'Or brisk indoor stepping if no rope.' },
      ],
    },
    {
      day: isHi ? 'दिन 5 · शुक्रवार' : 'Day 5 · Friday',
      focus: isHi ? 'सूर्य नमस्कार + स्ट्रेंथ + मेटाबॉलिक कार्डियो' : 'Power Surya Namaskar & Muscle Circuit + Cardio Sweat',
      durationMin: 45,
      exercises: [
        { name: 'Close-Grip Push-Ups + Squats', exerciseType: 'muscle', setsReps: '4 sets × 12 reps each', restSec: 60, caloriesEstimate: 80, note: 'Full-body push and leg engagement.' },
        { name: 'Side Plank + Hip Dips', exerciseType: 'muscle', setsReps: '3 sets × 30s/side', restSec: 45, caloriesEstimate: 40, note: 'Builds deep obliques and hip stability.' },
        { name: 'Backpack Biceps Curl + Overhead Press', exerciseType: 'muscle', setsReps: '3 sets × 12 reps', restSec: 45, caloriesEstimate: 55, note: 'Controlled arm & shoulder finisher.' },
        { name: 'Continuous Brisk Walk / Surya Namaskar Flow', exerciseType: 'cardio', setsReps: '4 sets × 4 min continuous', restSec: 30, caloriesEstimate: 150, note: 'Finishes week with aerobic stamina.' },
      ],
    },
  ];

  const bothDays: CoachWorkoutDay[] = [
    { ...gymDays[0], day: isHi ? 'दिन 1 · जिम (अपर पुश + कार्डियो)' : 'Day 1 · Gym (Chest, Tri & Treadmill Cardio)' },
    { ...homeDays[1], day: isHi ? 'दिन 2 · होम (लेग्स + कार्डियो सर्किट)' : 'Day 2 · Home (Legs & Shadow-Box Cardio)' },
    { ...gymDays[1], day: isHi ? 'दिन 3 · जिम (बैक, बाइसेप्स + रोइंग)' : 'Day 3 · Gym (Back, Biceps & Rowing Cardio)' },
    { ...homeDays[2], day: isHi ? 'दिन 4 · होम (कोर + माउंटेन क्लाइंबर)' : 'Day 4 · Home (Posture, Core & Climber Cardio)' },
    { ...gymDays[4], day: isHi ? 'दिन 5 · जिम (फुल बॉडी + HIIT)' : 'Day 5 · Gym (Full-Body Muscle & HIIT Cardio)' },
  ];

  const days = mode === 'gym' ? gymDays : mode === 'home' ? homeDays : bothDays;
  const title =
    mode === 'gym'
      ? isHi
        ? '5-दिवसीय जिम स्ट्रेंथ + कार्डियो प्लान'
        : '5-Day Gym Muscle + Cardio Plan'
      : mode === 'home'
      ? isHi
        ? '5-दिवसीय होम मसल + कार्डियो प्लान'
        : '5-Day Home Muscle + Cardio Plan'
      : isHi
      ? '5-दिवसीय हाइब्रिड (जिम + होम) मसल व कार्डियो प्लान'
      : '5-Day Hybrid (Gym + Home) Muscle & Cardio Plan';

  return {
    id: `wp_${Date.now()}`,
    title,
    mode,
    goalType,
    days,
    createdAt: new Date().toISOString(),
  };
}

function makeScaledMeal(
  mealType: CoachDayMeal['mealType'],
  title: string,
  portion: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  scale: number
): CoachDayMeal {
  return {
    mealType,
    title,
    portion: scale !== 1 ? `${portion} (×${scale.toFixed(1)})` : portion,
    calories: Math.round(calories * scale),
    protein: Math.round(protein * scale),
    carbs: Math.round(carbs * scale),
    fat: Math.round(fat * scale),
    fiber: Math.round(fiber * scale),
  };
}

export function buildLocal7DayMealPlan(params: {
  dietType: DietType;
  budget: 'budget' | 'moderate' | 'flexible';
  dailyCalorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
  allergies: string[];
  language: Language;
}): CoachMealPlan {
  const { dietType, budget, dailyCalorieTarget, proteinTargetG, carbsTargetG, fiberTargetG, allergies, language } = params;
  const isHi = language === 'hi';
  const noDairy = allergies.some((a) => /dairy|milk|paneer|curd/i.test(a));
  const proteinSourceVeg = noDairy ? 'Tofu & Soya Chunks' : 'Paneer & Low-Fat Curd';
  const proteinSourceMain =
    dietType === 'non-veg'
      ? 'Grilled Chicken Breast / Fish Curry'
      : dietType === 'eggetarian'
      ? noDairy
        ? 'Boiled Egg Whites & Soya'
        : 'Egg Bhurji & Paneer'
      : dietType === 'vegan'
      ? 'Tofu, Soy Chunks & Lentils'
      : proteinSourceVeg;

  const baseScale = Math.max(0.75, Math.min(1.6, dailyCalorieTarget / 1850));

  const dayNames = isHi
    ? ['सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार', 'रविवार']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const templates: CoachDayMeal[][] = [
    [
      makeScaledMeal('breakfast', `Moong Dal Chilla + ${dietType === 'non-veg' || dietType === 'eggetarian' ? '2 Boiled Eggs' : noDairy ? 'Tofu Scramble' : 'Low-Fat Paneer Stuffing'}`, '2 large chillas + 1 cup green chutney', 440, 26, 48, 12, 9, baseScale),
      makeScaledMeal('lunch', `2 Multigrain Rotis + Rajma Masala + ${proteinSourceMain} + Kachumber Salad`, '2 rotis + 1.5 katori rajma + 1 bowl salad', 630, 32, 82, 14, 14, baseScale),
      makeScaledMeal('snacks', 'Roasted Chana + Chia-Flax Seed Fruit Bowl (Apple/Guava)', '40g chana + 1 guava + 1 tbsp chia', 250, 11, 36, 6, 9, baseScale),
      makeScaledMeal('dinner', `Quinoa / Brown Rice Khichdi + ${proteinSourceMain} + Sautéed Broccoli`, '1.5 bowl khichdi + 120g protein + greens', 530, 31, 62, 13, 10, baseScale),
    ],
    [
      makeScaledMeal('breakfast', `Oats Upma with Peas, Carrots & ${dietType === 'non-veg' || dietType === 'eggetarian' ? '3 Egg Whites' : 'Sprouted Moong'}`, '1 large bowl + 1 tbsp flaxseed', 430, 24, 54, 11, 10, baseScale),
      makeScaledMeal('lunch', `1.5 Katori Kala Chana Curry + Brown Rice + 1 Roti + Cucumber Salad`, '1 cup rice + 1 roti + 1.5 katori curry', 640, 29, 90, 13, 15, baseScale),
      makeScaledMeal('snacks', `${noDairy || dietType === 'vegan' ? 'Unsweetened Soy Yogurt' : 'Greek Curd'} + Roasted Makhana & Almonds`, '150g + 30g makhana + 8 almonds', 245, 16, 22, 9, 4, baseScale),
      makeScaledMeal('dinner', `2 Jowar/Bajra Rotis + Palak ${noDairy || dietType === 'vegan' ? 'Tofu' : 'Paneer'} + Mixed Veg`, '2 rotis + 1.5 katori palak', 535, 29, 58, 16, 11, baseScale),
    ],
    [
      makeScaledMeal('breakfast', `Besan Vegetable Cheela + ${dietType === 'non-veg' || dietType === 'eggetarian' ? 'Masala Omelette' : 'Sprouts Salad'}`, '2 cheelas + 1 katori sprouts', 450, 27, 46, 14, 9, baseScale),
      makeScaledMeal('lunch', `2 Whole Wheat Rotis + Toor Dal Tadka + ${proteinSourceMain} + Cabbage Salad`, '2 rotis + 1.5 katori dal + 120g protein', 635, 34, 78, 15, 13, baseScale),
      makeScaledMeal('snacks', 'Sprouted Moong & Chickpea Chaat with Lemon + Pomegranate', '1 large bowl (200g)', 240, 14, 38, 3, 10, baseScale),
      makeScaledMeal('dinner', `High-Fiber Vegetable Daliya + ${noDairy || dietType === 'vegan' ? 'Roasted Soya Chunks' : 'Grilled Paneer'}`, '1.5 bowl daliya + 60g chunks', 525, 30, 64, 12, 11, baseScale),
    ],
    [
      makeScaledMeal('breakfast', 'Vegetable Poha with Roasted Peanuts + Flaxseeds + Protein Side', '1.5 bowl poha + high-protein side', 445, 22, 58, 12, 8, baseScale),
      makeScaledMeal('lunch', `2 Rotis + Chole (Chickpea Curry) + Steamed Rice + Carrot-Beet Salad`, '2 rotis + 1 katori chole + half cup rice', 645, 27, 94, 13, 15, baseScale),
      makeScaledMeal('snacks', '1 Apple + 1 tbsp Peanut Butter + Roasted Pumpkin Seeds', '1 medium apple + 15g peanut butter + 10g seeds', 250, 10, 28, 12, 6, baseScale),
      makeScaledMeal('dinner', `${proteinSourceMain} + Stir-Fried Beans, Bell Peppers & 1 Multigrain Roti`, '150g protein + 1.5 cup veggies + 1 roti', 510, 35, 48, 14, 9, baseScale),
    ],
    [
      makeScaledMeal('breakfast', `Ragi / Whole Wheat Toast + ${dietType === 'non-veg' || dietType === 'eggetarian' ? '3 Egg Bhurji' : noDairy ? 'Smashed Chickpea & Tofu' : 'Paneer Bhurji'}`, '2 slices toast + 1 bowl bhurji', 460, 28, 46, 15, 8, baseScale),
      makeScaledMeal('lunch', `2 Rotis + Masoor Dal + Bhindi/Gobi Sabzi + ${noDairy || dietType === 'vegan' ? 'Tofu Cubes' : 'Buttermilk & Curd'}`, '2 rotis + 1.5 katori dal + 1 katori sabzi', 610, 29, 82, 13, 13, baseScale),
      makeScaledMeal('snacks', 'Boiled Sweet Potato Chaat + Roasted Soy Nuts', '150g sweet potato + 30g soy nuts', 260, 14, 42, 4, 8, baseScale),
      makeScaledMeal('dinner', `Millet (Jowar) Khichdi + ${proteinSourceMain} + Cucumber Mint Salad`, '1.5 bowl khichdi + 120g protein', 520, 31, 60, 12, 10, baseScale),
    ],
    [
      makeScaledMeal('breakfast', `Suji/Oats Idli (3 pcs) + High-Dal Sambhar + ${dietType === 'non-veg' || dietType === 'eggetarian' ? '2 Boiled Eggs' : 'Soya Chutney'}`, '3 idlis + 1.5 bowl veg sambhar', 435, 24, 62, 8, 9, baseScale),
      makeScaledMeal('lunch', `2 Multigrain Rotis + Mix Dal + ${proteinSourceMain} + Green Salad`, '2 rotis + 1.5 katori dal + 120g protein', 635, 35, 76, 15, 13, baseScale),
      makeScaledMeal('snacks', '1 Pear/Papaya Bowl + Chia Seeds + Roasted Chana', '200g fruit + 30g chana', 245, 10, 42, 4, 10, baseScale),
      makeScaledMeal('dinner', `2 Rotis + Lauki/Tinda Chana Dal + ${noDairy || dietType === 'vegan' ? 'Grilled Tofu' : 'Low-Fat Paneer Tikka'}`, '2 rotis + 1.5 katori sabzi + 100g tikka', 535, 31, 62, 14, 11, baseScale),
    ],
    [
      makeScaledMeal('breakfast', `High-Protein Stuffed Paratha (Sattu/Paneer/Egg) + ${noDairy || dietType === 'vegan' ? 'Mint Chutney' : '1 Katori Curd'}`, '2 parathas (minimal ghee) + side', 475, 25, 56, 14, 8, baseScale),
      makeScaledMeal('lunch', `Brown Rice Veg/Protein Pulao + 1 Katori Boondi/Plain Raita or Dal + Salad`, '1.5 large bowl pulao + 1 katori dal/raita', 625, 30, 84, 14, 12, baseScale),
      makeScaledMeal('snacks', 'Sprouts Bhel + Roasted Almonds & Walnuts', '1 bowl sprouts + 6 almonds + 2 walnuts', 240, 12, 28, 9, 7, baseScale),
      makeScaledMeal('dinner', `Clear Vegetable Lentil Soup + ${proteinSourceMain} + 1 Multigrain Roti`, '1 large soup bowl + 140g protein + 1 roti', 510, 34, 52, 12, 10, baseScale),
    ],
  ];

  const days: CoachDayPlan[] = dayNames.map((day, idx) => {
    const meals = templates[idx % templates.length];
    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
    const totalProtein = Math.round(meals.reduce((s, m) => s + m.protein, 0));
    const totalCarbs = Math.round(meals.reduce((s, m) => s + m.carbs, 0));
    const totalFat = Math.round(meals.reduce((s, m) => s + m.fat, 0));
    const totalFiber = Math.round(meals.reduce((s, m) => s + m.fiber, 0));
    const estimatedCostInr =
      budget === 'budget' ? '₹130–180/day' : budget === 'moderate' ? '₹200–280/day' : '₹300–420/day';
    return {
      day,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalFiber,
      estimatedCostInr,
      meals,
    };
  });

  return {
    id: `mp_${Date.now()}`,
    title: isHi
      ? `7-दिवसीय मैक्रो-संतुलित डाइट प्लान (${proteinTargetG}g प्रोटीन · ${carbsTargetG}g कार्ब्स · ${fiberTargetG}g फाइबर)`
      : `7-Day Macro-Balanced Plan (${proteinTargetG}g Protein · ${carbsTargetG}g Carbs · ${fiberTargetG}g Fiber)`,
    budget,
    dailyTargetCalories: dailyCalorieTarget,
    days,
    tips: isHi
      ? [
          `रोज़ाना ${proteinTargetG}g प्रोटीन, ${carbsTargetG}g कार्ब्स और ${fiberTargetG}g फाइबर के लिए हर मुख्य भोजन के साथ सलाद और दाल/प्रोटीन शामिल करें।`,
          'पानी के साथ चिया या अलसी के बीज फाइबर लक्ष्य को आसानी से पूरा करते हैं।',
        ]
      : [
          `Pair every main meal with a raw salad or legume side to hit your daily ${fiberTargetG}g fiber and ${proteinTargetG}g protein targets.`,
          `Target breakdown: ~${dailyCalorieTarget} kcal · P ${proteinTargetG}g · C ${carbsTargetG}g · F ${params.fatTargetG}g · Fiber ${fiberTargetG}g.`,
        ],
    createdAt: new Date().toISOString(),
  };
}
