import { db } from '@/db/db';
import type {
  Exercise,
  FoodLogEntry,
  Profile,
  SavedFood,
  StoredProgram,
  SyncEntity,
  Workout,
  WorkoutPlan,
} from '@/db/types';
import {
  stamp,
  syncDeleteRecord,
  syncPushProfile,
  syncPushRecord,
} from './syncEngine';

// Debounce remote pushes so rapid edits (typing in a set) don't spam the network.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DELAY = 1500;

function schedulePush(entity: SyncEntity, record: { id: string; updatedAt?: number }) {
  const key = `${entity}:${record.id}`;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void syncPushRecord(entity, record);
    }, PUSH_DELAY),
  );
}

let profileTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleProfilePush(profile: Profile) {
  if (profileTimer) clearTimeout(profileTimer);
  profileTimer = setTimeout(() => {
    profileTimer = null;
    void syncPushProfile(profile);
  }, PUSH_DELAY);
}

// --- Workouts ---
export async function persistWorkout(w: Workout, immediate = false): Promise<Workout> {
  const s = stamp(w);
  await db.workouts.put(s);
  if (immediate) void syncPushRecord('workouts', s);
  else schedulePush('workouts', s);
  return s;
}
export async function removeWorkout(id: string): Promise<void> {
  await db.workouts.delete(id);
  void syncDeleteRecord('workouts', id);
}

// --- Programs ---
export async function persistProgram(p: StoredProgram): Promise<StoredProgram> {
  const s = stamp(p);
  await db.programs.put(s);
  void syncPushRecord('programs', s);
  return s;
}
export async function removeProgram(id: string): Promise<void> {
  await db.programs.delete(id);
  void syncDeleteRecord('programs', id);
}

// --- Custom exercises ---
export async function persistCustomExercise(e: Exercise): Promise<Exercise> {
  const s = stamp(e);
  await db.exercises.put(s);
  void syncPushRecord('custom_exercises', s);
  return s;
}

// --- Food journal ---
export async function persistFoodLog(e: FoodLogEntry): Promise<FoodLogEntry> {
  const s = stamp(e);
  await db.foodLogs.put(s);
  schedulePush('food_logs', s);
  return s;
}
export async function removeFoodLog(id: string): Promise<void> {
  await db.foodLogs.delete(id);
  void syncDeleteRecord('food_logs', id);
}

// --- Reusable foods ---
export async function persistFood(f: SavedFood): Promise<SavedFood> {
  const s = stamp(f);
  await db.foods.put(s);
  schedulePush('foods', s);
  return s;
}
export async function removeFood(id: string): Promise<void> {
  await db.foods.delete(id);
  void syncDeleteRecord('foods', id);
}

// --- Workout plans ---
export async function persistPlan(p: WorkoutPlan): Promise<WorkoutPlan> {
  const s = stamp(p);
  await db.plans.put(s);
  schedulePush('plans', s);
  return s;
}
export async function removePlan(id: string): Promise<void> {
  await db.plans.delete(id);
  void syncDeleteRecord('plans', id);
}

// --- Profile ---
export async function persistProfile(p: Profile, immediate = false): Promise<Profile> {
  const s = stamp(p);
  await db.profile.put(s);
  if (immediate) void syncPushProfile(s);
  else scheduleProfilePush(s);
  return s;
}
