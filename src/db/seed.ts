import { SEED_EXERCISES } from '@/data/exercises';
import { db } from './db';
import type { Profile } from './types';

export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  sex: 'unspecified',
  bodyweightKg: 80,
  units: 'kg',
  restDefaultSec: 120,
};

let seedingInFlight: Promise<void> | null = null;

/** Seed the exercise library + default profile on first run. Idempotent and
 * safe against concurrent callers (e.g. React StrictMode double-invoke). */
export function ensureSeeded(): Promise<void> {
  if (!seedingInFlight) {
    seedingInFlight = doSeed().catch((err) => {
      seedingInFlight = null; // allow a retry on failure
      throw err;
    });
  }
  return seedingInFlight;
}

async function doSeed(): Promise<void> {
  const count = await db.exercises.count();
  if (count === 0) {
    // bulkPut is idempotent — if a concurrent run raced us it won't throw.
    await db.exercises.bulkPut(SEED_EXERCISES);
  }
  const profile = await db.profile.get('me');
  if (!profile) {
    await db.profile.put(DEFAULT_PROFILE);
  }
}
