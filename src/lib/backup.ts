import { db } from '@/db/db';
import type { Exercise, FoodLogEntry, Profile, SavedFood, StoredProgram, WaterLog, Workout, WorkoutPlan } from '@/db/types';
import {
  persistCustomExercise,
  persistFood,
  persistFoodLog,
  persistPlan,
  persistProfile,
  persistProgram,
  persistWaterLog,
  persistWorkout,
} from '@/sync/local';
import { backupCounts, type Backup, type BackupCounts } from '@/schema/backup';

/**
 * Whole-account backup: a JSON file the user can keep, move to another browser,
 * or restore after wiping. Everything that cloud sync would carry is included,
 * so a backup is a complete substitute for having an account.
 *
 * The seeded exercise library is deliberately left out — it is identical in
 * every install and would triple the file size for nothing. Only custom
 * exercises travel.
 */

export interface BackupPayload {
  /** Bumped when the shape changes incompatibly; readers accept anything they can validate. */
  formatVersion: number;
  exportedAt: string;
  app: string;
  profile: Profile | undefined;
  workouts: Workout[];
  programs: StoredProgram[];
  customExercises: Exercise[];
  foodLogs: FoodLogEntry[];
  foods: SavedFood[];
  plans: WorkoutPlan[];
  waterLogs: WaterLog[];
}

export async function buildBackup(): Promise<BackupPayload> {
  const [workouts, programs, customExercises, profile, foodLogs, foods, plans, waterLogs] =
    await Promise.all([
      db.workouts.toArray(),
      db.programs.toArray(),
      db.exercises.filter((e) => !!e.custom).toArray(),
      db.profile.get('me'),
      db.foodLogs.toArray(),
      db.foods.toArray(),
      db.plans.toArray(),
      db.waterLogs.toArray(),
    ]);
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'STRIDE',
    profile,
    workouts,
    programs,
    customExercises,
    foodLogs,
    foods,
    plans,
    waterLogs,
  };
}

/** File name for a backup: dated, so successive exports don't overwrite. */
export function backupFilename(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `stride-backup-${d}.json`;
}

export async function downloadBackup(): Promise<void> {
  const payload = await buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Restore a validated backup.
 *
 * Records are merged by id: anything in the backup overwrites the local copy of
 * the same record, and anything only on this device is left alone. That makes a
 * restore safe to run onto a populated install — the alternative, wiping first,
 * is what "Erase Everything" is for.
 *
 * Writes go through the sync helpers, so a restore also re-stamps `updatedAt`
 * and pushes to Supabase when cloud sync is on. Without that, restored records
 * would look older than the cloud's and the next reconcile would undo the whole
 * restore. Callers reload the page straight afterwards, which cancels any push
 * still sitting in the debounce queue — that is fine, because the reconcile on
 * the next boot sees the restored rows as the newer side and pushes them then.
 */
export async function restoreBackup(backup: Backup): Promise<BackupCounts> {
  for (const w of backup.workouts ?? []) await persistWorkout(w as unknown as Workout);
  for (const p of backup.programs ?? []) await persistProgram(p as unknown as StoredProgram);
  for (const e of backup.customExercises ?? []) {
    await persistCustomExercise({ ...(e as unknown as Exercise), custom: true });
  }
  for (const p of backup.plans ?? []) await persistPlan(p as unknown as WorkoutPlan);
  for (const f of backup.foods ?? []) await persistFood(f as unknown as SavedFood);
  for (const e of backup.foodLogs ?? []) await persistFoodLog(e as unknown as FoodLogEntry);
  for (const w of backup.waterLogs ?? []) await persistWaterLog(w as unknown as WaterLog);

  if (backup.profile) {
    // Merge rather than replace: a backup from before a field existed shouldn't
    // blank out settings this install already has.
    const current = await db.profile.get('me');
    await persistProfile({ ...current, ...(backup.profile as unknown as Profile), id: 'me' }, true);
  }

  return backupCounts(backup);
}
