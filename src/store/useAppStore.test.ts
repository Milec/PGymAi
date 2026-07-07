import { describe, expect, it } from 'vitest';
import type { Workout } from '@/db/types';
import { epley } from '@/lib/e1rm';
import { newPrsFromWorkout } from './useAppStore';

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
