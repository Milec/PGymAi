import type { Sex } from '@/data/strengthStandards';

/**
 * Wilks coefficient (Wilks-1, the classic formula) — normalises a lift for
 * bodyweight and sex so scores are comparable across athletes.
 *
 *   coeff = 500 / (a + b·x + c·x² + d·x³ + e·x⁴ + f·x⁵),  x = bodyweight (kg)
 *   Wilks score = coeff × weight lifted (kg)
 *
 * Coefficients are the published Wilks-1 values (Robert Wilks / IPF era).
 */
const COEFFS: Record<Sex, [number, number, number, number, number, number]> = {
  male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8],
  female: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8],
};

// The 5th-order polynomial is only valid within the formula's fitted range;
// beyond it the curve turns over (and can go negative), so clamp per sex.
const MAX_BW: Record<Sex, number> = { male: 200, female: 150 };

/** Wilks coefficient for a bodyweight (kg) and sex. Clamped to a sane range. */
export function wilksCoefficient(sex: Sex, bodyweightKg: number): number {
  const x = Math.min(MAX_BW[sex], Math.max(40, bodyweightKg));
  const [a, b, c, d, e, f] = COEFFS[sex];
  const denom = a + b * x + c * x ** 2 + d * x ** 3 + e * x ** 4 + f * x ** 5;
  if (denom <= 0) return 0;
  return 500 / denom;
}

/** Wilks score for a lift: coefficient × weight lifted (kg). */
export function wilksScore(sex: Sex, bodyweightKg: number, liftKg: number): number {
  return wilksCoefficient(sex, bodyweightKg) * liftKg;
}
