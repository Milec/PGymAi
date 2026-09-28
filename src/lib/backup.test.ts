import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { DEFAULT_PROFILE } from '@/db/seed';
import { parseBackupJSON } from '@/schema/backup';
import { backupFilename, buildBackup, restoreBackup } from './backup';

async function clearAll() {
  await Promise.all([
    db.workouts.clear(),
    db.programs.clear(),
    db.exercises.clear(),
    db.profile.clear(),
    db.foodLogs.clear(),
    db.foods.clear(),
    db.plans.clear(),
    db.waterLogs.clear(),
  ]);
}

const sampleMacros = { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 };

async function seedOneOfEverything() {
  await db.workouts.put({
    id: 'wk1',
    startedAt: 1,
    finishedAt: 2,
    title: 'Session',
    entries: [
      { id: 'en1', exerciseId: 'squat', sets: [{ id: 's1', weightKg: 100, reps: 5, completed: true }] },
    ],
  });
  await db.programs.put({
    id: 'prog1',
    name: 'LP',
    units: 'kg',
    data: { schemaVersion: 1 },
    importedAt: 3,
  });
  await db.exercises.put({
    id: 'custom1',
    name: 'Zercher Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipment: 'barbell',
    pattern: 'squat',
    category: 'compound',
    bigLift: false,
    custom: true,
  });
  // A seeded (non-custom) exercise, which must NOT travel in the backup.
  await db.exercises.put({
    id: 'seeded1',
    name: 'Back Squat',
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipment: 'barbell',
    pattern: 'squat',
    category: 'compound',
    bigLift: true,
  });
  await db.foodLogs.put({
    id: 'f1',
    date: '2026-01-01',
    meal: 'lunch',
    name: 'Oats',
    per100: sampleMacros,
    amountG: 80,
    loggedAt: 4,
  });
  await db.foods.put({ id: 'sf1', name: 'Oats', per100: sampleMacros, lastUsedAt: 5 });
  await db.plans.put({
    id: 'pl1',
    name: 'Push Day',
    exercises: [{ id: 'pe1', exerciseId: 'squat', sets: 3 }],
    createdAt: 6,
  });
  await db.waterLogs.put({ id: 'wl1', date: '2026-01-01', ml: 500, loggedAt: 7 });
  await db.profile.put({ ...DEFAULT_PROFILE, bodyweightKg: 82, units: 'lb' });
}

describe('buildBackup', () => {
  beforeEach(async () => {
    await clearAll();
    await seedOneOfEverything();
  });

  it('includes every synced collection', async () => {
    const b = await buildBackup();
    expect(b.workouts).toHaveLength(1);
    expect(b.programs).toHaveLength(1);
    expect(b.foodLogs).toHaveLength(1);
    expect(b.foods).toHaveLength(1);
    // Regression: plans and water logs were missing from the original export.
    expect(b.plans).toHaveLength(1);
    expect(b.waterLogs).toHaveLength(1);
    expect(b.profile?.bodyweightKg).toBe(82);
  });

  it('carries custom exercises but not the seeded library', async () => {
    const b = await buildBackup();
    expect(b.customExercises.map((e) => e.id)).toEqual(['custom1']);
  });

  it('names the file by date', () => {
    expect(backupFilename(new Date(2026, 0, 9))).toBe('stride-backup-2026-01-09.json');
  });
});

describe('restoreBackup', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('round-trips an export back into an empty database', async () => {
    await seedOneOfEverything();
    const json = JSON.stringify(await buildBackup());
    await clearAll();

    const parsed = parseBackupJSON(json);
    expect('backup' in parsed).toBe(true);
    if (!('backup' in parsed)) return;
    await restoreBackup(parsed.backup);

    expect(await db.workouts.count()).toBe(1);
    expect(await db.plans.count()).toBe(1);
    expect(await db.waterLogs.count()).toBe(1);
    expect((await db.foodLogs.get('f1'))?.name).toBe('Oats');
    expect((await db.profile.get('me'))?.bodyweightKg).toBe(82);
    expect((await db.exercises.get('custom1'))?.custom).toBe(true);
  });

  it('keeps records the backup does not mention', async () => {
    await db.workouts.put({ id: 'local-only', startedAt: 1, title: 'Mine', entries: [] });
    const parsed = parseBackupJSON(
      JSON.stringify({ workouts: [{ id: 'wk1', startedAt: 1, title: 'Restored', entries: [] }] }),
    );
    if (!('backup' in parsed)) throw new Error(parsed.error);
    await restoreBackup(parsed.backup);
    expect(await db.workouts.count()).toBe(2);
  });

  it('overwrites a record that shares an id', async () => {
    await db.workouts.put({ id: 'wk1', startedAt: 1, title: 'Stale', entries: [] });
    const parsed = parseBackupJSON(
      JSON.stringify({ workouts: [{ id: 'wk1', startedAt: 1, title: 'Restored', entries: [] }] }),
    );
    if (!('backup' in parsed)) throw new Error(parsed.error);
    await restoreBackup(parsed.backup);
    expect((await db.workouts.get('wk1'))?.title).toBe('Restored');
  });

  it('stamps restored records so a cloud reconcile cannot undo the restore', async () => {
    const before = Date.now();
    const parsed = parseBackupJSON(
      JSON.stringify({
        workouts: [{ id: 'wk1', startedAt: 1, title: 'Restored', entries: [], updatedAt: 1000 }],
      }),
    );
    if (!('backup' in parsed)) throw new Error(parsed.error);
    await restoreBackup(parsed.backup);
    expect((await db.workouts.get('wk1'))?.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('merges a profile instead of blanking fields the backup predates', async () => {
    await db.profile.put({ ...DEFAULT_PROFILE, heightCm: 180, bodyweightKg: 70 });
    const parsed = parseBackupJSON(
      JSON.stringify({
        profile: { id: 'me', sex: 'male', bodyweightKg: 90, units: 'kg', restDefaultSec: 90 },
      }),
    );
    if (!('backup' in parsed)) throw new Error(parsed.error);
    await restoreBackup(parsed.backup);
    const p = await db.profile.get('me');
    expect(p?.bodyweightKg).toBe(90);
    expect(p?.heightCm).toBe(180); // untouched by the older backup
  });
});

describe('parseBackupJSON', () => {
  it('rejects non-JSON', () => {
    expect(parseBackupJSON('not json')).toEqual({ error: "That file isn't valid JSON." });
  });

  it('rejects an empty backup', () => {
    const r = parseBackupJSON('{}');
    expect('error' in r && r.error).toMatch(/empty/i);
  });

  it('rejects a file whose records are the wrong shape', () => {
    const r = parseBackupJSON(JSON.stringify({ workouts: [{ id: 'wk1' }] }));
    expect('error' in r && r.error).toMatch(/doesn't look like a STRIDE backup/);
  });

  it('accepts a backup from a build that predates plans and water logs', () => {
    const r = parseBackupJSON(
      JSON.stringify({
        exportedAt: '2025-01-01T00:00:00.000Z',
        workouts: [{ id: 'wk1', startedAt: 1, title: 'Old', entries: [] }],
      }),
    );
    expect('backup' in r).toBe(true);
  });

  it('keeps fields a newer build added', () => {
    const r = parseBackupJSON(
      JSON.stringify({
        workouts: [{ id: 'wk1', startedAt: 1, title: 'New', entries: [], someFutureField: 42 }],
      }),
    );
    if (!('backup' in r)) throw new Error(r.error);
    expect((r.backup.workouts?.[0] as Record<string, unknown>).someFutureField).toBe(42);
  });
});
