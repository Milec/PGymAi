import { describe, expect, it } from 'vitest';
import type { FoodLogEntry } from '@/db/types';
import { averageMacros, dailyTotals, fillGaps, filterPeriod } from './fuelStats';

function entry(date: string, kcalPer100: number, proteinPer100: number, amountG = 100): FoodLogEntry {
  return {
    id: `e-${date}-${Math.random()}`,
    date,
    meal: 'lunch',
    name: 'Test food',
    per100: { kcal: kcalPer100, proteinG: proteinPer100, carbsG: 0, fatG: 0 },
    amountG,
    loggedAt: 0,
  };
}

describe('dailyTotals', () => {
  it('sums entries per day and sorts ascending', () => {
    const days = dailyTotals([
      entry('2026-07-02', 300, 20),
      entry('2026-07-01', 500, 30),
      entry('2026-07-02', 200, 10, 50), // 100 kcal, 5 g protein
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(days[1].macros.kcal).toBeCloseTo(400);
    expect(days[1].macros.proteinG).toBeCloseTo(25);
  });
});

describe('filterPeriod', () => {
  const days = dailyTotals([
    entry('2026-06-01', 100, 1),
    entry('2026-07-01', 200, 2),
    entry('2026-07-08', 300, 3),
  ]);

  it('keeps only the trailing window', () => {
    const week = filterPeriod(days, 7, '2026-07-08');
    expect(week.map((d) => d.date)).toEqual(['2026-07-08']);
    const month = filterPeriod(days, 30, '2026-07-08');
    expect(month.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-08']);
  });

  it('period 0 means all time', () => {
    expect(filterPeriod(days, 0, '2026-07-08')).toHaveLength(3);
  });
});

describe('averageMacros', () => {
  it('averages across logged days only', () => {
    const days = fillGaps(
      dailyTotals([entry('2026-07-01', 2000, 150), entry('2026-07-03', 1000, 50)]),
      0,
      '2026-07-03',
    );
    expect(days).toHaveLength(3); // gap day inserted
    const avg = averageMacros(days)!;
    expect(avg.kcal).toBeCloseTo(1500); // gap day excluded from the average
    expect(avg.proteinG).toBeCloseTo(100);
  });

  it('returns null with no logged days', () => {
    expect(averageMacros([])).toBeNull();
  });
});

describe('fillGaps', () => {
  it('fills the whole trailing window for a fixed period', () => {
    const days = fillGaps(dailyTotals([entry('2026-07-07', 500, 20)]), 7, '2026-07-08');
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-07-02');
    expect(days[5].logged).toBe(true);
    expect(days[6].logged).toBe(false); // today, nothing logged
  });
});
