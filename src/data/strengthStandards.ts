/**
 * STRENGTH STANDARDS — bodyweight-ratio bands (lift ÷ bodyweight) at ~1RM.
 *
 * SOURCE / HONESTY NOTE (see DECISIONS.md §3 for full text):
 * These are APPROXIMATE reference bands consolidated from widely published,
 * openly documented strength-standard tables — primarily ExRx.net Strength
 * Standards (derived from Lon Kilgore's work) cross-checked against the
 * crowd-sourced Symmetric Strength / StrengthLevel ratio bands. They are a
 * ratio model (single lift/bodyweight ratio per level), NOT a per-bodyweight
 * regression, so they slightly overrate very light lifters and underrate very
 * heavy ones (allometric scaling). They are presented as approximate reference
 * points, never as authoritative competitive or medical standards.
 *
 * "Average person of your bodyweight" is defined explicitly as the NOVICE band
 * ceiling — roughly what a healthy, minimally-trained adult of that sex and
 * bodyweight can lift. It is a reference point, not a census of the general
 * (largely untrained) population.
 */

export type Sex = 'male' | 'female';

export const STRENGTH_LEVELS = [
  'Untrained',
  'Novice',
  'Intermediate',
  'Advanced',
  'Elite',
] as const;
export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

/** Ordered ratio thresholds — the *minimum* lift/bw ratio to reach each level. */
export interface RatioBands {
  Untrained: number;
  Novice: number;
  Intermediate: number;
  Advanced: number;
  Elite: number;
}

/** Standards keyed by the exercise's `standardKey`. */
export const STRENGTH_STANDARDS: Record<string, Record<Sex, RatioBands>> = {
  'back-squat': {
    male: { Untrained: 0.75, Novice: 1.2, Intermediate: 1.5, Advanced: 2.1, Elite: 2.75 },
    female: { Untrained: 0.5, Novice: 0.75, Intermediate: 1.25, Advanced: 1.75, Elite: 2.25 },
  },
  'bench-press': {
    male: { Untrained: 0.5, Novice: 0.75, Intermediate: 1.0, Advanced: 1.5, Elite: 2.0 },
    female: { Untrained: 0.35, Novice: 0.5, Intermediate: 0.75, Advanced: 1.0, Elite: 1.5 },
  },
  deadlift: {
    male: { Untrained: 1.0, Novice: 1.5, Intermediate: 2.0, Advanced: 2.5, Elite: 3.0 },
    female: { Untrained: 0.5, Novice: 1.0, Intermediate: 1.5, Advanced: 2.0, Elite: 2.5 },
  },
  'overhead-press': {
    male: { Untrained: 0.35, Novice: 0.55, Intermediate: 0.8, Advanced: 1.1, Elite: 1.4 },
    female: { Untrained: 0.2, Novice: 0.35, Intermediate: 0.5, Advanced: 0.75, Elite: 1.0 },
  },
  'barbell-row': {
    male: { Untrained: 0.5, Novice: 0.7, Intermediate: 1.0, Advanced: 1.3, Elite: 1.6 },
    female: { Untrained: 0.3, Novice: 0.5, Intermediate: 0.7, Advanced: 0.9, Elite: 1.2 },
  },
  'front-squat': {
    male: { Untrained: 0.6, Novice: 1.0, Intermediate: 1.3, Advanced: 1.8, Elite: 2.2 },
    female: { Untrained: 0.4, Novice: 0.65, Intermediate: 1.0, Advanced: 1.4, Elite: 1.8 },
  },
};

/** Approximate percentile among *trained* lifters at the start of each band. */
const BAND_PERCENTILE: Record<StrengthLevel, number> = {
  Untrained: 5,
  Novice: 20,
  Intermediate: 50,
  Advanced: 80,
  Elite: 95,
};

export interface StandardResult {
  ratio: number;
  level: StrengthLevel;
  /** Next level up (undefined if already Elite). */
  nextLevel?: StrengthLevel;
  /** Ratio needed to reach the next level. */
  nextRatio?: number;
  bands: RatioBands;
  /** The "average of your bodyweight" reference ratio (Novice ceiling). */
  averageRatio: number;
  /** Absolute average reference load in kg for this bodyweight. */
  averageKg: number;
  /** Signed delta of the user's e1RM vs the average reference, in kg. */
  deltaVsAverageKg: number;
  /** Approximate percentile among trained lifters (labelled "approx."). */
  approxPercentile: number;
}

export function hasStandard(standardKey: string | undefined): boolean {
  return !!standardKey && standardKey in STRENGTH_STANDARDS;
}

/**
 * Classify an estimated 1RM against the standards.
 * @param e1rmKg best estimated 1RM in kg
 * @param bodyweightKg user bodyweight in kg
 */
export function classifyStrength(
  standardKey: string,
  sex: Sex,
  e1rmKg: number,
  bodyweightKg: number,
): StandardResult | null {
  const table = STRENGTH_STANDARDS[standardKey];
  if (!table || bodyweightKg <= 0) return null;
  const bands = table[sex];
  const ratio = e1rmKg / bodyweightKg;

  const ordered = STRENGTH_LEVELS.map((l) => ({ level: l, r: bands[l] }));
  let level: StrengthLevel = 'Untrained';
  for (const { level: l, r } of ordered) {
    if (ratio >= r) level = l;
  }
  const idx = STRENGTH_LEVELS.indexOf(level);
  const nextLevel = idx < STRENGTH_LEVELS.length - 1 ? STRENGTH_LEVELS[idx + 1] : undefined;
  const nextRatio = nextLevel ? bands[nextLevel] : undefined;

  const averageRatio = bands.Novice;
  const averageKg = averageRatio * bodyweightKg;

  // Approximate percentile: interpolate within the current band toward the next.
  let approxPercentile: number;
  if (ratio < bands.Untrained) {
    approxPercentile = Math.max(1, (ratio / bands.Untrained) * BAND_PERCENTILE.Untrained);
  } else if (nextLevel && nextRatio !== undefined) {
    const lo = bands[level];
    const frac = Math.min(1, (ratio - lo) / (nextRatio - lo || 1));
    const pLo = BAND_PERCENTILE[level];
    const pHi = BAND_PERCENTILE[nextLevel];
    approxPercentile = pLo + frac * (pHi - pLo);
  } else {
    // At/over Elite threshold.
    const over = ratio / bands.Elite;
    approxPercentile = Math.min(99.5, 95 + (over - 1) * 20);
  }

  return {
    ratio,
    level,
    nextLevel,
    nextRatio,
    bands,
    averageRatio,
    averageKg,
    deltaVsAverageKg: e1rmKg - averageKg,
    approxPercentile: Math.round(approxPercentile * 10) / 10,
  };
}
