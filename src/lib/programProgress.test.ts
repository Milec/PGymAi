import { describe, expect, it } from 'vitest';
import type { Workout } from '@/db/types';
import type { Program } from '@/schema/program';
import { completedDays, dayKey, programPosition, totalDays } from './programProgress';

const program = (weeks: number, daysPerWeek: number): Program => ({
  schemaVersion: 1,
  name: 'Test',
  units: 'kg',
  weeks: Array.from({ length: weeks }, (_, w) => ({
    name: `Week ${w + 1}`,
    days: Array.from({ length: daysPerWeek }, (_, d) => ({
      name: `Day ${d + 1}`,
      exercises: [{ exerciseName: 'Back Squat', sets: 3, reps: 5 }],
    })),
  })),
});

const session = (over: Partial<Workout>): Workout => ({
  id: 'wk',
  startedAt: 1,
  finishedAt: 2,
  title: 'S',
  entries: [],
  ...over,
});

describe('completedDays', () => {
  it('records finished days for the program', () => {
    const done = completedDays(
      [
        session({ id: 'a', programId: 'p1', weekIndex: 0, dayIndex: 0, finishedAt: 100 }),
        session({ id: 'b', programId: 'p1', weekIndex: 0, dayIndex: 1, finishedAt: 200 }),
      ],
      'p1',
    );
    expect([...done.keys()].sort()).toEqual(['0-0', '0-1']);
    expect(done.get(dayKey(0, 1))).toBe(200);
  });

  it('ignores other programs, freestyle sessions, and unfinished ones', () => {
    const done = completedDays(
      [
        session({ id: 'a', programId: 'other', weekIndex: 0, dayIndex: 0 }),
        session({ id: 'b', finishedAt: 100 }),
        session({ id: 'c', programId: 'p1', weekIndex: 0, dayIndex: 0, finishedAt: undefined }),
      ],
      'p1',
    );
    expect(done.size).toBe(0);
  });

  it('keeps the most recent finish when a day is repeated', () => {
    const done = completedDays(
      [
        session({ id: 'a', programId: 'p1', weekIndex: 1, dayIndex: 0, finishedAt: 100 }),
        session({ id: 'b', programId: 'p1', weekIndex: 1, dayIndex: 0, finishedAt: 300 }),
        session({ id: 'c', programId: 'p1', weekIndex: 1, dayIndex: 0, finishedAt: 200 }),
      ],
      'p1',
    );
    expect(done.get(dayKey(1, 0))).toBe(300);
  });
});

describe('programPosition', () => {
  it('points at the first day of a program never started', () => {
    const pos = programPosition(program(4, 3), new Map());
    expect(pos).toEqual({ completed: 0, total: 12, next: { weekIndex: 0, dayIndex: 0 } });
  });

  it('advances to the next unfinished day', () => {
    const done = new Map([
      [dayKey(0, 0), 1],
      [dayKey(0, 1), 2],
    ] as const);
    const pos = programPosition(program(2, 3), done);
    expect(pos.completed).toBe(2);
    expect(pos.next).toEqual({ weekIndex: 0, dayIndex: 2 });
  });

  it('points at the earliest gap rather than skipping it', () => {
    // Trained week 2 before finishing week 1 — the missed day is still next.
    const done = new Map([
      [dayKey(0, 0), 1],
      [dayKey(1, 0), 2],
    ] as const);
    const pos = programPosition(program(2, 2), done);
    expect(pos.completed).toBe(2);
    expect(pos.next).toEqual({ weekIndex: 0, dayIndex: 1 });
  });

  it('reports no next day once the program is finished', () => {
    const p = program(1, 2);
    const done = new Map([
      [dayKey(0, 0), 1],
      [dayKey(0, 1), 2],
    ] as const);
    expect(programPosition(p, done)).toEqual({ completed: 2, total: 2, next: null });
  });

  it('ignores completions for days the program no longer has', () => {
    const done = new Map([[dayKey(9, 9), 1]] as const);
    const pos = programPosition(program(1, 2), done);
    expect(pos.completed).toBe(0);
    expect(pos.next).toEqual({ weekIndex: 0, dayIndex: 0 });
  });
});

describe('totalDays', () => {
  it('sums days across weeks of differing length', () => {
    const p = program(2, 3);
    p.weeks[1].days.pop();
    expect(totalDays(p)).toBe(5);
  });
});
