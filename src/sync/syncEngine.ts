import type { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '@/db/db';
import type {
  Exercise,
  FoodLogEntry,
  Profile,
  SavedFood,
  StoredProgram,
  SyncEntity,
  Workout,
  WorkoutPlan,
} from '@/db/types';
import { supabase } from '@/lib/supabase';
import { reconcile, type SyncRecord, type Tomb } from './merge';

/** Bump `updatedAt` on a record about to be written. */
export function stamp<T extends { updatedAt?: number }>(obj: T): T {
  return { ...obj, updatedAt: Date.now() };
}

interface EntityCfg {
  entity: SyncEntity;
  table: string;
  readLocal: () => Promise<SyncRecord[]>;
  writeLocal: (data: Record<string, unknown>) => Promise<void>;
  deleteLocal: (id: string) => Promise<void>;
}

const REGISTRY: EntityCfg[] = [
  {
    entity: 'workouts',
    table: 'workouts',
    readLocal: async () =>
      (await db.workouts.toArray()).map((w) => ({ id: w.id, updatedAt: w.updatedAt ?? 0, data: w })),
    writeLocal: async (data) => {
      await db.workouts.put(data as unknown as Workout);
    },
    deleteLocal: async (id) => {
      await db.workouts.delete(id);
    },
  },
  {
    entity: 'programs',
    table: 'programs',
    readLocal: async () =>
      (await db.programs.toArray()).map((p) => ({ id: p.id, updatedAt: p.updatedAt ?? 0, data: p })),
    writeLocal: async (data) => {
      await db.programs.put(data as unknown as StoredProgram);
    },
    deleteLocal: async (id) => {
      await db.programs.delete(id);
    },
  },
  {
    entity: 'custom_exercises',
    table: 'custom_exercises',
    readLocal: async () =>
      (await db.exercises.filter((e) => !!e.custom).toArray()).map((e) => ({
        id: e.id,
        updatedAt: e.updatedAt ?? 0,
        data: e,
      })),
    writeLocal: async (data) => {
      await db.exercises.put(data as unknown as Exercise);
    },
    deleteLocal: async (id) => {
      await db.exercises.delete(id);
    },
  },
  {
    entity: 'food_logs',
    table: 'food_logs',
    readLocal: async () =>
      (await db.foodLogs.toArray()).map((e) => ({ id: e.id, updatedAt: e.updatedAt ?? 0, data: e })),
    writeLocal: async (data) => {
      await db.foodLogs.put(data as unknown as FoodLogEntry);
    },
    deleteLocal: async (id) => {
      await db.foodLogs.delete(id);
    },
  },
  {
    entity: 'foods',
    table: 'foods',
    readLocal: async () =>
      (await db.foods.toArray()).map((f) => ({ id: f.id, updatedAt: f.updatedAt ?? 0, data: f })),
    writeLocal: async (data) => {
      await db.foods.put(data as unknown as SavedFood);
    },
    deleteLocal: async (id) => {
      await db.foods.delete(id);
    },
  },
  {
    entity: 'plans',
    table: 'plans',
    readLocal: async () =>
      (await db.plans.toArray()).map((p) => ({ id: p.id, updatedAt: p.updatedAt ?? 0, data: p })),
    writeLocal: async (data) => {
      await db.plans.put(data as unknown as WorkoutPlan);
    },
    deleteLocal: async (id) => {
      await db.plans.delete(id);
    },
  },
];

const cfgFor = (entity: SyncEntity) => REGISTRY.find((c) => c.entity === entity)!;

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let syncing = false;

/** Whether cloud sync is currently active (configured + signed in). */
export function isSyncActive(): boolean {
  return !!supabase && !!currentUserId;
}

// --------------------------------------------------------------------------
// Single-record push helpers (called optimistically from the store on change)
// --------------------------------------------------------------------------

export async function syncPushRecord(
  entity: SyncEntity,
  record: { id: string; updatedAt?: number },
): Promise<void> {
  if (!supabase || !currentUserId) return;
  const { table } = cfgFor(entity);
  await supabase
    .from(table)
    .upsert({ id: record.id, user_id: currentUserId, data: record, updated_at: record.updatedAt ?? Date.now() });
}

export async function syncDeleteRecord(entity: SyncEntity, id: string): Promise<void> {
  const deletedAt = Date.now();
  await db.deletions.put({ key: `${entity}:${id}`, entity, entityId: id, deletedAt });
  if (!supabase || !currentUserId) return;
  const { table } = cfgFor(entity);
  await supabase.from(table).delete().eq('user_id', currentUserId).eq('id', id);
  await supabase
    .from('deletions')
    .upsert({ user_id: currentUserId, entity, entity_id: id, deleted_at: deletedAt });
}

export async function syncPushProfile(profile: Profile): Promise<void> {
  if (!supabase || !currentUserId) return;
  await supabase
    .from('profiles')
    .upsert({ user_id: currentUserId, data: profile, updated_at: profile.updatedAt ?? Date.now() });
}

/**
 * Delete every remote row for the signed-in user — all entity tables, the
 * profile, and the tombstone log. Used by "Erase Everything" so a wipe can't
 * be resurrected by the next reconcile. Throws if any delete fails (the
 * caller must then keep local data intact).
 */
export async function eraseRemoteData(): Promise<void> {
  if (!supabase || !currentUserId) return;
  const uid = currentUserId;
  for (const cfg of REGISTRY) {
    const { error } = await supabase.from(cfg.table).delete().eq('user_id', uid);
    if (error) throw new Error(`Cloud erase failed (${cfg.table}): ${error.message}`);
  }
  for (const table of ['deletions', 'profiles']) {
    const { error } = await supabase.from(table).delete().eq('user_id', uid);
    if (error) throw new Error(`Cloud erase failed (${table}): ${error.message}`);
  }
}

// --------------------------------------------------------------------------
// Full reconcile (on sign-in / reconnect)
// --------------------------------------------------------------------------

async function reconcileEntity(cfg: EntityCfg, userId: string): Promise<void> {
  if (!supabase) return;
  const [{ data: remoteRows }, { data: remoteDelRows }] = await Promise.all([
    supabase.from(cfg.table).select('id, data, updated_at').eq('user_id', userId),
    supabase.from('deletions').select('entity_id, deleted_at').eq('user_id', userId).eq('entity', cfg.entity),
  ]);

  const remote: SyncRecord[] = (remoteRows ?? []).map((r) => ({
    id: r.id as string,
    updatedAt: Number(r.updated_at),
    data: r.data as Record<string, unknown>,
  }));
  const remoteTombs: Tomb[] = (remoteDelRows ?? []).map((t) => ({
    entityId: t.entity_id as string,
    deletedAt: Number(t.deleted_at),
  }));

  const local = await cfg.readLocal();
  const localTombs: Tomb[] = (await db.deletions.where('entity').equals(cfg.entity).toArray()).map((t) => ({
    entityId: t.entityId,
    deletedAt: t.deletedAt,
  }));

  const plan = reconcile(local, remote, localTombs, remoteTombs);

  // Apply locally.
  for (const rec of plan.writeLocal) await cfg.writeLocal(rec.data as Record<string, unknown>);
  for (const id of plan.deleteLocal) {
    await cfg.deleteLocal(id);
    await db.deletions.put({ key: `${cfg.entity}:${id}`, entity: cfg.entity, entityId: id, deletedAt: Date.now() });
  }

  // Apply remotely.
  if (plan.pushRemote.length) {
    await supabase.from(cfg.table).upsert(
      plan.pushRemote.map((r) => ({ id: r.id, user_id: userId, data: r.data, updated_at: r.updatedAt })),
    );
  }
  for (const id of plan.deleteRemote) {
    await supabase.from(cfg.table).delete().eq('user_id', userId).eq('id', id);
    const tomb = localTombs.find((t) => t.entityId === id);
    await supabase
      .from('deletions')
      .upsert({ user_id: userId, entity: cfg.entity, entity_id: id, deleted_at: tomb?.deletedAt ?? Date.now() });
  }
}

async function reconcileProfile(userId: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('data, updated_at').eq('user_id', userId).maybeSingle();
  const local = await db.profile.get('me');
  const remoteTime = data ? Number(data.updated_at) : -1;
  const localTime = local?.updatedAt ?? -1;

  if (remoteTime > localTime && data) {
    await db.profile.put(data.data as Profile);
  } else if (localTime > remoteTime && local) {
    await supabase.from('profiles').upsert({ user_id: userId, data: local, updated_at: localTime });
  }
}

/** Full two-way sync for the signed-in user. Safe to call repeatedly. */
export async function fullSync(userId: string): Promise<void> {
  if (!supabase || syncing) return;
  syncing = true;
  currentUserId = userId;
  try {
    await reconcileProfile(userId);
    for (const cfg of REGISTRY) await reconcileEntity(cfg, userId);
  } finally {
    syncing = false;
  }
}

// --------------------------------------------------------------------------
// Realtime — apply inbound changes from other devices
// --------------------------------------------------------------------------

export function startRealtime(userId: string): void {
  if (!supabase || channel) return;
  currentUserId = userId;
  const ch = supabase.channel(`stride-sync-${userId}`);

  for (const cfg of REGISTRY) {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: cfg.table, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { data?: Record<string, unknown> } | undefined;
        if (row?.data) void cfg.writeLocal(row.data);
      },
    );
  }
  ch.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'deletions', filter: `user_id=eq.${userId}` },
    (payload) => {
      const row = payload.new as { entity?: SyncEntity; entity_id?: string; deleted_at?: number } | undefined;
      if (!row?.entity || !row.entity_id) return;
      const cfg = REGISTRY.find((c) => c.entity === row.entity);
      if (cfg) void cfg.deleteLocal(row.entity_id);
    },
  );
  ch.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
    (payload) => {
      const row = payload.new as { data?: Profile } | undefined;
      if (row?.data) void db.profile.put(row.data);
    },
  );

  ch.subscribe();
  channel = ch;
}

export function stopRealtime(): void {
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  currentUserId = null;
}
