/**
 * Pure last-write-wins reconciliation between a local record set and a remote
 * record set, accounting for deletion tombstones on both sides. No I/O — this
 * is unit-tested in isolation and drives the sync engine.
 */

export interface SyncRecord<T = unknown> {
  id: string;
  updatedAt: number;
  data: T;
}

export interface Tomb {
  entityId: string;
  deletedAt: number;
}

export interface ReconcilePlan<T = unknown> {
  /** Remote records that should be written into the local store. */
  writeLocal: SyncRecord<T>[];
  /** Ids that should be deleted locally (remote tombstone won). */
  deleteLocal: string[];
  /** Local records that should be pushed to the remote. */
  pushRemote: SyncRecord<T>[];
  /** Ids that should be deleted remotely (local tombstone won). */
  deleteRemote: string[];
}

type Side<T> = { time: number; state: 'present' | 'deleted'; rec?: SyncRecord<T> };

function sideOf<T>(rec: SyncRecord<T> | undefined, tomb: Tomb | undefined): Side<T> | null {
  const recTime = rec?.updatedAt ?? -1;
  const tombTime = tomb?.deletedAt ?? -1;
  if (recTime < 0 && tombTime < 0) return null;
  if (tombTime > recTime) return { time: tombTime, state: 'deleted' };
  return { time: recTime, state: 'present', rec };
}

export function reconcile<T>(
  local: SyncRecord<T>[],
  remote: SyncRecord<T>[],
  localTombs: Tomb[],
  remoteTombs: Tomb[],
): ReconcilePlan<T> {
  const plan: ReconcilePlan<T> = { writeLocal: [], deleteLocal: [], pushRemote: [], deleteRemote: [] };

  const lRec = new Map(local.map((r) => [r.id, r]));
  const rRec = new Map(remote.map((r) => [r.id, r]));
  const lTomb = new Map(localTombs.map((t) => [t.entityId, t]));
  const rTomb = new Map(remoteTombs.map((t) => [t.entityId, t]));

  const ids = new Set<string>([...lRec.keys(), ...rRec.keys(), ...lTomb.keys(), ...rTomb.keys()]);

  for (const id of ids) {
    const l = sideOf(lRec.get(id), lTomb.get(id));
    const r = sideOf(rRec.get(id), rTomb.get(id));

    if (l && !r) {
      // Only exists locally → propagate to remote.
      if (l.state === 'present' && l.rec) plan.pushRemote.push(l.rec);
      else plan.deleteRemote.push(id);
      continue;
    }
    if (r && !l) {
      if (r.state === 'present' && r.rec) plan.writeLocal.push(r.rec);
      else plan.deleteLocal.push(id);
      continue;
    }
    if (!l || !r) continue;

    // Both sides known — last write wins. Ties are treated as already in sync.
    if (r.time > l.time) {
      if (r.state === 'present' && r.rec) plan.writeLocal.push(r.rec);
      else plan.deleteLocal.push(id);
    } else if (l.time > r.time) {
      if (l.state === 'present' && l.rec) plan.pushRemote.push(l.rec);
      else plan.deleteRemote.push(id);
    }
  }

  return plan;
}
