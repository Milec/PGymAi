import { describe, expect, it } from 'vitest';
import { reconcile, type SyncRecord, type Tomb } from './merge';

const rec = (id: string, updatedAt: number, data: unknown = { id }): SyncRecord => ({ id, updatedAt, data });
const tomb = (entityId: string, deletedAt: number): Tomb => ({ entityId, deletedAt });

describe('reconcile (last-write-wins)', () => {
  it('pushes local-only records to remote', () => {
    const plan = reconcile([rec('a', 5)], [], [], []);
    expect(plan.pushRemote.map((r) => r.id)).toEqual(['a']);
    expect(plan.writeLocal).toHaveLength(0);
  });

  it('writes remote-only records locally', () => {
    const plan = reconcile([], [rec('b', 5)], [], []);
    expect(plan.writeLocal.map((r) => r.id)).toEqual(['b']);
    expect(plan.pushRemote).toHaveLength(0);
  });

  it('newer remote wins and is written locally', () => {
    const plan = reconcile([rec('a', 5)], [rec('a', 9)], [], []);
    expect(plan.writeLocal.map((r) => r.id)).toEqual(['a']);
    expect(plan.pushRemote).toHaveLength(0);
  });

  it('newer local wins and is pushed', () => {
    const plan = reconcile([rec('a', 12)], [rec('a', 9)], [], []);
    expect(plan.pushRemote.map((r) => r.id)).toEqual(['a']);
    expect(plan.writeLocal).toHaveLength(0);
  });

  it('equal timestamps are treated as already in sync', () => {
    const plan = reconcile([rec('a', 7)], [rec('a', 7)], [], []);
    expect(plan.pushRemote).toHaveLength(0);
    expect(plan.writeLocal).toHaveLength(0);
  });

  it('a remote tombstone newer than local edit deletes locally', () => {
    const plan = reconcile([rec('a', 5)], [], [], [tomb('a', 8)]);
    expect(plan.deleteLocal).toEqual(['a']);
    expect(plan.pushRemote).toHaveLength(0);
  });

  it('a local tombstone newer than remote edit deletes remotely', () => {
    const plan = reconcile([], [rec('a', 5)], [tomb('a', 8)], []);
    expect(plan.deleteRemote).toEqual(['a']);
    expect(plan.writeLocal).toHaveLength(0);
  });

  it('a re-created record newer than a tombstone survives', () => {
    // Local deleted at t=4, but remote re-created/edited at t=9 → remote wins.
    const plan = reconcile([], [rec('a', 9)], [tomb('a', 4)], []);
    expect(plan.writeLocal.map((r) => r.id)).toEqual(['a']);
    expect(plan.deleteRemote).toHaveLength(0);
  });

  it('handles a mixed batch deterministically', () => {
    const local = [rec('keep', 5), rec('localnew', 20), rec('gone', 3)];
    const remote = [rec('keep', 5), rec('remotenew', 15)];
    const localTombs = [tomb('gone', 10)];
    const remoteTombs: Tomb[] = [];
    const plan = reconcile(local, remote, localTombs, remoteTombs);
    expect(plan.pushRemote.map((r) => r.id).sort()).toEqual(['localnew']);
    expect(plan.writeLocal.map((r) => r.id).sort()).toEqual(['remotenew']);
    expect(plan.deleteRemote).toEqual(['gone']);
  });
});
