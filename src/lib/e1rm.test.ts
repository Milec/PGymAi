import { describe, expect, it } from 'vitest';
import { brzycki, e1rmBreakdown, epley, estimate1rm } from './e1rm';

describe('e1RM formulas', () => {
  it('epley returns the weight at 1 rep', () => {
    expect(epley(100, 1)).toBe(100);
  });

  it('epley matches the textbook formula', () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(epley(100, 5)).toBeCloseTo(116.667, 2);
  });

  it('brzycki returns the weight at 1 rep', () => {
    expect(brzycki(100, 1)).toBe(100);
  });

  it('brzycki matches the textbook formula', () => {
    // 100 * 36 / (37 - 5) = 112.5
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 4);
  });

  it('guards against zero/negative inputs', () => {
    expect(epley(0, 5)).toBe(0);
    expect(brzycki(100, 0)).toBe(0);
    expect(estimate1rm(-5, 5)).toBe(0);
  });

  it('brzycki avoids the 37-rep singularity', () => {
    expect(Number.isFinite(brzycki(50, 37))).toBe(true);
    expect(Number.isFinite(brzycki(50, 40))).toBe(true);
  });

  it('estimate1rm dispatches by formula', () => {
    expect(estimate1rm(100, 5, 'epley')).toBeCloseTo(epley(100, 5), 6);
    expect(estimate1rm(100, 5, 'brzycki')).toBeCloseTo(brzycki(100, 5), 6);
  });

  it('breakdown flags unreliable high-rep estimates', () => {
    expect(e1rmBreakdown(100, 5).reliable).toBe(true);
    expect(e1rmBreakdown(100, 20).reliable).toBe(false);
  });

  it('estimates increase monotonically with reps', () => {
    expect(epley(100, 6)).toBeGreaterThan(epley(100, 5));
    expect(brzycki(100, 6)).toBeGreaterThan(brzycki(100, 5));
  });
});
