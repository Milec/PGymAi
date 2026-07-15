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

/** Smallest weight change realisable with a pair of the smallest common plate. */
export function increment(unit: Unit): number {
  return unit === 'kg' ? 2.5 : 5;
}

/** Round a value already expressed in `unit` to the nearest plate increment. */
export function roundToIncrement(value: number, unit: Unit): number {
  const step = increment(unit);
  return Math.round(value / step) * step;
}

/**
 * Round a kg-stored weight to the nearest plate increment *in the display unit*,
 * returning kg. This keeps auto-filled weights on clean 5 lb / 2.5 kg steps so
 * the plate calculator always lands on real plates.
 */
export function roundKgToIncrement(kg: number, unit: Unit): number {
  return toKg(roundToIncrement(fromKg(kg, unit), unit), unit);
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

export const CM_PER_IN = 2.54;

/** Split a height in cm into feet + whole inches (inches wrap at 12). */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

/** Combine feet + inches into cm (rounded to whole cm). */
export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * CM_PER_IN);
}
