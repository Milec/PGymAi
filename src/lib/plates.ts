import type { Equipment } from '@/data/muscles';
import { fromKg, roundToIncrement, type Unit } from './units';

/** Equipment that is loaded by sliding plates onto a bar (per side). */
const BARBELL_EQUIPMENT = new Set<Equipment>(['barbell', 'ez-bar', 'trap-bar', 'smith']);

export function isBarbellEquipment(equipment?: Equipment): boolean {
  return !!equipment && BARBELL_EQUIPMENT.has(equipment);
}

/** Standard olympic bar weight, in the display unit. */
const STANDARD_BAR: Record<Unit, number> = { kg: 20, lb: 45 };

/** Bars whose empty weight differs from the standard olympic bar (display unit). */
const BAR_OVERRIDE: Partial<Record<Equipment, Record<Unit, number>>> = {
  'ez-bar': { kg: 10, lb: 25 },
  'trap-bar': { kg: 25, lb: 55 },
};

/** Empty-bar weight for a piece of equipment, in the display unit. */
export function barWeight(equipment: Equipment | undefined, unit: Unit): number {
  const override = equipment ? BAR_OVERRIDE[equipment] : undefined;
  return override ? override[unit] : STANDARD_BAR[unit];
}

/** Plate denominations commonly available in a gym, largest first (display unit). */
const PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export interface PlateStack {
  /** A single plate denomination, in the display unit. */
  plate: number;
  /** How many of that plate go on each side of the bar. */
  count: number;
}

export interface PlateLoad {
  /** Target weight the load is solving for, in the display unit. */
  target: number;
  /** Empty-bar weight, in the display unit. */
  bar: number;
  /** Plates on ONE side of the bar, largest first. */
  perSide: PlateStack[];
  /** Weight actually achieved by bar + plates, in the display unit. */
  loaded: number;
  /** Weight that could not be made with available plates (0 when exact). */
  remainder: number;
  /** Whether the plates land exactly on the target. */
  exact: boolean;
}

/**
 * Work out the plates to hang on each side of a bar to reach `weightKg`.
 *
 * Returns `null` when the target is below the empty bar (nothing to load) or
 * the equipment is not bar-loaded. The greedy fill assumes an unlimited supply
 * of each plate — good enough for a lifter eyeballing the next set.
 */
export function computePlateLoad(
  weightKg: number,
  unit: Unit,
  equipment?: Equipment,
): PlateLoad | null {
  const target = roundToIncrement(fromKg(weightKg, unit), unit);
  const bar = barWeight(equipment, unit);
  if (target < bar) return null;

  let perSideWeight = (target - bar) / 2;
  const perSide: PlateStack[] = [];
  for (const plate of PLATES[unit]) {
    const count = Math.floor((perSideWeight + 1e-9) / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      perSideWeight -= count * plate;
    }
  }

  const remainder = Math.round(perSideWeight * 2 * 100) / 100;
  return {
    target,
    bar,
    perSide,
    loaded: target - remainder,
    remainder,
    exact: remainder === 0,
  };
}
