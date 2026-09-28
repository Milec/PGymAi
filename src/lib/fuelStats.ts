import type { FoodLogEntry, WaterLog } from '@/db/types';
import {
  EMPTY_MACROS,
  addMacros,
  dateKey,
  macrosForAmount,
  shiftDateKey,
  type MacroSet,
} from './nutrition';

/** Derived nutrition metrics for the Trends page. */

export interface DayTotal {
  /** YYYY-MM-DD journal day. */
  date: string;
  macros: MacroSet;
  /** false for gap days inserted to keep the chart axis continuous. */
  logged: boolean;
}

/** Sum every entry into per-day totals, sorted by date ascending. */
export function dailyTotals(entries: FoodLogEntry[]): DayTotal[] {
  const byDay = new Map<string, MacroSet>();
  for (const e of entries) {
    byDay.set(e.date, addMacros(byDay.get(e.date) ?? EMPTY_MACROS, macrosForAmount(e.per100, e.amountG)));
  }
  return [...byDay.entries()]
    .map(([date, macros]) => ({ date, macros, logged: true }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Keep only days within the trailing window (periodDays 0 = all time). */
export function filterPeriod(days: DayTotal[], periodDays: number, today: string = dateKey()): DayTotal[] {
  if (periodDays <= 0) return days;
  const since = shiftDateKey(today, -(periodDays - 1));
  return days.filter((d) => d.date >= since && d.date <= today);
}

/**
 * Average macros across logged days only — an unlogged day is treated as
 * missing data, not as zero intake.
 */
export function averageMacros(days: DayTotal[]): MacroSet | null {
  const logged = days.filter((d) => d.logged);
  if (logged.length === 0) return null;
  const sum = logged.reduce((acc, d) => addMacros(acc, d.macros), EMPTY_MACROS);
  return {
    kcal: sum.kcal / logged.length,
    proteinG: sum.proteinG / logged.length,
    carbsG: sum.carbsG / logged.length,
    fatG: sum.fatG / logged.length,
  };
}

export interface WaterDay {
  date: string;
  ml: number;
  logged: boolean;
}

/** Sum water events into per-day totals, sorted by date ascending. */
export function dailyWater(logs: WaterLog[]): WaterDay[] {
  const byDay = new Map<string, number>();
  for (const w of logs) byDay.set(w.date, (byDay.get(w.date) ?? 0) + w.ml);
  return [...byDay.entries()]
    .map(([date, ml]) => ({ date, ml, logged: true }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Trailing-window filter for water days (periodDays 0 = all time). */
export function filterWaterPeriod(days: WaterDay[], periodDays: number, today: string = dateKey()): WaterDay[] {
  if (periodDays <= 0) return days;
  const since = shiftDateKey(today, -(periodDays - 1));
  return days.filter((d) => d.date >= since && d.date <= today);
}

/** Average ml/day across days with water logged; null when none. */
export function averageWaterMl(days: WaterDay[]): number | null {
  const logged = days.filter((d) => d.logged);
  if (logged.length === 0) return null;
  return logged.reduce((s, d) => s + d.ml, 0) / logged.length;
}

/**
 * Longest span a gap-filled series may cover. A chart with a point per day gets
 * unreadable (and slow) long before this; the cap also stops a malformed date
 * key from spinning the fill loop forever.
 */
export const MAX_GAP_FILL_DAYS = 730;

/**
 * Resolve the [start, end] day range a gap fill should cover. The window is
 * anchored to its END so that capping a very long history drops the oldest
 * days — showing a two-year-old chart with today missing would be worse than
 * showing a shorter one.
 */
function gapWindow(
  firstLogged: string,
  lastLogged: string,
  periodDays: number,
  today: string,
): { start: string; end: string } {
  const end = periodDays > 0 ? today : lastLogged;
  const wanted = periodDays > 0 ? shiftDateKey(today, -(periodDays - 1)) : firstLogged;
  const earliest = shiftDateKey(end, -(MAX_GAP_FILL_DAYS - 1));
  return { start: wanted > earliest ? wanted : earliest, end };
}

/** Continuous-axis fill for water days (mirrors fillGaps). */
export function fillWaterGaps(days: WaterDay[], periodDays: number, today: string = dateKey()): WaterDay[] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const { start, end } = gapWindow(days[0].date, days[days.length - 1].date, periodDays, today);
  const out: WaterDay[] = [];
  for (let d = start; d <= end; d = shiftDateKey(d, 1)) {
    out.push(byDate.get(d) ?? { date: d, ml: 0, logged: false });
  }
  return out;
}

/**
 * Fill calendar gaps between the first and last day (or the whole trailing
 * window when periodDays > 0) so chart x-axes are continuous. Gap days carry
 * zero macros and logged=false.
 */
export function fillGaps(days: DayTotal[], periodDays: number, today: string = dateKey()): DayTotal[] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const { start, end } = gapWindow(days[0].date, days[days.length - 1].date, periodDays, today);
  const out: DayTotal[] = [];
  for (let d = start; d <= end; d = shiftDateKey(d, 1)) {
    out.push(byDate.get(d) ?? { date: d, macros: EMPTY_MACROS, logged: false });
  }
  return out;
}
