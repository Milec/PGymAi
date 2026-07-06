import { z } from 'zod';

/** Intensity prescription forms. */
export const intensitySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('absolute'), value: z.number().positive() }),
  z.object({ type: z.literal('percent1rm'), value: z.number().min(1).max(150) }),
  z.object({ type: z.literal('rpe'), value: z.number().min(1).max(10) }),
]);

/** Reps: a fixed number or an inclusive [min,max] range. */
export const repsSchema = z.union([
  z.number().int().positive(),
  z.tuple([z.number().int().positive(), z.number().int().positive()]),
]);

/** Progression (auto-regulation) rules. */
export const progressionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('linear'),
    incrementKg: z.number().positive(),
    onSuccessRepTarget: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('double'),
    repRange: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    incrementKg: z.number().positive(),
  }),
  z.object({
    type: z.literal('percent-e1rm'),
    percent: z.number().min(1).max(150),
  }),
]);

export const prescribedExerciseSchema = z.object({
  exerciseName: z.string().min(1),
  sets: z.number().int().positive(),
  reps: repsSchema,
  intensity: intensitySchema.optional(),
  progression: progressionSchema.optional(),
  notes: z.string().optional(),
});

export const daySchema = z.object({
  name: z.string().min(1),
  exercises: z.array(prescribedExerciseSchema).min(1),
});

export const weekSchema = z.object({
  name: z.string().min(1),
  days: z.array(daySchema).min(1),
});

export const programSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  author: z.string().optional(),
  description: z.string().optional(),
  units: z.enum(['kg', 'lb']),
  weeks: z.array(weekSchema).min(1),
});

export type Intensity = z.infer<typeof intensitySchema>;
export type Progression = z.infer<typeof progressionSchema>;
export type PrescribedExercise = z.infer<typeof prescribedExerciseSchema>;
export type ProgramDay = z.infer<typeof daySchema>;
export type ProgramWeek = z.infer<typeof weekSchema>;
export type Program = z.infer<typeof programSchema>;

export interface ImportResult {
  ok: boolean;
  program?: Program;
  errors?: string[];
}

/** Parse + validate a program from an unknown value (parsed JSON). */
export function validateProgram(input: unknown): ImportResult {
  const res = programSchema.safeParse(input);
  if (res.success) return { ok: true, program: res.data };
  return {
    ok: false,
    errors: res.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    ),
  };
}

/** Parse from a JSON string. */
export function parseProgramJSON(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }
  return validateProgram(json);
}
