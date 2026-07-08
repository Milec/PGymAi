import type { Sex } from '@/data/strengthStandards';

/**
 * Nutrition domain math: BMR (Mifflin-St Jeor), TDEE, goal-adjusted calorie
 * targets, and macro splits. All weights kg, heights cm, energy kcal.
 * Sources are the published formulas — see DECISIONS.md §12.
 */

export interface MacroSet {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const EMPTY_MACROS: MacroSet = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function addMacros(a: MacroSet, b: MacroSet): MacroSet {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

/** Scale per-100g macros to an amount in grams. */
export function macrosForAmount(per100: MacroSet, amountG: number): MacroSet {
  const f = amountG / 100;
  return {
    kcal: per100.kcal * f,
    proteinG: per100.proteinG * f,
    carbsG: per100.carbsG * f,
    fatG: per100.fatG * f,
  };
}

// ---------------------------------------------------------------------------
// Energy targets
// ---------------------------------------------------------------------------

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';

export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; factor: number; blurb: string }[] = [
  { id: 'sedentary', label: 'Sedentary', factor: 1.2, blurb: 'Desk life, little exercise' },
  { id: 'light', label: 'Light', factor: 1.375, blurb: 'Training 1–3 days/week' },
  { id: 'moderate', label: 'Moderate', factor: 1.55, blurb: 'Training 3–5 days/week' },
  { id: 'very', label: 'Very Active', factor: 1.725, blurb: 'Training 6–7 days/week' },
  { id: 'athlete', label: 'Athlete', factor: 1.9, blurb: 'Hard daily training + physical job' },
];

export type DietGoal = 'cut' | 'maintain' | 'bulk';

export const DIET_GOALS: { id: DietGoal; label: string; sign: -1 | 0 | 1 }[] = [
  { id: 'cut', label: 'Cut', sign: -1 },
  { id: 'maintain', label: 'Maintain', sign: 0 },
  { id: 'bulk', label: 'Bulk', sign: 1 },
];

/** Weekly weight-change rate options (kg/week magnitude). */
export const RATE_OPTIONS_KG = [0.25, 0.5, 0.75];

/** ≈7700 kcal per kg of bodyweight change — the standard planning heuristic. */
const KCAL_PER_KG = 7700;

/**
 * Mifflin-St Jeor resting energy expenditure.
 * male: 10w + 6.25h − 5a + 5 · female: 10w + 6.25h − 5a − 161.
 * For 'unspecified' sex the two are averaged (midpoint offset −78).
 */
export function bmrMifflinStJeor(
  sex: Sex | 'unspecified',
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return base + offset;
}

export function tdee(bmr: number, activity: ActivityLevel): number {
  const level = ACTIVITY_LEVELS.find((a) => a.id === activity) ?? ACTIVITY_LEVELS[2];
  return bmr * level.factor;
}

/** Daily calorie target for a goal at a weekly rate (kg/week, magnitude). */
export function goalCalories(tdeeKcal: number, goal: DietGoal, rateKgPerWeek: number): number {
  const sign = DIET_GOALS.find((g) => g.id === goal)?.sign ?? 0;
  const daily = tdeeKcal + (sign * rateKgPerWeek * KCAL_PER_KG) / 7;
  // Never prescribe below a minimal safe floor.
  return Math.max(1200, Math.round(daily));
}

/** Protein g/kg presets (cut favours higher protein). */
export const PROTEIN_PER_KG_OPTIONS = [1.6, 1.8, 2.2];
/** Fat as % of calories presets. */
export const FAT_PERCENT_OPTIONS = [25, 30, 35];

/**
 * Split a calorie target into macro grams: protein by bodyweight, fat as a
 * percentage of calories, carbs from the remainder (4/9/4 kcal per gram).
 */
export function macroTargets(
  kcal: number,
  bodyweightKg: number,
  proteinPerKg: number,
  fatPercent: number,
): MacroSet {
  const proteinG = Math.round(proteinPerKg * bodyweightKg);
  const fatG = Math.round((kcal * (fatPercent / 100)) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal: Math.round(kcal), proteinG, carbsG, fatG };
}

/** Everything the calculator needs + the resulting targets, kept on the profile. */
export interface NutritionSettings {
  targets: MacroSet;
  /** true → targets came from the calculator; false → manual override. */
  auto: boolean;
  activity: ActivityLevel;
  goal: DietGoal;
  rateKgPerWeek: number;
  proteinPerKg: number;
  fatPercent: number;
}

export const DEFAULT_NUTRITION_INPUTS = {
  activity: 'moderate' as ActivityLevel,
  goal: 'maintain' as DietGoal,
  rateKgPerWeek: 0.5,
  proteinPerKg: 1.8,
  fatPercent: 30,
};

// ---------------------------------------------------------------------------
// Journal dates & meals
// ---------------------------------------------------------------------------

export type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: { id: MealId; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

/** Local-time YYYY-MM-DD key for a journal day. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shift a YYYY-MM-DD key by ±days (local time, DST-safe via noon anchor). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** Human label for a journal day: Today / Yesterday / Tomorrow / weekday+date. */
export function dateKeyLabel(key: string, today: string = dateKey()): string {
  if (key === today) return 'Today';
  if (key === shiftDateKey(today, -1)) return 'Yesterday';
  if (key === shiftDateKey(today, 1)) return 'Tomorrow';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
