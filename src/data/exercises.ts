import type { Equipment, MovementPattern, MuscleGroup } from './muscles';

export interface SeedExercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  pattern: MovementPattern;
  category: 'compound' | 'isolation';
  bigLift: boolean;
  standardKey?: string;
  custom?: boolean;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

type E = [
  name: string,
  equipment: Equipment,
  pattern: MovementPattern,
  category: 'compound' | 'isolation',
  primary: MuscleGroup[],
  secondary: MuscleGroup[],
  big?: boolean,
  standardKey?: string,
];

function e(...args: E): SeedExercise {
  const [name, equipment, pattern, category, primary, secondary, big, standardKey] = args;
  return {
    id: slug(name),
    name,
    equipment,
    pattern,
    category,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    bigLift: !!big,
    standardKey,
  };
}

const list: SeedExercise[] = [
  // Big barbell lifts (strength-standard eligible)
  e('Back Squat', 'barbell', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings', 'lower-back', 'abs'], true, 'back-squat'),
  e('Front Squat', 'barbell', 'squat', 'compound', ['quads'], ['glutes', 'abs', 'upper-back'], true, 'front-squat'),
  e('Bench Press', 'barbell', 'horizontal-push', 'compound', ['chest'], ['triceps', 'shoulders'], true, 'bench-press'),
  e('Deadlift', 'barbell', 'hinge', 'compound', ['glutes', 'hamstrings', 'lower-back'], ['quads', 'traps', 'forearms'], true, 'deadlift'),
  e('Overhead Press', 'barbell', 'vertical-push', 'compound', ['shoulders'], ['triceps', 'traps', 'abs'], true, 'overhead-press'),
  e('Barbell Row', 'barbell', 'horizontal-pull', 'compound', ['upper-back', 'lats'], ['biceps', 'rear-delts', 'lower-back'], true, 'barbell-row'),

  // ---- Squat / quad ----
  e('Box Squat', 'barbell', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings']),
  e('Pause Squat', 'barbell', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings', 'abs']),
  e('Safety Bar Squat', 'barbell', 'squat', 'compound', ['quads', 'glutes'], ['upper-back']),
  e('Goblet Squat', 'dumbbell', 'squat', 'compound', ['quads', 'glutes'], ['abs']),
  e('Hack Squat', 'machine', 'squat', 'compound', ['quads'], ['glutes']),
  e('Leg Press', 'machine', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings']),
  e('Smith Machine Squat', 'smith', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings']),
  e('Bulgarian Split Squat', 'dumbbell', 'lunge', 'compound', ['quads', 'glutes'], ['hamstrings', 'adductors']),
  e('Walking Lunge', 'dumbbell', 'lunge', 'compound', ['quads', 'glutes'], ['hamstrings']),
  e('Reverse Lunge', 'dumbbell', 'lunge', 'compound', ['glutes', 'quads'], ['hamstrings']),
  e('Step Up', 'dumbbell', 'lunge', 'compound', ['quads', 'glutes'], ['hamstrings']),
  e('Sissy Squat', 'bodyweight', 'squat', 'isolation', ['quads'], []),
  e('Leg Extension', 'machine', 'isolation', 'isolation', ['quads'], []),
  e('Pistol Squat', 'bodyweight', 'squat', 'compound', ['quads', 'glutes'], ['abs']),
  e('Zercher Squat', 'barbell', 'squat', 'compound', ['quads', 'glutes'], ['upper-back', 'abs']),

  // ---- Hinge / posterior chain ----
  e('Romanian Deadlift', 'barbell', 'hinge', 'compound', ['hamstrings', 'glutes'], ['lower-back', 'forearms']),
  e('Stiff-Leg Deadlift', 'barbell', 'hinge', 'compound', ['hamstrings'], ['glutes', 'lower-back']),
  e('Sumo Deadlift', 'barbell', 'hinge', 'compound', ['glutes', 'hamstrings'], ['adductors', 'quads', 'traps']),
  e('Trap Bar Deadlift', 'trap-bar', 'hinge', 'compound', ['glutes', 'quads'], ['hamstrings', 'traps']),
  e('Deficit Deadlift', 'barbell', 'hinge', 'compound', ['glutes', 'hamstrings'], ['quads', 'lower-back']),
  e('Rack Pull', 'barbell', 'hinge', 'compound', ['glutes', 'traps'], ['lower-back', 'forearms']),
  e('Good Morning', 'barbell', 'hinge', 'compound', ['hamstrings', 'lower-back'], ['glutes']),
  e('Hip Thrust', 'barbell', 'hinge', 'compound', ['glutes'], ['hamstrings']),
  e('Glute Bridge', 'barbell', 'hinge', 'compound', ['glutes'], ['hamstrings']),
  e('Kettlebell Swing', 'kettlebell', 'hinge', 'compound', ['glutes', 'hamstrings'], ['lower-back', 'shoulders']),
  e('Back Extension', 'bodyweight', 'hinge', 'isolation', ['lower-back'], ['glutes', 'hamstrings']),
  e('Lying Leg Curl', 'machine', 'isolation', 'isolation', ['hamstrings'], ['calves']),
  e('Seated Leg Curl', 'machine', 'isolation', 'isolation', ['hamstrings'], []),
  e('Nordic Curl', 'bodyweight', 'isolation', 'isolation', ['hamstrings'], ['glutes']),
  e('Cable Pull-Through', 'cable', 'hinge', 'compound', ['glutes', 'hamstrings'], ['lower-back']),

  // ---- Horizontal push (chest) ----
  e('Incline Bench Press', 'barbell', 'horizontal-push', 'compound', ['chest', 'shoulders'], ['triceps']),
  e('Decline Bench Press', 'barbell', 'horizontal-push', 'compound', ['chest'], ['triceps']),
  e('Close-Grip Bench Press', 'barbell', 'horizontal-push', 'compound', ['triceps', 'chest'], ['shoulders']),
  e('Dumbbell Bench Press', 'dumbbell', 'horizontal-push', 'compound', ['chest'], ['triceps', 'shoulders']),
  e('Incline Dumbbell Press', 'dumbbell', 'horizontal-push', 'compound', ['chest', 'shoulders'], ['triceps']),
  e('Machine Chest Press', 'machine', 'horizontal-push', 'compound', ['chest'], ['triceps', 'shoulders']),
  e('Smith Machine Bench Press', 'smith', 'horizontal-push', 'compound', ['chest'], ['triceps']),
  e('Push-Up', 'bodyweight', 'horizontal-push', 'compound', ['chest'], ['triceps', 'shoulders', 'abs']),
  e('Dips', 'bodyweight', 'horizontal-push', 'compound', ['chest', 'triceps'], ['shoulders']),
  e('Dumbbell Fly', 'dumbbell', 'isolation', 'isolation', ['chest'], ['shoulders']),
  e('Cable Fly', 'cable', 'isolation', 'isolation', ['chest'], ['shoulders']),
  e('Pec Deck', 'machine', 'isolation', 'isolation', ['chest'], []),
  e('Incline Cable Fly', 'cable', 'isolation', 'isolation', ['chest'], ['shoulders']),
  e('Svend Press', 'plate', 'isolation', 'isolation', ['chest'], []),

  // ---- Vertical push (shoulders) ----
  e('Seated Dumbbell Press', 'dumbbell', 'vertical-push', 'compound', ['shoulders'], ['triceps', 'traps']),
  e('Arnold Press', 'dumbbell', 'vertical-push', 'compound', ['shoulders'], ['triceps']),
  e('Push Press', 'barbell', 'vertical-push', 'compound', ['shoulders'], ['triceps', 'quads', 'glutes']),
  e('Machine Shoulder Press', 'machine', 'vertical-push', 'compound', ['shoulders'], ['triceps']),
  e('Landmine Press', 'barbell', 'vertical-push', 'compound', ['shoulders', 'chest'], ['triceps', 'abs']),
  e('Pike Push-Up', 'bodyweight', 'vertical-push', 'compound', ['shoulders'], ['triceps']),
  e('Lateral Raise', 'dumbbell', 'isolation', 'isolation', ['shoulders'], []),
  e('Cable Lateral Raise', 'cable', 'isolation', 'isolation', ['shoulders'], []),
  e('Front Raise', 'dumbbell', 'isolation', 'isolation', ['shoulders'], []),
  e('Rear Delt Fly', 'dumbbell', 'isolation', 'isolation', ['rear-delts'], ['upper-back']),
  e('Reverse Pec Deck', 'machine', 'isolation', 'isolation', ['rear-delts'], ['upper-back']),
  e('Face Pull', 'cable', 'horizontal-pull', 'isolation', ['rear-delts', 'traps'], ['upper-back']),
  e('Upright Row', 'barbell', 'vertical-pull', 'compound', ['traps', 'shoulders'], ['biceps']),

  // ---- Vertical pull (back / lats) ----
  e('Pull-Up', 'bodyweight', 'vertical-pull', 'compound', ['lats', 'upper-back'], ['biceps', 'forearms']),
  e('Chin-Up', 'bodyweight', 'vertical-pull', 'compound', ['lats', 'biceps'], ['upper-back']),
  e('Lat Pulldown', 'cable', 'vertical-pull', 'compound', ['lats'], ['biceps', 'upper-back']),
  e('Close-Grip Pulldown', 'cable', 'vertical-pull', 'compound', ['lats'], ['biceps']),
  e('Neutral-Grip Pulldown', 'cable', 'vertical-pull', 'compound', ['lats'], ['biceps', 'upper-back']),
  e('Straight-Arm Pulldown', 'cable', 'isolation', 'isolation', ['lats'], ['triceps']),
  e('Assisted Pull-Up', 'machine', 'vertical-pull', 'compound', ['lats'], ['biceps']),

  // ---- Horizontal pull (rows) ----
  e('Pendlay Row', 'barbell', 'horizontal-pull', 'compound', ['upper-back', 'lats'], ['biceps', 'rear-delts']),
  e('T-Bar Row', 'barbell', 'horizontal-pull', 'compound', ['upper-back', 'lats'], ['biceps']),
  e('Dumbbell Row', 'dumbbell', 'horizontal-pull', 'compound', ['lats', 'upper-back'], ['biceps']),
  e('Chest-Supported Row', 'machine', 'horizontal-pull', 'compound', ['upper-back'], ['lats', 'biceps']),
  e('Seated Cable Row', 'cable', 'horizontal-pull', 'compound', ['upper-back', 'lats'], ['biceps', 'rear-delts']),
  e('Inverted Row', 'bodyweight', 'horizontal-pull', 'compound', ['upper-back'], ['lats', 'biceps']),
  e('Meadows Row', 'barbell', 'horizontal-pull', 'compound', ['lats', 'upper-back'], ['biceps']),
  e('Seal Row', 'barbell', 'horizontal-pull', 'compound', ['upper-back', 'lats'], ['biceps']),

  // ---- Traps ----
  e('Barbell Shrug', 'barbell', 'isolation', 'isolation', ['traps'], ['forearms']),
  e('Dumbbell Shrug', 'dumbbell', 'isolation', 'isolation', ['traps'], ['forearms']),
  e('Farmer Carry', 'dumbbell', 'carry', 'compound', ['traps', 'forearms'], ['abs', 'glutes']),

  // ---- Biceps ----
  e('Barbell Curl', 'barbell', 'isolation', 'isolation', ['biceps'], ['forearms']),
  e('EZ-Bar Curl', 'ez-bar', 'isolation', 'isolation', ['biceps'], ['forearms']),
  e('Dumbbell Curl', 'dumbbell', 'isolation', 'isolation', ['biceps'], ['forearms']),
  e('Hammer Curl', 'dumbbell', 'isolation', 'isolation', ['biceps', 'forearms'], []),
  e('Incline Dumbbell Curl', 'dumbbell', 'isolation', 'isolation', ['biceps'], []),
  e('Preacher Curl', 'ez-bar', 'isolation', 'isolation', ['biceps'], []),
  e('Cable Curl', 'cable', 'isolation', 'isolation', ['biceps'], ['forearms']),
  e('Concentration Curl', 'dumbbell', 'isolation', 'isolation', ['biceps'], []),
  e('Spider Curl', 'dumbbell', 'isolation', 'isolation', ['biceps'], []),

  // ---- Triceps ----
  e('Triceps Pushdown', 'cable', 'isolation', 'isolation', ['triceps'], []),
  e('Rope Pushdown', 'cable', 'isolation', 'isolation', ['triceps'], []),
  e('Overhead Triceps Extension', 'dumbbell', 'isolation', 'isolation', ['triceps'], []),
  e('Skull Crusher', 'ez-bar', 'isolation', 'isolation', ['triceps'], []),
  e('Cable Overhead Extension', 'cable', 'isolation', 'isolation', ['triceps'], []),
  e('Bench Dip', 'bodyweight', 'isolation', 'isolation', ['triceps'], ['chest']),
  e('Diamond Push-Up', 'bodyweight', 'horizontal-push', 'compound', ['triceps', 'chest'], ['shoulders']),
  e('Kickback', 'dumbbell', 'isolation', 'isolation', ['triceps'], []),

  // ---- Forearms ----
  e('Wrist Curl', 'barbell', 'isolation', 'isolation', ['forearms'], []),
  e('Reverse Wrist Curl', 'barbell', 'isolation', 'isolation', ['forearms'], []),
  e('Reverse Curl', 'ez-bar', 'isolation', 'isolation', ['forearms', 'biceps'], []),
  e('Wrist Roller', 'plate', 'isolation', 'isolation', ['forearms'], []),
  e('Dead Hang', 'bodyweight', 'carry', 'isolation', ['forearms'], ['lats']),

  // ---- Quads/Glutes accessory ----
  e('Cable Kickback', 'cable', 'isolation', 'isolation', ['glutes'], ['hamstrings']),
  e('Hip Abduction', 'machine', 'isolation', 'isolation', ['abductors', 'glutes'], []),
  e('Hip Adduction', 'machine', 'isolation', 'isolation', ['adductors'], []),
  e('Frog Pump', 'bodyweight', 'hinge', 'isolation', ['glutes'], []),

  // ---- Calves ----
  e('Standing Calf Raise', 'machine', 'isolation', 'isolation', ['calves'], []),
  e('Seated Calf Raise', 'machine', 'isolation', 'isolation', ['calves'], []),
  e('Leg Press Calf Raise', 'machine', 'isolation', 'isolation', ['calves'], []),
  e('Dumbbell Calf Raise', 'dumbbell', 'isolation', 'isolation', ['calves'], []),

  // ---- Abs / core ----
  e('Plank', 'bodyweight', 'core', 'isolation', ['abs'], ['obliques', 'lower-back']),
  e('Hanging Leg Raise', 'bodyweight', 'core', 'isolation', ['abs'], ['obliques']),
  e('Cable Crunch', 'cable', 'core', 'isolation', ['abs'], []),
  e('Ab Wheel Rollout', 'bodyweight', 'core', 'compound', ['abs'], ['lats', 'shoulders']),
  e('Russian Twist', 'plate', 'core', 'isolation', ['obliques', 'abs'], []),
  e('Sit-Up', 'bodyweight', 'core', 'isolation', ['abs'], []),
  e('Bicycle Crunch', 'bodyweight', 'core', 'isolation', ['abs', 'obliques'], []),
  e('Side Plank', 'bodyweight', 'core', 'isolation', ['obliques'], ['abs']),
  e('Dead Bug', 'bodyweight', 'core', 'isolation', ['abs'], []),
  e('Pallof Press', 'cable', 'core', 'isolation', ['obliques', 'abs'], []),
  e('Woodchopper', 'cable', 'core', 'isolation', ['obliques'], ['abs']),
  e('Toes to Bar', 'bodyweight', 'core', 'compound', ['abs'], ['lats', 'forearms']),
  e('Mountain Climber', 'bodyweight', 'core', 'compound', ['abs'], ['shoulders', 'quads']),

  // ---- Olympic / power ----
  e('Power Clean', 'barbell', 'olympic', 'compound', ['glutes', 'hamstrings', 'traps'], ['quads', 'shoulders']),
  e('Hang Clean', 'barbell', 'olympic', 'compound', ['traps', 'glutes'], ['hamstrings', 'shoulders']),
  e('Clean and Jerk', 'barbell', 'olympic', 'compound', ['glutes', 'shoulders', 'quads'], ['traps', 'hamstrings']),
  e('Snatch', 'barbell', 'olympic', 'compound', ['glutes', 'shoulders', 'traps'], ['hamstrings', 'quads']),
  e('Power Snatch', 'barbell', 'olympic', 'compound', ['glutes', 'traps', 'shoulders'], ['hamstrings']),
  e('Clean Pull', 'barbell', 'olympic', 'compound', ['traps', 'glutes'], ['hamstrings', 'forearms']),
  e('Push Jerk', 'barbell', 'olympic', 'compound', ['shoulders', 'quads'], ['triceps', 'glutes']),

  // ---- Conditioning / carries ----
  e('Suitcase Carry', 'dumbbell', 'carry', 'compound', ['obliques', 'forearms'], ['traps', 'abs']),
  e('Sled Push', 'machine', 'carry', 'compound', ['quads', 'glutes'], ['calves']),
  e('Battle Ropes', 'band', 'carry', 'compound', ['shoulders'], ['abs', 'forearms']),
  e('Burpee', 'bodyweight', 'core', 'compound', ['quads', 'chest'], ['shoulders', 'abs']),
  e('Box Jump', 'bodyweight', 'squat', 'compound', ['quads', 'glutes'], ['calves']),

  // ---- Extra dumbbell / machine variety ----
  e('Dumbbell Deadlift', 'dumbbell', 'hinge', 'compound', ['glutes', 'hamstrings'], ['lower-back']),
  e('Dumbbell Squat', 'dumbbell', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings']),
  e('Dumbbell Overhead Press', 'dumbbell', 'vertical-push', 'compound', ['shoulders'], ['triceps']),
  e('Dumbbell Pullover', 'dumbbell', 'isolation', 'isolation', ['lats', 'chest'], ['triceps']),
  e('Cable Crossover', 'cable', 'isolation', 'isolation', ['chest'], ['shoulders']),
  e('Machine Row', 'machine', 'horizontal-pull', 'compound', ['upper-back', 'lats'], ['biceps']),
  e('Machine Rear Delt', 'machine', 'isolation', 'isolation', ['rear-delts'], []),
  e('Machine Bicep Curl', 'machine', 'isolation', 'isolation', ['biceps'], []),
  e('Machine Tricep Extension', 'machine', 'isolation', 'isolation', ['triceps'], []),
  e('Machine Abduction', 'machine', 'isolation', 'isolation', ['abductors'], []),
  e('Landmine Row', 'barbell', 'horizontal-pull', 'compound', ['lats', 'upper-back'], ['biceps']),
  e('Landmine Squat', 'barbell', 'squat', 'compound', ['quads', 'glutes'], ['abs']),
  e('Jefferson Curl', 'barbell', 'hinge', 'isolation', ['lower-back', 'hamstrings'], []),
  e('Copenhagen Plank', 'bodyweight', 'core', 'isolation', ['adductors'], ['obliques']),
  e('Reverse Hyper', 'machine', 'hinge', 'isolation', ['glutes', 'lower-back'], ['hamstrings']),
  e('Glute Ham Raise', 'bodyweight', 'hinge', 'compound', ['hamstrings', 'glutes'], ['calves']),
  e('Cable Row Single Arm', 'cable', 'horizontal-pull', 'compound', ['lats'], ['biceps', 'upper-back']),
  e('Incline Machine Press', 'machine', 'horizontal-push', 'compound', ['chest', 'shoulders'], ['triceps']),
  e('Cable Lateral Raise Single', 'cable', 'isolation', 'isolation', ['shoulders'], []),
  e('Zottman Curl', 'dumbbell', 'isolation', 'isolation', ['biceps', 'forearms'], []),
  e('Cable Hammer Curl', 'cable', 'isolation', 'isolation', ['biceps', 'forearms'], []),
  e('JM Press', 'barbell', 'horizontal-push', 'compound', ['triceps'], ['chest']),
  e('Tate Press', 'dumbbell', 'isolation', 'isolation', ['triceps'], []),
  e('Cable Woodchop Low', 'cable', 'core', 'isolation', ['obliques'], ['abs']),
  e('Hip Thrust Machine', 'machine', 'hinge', 'compound', ['glutes'], ['hamstrings']),
  e('Belt Squat', 'machine', 'squat', 'compound', ['quads', 'glutes'], ['hamstrings']),
];

export const SEED_EXERCISES: SeedExercise[] = list;
export const SEED_EXERCISE_COUNT = list.length;
