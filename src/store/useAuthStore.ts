import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fullSync, startRealtime, stopRealtime } from '@/sync/syncEngine';
import { useAppStore } from './useAppStore';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthState {
  configured: boolean;
  ready: boolean;
  user: AuthUser | null;
  syncState: SyncState;
  lastSyncedAt: number | null;
  errorMsg: string | null;

  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  sendMagicLink: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  runSync: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  configured: isSupabaseConfigured,
  ready: !isSupabaseConfigured,
  user: null,
  syncState: 'idle',
  lastSyncedAt: null,
  errorMsg: null,

  init: async () => {
    if (!supabase || initialized) {
      set({ ready: true });
      return;
    }
    initialized = true;

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user) {
      set({ user: { id: session.user.id, email: session.user.email ?? undefined } });
      await get().runSync();
      startRealtime(session.user.id);
    }
    set({ ready: true });

    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        set({ user: { id: session.user.id, email: session.user.email ?? undefined } });
        if (event === 'SIGNED_IN') {
          void get()
            .runSync()
            .then(() => startRealtime(session.user!.id));
        }
      } else {
        stopRealtime();
        set({ user: null, syncState: 'idle', lastSyncedAt: null });
      }
    });

    window.addEventListener('online', () => {
      if (get().user) void get().runSync();
    });
  },

  runSync: async () => {
    const user = get().user;
    if (!supabase || !user) return;
    if (!navigator.onLine) {
      set({ syncState: 'offline' });
      return;
    }
    set({ syncState: 'syncing', errorMsg: null });
    try {
      await fullSync(user.id);
      await useAppStore.getState().reloadFromDb();
      set({ syncState: 'synced', lastSyncedAt: Date.now() });
    } catch (err) {
      const msg = (err as Error).message ?? 'Sync failed';
      const hint = /relation .* does not exist|not find the table|schema cache/i.test(msg)
        ? 'Backend tables missing — run supabase/schema.sql in your Supabase dashboard.'
        : msg;
      set({ syncState: 'error', errorMsg: hint });
    }
  },

  signUp: async (email, password) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // If email confirmation is on, there is no session yet.
    return { needsConfirm: !data.session };
  },

  signIn: async (email, password) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  },

  sendMagicLink: async (email) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    return error ? { error: error.message } : {};
  },

  signOut: async () => {
    if (!supabase) return;
    stopRealtime();
    await supabase.auth.signOut();
    set({ user: null, syncState: 'idle', lastSyncedAt: null });
  },
}));
