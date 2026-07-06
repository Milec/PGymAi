export type Unit = 'kg' | 'lb';

export const KG_PER_LB = 0.45359237;

/** Convert a value stored in kg to the display unit. */
export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/** Convert a value entered in the display unit back to kg for storage. */
export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** Round to the nearest sensible plate increment for the unit. */
export function roundToIncrement(value: number, unit: Unit): number {
  const step = unit === 'kg' ? 2.5 : 5;
  return Math.round(value / step) * step;
}

/** Format a kg value for display in the given unit (no unit suffix). */
export function formatWeight(kg: number, unit: Unit, decimals = 1): string {
  const v = fromKg(kg, unit);
  const rounded = Math.round(v * 10 ** decimals) / 10 ** decimals;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
}

export function unitLabel(unit: Unit): string {
  return unit;
}
