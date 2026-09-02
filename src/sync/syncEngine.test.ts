import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import type { Workout } from '@/db/types';
import { applyInboundProfile, applyInboundRecord, entityCfg } from './syncEngine';
import { DEFAULT_PROFILE } from '@/db/seed';

const cfg = entityCfg('workouts');

function workout(patch: Partial<Workout> = {}): Workout {
  return { id: 'wk1', startedAt: 1, title: 'Session', entries: [], updatedAt: 1000, ...patch };
}

/** A workout as it arrives over realtime — an untyped JSON blob. */
function inbound(patch: Partial<Workout> = {}): Record<string, unknown> {
  return workout(patch) as unknown as Record<string, unknown>;
}

describe('applyInboundRecord', () => {
  beforeEach(async () => {
    await db.workouts.clear();
    await db.deletions.clear();
  });

  it('applies a row that is newer than the local copy', async () => {
    await db.workouts.put(workout({ updatedAt: 1000 }));
    await applyInboundRecord(cfg, inbound({ updatedAt: 2000, title: 'Renamed' }));
    expect((await db.workouts.get('wk1'))?.title).toBe('Renamed');
  });

  it('ignores a row that is older than the local copy', async () => {
    // Realtime echoes this device's own writes, so a late-arriving stale copy
    // of a finished session must not un-finish it.
    await db.workouts.put(workout({ updatedAt: 2000, finishedAt: 2000 }));
    await applyInboundRecord(cfg, inbound({ updatedAt: 1000 }));
    expect((await db.workouts.get('wk1'))?.finishedAt).toBe(2000);
  });

  it('ignores a row that ties the local copy', async () => {
    await db.workouts.put(workout({ updatedAt: 2000, title: 'Local' }));
    await applyInboundRecord(cfg, inbound({ updatedAt: 2000, title: 'Remote' }));
    expect((await db.workouts.get('wk1'))?.title).toBe('Local');
  });

  it('does not resurrect a record deleted here more recently', async () => {
    await db.deletions.put({ key: 'workouts:wk1', entity: 'workouts', entityId: 'wk1', deletedAt: 3000 });
    await applyInboundRecord(cfg, inbound({ updatedAt: 2000 }));
    expect(await db.workouts.get('wk1')).toBeUndefined();
  });

  it('accepts a record edited after it was deleted here', async () => {
    await db.deletions.put({ key: 'workouts:wk1', entity: 'workouts', entityId: 'wk1', deletedAt: 3000 });
    await applyInboundRecord(cfg, inbound({ updatedAt: 4000 }));
    expect(await db.workouts.get('wk1')).toBeDefined();
  });

  it('writes a record this device has never seen', async () => {
    await applyInboundRecord(cfg, inbound({ updatedAt: 500 }));
    expect(await db.workouts.get('wk1')).toBeDefined();
  });
});

describe('applyInboundProfile', () => {
  beforeEach(async () => {
    await db.profile.clear();
  });

  it('keeps the local profile when it is newer', async () => {
    await db.profile.put({ ...DEFAULT_PROFILE, bodyweightKg: 90, updatedAt: 2000 });
    await applyInboundProfile({ ...DEFAULT_PROFILE, bodyweightKg: 70, updatedAt: 1000 });
    expect((await db.profile.get('me'))?.bodyweightKg).toBe(90);
  });

  it('takes the inbound profile when it is newer', async () => {
    await db.profile.put({ ...DEFAULT_PROFILE, bodyweightKg: 90, updatedAt: 1000 });
    await applyInboundProfile({ ...DEFAULT_PROFILE, bodyweightKg: 70, updatedAt: 2000 });
    expect((await db.profile.get('me'))?.bodyweightKg).toBe(70);
  });
});
