import { useState } from 'react';
import { AuthModal } from '@/components/AuthModal';
import { HudButton, HudPanel } from '@/components/hud';
import { IconUser } from '@/components/icons';
import { relativeDay } from '@/lib/time';
import { useAuthStore, type SyncState } from '@/store/useAuthStore';

const STATE_LABEL: Record<SyncState, { text: string; color: string }> = {
  idle: { text: 'Idle', color: 'var(--ink-faint)' },
  syncing: { text: 'Syncing…', color: 'var(--cyan)' },
  synced: { text: 'Synced', color: 'var(--up)' },
  error: { text: 'Sync error', color: 'var(--down)' },
  offline: { text: 'Offline', color: 'var(--amber)' },
};

export function AccountPanel() {
  const configured = useAuthStore((s) => s.configured);
  const user = useAuthStore((s) => s.user);
  const syncState = useAuthStore((s) => s.syncState);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const errorMsg = useAuthStore((s) => s.errorMsg);
  const runSync = useAuthStore((s) => s.runSync);
  const signOut = useAuthStore((s) => s.signOut);
  const [authOpen, setAuthOpen] = useState(false);

  if (!configured) {
    return (
      <HudPanel className="mb-4 p-5" label="CLOUD SYNC" bracketColor="var(--violet)">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          Cloud sync is <strong className="text-[var(--ink)]">not configured</strong>. STRIDE is
          running fully local-first. To enable multi-device sync, set{' '}
          <span className="mono text-[var(--cyan)]">VITE_SUPABASE_URL</span> and{' '}
          <span className="mono text-[var(--cyan)]">VITE_SUPABASE_ANON_KEY</span> and run{' '}
          <span className="mono text-[var(--cyan)]">supabase/schema.sql</span> — see the README.
        </p>
      </HudPanel>
    );
  }

  const st = STATE_LABEL[syncState];

  return (
    <HudPanel className="mb-4 p-5" label="CLOUD SYNC" bracketColor={user ? 'var(--cyan)' : 'var(--violet)'}>
      {user ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="chamfer flex h-10 w-10 items-center justify-center border border-[var(--cyan)]"
                style={{ background: 'rgba(56,225,255,0.08)' }}
              >
                <IconUser size={18} className="text-[var(--cyan)]" />
              </div>
              <div>
                <div className="mono text-[13px] text-[var(--ink)]">{user.email ?? 'Signed in'}</div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }}
                  />
                  <span className="mono text-[10px]" style={{ color: st.color }}>
                    {st.text}
                    {lastSyncedAt && syncState === 'synced' ? ` · ${relativeDay(lastSyncedAt)}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {syncState === 'error' && errorMsg && (
            <div className="chamfer border border-[var(--down)] bg-[rgba(255,90,114,0.08)] p-2.5 text-[11px] text-[var(--down)]">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <HudButton className="!min-h-[38px]" onClick={() => void runSync()} disabled={syncState === 'syncing'}>
              Sync Now
            </HudButton>
            <HudButton variant="ghost" sheen={false} className="!min-h-[38px]" onClick={() => void signOut()}>
              Sign Out
            </HudButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
            Sign in to sync your workouts, programs, custom exercises, and profile across all your
            devices. Your local data stays put and merges on first sign-in.
          </p>
          <div>
            <HudButton onClick={() => setAuthOpen(true)}>Sign In / Create Account</HudButton>
          </div>
        </div>
      )}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </HudPanel>
  );
}
