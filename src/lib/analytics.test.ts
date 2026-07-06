import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '@/db/types';
import {
  buildExerciseSeries,
  computeStreak,
  muscleBalance,
  recentPRs,
  totalVolume,
  weeklyVolume,
} from './analytics';

const DAY = 86400000;

function wk(finishedAt: number, exerciseId: string, sets: [number, number][]): Workout {
  return {
    id: 'w' + finishedAt,
    startedAt: finishedAt - 3600000,
    finishedAt,
    title: 'S',
    entries: [
      {
        id: 'e1',
        exerciseId,
        sets: sets.map(([weightKg, reps], i) => ({
          id: 'set' + i,
          weightKg,
          reps,
          completed: true,
        })),
      },
    ],
  };
}

const squat: Exercise = {
  id: 'back-squat',
  name: 'Back Squat',
  primaryMuscles: ['quads', 'glutes'],
  secondaryMuscles: ['hamstrings'],
  equipment: 'barbell',
  pattern: 'squat',
  category: 'compound',
  bigLift: true,
  standardKey: 'back-squat',
};

describe('analytics', () => {
  const now = Date.now();
  const workouts = [
    wk(now - 4 * DAY, 'back-squat', [[100, 5]]),
    wk(now - 2 * DAY, 'back-squat', [[105, 5]]),
    wk(now, 'back-squat', [[110, 5], [110, 3]]),
  ];

  it('builds an ascending e1RM series with PRs', () => {
    const s = buildExerciseSeries(workouts, 'back-squat');
    expect(s.points).toHaveLength(3);
    expect(s.best1rmKg).toBeGreaterThan(120);
    expect(s.prTimeline.length).toBe(3); // each session was a new PR
    expect(s.bestTopSetKg).toBe(110);
  });

  it('sums total volume', () => {
    // 100*5 + 105*5 + (110*5 + 110*3) = 500+525+880 = 1905
    expect(totalVolume(workouts)).toBe(1905);
  });

  it('computes weekly volume buckets', () => {
    const weeks = weeklyVolume(workouts, 4);
    expect(weeks).toHaveLength(4);
    const sum = weeks.reduce((n, w) => n + w.volumeKg, 0);
    expect(sum).toBe(1905);
  });

  it('counts a training streak', () => {
    const daily = [wk(now, 'back-squat', [[100, 5]]), wk(now - DAY, 'back-squat', [[100, 5]])];
    expect(computeStreak(daily)).toBe(2);
    expect(computeStreak([])).toBe(0);
  });

  it('detects recent PRs across exercises', () => {
    const prs = recentPRs(workouts, new Map([['back-squat', squat]]));
    expect(prs[0].exerciseName).toBe('Back Squat');
    expect(prs.length).toBeGreaterThan(0);
  });

  it('weights muscle balance by primary/secondary', () => {
    const bal = muscleBalance(workouts, new Map([['back-squat', squat]]), 28);
    const quads = bal.find((b) => b.muscle === 'quads');
    const hams = bal.find((b) => b.muscle === 'hamstrings');
    expect(quads!.sets).toBeGreaterThan(hams!.sets); // primary > secondary
  });
});
