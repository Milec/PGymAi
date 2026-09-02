import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import type { Workout } from '@/db/types';
import { epley } from '@/lib/e1rm';
import { newPrsFromWorkout, useAppStore } from './useAppStore';

function workout(entries: Workout['entries']): Workout {
  return {
    id: 'wk1',
    startedAt: 0,
    finishedAt: 1,
    title: 'Test',
    entries,
  };
}

describe('newPrsFromWorkout', () => {
  it('creates a PR from the best estimated 1RM for an exercise with no PR', () => {
    const w = workout([
      {
        id: 'e1',
        exerciseId: 'squat',
        sets: [
          { id: 's1', weightKg: 100, reps: 5, completed: true },
          { id: 's2', weightKg: 110, reps: 3, completed: true },
        ],
      },
    ]);
    const prs = newPrsFromWorkout(w, {});
    // 110x3 (epley ~121) beats 100x5 (epley ~116.7).
    expect(prs.squat).toBeCloseTo(epley(110, 3), 5);
  });

  it('does not overwrite an existing PR', () => {
    const w = workout([
      { id: 'e1', exerciseId: 'squat', sets: [{ id: 's1', weightKg: 100, reps: 5, completed: true }] },
    ]);
    expect(newPrsFromWorkout(w, { squat: 200 })).toEqual({});
  });

  it('ignores sets with no reps or no weight', () => {
    const w = workout([
      {
        id: 'e1',
        exerciseId: 'bench',
        sets: [
          { id: 's1', weightKg: 0, reps: 0, completed: false },
          { id: 's2', weightKg: 60, reps: 0, completed: false },
        ],
      },
    ]);
    expect(newPrsFromWorkout(w, {})).toEqual({});
  });

  it('handles multiple exercises, only filling the ones without a PR', () => {
    const w = workout([
      { id: 'e1', exerciseId: 'squat', sets: [{ id: 's1', weightKg: 100, reps: 1, completed: true }] },
      { id: 'e2', exerciseId: 'bench', sets: [{ id: 's2', weightKg: 80, reps: 1, completed: true }] },
    ]);
    const prs = newPrsFromWorkout(w, { squat: 150 });
    expect(prs).toEqual({ bench: 80 });
  });
});

function running(patch: Partial<Workout> = {}): Workout {
  return { id: 'wk-live', startedAt: 1, title: 'Session', entries: [], updatedAt: 1000, ...patch };
}

describe('finishWorkout', () => {
  beforeEach(async () => {
    await db.workouts.clear();
    await db.deletions.clear();
    useAppStore.setState({ active: null });
  });

  it('files the session and clears it from the store', async () => {
    useAppStore.setState({ active: running() });
    const id = await useAppStore.getState().finishWorkout();
    expect(id).toBe('wk-live');
    expect(useAppStore.getState().active).toBeNull();
    expect((await db.workouts.get('wk-live'))?.finishedAt).toBeGreaterThan(0);
  });

  it('keeps the session running when the write does not land', async () => {
    useAppStore.setState({ active: running() });
    const put = vi.spyOn(db.workouts, 'put').mockResolvedValue('wk-live');
    await expect(useAppStore.getState().finishWorkout()).rejects.toThrow(/still open/);
    put.mockRestore();
    // Nothing was torn down, so the user can hit Finish again without losing work.
    expect(useAppStore.getState().active?.id).toBe('wk-live');
  });
});

describe('reloadFromDb', () => {
  beforeEach(async () => {
    await db.workouts.clear();
    await db.deletions.clear();
    useAppStore.setState({ active: null });
  });

  it('drops an active session the DB has already finished', async () => {
    await db.workouts.put(running({ finishedAt: 5000, updatedAt: 5000 }));
    useAppStore.setState({ active: running() });
    await useAppStore.getState().reloadFromDb();
    expect(useAppStore.getState().active).toBeNull();
  });

  it('drops an active session that was discarded elsewhere', async () => {
    await db.deletions.put({
      key: 'workouts:wk-live',
      entity: 'workouts',
      entityId: 'wk-live',
      deletedAt: 5000,
    });
    useAppStore.setState({ active: running() });
    await useAppStore.getState().reloadFromDb();
    expect(useAppStore.getState().active).toBeNull();
  });

  it('keeps a session that has not reached IndexedDB yet', async () => {
    useAppStore.setState({ active: running() });
    await useAppStore.getState().reloadFromDb();
    expect(useAppStore.getState().active?.id).toBe('wk-live');
  });

  it('takes the DB copy when it is newer', async () => {
    await db.workouts.put(running({ title: 'Renamed on another device', updatedAt: 4000 }));
    useAppStore.setState({ active: running({ updatedAt: 1000 }) });
    await useAppStore.getState().reloadFromDb();
    expect(useAppStore.getState().active?.title).toBe('Renamed on another device');
  });
});
