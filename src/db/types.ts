import type { Equipment, MovementPattern, MuscleGroup } from '@/data/muscles';
import type { Sex } from '@/data/strengthStandards';
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
  /** Last-modified epoch ms — used for cloud sync (last-write-wins). */
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

/** Sync entity kinds that participate in cloud sync. */
export type SyncEntity = 'workouts' | 'programs' | 'custom_exercises';

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
