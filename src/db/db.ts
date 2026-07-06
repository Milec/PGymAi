import Dexie, { type Table } from 'dexie';
import type {
  Deletion,
  Exercise,
  Profile,
  ProgramProgress,
  StoredProgram,
  Workout,
} from './types';

export class StrideDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  profile!: Table<Profile, string>;
  programs!: Table<StoredProgram, string>;
  programProgress!: Table<ProgramProgress, string>;
  deletions!: Table<Deletion, string>;

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
  }
}

export const db = new StrideDB();
