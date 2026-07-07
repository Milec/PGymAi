import { describe, expect, it } from 'vitest';
import { wilksCoefficient, wilksScore } from './wilks';
import { classifyWilks, WILKS_BANDS, STRENGTH_LEVELS } from '@/data/strengthStandards';

describe('Wilks coefficient', () => {
  it('is in a sensible range for a mid-bodyweight male', () => {
    const c = wilksCoefficient('male', 90);
    expect(c).toBeGreaterThan(0.55);
    expect(c).toBeLessThan(0.75);
  });

  it('is higher for lighter lifters (same sex)', () => {
    expect(wilksCoefficient('male', 70)).toBeGreaterThan(wilksCoefficient('male', 110));
  });

  it('rewards a lighter lifter for the same absolute lift', () => {
    const light = wilksScore('male', 70, 150);
    const heavy = wilksScore('male', 110, 150);
    expect(light).toBeGreaterThan(heavy);
  });

  it('clamps extreme bodyweights without going negative', () => {
    expect(wilksCoefficient('male', 30)).toBeGreaterThan(0);
    expect(wilksCoefficient('female', 300)).toBeGreaterThan(0);
  });
});

describe('Wilks bands + classification', () => {
  it('derives strictly increasing bands for every lift', () => {
    for (const bands of Object.values(WILKS_BANDS)) {
      for (let i = 1; i < STRENGTH_LEVELS.length; i++) {
        expect(bands[STRENGTH_LEVELS[i]]).toBeGreaterThan(bands[STRENGTH_LEVELS[i - 1]]);
      }
    }
  });

  it('classifies a strong lifter above a weak one', () => {
    const weak = classifyWilks('bench-press', 'male', 40, 90)!;
    const strong = classifyWilks('bench-press', 'male', 160, 90)!;
    expect(STRENGTH_LEVELS.indexOf(strong.level)).toBeGreaterThan(
      STRENGTH_LEVELS.indexOf(weak.level),
    );
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('score equals coefficient × e1RM', () => {
    const r = classifyWilks('deadlift', 'male', 200, 90)!;
    expect(r.score).toBeCloseTo(wilksCoefficient('male', 90) * 200, 5);
  });

  it('average reference is the Novice band, expressed back into kg', () => {
    const r = classifyWilks('back-squat', 'female', 100, 65)!;
    expect(r.averageScore).toBe(r.bands.Novice);
    expect(r.averageKg).toBeCloseTo(r.averageScore / r.coefficient, 3);
    expect(r.deltaVsAverageKg).toBeCloseTo(100 - r.averageKg, 3);
  });

  it('returns null for invalid bodyweight or unknown lift', () => {
    expect(classifyWilks('back-squat', 'male', 100, 0)).toBeNull();
    expect(classifyWilks('bicep-curl', 'male', 100, 90)).toBeNull();
  });
});
