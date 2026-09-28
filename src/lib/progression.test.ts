import { describe, expect, it } from 'vitest';
import { rpePercent, suggestLoad, summarizePerformance } from './progression';
import { fromKg } from './units';
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

describe('suggestLoad — units', () => {
  it('reads an absolute load in the program\u2019s units, not the user\u2019s', () => {
    // A 225 lb prescription for a user who works in kg is ~102 kg, not 225 kg.
    const s = suggestLoad(base({ intensity: { type: 'absolute', value: 225 } }), {
      unit: 'kg',
      programUnit: 'lb',
    });
    expect(s.weightKg).toBeCloseTo(102.06, 1);
  });

  it('falls back to the user unit when the program declares none', () => {
    const s = suggestLoad(base({ intensity: { type: 'absolute', value: 100 } }), { unit: 'kg' });
    expect(s.weightKg).toBe(100);
  });

  it('rounds a linear bump to a loadable weight in the user\u2019s unit', () => {
    // 100 kg + 2.5 kg = 102.5 kg = 225.97 lb, which rounds to a real 225 lb.
    const s = suggestLoad(
      base({ progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } }),
      { unit: 'lb', last: { topWeightKg: 100, topReps: 5, bestE1rmKg: 116, hitAllTargets: true } },
    );
    expect(fromKg(s.weightKg, 'lb')).toBeCloseTo(225, 5);
  });

  it('rounds a double-progression bump to a loadable weight in the user\u2019s unit', () => {
    const s = suggestLoad(
      base({ reps: [6, 10], progression: { type: 'double', repRange: [6, 10], incrementKg: 2.5 } }),
      { unit: 'lb', last: { topWeightKg: 60, topReps: 10, bestE1rmKg: 80, hitAllTargets: true } },
    );
    expect(fromKg(s.weightKg, 'lb')).toBeCloseTo(140, 5);
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
    ])!;
    expect(p.topWeightKg).toBe(105);
    expect(p.hitAllTargets).toBe(true);
    expect(p.bestE1rmKg).toBeGreaterThan(105);
  });

  it('does not count a session with an abandoned set as hitting targets', () => {
    const p = summarizePerformance([
      { weightKg: 100, reps: 5, completed: true },
      { weightKg: 100, reps: 5, completed: true },
      { weightKg: 100, reps: 2, completed: false },
    ])!;
    expect(p.hitAllTargets).toBe(false);
  });

  it('fails the target when a completed set fell short of its prescribed reps', () => {
    const p = summarizePerformance([
      { weightKg: 100, reps: 5, completed: true, targetReps: 5 },
      { weightKg: 100, reps: 3, completed: true, targetReps: 5 },
    ])!;
    expect(p.hitAllTargets).toBe(false);
  });

  it('counts the bottom of a rep range as hitting the target', () => {
    const p = summarizePerformance([
      { weightKg: 60, reps: 6, completed: true, targetReps: [6, 10] },
      { weightKg: 60, reps: 8, completed: true, targetReps: [6, 10] },
    ])!;
    expect(p.hitAllTargets).toBe(true);
  });

  it('returns undefined with no completed sets', () => {
    expect(summarizePerformance([{ weightKg: 0, reps: 0, completed: false }])).toBeUndefined();
  });
});
