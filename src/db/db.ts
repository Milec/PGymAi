import Dexie, { type Table } from 'dexie';
import type {
  Deletion,
  Exercise,
  FoodLogEntry,
  Profile,
  ProgramProgress,
  SavedFood,
  StoredProgram,
  Workout,
  WorkoutPlan,
} from './types';

export class StrideDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  profile!: Table<Profile, string>;
  programs!: Table<StoredProgram, string>;
  programProgress!: Table<ProgramProgress, string>;
  deletions!: Table<Deletion, string>;
  foodLogs!: Table<FoodLogEntry, string>;
  foods!: Table<SavedFood, string>;
  plans!: Table<WorkoutPlan, string>;

  constructor() {
    super('stride-db');
    this.version(1).stores({
      exercises: 'id, name, equipment, pattern, category, bigLift, custom',
      workouts: 'id, startedAt, finishedAt, programId',
      profile: 'id',
      programs: 'id, importedAt, active',
      programProgress: 'programId',
    });
    // v2 adds cloud-sync support: updatedAt indexes + a deletions tombstone log.
    this.version(2).stores({
      exercises: 'id, name, equipment, pattern, category, bigLift, custom, updatedAt',
      workouts: 'id, startedAt, finishedAt, programId, updatedAt',
      profile: 'id',
      programs: 'id, importedAt, active, updatedAt',
      programProgress: 'programId',
      deletions: 'key, entity, deletedAt',
    });
    // v3 adds the nutrition journal (Fuel): per-day food logs + reusable foods.
    this.version(3).stores({
      exercises: 'id, name, equipment, pattern, category, bigLift, custom, updatedAt',
      workouts: 'id, startedAt, finishedAt, programId, updatedAt',
      profile: 'id',
      programs: 'id, importedAt, active, updatedAt',
      programProgress: 'programId',
      deletions: 'key, entity, deletedAt',
      foodLogs: 'id, date, meal, loggedAt',
      foods: 'id, name, barcode, custom, lastUsedAt',
    });
    // v4 adds the workout planner: reusable pre-built workout blueprints.
    this.version(4).stores({
      exercises: 'id, name, equipment, pattern, category, bigLift, custom, updatedAt',
      workouts: 'id, startedAt, finishedAt, programId, updatedAt',
      profile: 'id',
      programs: 'id, importedAt, active, updatedAt',
      programProgress: 'programId',
      deletions: 'key, entity, deletedAt',
      foodLogs: 'id, date, meal, loggedAt',
      foods: 'id, name, barcode, custom, lastUsedAt',
      plans: 'id, name, createdAt, lastUsedAt',
    });
  }
}

export const db = new StrideDB();
