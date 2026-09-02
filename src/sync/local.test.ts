import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import type { SyncEntity, Workout } from '@/db/types';

const pushed: { entity: SyncEntity; record: { id: string; finishedAt?: number } }[] = [];

vi.mock('./syncEngine', () => ({
  stamp: <T extends object>(o: T) => ({ ...o, updatedAt: Date.now() }),
  syncPushRecord: (entity: SyncEntity, record: { id: string }) => {
    pushed.push({ entity, record });
    return Promise.resolve();
  },
  syncPushProfile: () => Promise.resolve(),
  syncDeleteRecord: () => Promise.resolve(),
}));

const { flushPendingPushes, persistWorkout, removeWorkout } = await import('./local');

function workout(patch: Partial<Workout> = {}): Workout {
  return { id: 'wk1', startedAt: 1, title: 'Session', entries: [], ...patch };
}

describe('queued cloud pushes', () => {
  beforeEach(async () => {
    pushed.length = 0;
    // Only the debounce timers are faked — Dexie and fake-indexeddb need the
    // real microtask/immediate plumbing.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await db.workouts.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a debounced edit once the delay elapses', async () => {
    await persistWorkout(workout());
    expect(pushed).toHaveLength(0);
    vi.advanceTimersByTime(2000);
    expect(pushed).toHaveLength(1);
    expect(pushed[0].entity).toBe('workouts');
  });

  it('does not let a queued mid-session edit overwrite the finished session', async () => {
    // A set edit queues a push of the still-running session...
    await persistWorkout(workout());
    vi.advanceTimersByTime(800);
    // ...then Finish writes the finished session immediately.
    await persistWorkout(workout({ finishedAt: 5000 }), true);
    vi.advanceTimersByTime(5000);

    expect(pushed).toHaveLength(1);
    expect(pushed[0].record.finishedAt).toBe(5000);
  });

  it('drops a queued push when the record is deleted', async () => {
    await persistWorkout(workout());
    vi.advanceTimersByTime(800);
    await removeWorkout('wk1');
    vi.advanceTimersByTime(5000);
    expect(pushed).toHaveLength(0);
  });

  it('flushes queued pushes when the app is backgrounded', async () => {
    await persistWorkout(workout());
    flushPendingPushes();
    expect(pushed).toHaveLength(1);
    // Already sent — the timer must not fire a second copy.
    vi.advanceTimersByTime(5000);
    expect(pushed).toHaveLength(1);
  });
});
