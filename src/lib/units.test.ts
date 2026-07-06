import { describe, expect, it } from 'vitest';
import { formatWeight, fromKg, roundToIncrement, toKg } from './units';

describe('unit conversion', () => {
  it('kg is identity', () => {
    expect(fromKg(100, 'kg')).toBe(100);
    expect(toKg(100, 'kg')).toBe(100);
  });

  it('kg <-> lb round-trips', () => {
    const lb = fromKg(100, 'lb');
    expect(lb).toBeCloseTo(220.462, 2);
    expect(toKg(lb, 'lb')).toBeCloseTo(100, 6);
  });

  it('rounds to plate increments', () => {
    expect(roundToIncrement(101, 'kg')).toBe(100); // nearest 2.5
    expect(roundToIncrement(103, 'kg')).toBe(102.5);
    expect(roundToIncrement(133, 'lb')).toBe(135); // nearest 5
  });

  it('formats without trailing noise', () => {
    expect(formatWeight(100, 'kg')).toBe('100');
    expect(formatWeight(102.5, 'kg')).toBe('102.5');
  });
});
