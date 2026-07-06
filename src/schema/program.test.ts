import { describe, expect, it } from 'vitest';
import { parseProgramJSON, validateProgram } from './program';
import { EXAMPLE_PROGRAMS } from '@/fixtures/programs';

describe('program import validation', () => {
  it('accepts all bundled example programs', () => {
    for (const { program } of EXAMPLE_PROGRAMS) {
      const res = validateProgram(program);
      expect(res.ok, JSON.stringify(res.errors)).toBe(true);
    }
  });

  it('round-trips a valid program through JSON', () => {
    const json = JSON.stringify(EXAMPLE_PROGRAMS[0].program);
    const res = parseProgramJSON(json);
    expect(res.ok).toBe(true);
    expect(res.program?.name).toBe(EXAMPLE_PROGRAMS[0].program.name);
  });

  it('reports invalid JSON', () => {
    const res = parseProgramJSON('{ not json');
    expect(res.ok).toBe(false);
    expect(res.errors?.[0]).toMatch(/Invalid JSON/);
  });

  it('rejects a wrong schema version', () => {
    const res = validateProgram({ ...EXAMPLE_PROGRAMS[0].program, schemaVersion: 2 });
    expect(res.ok).toBe(false);
  });

  it('rejects missing required fields with a path', () => {
    const res = validateProgram({ schemaVersion: 1, units: 'kg', weeks: [] });
    expect(res.ok).toBe(false);
    expect(res.errors?.some((e) => e.includes('name'))).toBe(true);
  });

  it('rejects an invalid intensity value', () => {
    const bad = {
      schemaVersion: 1,
      name: 'Bad',
      units: 'kg',
      weeks: [
        {
          name: 'W1',
          days: [
            {
              name: 'D1',
              exercises: [
                { exerciseName: 'Squat', sets: 3, reps: 5, intensity: { type: 'rpe', value: 15 } },
              ],
            },
          ],
        },
      ],
    };
    expect(validateProgram(bad).ok).toBe(false);
  });

  it('accepts rep ranges as tuples', () => {
    const ok = {
      schemaVersion: 1,
      name: 'Ranges',
      units: 'lb',
      weeks: [
        {
          name: 'W1',
          days: [{ name: 'D1', exercises: [{ exerciseName: 'Curl', sets: 3, reps: [8, 12] }] }],
        },
      ],
    };
    expect(validateProgram(ok).ok).toBe(true);
  });
});
