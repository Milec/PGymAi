import { db } from '@/db/db';
import type { FoodLogEntry, LoggedSet, Workout, WorkoutEntry } from '@/db/types';
import { uid } from '@/lib/id';
import {
  bmrMifflinStJeor,
  dateKey,
  goalCalories,
  macroTargets,
  tdee,
  type MacroSet,
  type MealId,
} from '@/lib/nutrition';
import { roundToIncrement } from '@/lib/units';
import { persistFoodLog, persistWorkout, removeFoodLog, removeWorkout } from '@/sync/local';

/**
 * Generate a realistic ~7-week training history so charts, PRs, streaks and
 * strength comparisons have data. Used by the "Load Sample Data" button.
 * All writes/deletes go through the sync helpers so sample data behaves
 * correctly under cloud sync (tombstoned removal, no resurrection).
 */
export async function loadDemoData(): Promise<void> {
  const oldDemo = await db.workouts.filter((w) => w.title.startsWith('[Demo]')).toArray();
  for (const w of oldDemo) await removeWorkout(w.id);

  // Set a sensible demo profile if still on defaults.
  const profile = await db.profile.get('me');
  if (profile) {
    const sex = profile.sex === 'unspecified' ? 'male' : profile.sex;
    const bodyweightKg = profile.bodyweightKg || 82;
    const heightCm = profile.heightCm ?? 181;
    const age = profile.age ?? 29;
    // Calibrated maintenance targets so the Fuel page has goals to track.
    const kcal = goalCalories(tdee(bmrMifflinStJeor(sex, bodyweightKg, heightCm, age), 'moderate'), 'maintain', 0);
    await db.profile.put({
      ...profile,
      sex,
      bodyweightKg,
      heightCm,
      age,
      name: profile.name || 'Nova',
      nutrition: profile.nutrition ?? {
        targets: macroTargets(kcal, bodyweightKg, 1.8, 30),
        auto: true,
        activity: 'moderate',
        goal: 'maintain',
        rateKgPerWeek: 0,
        proteinPerKg: 1.8,
        fatPercent: 30,
      },
    });
  }

  await seedDemoFoodDay();

  const plan: { id: string; start: number; incKg: number; reps: number }[] = [
    { id: 'back-squat', start: 90, incKg: 2.5, reps: 5 },
    { id: 'bench-press', start: 65, incKg: 1.5, reps: 5 },
    { id: 'deadlift', start: 110, incKg: 3, reps: 5 },
    { id: 'overhead-press', start: 42, incKg: 1, reps: 5 },
    { id: 'barbell-row', start: 60, incKg: 1.5, reps: 6 },
    { id: 'pull-up', start: 0, incKg: 0, reps: 8 },
  ];

  const workouts: Workout[] = [];
  const sessions = 21; // 3x/week for 7 weeks
  const dayMs = 86400000;
  const now = Date.now();

  for (let s = 0; s < sessions; s++) {
    // spread ~ every 2-3 days ending near today
    const daysAgo = (sessions - 1 - s) * 2.4 + (s % 2 === 0 ? 0 : 1);
    const ts = now - Math.round(daysAgo * dayMs);
    const isA = s % 2 === 0;
    const picks = isA
      ? ['back-squat', 'bench-press', 'barbell-row']
      : ['deadlift', 'overhead-press', 'pull-up'];

    const entries: WorkoutEntry[] = picks.map((exId) => {
      const cfg = plan.find((p) => p.id === exId)!;
      const progressed = cfg.start + cfg.incKg * s;
      const noise = (Math.sin(s * 1.7 + exId.length) * cfg.incKg) / 2;
      const weight = exId === 'pull-up' ? 0 : roundToIncrement(Math.max(20, progressed + noise), 'kg');
      const sets: LoggedSet[] = Array.from({ length: 3 }, (_, i) => ({
        id: uid('set'),
        weightKg: weight,
        reps: cfg.reps - (i === 2 && s % 3 === 0 ? 1 : 0),
        rpe: 7 + (i === 2 ? 1.5 : 0),
        completed: true,
      }));
      return { id: uid('en'), exerciseId: exId, sets };
    });

    const start = ts - 55 * 60000;
    workouts.push({
      id: uid('wk'),
      startedAt: start,
      finishedAt: ts,
      title: `[Demo] ${isA ? 'Day A · Squat Focus' : 'Day B · Pull Focus'}`,
      entries,
      bodyweightKgAtTime: 82,
    });
  }

  for (const w of workouts) await persistWorkout(w);
}

/** A plausible day of eating for today's Fuel journal (id-prefixed so
 * re-running the loader replaces rather than duplicates it). */
async function seedDemoFoodDay(): Promise<void> {
  const oldFood = await db.foodLogs.filter((e) => e.id.startsWith('demofood-')).toArray();
  for (const e of oldFood) await removeFoodLog(e.id);
  const date = dateKey();
  const runId = Date.now();
  const day: [MealId, string, string | undefined, MacroSet, number, number?][] = [
    ['breakfast', 'Rolled Oats (cooked)', undefined, { kcal: 71, proteinG: 2.5, carbsG: 12, fatG: 1.5 }, 300],
    ['breakfast', 'Greek Yogurt 2%', 'Fage', { kcal: 73, proteinG: 9.9, carbsG: 3.9, fatG: 1.9 }, 170, 170],
    ['lunch', 'Chicken Breast (grilled)', undefined, { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }, 180],
    ['lunch', 'Basmati Rice (cooked)', undefined, { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 }, 250],
    ['dinner', 'Salmon Fillet', undefined, { kcal: 208, proteinG: 20, carbsG: 0, fatG: 13 }, 200],
    ['dinner', 'Sweet Potato (baked)', undefined, { kcal: 90, proteinG: 2, carbsG: 21, fatG: 0.1 }, 250],
    ['snacks', 'Whey Protein', 'Optimum Nutrition', { kcal: 400, proteinG: 80, carbsG: 10, fatG: 5 }, 30, 30],
    ['snacks', 'Banana', undefined, { kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 }, 120, 120],
  ];
  const now = Date.now();
  const entries: FoodLogEntry[] = day.map(([meal, name, brand, per100, amountG, servingG], i) => ({
    // Unique per load so a re-seed can't collide with its own tombstones.
    id: `demofood-${runId}-${i}`,
    date,
    meal,
    name,
    brand,
    per100,
    amountG,
    servingG,
    loggedAt: now - (day.length - i) * 60000,
  }));
  for (const e of entries) await persistFoodLog(e);
}

export async function hasDemoData(): Promise<boolean> {
  return (await db.workouts.filter((w) => w.title.startsWith('[Demo]')).count()) > 0;
}

/** Insert an in-progress session (picked up as active on next init) — for demos/screenshots. */
export async function createDemoActiveSession(): Promise<void> {
  await db.workouts.filter((w) => w.finishedAt === undefined).delete();
  const mk = (exerciseId: string, weightKg: number, reps: number, done: number, count: number): WorkoutEntry => ({
    id: uid('en'),
    exerciseId,
    sets: Array.from({ length: count }, (_, i) => ({
      id: uid('set'),
      weightKg,
      reps: i < done ? reps : 0,
      rpe: i < done ? 8 : undefined,
      completed: i < done,
    })),
  });
  await db.workouts.add({
    id: uid('wk'),
    startedAt: Date.now() - 18 * 60000,
    title: 'Day A · Squat Focus',
    entries: [
      mk('back-squat', 102.5, 5, 2, 3),
      mk('bench-press', 72.5, 5, 1, 3),
      mk('barbell-row', 65, 6, 0, 3),
    ],
    bodyweightKgAtTime: 82,
  });
}
