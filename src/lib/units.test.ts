import { describe, expect, it } from 'vitest';
import {
  cmToFtIn,
  formatWeight,
  fromKg,
  ftInToCm,
  roundKgToIncrement,
  roundToIncrement,
  toKg,
} from './units';

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

  it('rounds kg-stored weights to plate steps in the display unit', () => {
    // lb user: 50% of a 420 lb 1RM = 210 lb exactly → stays on a clean 5 lb step.
    const oneRmKg = toKg(420, 'lb');
    expect(fromKg(roundKgToIncrement(0.5 * oneRmKg, 'lb'), 'lb')).toBeCloseTo(210, 6);
    // An off-grid lb weight snaps to the nearest 5 lb, not the nearest 5 kg.
    expect(fromKg(roundKgToIncrement(toKg(212, 'lb'), 'lb'), 'lb')).toBeCloseTo(210, 6);
    expect(fromKg(roundKgToIncrement(toKg(213, 'lb'), 'lb'), 'lb')).toBeCloseTo(215, 6);
    // kg user rounds to the nearest 2.5 kg.
    expect(roundKgToIncrement(101, 'kg')).toBeCloseTo(100, 6);
  });

  it('formats without trailing noise', () => {
    expect(formatWeight(100, 'kg')).toBe('100');
    expect(formatWeight(102.5, 'kg')).toBe('102.5');
  });

  it('converts height cm <-> ft/in with inch wrapping', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 }); // 70.9 in
    expect(cmToFtIn(183)).toEqual({ ft: 6, inch: 0 }); // 72.05 in
    expect(ftInToCm(5, 11)).toBe(180);
    expect(ftInToCm(6, 0)).toBe(183);
    // Round-trips land on the same whole-inch height.
    expect(cmToFtIn(ftInToCm(5, 7))).toEqual({ ft: 5, inch: 7 });
  });
});
