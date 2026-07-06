import { describe, expect, it } from 'vitest';
import {
  STRENGTH_STANDARDS,
  classifyStrength,
  hasStandard,
} from './strengthStandards';

describe('strength standards', () => {
  it('exposes the six big lifts', () => {
    for (const key of ['back-squat', 'bench-press', 'deadlift', 'overhead-press', 'barbell-row', 'front-squat']) {
      expect(hasStandard(key)).toBe(true);
    }
    expect(hasStandard('bicep-curl')).toBe(false);
    expect(hasStandard(undefined)).toBe(false);
  });

  it('bands are strictly increasing for every lift/sex', () => {
    for (const table of Object.values(STRENGTH_STANDARDS)) {
      for (const bands of Object.values(table)) {
        expect(bands.Untrained).toBeLessThan(bands.Novice);
        expect(bands.Novice).toBeLessThan(bands.Intermediate);
        expect(bands.Intermediate).toBeLessThan(bands.Advanced);
        expect(bands.Advanced).toBeLessThan(bands.Elite);
      }
    }
  });

  it('classifies a strong male squatter as advanced+', () => {
    // 2.1x bodyweight squat -> Advanced band for males.
    const r = classifyStrength('back-squat', 'male', 168, 80)!;
    expect(r.ratio).toBeCloseTo(2.1, 2);
    expect(r.level).toBe('Advanced');
    expect(r.deltaVsAverageKg).toBeGreaterThan(0);
  });

  it('defines the average reference as the Novice ceiling', () => {
    const r = classifyStrength('bench-press', 'male', 100, 80)!;
    // Novice male bench ratio = 0.75 -> 60kg average at 80kg bw.
    expect(r.averageKg).toBeCloseTo(60, 5);
    expect(r.averageRatio).toBeCloseTo(0.75, 5);
    expect(r.deltaVsAverageKg).toBeCloseTo(40, 5);
  });

  it('a weak lifter falls below untrained with low percentile', () => {
    const r = classifyStrength('deadlift', 'female', 20, 70)!;
    expect(r.level).toBe('Untrained');
    expect(r.approxPercentile).toBeLessThan(20);
  });

  it('percentile increases with load', () => {
    const weak = classifyStrength('back-squat', 'male', 80, 80)!;
    const strong = classifyStrength('back-squat', 'male', 200, 80)!;
    expect(strong.approxPercentile).toBeGreaterThan(weak.approxPercentile);
  });

  it('returns null for invalid bodyweight', () => {
    expect(classifyStrength('back-squat', 'male', 100, 0)).toBeNull();
  });

  it('reaches Elite with no next level', () => {
    const r = classifyStrength('deadlift', 'male', 260, 80)!; // 3.25x
    expect(r.level).toBe('Elite');
    expect(r.nextLevel).toBeUndefined();
  });
});
