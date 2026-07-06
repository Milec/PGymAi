/** Estimated 1-rep-max formulas. Weight in any unit; result in same unit. */

export type E1rmFormula = 'epley' | 'brzycki';

/** Epley: 1RM = w * (1 + reps/30). Exact at 1 rep. */
export function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki: 1RM = w * 36 / (37 - reps). Diverges as reps -> 37. */
export function brzycki(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return epley(weight, reps); // guard singularity
  return (weight * 36) / (37 - reps);
}

export function estimate1rm(
  weight: number,
  reps: number,
  formula: E1rmFormula = 'epley',
): number {
  return formula === 'brzycki' ? brzycki(weight, reps) : epley(weight, reps);
}

/** Both estimates plus a note about reliability. */
export function e1rmBreakdown(weight: number, reps: number) {
  return {
    epley: epley(weight, reps),
    brzycki: brzycki(weight, reps),
    reliable: reps > 0 && reps <= 12,
  };
}
