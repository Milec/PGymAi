import type { Program } from '@/schema/program';

/** Program 1: Novice Linear Progression (Boostcamp-style structure + linear auto-regulation). */
export const noviceLP: Program = {
  schemaVersion: 1,
  name: 'Novice Linear Progression',
  author: 'STRIDE',
  description:
    'Classic 3-day full-body LP. Add load every session while reps are met. Two alternating days (A/B).',
  units: 'kg',
  weeks: [
    {
      name: 'Week 1',
      days: [
        {
          name: 'Day A',
          exercises: [
            { exerciseName: 'Back Squat', sets: 3, reps: 5, intensity: { type: 'rpe', value: 8 }, progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } },
            { exerciseName: 'Bench Press', sets: 3, reps: 5, intensity: { type: 'rpe', value: 8 }, progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } },
            { exerciseName: 'Barbell Row', sets: 3, reps: 5, intensity: { type: 'rpe', value: 8 }, progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } },
          ],
        },
        {
          name: 'Day B',
          exercises: [
            { exerciseName: 'Back Squat', sets: 3, reps: 5, intensity: { type: 'rpe', value: 8 }, progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } },
            { exerciseName: 'Overhead Press', sets: 3, reps: 5, intensity: { type: 'rpe', value: 8 }, progression: { type: 'linear', incrementKg: 2.5, onSuccessRepTarget: 5 } },
            { exerciseName: 'Deadlift', sets: 1, reps: 5, intensity: { type: 'rpe', value: 8 }, progression: { type: 'linear', incrementKg: 5, onSuccessRepTarget: 5 } },
          ],
        },
      ],
    },
  ],
};

/** Program 2: Push/Pull/Legs hypertrophy block (double progression). */
export const pplHypertrophy: Program = {
  schemaVersion: 1,
  name: 'PPL Hypertrophy Block',
  author: 'STRIDE',
  description:
    '6-day Push/Pull/Legs split focused on hypertrophy with double progression across rep ranges.',
  units: 'kg',
  weeks: [
    {
      name: 'Week 1',
      days: [
        {
          name: 'Push',
          exercises: [
            { exerciseName: 'Bench Press', sets: 4, reps: [6, 10], intensity: { type: 'rpe', value: 8 }, progression: { type: 'double', repRange: [6, 10], incrementKg: 2.5 } },
            { exerciseName: 'Seated Dumbbell Press', sets: 3, reps: [8, 12], progression: { type: 'double', repRange: [8, 12], incrementKg: 2 } },
            { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: [8, 12], progression: { type: 'double', repRange: [8, 12], incrementKg: 2 } },
            { exerciseName: 'Lateral Raise', sets: 3, reps: [12, 20], progression: { type: 'double', repRange: [12, 20], incrementKg: 1 } },
            { exerciseName: 'Rope Pushdown', sets: 3, reps: [10, 15], progression: { type: 'double', repRange: [10, 15], incrementKg: 2.5 } },
          ],
        },
        {
          name: 'Pull',
          exercises: [
            { exerciseName: 'Pull-Up', sets: 4, reps: [5, 10], progression: { type: 'double', repRange: [5, 10], incrementKg: 2.5 } },
            { exerciseName: 'Barbell Row', sets: 4, reps: [6, 10], intensity: { type: 'rpe', value: 8 }, progression: { type: 'double', repRange: [6, 10], incrementKg: 2.5 } },
            { exerciseName: 'Seated Cable Row', sets: 3, reps: [10, 15], progression: { type: 'double', repRange: [10, 15], incrementKg: 2.5 } },
            { exerciseName: 'Face Pull', sets: 3, reps: [15, 20], progression: { type: 'double', repRange: [15, 20], incrementKg: 1 } },
            { exerciseName: 'Dumbbell Curl', sets: 3, reps: [10, 15], progression: { type: 'double', repRange: [10, 15], incrementKg: 1 } },
          ],
        },
        {
          name: 'Legs',
          exercises: [
            { exerciseName: 'Back Squat', sets: 4, reps: [6, 10], intensity: { type: 'rpe', value: 8 }, progression: { type: 'double', repRange: [6, 10], incrementKg: 2.5 } },
            { exerciseName: 'Romanian Deadlift', sets: 3, reps: [8, 12], progression: { type: 'double', repRange: [8, 12], incrementKg: 2.5 } },
            { exerciseName: 'Leg Press', sets: 3, reps: [10, 15], progression: { type: 'double', repRange: [10, 15], incrementKg: 5 } },
            { exerciseName: 'Lying Leg Curl', sets: 3, reps: [10, 15], progression: { type: 'double', repRange: [10, 15], incrementKg: 2.5 } },
            { exerciseName: 'Standing Calf Raise', sets: 4, reps: [10, 15], progression: { type: 'double', repRange: [10, 15], incrementKg: 2.5 } },
          ],
        },
      ],
    },
  ],
};

/** Program 3: Percentage-based intensity block (%1RM prescriptions). */
export const percentageBlock: Program = {
  schemaVersion: 1,
  name: '4-Week Percentage Strength Block',
  author: 'STRIDE',
  description:
    'Intensity block driven by %1RM. Waves up in intensity across 4 weeks. Requires an estimated 1RM per lift.',
  units: 'kg',
  weeks: [
    {
      name: 'Week 1 — 75%',
      days: [
        {
          name: 'Squat / Bench',
          exercises: [
            { exerciseName: 'Back Squat', sets: 5, reps: 5, intensity: { type: 'percent1rm', value: 75 } },
            { exerciseName: 'Bench Press', sets: 5, reps: 5, intensity: { type: 'percent1rm', value: 75 } },
            { exerciseName: 'Barbell Row', sets: 4, reps: 8, intensity: { type: 'rpe', value: 7 } },
          ],
        },
        {
          name: 'Deadlift / Press',
          exercises: [
            { exerciseName: 'Deadlift', sets: 4, reps: 4, intensity: { type: 'percent1rm', value: 78 } },
            { exerciseName: 'Overhead Press', sets: 5, reps: 5, intensity: { type: 'percent1rm', value: 72 } },
            { exerciseName: 'Chin-Up', sets: 3, reps: 8, intensity: { type: 'rpe', value: 8 } },
          ],
        },
      ],
    },
    {
      name: 'Week 2 — 80%',
      days: [
        {
          name: 'Squat / Bench',
          exercises: [
            { exerciseName: 'Back Squat', sets: 5, reps: 3, intensity: { type: 'percent1rm', value: 80 } },
            { exerciseName: 'Bench Press', sets: 5, reps: 3, intensity: { type: 'percent1rm', value: 80 } },
            { exerciseName: 'Barbell Row', sets: 4, reps: 6, intensity: { type: 'rpe', value: 8 } },
          ],
        },
        {
          name: 'Deadlift / Press',
          exercises: [
            { exerciseName: 'Deadlift', sets: 4, reps: 3, intensity: { type: 'percent1rm', value: 82 } },
            { exerciseName: 'Overhead Press', sets: 5, reps: 3, intensity: { type: 'percent1rm', value: 78 } },
            { exerciseName: 'Chin-Up', sets: 3, reps: 6, intensity: { type: 'rpe', value: 8 } },
          ],
        },
      ],
    },
    {
      name: 'Week 3 — 85%',
      days: [
        {
          name: 'Squat / Bench',
          exercises: [
            { exerciseName: 'Back Squat', sets: 4, reps: 2, intensity: { type: 'percent1rm', value: 85 } },
            { exerciseName: 'Bench Press', sets: 4, reps: 2, intensity: { type: 'percent1rm', value: 85 } },
            { exerciseName: 'Barbell Row', sets: 4, reps: 5, intensity: { type: 'rpe', value: 8 } },
          ],
        },
        {
          name: 'Deadlift / Press',
          exercises: [
            { exerciseName: 'Deadlift', sets: 3, reps: 2, intensity: { type: 'percent1rm', value: 87 } },
            { exerciseName: 'Overhead Press', sets: 4, reps: 3, intensity: { type: 'percent1rm', value: 82 } },
            { exerciseName: 'Chin-Up', sets: 3, reps: 5, intensity: { type: 'rpe', value: 9 } },
          ],
        },
      ],
    },
    {
      name: 'Week 4 — Deload 65%',
      days: [
        {
          name: 'Full Body',
          exercises: [
            { exerciseName: 'Back Squat', sets: 3, reps: 5, intensity: { type: 'percent1rm', value: 65 } },
            { exerciseName: 'Bench Press', sets: 3, reps: 5, intensity: { type: 'percent1rm', value: 65 } },
            { exerciseName: 'Deadlift', sets: 2, reps: 5, intensity: { type: 'percent1rm', value: 65 } },
          ],
        },
      ],
    },
  ],
};

export const EXAMPLE_PROGRAMS: { key: string; program: Program }[] = [
  { key: 'novice-lp', program: noviceLP },
  { key: 'ppl-hypertrophy', program: pplHypertrophy },
  { key: 'percentage-block', program: percentageBlock },
];
