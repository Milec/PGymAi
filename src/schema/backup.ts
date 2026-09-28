import { z } from 'zod';

/**
 * Validation for the JSON produced by Profile → Export All Data, so a restore
 * can never write malformed rows into IndexedDB (and from there into the cloud).
 *
 * Every collection is optional: backups written by older versions of STRIDE
 * predate the planner and the hydration tracker, and must still restore. Each
 * record is checked loosely — enough to know it is the right shape and has an
 * id — and `looseObject` keeps fields a newer version added, so exporting from
 * a newer build and restoring into an older one doesn't silently drop data.
 */

const macros = z.looseObject({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
});

const loggedSet = z.looseObject({
  id: z.string(),
  weightKg: z.number(),
  reps: z.number(),
  completed: z.boolean(),
});

const workoutEntry = z.looseObject({
  id: z.string(),
  exerciseId: z.string(),
  sets: z.array(loggedSet),
});

const workout = z.looseObject({
  id: z.string(),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  title: z.string(),
  entries: z.array(workoutEntry),
});

const program = z.looseObject({
  id: z.string(),
  name: z.string(),
  units: z.enum(['kg', 'lb']),
  data: z.unknown(),
  importedAt: z.number(),
});

const exercise = z.looseObject({
  id: z.string(),
  name: z.string(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  equipment: z.string(),
  pattern: z.string(),
  category: z.string(),
  bigLift: z.boolean(),
});

const foodLog = z.looseObject({
  id: z.string(),
  date: z.string(),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']),
  name: z.string(),
  per100: macros,
  amountG: z.number(),
  loggedAt: z.number(),
});

const food = z.looseObject({
  id: z.string(),
  name: z.string(),
  per100: macros,
  lastUsedAt: z.number(),
});

const plan = z.looseObject({
  id: z.string(),
  name: z.string(),
  exercises: z.array(z.looseObject({ id: z.string(), exerciseId: z.string(), sets: z.number() })),
  createdAt: z.number(),
});

const waterLog = z.looseObject({
  id: z.string(),
  date: z.string(),
  ml: z.number(),
  loggedAt: z.number(),
});

const profile = z.looseObject({
  id: z.literal('me'),
  sex: z.enum(['male', 'female', 'unspecified']),
  bodyweightKg: z.number(),
  units: z.enum(['kg', 'lb']),
  restDefaultSec: z.number(),
});

export const backupSchema = z.looseObject({
  exportedAt: z.string().optional(),
  profile: profile.nullish(),
  workouts: z.array(workout).optional(),
  programs: z.array(program).optional(),
  customExercises: z.array(exercise).optional(),
  foodLogs: z.array(foodLog).optional(),
  foods: z.array(food).optional(),
  plans: z.array(plan).optional(),
  waterLogs: z.array(waterLog).optional(),
});

export type Backup = z.infer<typeof backupSchema>;

/** How many records of each kind a backup carries. */
export interface BackupCounts {
  workouts: number;
  programs: number;
  customExercises: number;
  foodLogs: number;
  foods: number;
  plans: number;
  waterLogs: number;
  profile: number;
}

export function backupCounts(b: Backup): BackupCounts {
  return {
    workouts: b.workouts?.length ?? 0,
    programs: b.programs?.length ?? 0,
    customExercises: b.customExercises?.length ?? 0,
    foodLogs: b.foodLogs?.length ?? 0,
    foods: b.foods?.length ?? 0,
    plans: b.plans?.length ?? 0,
    waterLogs: b.waterLogs?.length ?? 0,
    profile: b.profile ? 1 : 0,
  };
}

export function totalRecords(c: BackupCounts): number {
  return Object.values(c).reduce((n, v) => n + v, 0);
}

/** One line per non-empty collection, for the restore confirmation dialog. */
export function describeBackup(c: BackupCounts): string {
  const labels: [keyof BackupCounts, string, string][] = [
    ['workouts', 'session', 'sessions'],
    ['programs', 'program', 'programs'],
    ['customExercises', 'custom exercise', 'custom exercises'],
    ['plans', 'workout plan', 'workout plans'],
    ['foodLogs', 'food entry', 'food entries'],
    ['foods', 'saved food', 'saved foods'],
    ['waterLogs', 'water log', 'water logs'],
  ];
  const parts = labels
    .filter(([key]) => c[key] > 0)
    .map(([key, one, many]) => `${c[key]} ${c[key] === 1 ? one : many}`);
  if (c.profile) parts.push('your profile');
  return parts.join('\n');
}

/**
 * Parse and validate backup JSON. Returns a readable message rather than a Zod
 * dump — this goes straight into a dialog the user reads.
 */
export function parseBackupJSON(text: string): { backup: Backup } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` (at ${first.path.join('.')})` : '';
    return {
      error: `That doesn't look like a STRIDE backup${where}: ${first?.message ?? 'unknown error'}`,
    };
  }
  if (totalRecords(backupCounts(parsed.data)) === 0) {
    return { error: 'That backup is empty — there is nothing to restore.' };
  }
  return { backup: parsed.data };
}
