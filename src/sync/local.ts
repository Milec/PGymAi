import { db } from '@/db/db';
import type {
  Exercise,
  FoodLogEntry,
  Profile,
  SavedFood,
  StoredProgram,
  SyncEntity,
  WaterLog,
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
//
// The queued snapshot lives in `pending`, not in the timer's closure: a queued
// push must always send the *latest* version of a record. Otherwise an edit
// scheduled at T can fire after an immediate push at T+800ms and overwrite the
// finished session on the server with a stale, still-running copy — which then
// syncs back down and resurrects yesterday's workout.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, { entity: SyncEntity; record: { id: string; updatedAt?: number } }>();
const PUSH_DELAY = 1500;

const pushKey = (entity: SyncEntity, id: string) => `${entity}:${id}`;

function flushKey(key: string) {
  const p = pending.get(key);
  if (!p) return;
  pending.delete(key);
  void syncPushRecord(p.entity, p.record);
}

function schedulePush(entity: SyncEntity, record: { id: string; updatedAt?: number }) {
  const key = pushKey(entity, record.id);
  pending.set(key, { entity, record });
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      flushKey(key);
    }, PUSH_DELAY),
  );
}

/** Drop a record's queued push — it has been superseded by a write going out
 * now (an immediate push, or a delete). */
function cancelPush(entity: SyncEntity, id: string) {
  const key = pushKey(entity, id);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.delete(key);
  pending.delete(key);
}

/** Push a record now, superseding anything queued for it. */
function pushNow(entity: SyncEntity, record: { id: string; updatedAt?: number }) {
  cancelPush(entity, record.id);
  void syncPushRecord(entity, record);
}

let profileTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProfile: Profile | null = null;

function flushProfile() {
  const p = pendingProfile;
  pendingProfile = null;
  if (p) void syncPushProfile(p);
}

function scheduleProfilePush(profile: Profile) {
  pendingProfile = profile;
  if (profileTimer) clearTimeout(profileTimer);
  profileTimer = setTimeout(() => {
    profileTimer = null;
    flushProfile();
  }, PUSH_DELAY);
}

/**
 * Send every queued push immediately. Called when the app is backgrounded or
 * closed so edits made in the last second and a half aren't stranded in a
 * timer the browser is about to discard.
 */
export function flushPendingPushes(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const key of [...pending.keys()]) flushKey(key);
  if (profileTimer) clearTimeout(profileTimer);
  profileTimer = null;
  flushProfile();
}

// --- Workouts ---
export async function persistWorkout(w: Workout, immediate = false): Promise<Workout> {
  const s = stamp(w);
  await db.workouts.put(s);
  if (immediate) pushNow('workouts', s);
  else schedulePush('workouts', s);
  return s;
}
export async function removeWorkout(id: string): Promise<void> {
  cancelPush('workouts', id);
  await db.workouts.delete(id);
  void syncDeleteRecord('workouts', id);
}

// --- Programs ---
export async function persistProgram(p: StoredProgram): Promise<StoredProgram> {
  const s = stamp(p);
  await db.programs.put(s);
  pushNow('programs', s);
  return s;
}
export async function removeProgram(id: string): Promise<void> {
  cancelPush('programs', id);
  await db.programs.delete(id);
  void syncDeleteRecord('programs', id);
}

// --- Custom exercises ---
export async function persistCustomExercise(e: Exercise): Promise<Exercise> {
  const s = stamp(e);
  await db.exercises.put(s);
  pushNow('custom_exercises', s);
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
  cancelPush('food_logs', id);
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
  cancelPush('foods', id);
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
  cancelPush('plans', id);
  await db.plans.delete(id);
  void syncDeleteRecord('plans', id);
}

// --- Water logs ---
export async function persistWaterLog(w: WaterLog): Promise<WaterLog> {
  const s = stamp(w);
  await db.waterLogs.put(s);
  schedulePush('water_logs', s);
  return s;
}
export async function removeWaterLog(id: string): Promise<void> {
  cancelPush('water_logs', id);
  await db.waterLogs.delete(id);
  void syncDeleteRecord('water_logs', id);
}

// --- Profile ---
export async function persistProfile(p: Profile, immediate = false): Promise<Profile> {
  const s = stamp(p);
  await db.profile.put(s);
  if (immediate) {
    if (profileTimer) clearTimeout(profileTimer);
    profileTimer = null;
    pendingProfile = null;
    void syncPushProfile(s);
  } else scheduleProfilePush(s);
  return s;
}
