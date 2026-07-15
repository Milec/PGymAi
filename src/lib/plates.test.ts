import { describe, expect, it } from 'vitest';
import { barWeight, computePlateLoad, isBarbellEquipment } from './plates';
import { toKg } from './units';

describe('isBarbellEquipment', () => {
  it('recognises bar-loaded equipment', () => {
    expect(isBarbellEquipment('barbell')).toBe(true);
    expect(isBarbellEquipment('trap-bar')).toBe(true);
    expect(isBarbellEquipment('smith')).toBe(true);
  });
  it('rejects non-bar equipment', () => {
    expect(isBarbellEquipment('dumbbell')).toBe(false);
    expect(isBarbellEquipment('machine')).toBe(false);
    expect(isBarbellEquipment(undefined)).toBe(false);
  });
});

describe('barWeight', () => {
  it('uses the standard olympic bar by default', () => {
    expect(barWeight('barbell', 'lb')).toBe(45);
    expect(barWeight('barbell', 'kg')).toBe(20);
  });
  it('overrides lighter/heavier bars', () => {
    expect(barWeight('ez-bar', 'lb')).toBe(25);
    expect(barWeight('trap-bar', 'kg')).toBe(25);
  });
});

describe('computePlateLoad (lb)', () => {
  it('solves 225 lb as a 45 bar + one 45 + one 45 per side', () => {
    const load = computePlateLoad(toKg(225, 'lb'), 'lb', 'barbell')!;
    expect(load.exact).toBe(true);
    expect(load.perSide).toEqual([{ plate: 45, count: 2 }]);
    expect(load.loaded).toBe(225);
    expect(load.remainder).toBe(0);
  });

  it('solves 210 lb (the screenshot working set)', () => {
    const load = computePlateLoad(toKg(210, 'lb'), 'lb', 'barbell')!;
    // (210 - 45) / 2 = 82.5 per side → 45 + 35 + 2.5
    expect(load.perSide).toEqual([
      { plate: 45, count: 1 },
      { plate: 35, count: 1 },
      { plate: 2.5, count: 1 },
    ]);
    expect(load.exact).toBe(true);
  });

  it('rounds an odd weight to the nearest 5 lb before loading', () => {
    const load = computePlateLoad(toKg(137, 'lb'), 'lb', 'barbell')!;
    expect(load.target).toBe(135); // 137 → nearest 5
    expect(load.exact).toBe(true);
  });

  it('returns null below the bar', () => {
    expect(computePlateLoad(toKg(30, 'lb'), 'lb', 'barbell')).toBeNull();
  });
});

describe('computePlateLoad (kg)', () => {
  it('solves 100 kg with a greedy largest-first fill (25 + 15 per side)', () => {
    const load = computePlateLoad(100, 'kg', 'barbell')!;
    // (100 - 20) / 2 = 40 per side → 25 + 15
    expect(load.perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ]);
    expect(load.exact).toBe(true);
  });

  it('uses 1.25 kg plates for fine loads', () => {
    const load = computePlateLoad(62.5, 'kg', 'barbell')!;
    // (62.5 - 20) / 2 = 21.25 → 20 + 1.25
    expect(load.perSide).toEqual([
      { plate: 20, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
    expect(load.exact).toBe(true);
  });
});
