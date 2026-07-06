import Dexie, { type Table } from 'dexie';
import type {
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

  constructor() {
    super('stride-db');
    this.version(1).stores({
      exercises: 'id, name, equipment, pattern, category, bigLift, custom',
      workouts: 'id, startedAt, finishedAt, programId',
      profile: 'id',
      programs: 'id, importedAt, active',
      programProgress: 'programId',
    });
  }
}

export const db = new StrideDB();
