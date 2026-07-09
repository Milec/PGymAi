import type { Equipment, MovementPattern, MuscleGroup } from '@/data/muscles';
import type { Sex } from '@/data/strengthStandards';
import type { HydrationSettings, MacroSet, MealId, NutritionSettings } from '@/lib/nutrition';
import type { ThemeName } from '@/lib/theme';
import type { Unit } from '@/lib/units';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  pattern: MovementPattern;
  category: 'compound' | 'isolation';
  bigLift: boolean;
  standardKey?: string;
  custom?: boolean;
  /** Last-modified epoch ms — used for cloud sync (last-write-wins). */
  updatedAt?: number;
}

export interface LoggedSet {
  id: string;
  /** Weight stored in kg (canonical). */
  weightKg: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  notes?: string;
  /** Prescription target this set was logged against, if any. */
  targetReps?: number | [number, number];
  targetText?: string;
}

export interface WorkoutEntry {
  id: string;
  exerciseId: string;
  sets: LoggedSet[];
  notes?: string;
}

export interface Workout {
  id: string;
  startedAt: number;
  finishedAt?: number;
  title: string;
  entries: WorkoutEntry[];
  /** Link back to a program if started from one. */
  programId?: string;
  weekIndex?: number;
  dayIndex?: number;
  /** Accumulated active duration in ms (excludes paused-out time on resume). */
  bodyweightKgAtTime?: number;
  /** Last-modified epoch ms — used for cloud sync (last-write-wins). */
  updatedAt?: number;
}

export interface Profile {
  id: 'me';
  sex: Sex | 'unspecified';
  bodyweightKg: number;
  age?: number;
  units: Unit;
  restDefaultSec: number;
  name?: string;
  /** UI theme id (see src/lib/theme.ts). Defaults to 'hud'. */
  theme?: ThemeName;
  /** Manual personal-record 1RM per exercise id, in kg. */
  prs?: Record<string, number>;
  /** Height in cm — used by the nutrition target calculator. */
  heightCm?: number;
  /** Macro targets + calculator inputs for the Fuel page. */
  nutrition?: NutritionSettings;
  /** Daily water target for the hydration tracker. */
  hydration?: HydrationSettings;
  /** Last-modified epoch ms — used for cloud sync (last-write-wins). */
  updatedAt?: number;
}

/** One food logged in the daily journal. Macros are snapshotted per-100g at
 * log time so entries stay stable if the catalogue changes. */
export interface FoodLogEntry {
  id: string;
  /** Local-time journal day, YYYY-MM-DD. */
  date: string;
  meal: MealId;
  name: string;
  brand?: string;
  per100: MacroSet;
  /** Logged amount in grams (canonical). */
  amountG: number;
  /** Grams per labelled serving, when known. */
  servingG?: number;
  barcode?: string;
  loggedAt: number;
  updatedAt?: number;
}

/** A reusable food: user-created ("My Foods") or cached from the catalogue
 * for quick re-logging and offline reuse. */
export interface SavedFood {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  per100: MacroSet;
  servingG?: number;
  custom?: boolean;
  lastUsedAt: number;
  updatedAt?: number;
}

/** A persisted, imported program (raw validated JSON). */
export interface StoredProgram {
  id: string;
  name: string;
  author?: string;
  description?: string;
  units: Unit;
  data: unknown; // the validated Program object
  importedAt: number;
  active?: boolean;
  /** Last-modified epoch ms — used for cloud sync (last-write-wins). */
  updatedAt?: number;
}

/** One exercise slot in a planned workout. */
export interface PlannedExercise {
  id: string;
  exerciseId: string;
  /** Number of sets to pre-create. */
  sets: number;
  /** Target reps per set (shown as the rep placeholder while logging). */
  reps?: number;
  /** Target working weight in kg (pre-filled into each set). */
  weightKg?: number;
}

/** A reusable workout blueprint built before training ("Planner"). */
export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: PlannedExercise[];
  createdAt: number;
  lastUsedAt?: number;
  /** Last-modified epoch ms — used for cloud sync (last-write-wins). */
  updatedAt?: number;
}

/** One water intake event in the hydration tracker. */
export interface WaterLog {
  id: string;
  /** Local-time journal day, YYYY-MM-DD. */
  date: string;
  ml: number;
  loggedAt: number;
  updatedAt?: number;
}

/** Sync entity kinds that participate in cloud sync. */
export type SyncEntity =
  | 'workouts'
  | 'programs'
  | 'custom_exercises'
  | 'food_logs'
  | 'foods'
  | 'plans'
  | 'water_logs';

/** A tombstone recording a local deletion so it can propagate to other devices. */
export interface Deletion {
  /** Composite key `${entity}:${entityId}`. */
  key: string;
  entity: SyncEntity;
  entityId: string;
  deletedAt: number;
}

/** Per-program progress cursor. */
export interface ProgramProgress {
  programId: string;
  currentWeek: number;
  currentDay: number;
  completedDays: string[]; // "week-day" keys
}
