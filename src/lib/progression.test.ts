import { describe, expect, it } from 'vitest';
import { rpePercent, suggestLoad, summarizePerformance } from './progression';
import type { PrescribedExercise } from '@/schema/program';

const base = (over: Partial<PrescribedExercise>): PrescribedExercise => ({
  exerciseName: 'Back Squat',
  sets: 3,
  reps: 5,
  ...over,
});

describe('suggestLoad — intensity resolution', () => {
  it('resolves absolute loads directly (kg)', () => {
    const s = suggestLoad(base({ intensity: { type: 'absolute', value: 100 } }), { unit: 'kg' });
    expect(s.weightKg).toBe(100);
  });

  it('converts absolute loads from lb to kg for storage', () => {
    const s = suggestLoad(base({ intensity: { type: 'absolute', value: 100 } }), { unit: 'lb' });
    expect(s.weightKg).toBeCloseTo(45.359, 2);
  });

  it('computes %1RM from current e1RM', () => {
    const s = suggestLoad(base({ intensity: { type: 'percent1rm', value: 80 } }), {
      unit: 'kg',
      currentE1rmKg: 100,
    });
    expect(s.weightKg).toBe(80);
  });

  it('auto-regulates from RPE using the RPE table', () => {
    const s = suggestLoad(base({ reps: 5, intensity: { type: 'rpe', value: 8 } }), {
      unit: 'kg',
      currentE1rmKg: 100,
    });
    // RPE8 @ 5 reps ~ 81.1% of 1RM, rounded to 2.5kg.
    expect(s.weightKg).toBeGreaterThan(75);
    expect(s.weightKg).toBeLessThan(85);
  });
});

describe('suggestLoad — progression rules', () => {
  it('linear adds increment when targets are met', () => {
    const s = suggestLoad(
      base({ progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } }),
      { unit: 'kg', last: { topWeightKg: 100, topReps: 5, bestE1rmKg: 116, hitAllTargets: true } },
    );
    expect(s.weightKg).toBe(102.5);
  });

  it('linear repeats load when targets are missed', () => {
    const s = suggestLoad(
      base({ progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } }),
      { unit: 'kg', last: { topWeightKg: 100, topReps: 3, bestE1rmKg: 110, hitAllTargets: false } },
    );
    expect(s.weightKg).toBe(100);
  });

  it('double progression bumps load at the top of the rep range', () => {
    const s = suggestLoad(
      base({ reps: [6, 10], progression: { type: 'double', repRange: [6, 10], incrementKg: 2.5 } }),
      { unit: 'kg', last: { topWeightKg: 60, topReps: 10, bestE1rmKg: 80, hitAllTargets: true } },
    );
    expect(s.weightKg).toBe(62.5);
    expect(s.reps).toEqual([6, 10]);
  });

  it('double progression holds load below the top of the range', () => {
    const s = suggestLoad(
      base({ reps: [6, 10], progression: { type: 'double', repRange: [6, 10], incrementKg: 2.5 } }),
      { unit: 'kg', last: { topWeightKg: 60, topReps: 8, bestE1rmKg: 75, hitAllTargets: true } },
    );
    expect(s.weightKg).toBe(60);
  });

  it('percent-e1rm scales from current e1RM', () => {
    const s = suggestLoad(base({ progression: { type: 'percent-e1rm', percent: 90 } }), {
      unit: 'kg',
      currentE1rmKg: 100,
    });
    expect(s.weightKg).toBe(90);
  });
});

describe('rpePercent table', () => {
  it('RPE 10 @ 1 rep is 100%', () => {
    expect(rpePercent(10, 1)).toBe(1);
  });
  it('lower RPE means lower % for same reps', () => {
    expect(rpePercent(7, 5)).toBeLessThan(rpePercent(9, 5));
  });
  it('more reps means lower % for same RPE', () => {
    expect(rpePercent(8, 10)).toBeLessThan(rpePercent(8, 3));
  });
});

describe('summarizePerformance', () => {
  it('summarises top set and best e1RM', () => {
    const p = summarizePerformance([
      { weightKg: 100, reps: 5, completed: true },
      { weightKg: 105, reps: 3, completed: true },
      { weightKg: 90, reps: 8, completed: false },
    ])!;
    expect(p.topWeightKg).toBe(105);
    expect(p.hitAllTargets).toBe(true);
    expect(p.bestE1rmKg).toBeGreaterThan(105);
  });

  it('returns undefined with no completed sets', () => {
    expect(summarizePerformance([{ weightKg: 0, reps: 0, completed: false }])).toBeUndefined();
  });
});
