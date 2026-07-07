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

import { wilksCoefficient } from '@/lib/wilks';

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

// ---------------------------------------------------------------------------
// WILKS-BASED CLASSIFICATION
//
// The Wilks coefficient normalises a lift for bodyweight and sex, giving a
// single comparable score. Per-lift Wilks-score bands below are derived by
// running the published ratio standards above through the Wilks formula at
// reference bodyweights (male 90 kg, female 65 kg) and averaging the sexes —
// so the bands are one sex/bodyweight-independent scale grounded in the same
// documented tables. Still approximate reference bands, not official standards.
// ---------------------------------------------------------------------------

const REF_BW: Record<Sex, number> = { male: 90, female: 65 };

function deriveWilksBands(std: Record<Sex, RatioBands>): RatioBands {
  const out = {} as RatioBands;
  for (const level of STRENGTH_LEVELS) {
    const m = std.male[level] * REF_BW.male * wilksCoefficient('male', REF_BW.male);
    const f = std.female[level] * REF_BW.female * wilksCoefficient('female', REF_BW.female);
    out[level] = Math.round((m + f) / 2);
  }
  return out;
}

/** Wilks-score bands per lift (see note above). */
export const WILKS_BANDS: Record<string, RatioBands> = Object.fromEntries(
  Object.entries(STRENGTH_STANDARDS).map(([key, std]) => [key, deriveWilksBands(std)]),
);

export interface WilksResult {
  /** Wilks score for this lift (coefficient × e1RM). */
  score: number;
  /** The Wilks coefficient at the user's sex + bodyweight. */
  coefficient: number;
  level: StrengthLevel;
  nextLevel?: StrengthLevel;
  nextScore?: number;
  bands: RatioBands;
  /** "Average of your bodyweight" reference Wilks score (Novice ceiling). */
  averageScore: number;
  /** That reference expressed as a lift in kg at this bodyweight. */
  averageKg: number;
  /** Signed delta of the user's e1RM vs the average reference, in kg. */
  deltaVsAverageKg: number;
  /** Approximate percentile among trained lifters (labelled "approx."). */
  approxPercentile: number;
}

/** Classify an estimated 1RM using the Wilks score against per-lift bands. */
export function classifyWilks(
  standardKey: string,
  sex: Sex,
  e1rmKg: number,
  bodyweightKg: number,
): WilksResult | null {
  const bands = WILKS_BANDS[standardKey];
  if (!bands || bodyweightKg <= 0) return null;
  const coefficient = wilksCoefficient(sex, bodyweightKg);
  const score = coefficient * e1rmKg;

  let level: StrengthLevel = 'Untrained';
  for (const l of STRENGTH_LEVELS) if (score >= bands[l]) level = l;
  const idx = STRENGTH_LEVELS.indexOf(level);
  const nextLevel = idx < STRENGTH_LEVELS.length - 1 ? STRENGTH_LEVELS[idx + 1] : undefined;
  const nextScore = nextLevel ? bands[nextLevel] : undefined;

  const averageScore = bands.Novice;
  const averageKg = coefficient > 0 ? averageScore / coefficient : 0;

  let approxPercentile: number;
  if (score < bands.Untrained) {
    approxPercentile = Math.max(1, (score / bands.Untrained) * BAND_PERCENTILE.Untrained);
  } else if (nextLevel && nextScore !== undefined) {
    const lo = bands[level];
    const frac = Math.min(1, (score - lo) / (nextScore - lo || 1));
    approxPercentile = BAND_PERCENTILE[level] + frac * (BAND_PERCENTILE[nextLevel] - BAND_PERCENTILE[level]);
  } else {
    approxPercentile = Math.min(99.5, 95 + (score / bands.Elite - 1) * 20);
  }

  return {
    score,
    coefficient,
    level,
    nextLevel,
    nextScore,
    bands,
    averageScore,
    averageKg,
    deltaVsAverageKg: e1rmKg - averageKg,
    approxPercentile: Math.round(approxPercentile * 10) / 10,
  };
}
