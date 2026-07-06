export const MUSCLE_GROUPS = [
  'chest',
  'upper-back',
  'lats',
  'traps',
  'shoulders',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
  'lower-back',
  'adductors',
  'abductors',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'smith',
  'ez-bar',
  'trap-bar',
  'plate',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal-push',
  'vertical-push',
  'horizontal-pull',
  'vertical-pull',
  'carry',
  'core',
  'isolation',
  'olympic',
] as const;
export type MovementPattern = (typeof PATTERNS)[number];

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  'upper-back': 'Upper Back',
  lats: 'Lats',
  traps: 'Traps',
  shoulders: 'Shoulders',
  'rear-delts': 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
  obliques: 'Obliques',
  'lower-back': 'Lower Back',
  adductors: 'Adductors',
  abductors: 'Abductors',
};
