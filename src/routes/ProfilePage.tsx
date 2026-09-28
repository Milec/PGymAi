import { useRef, useState } from 'react';
import { AccountPanel } from '@/components/AccountPanel';
import { HeightField } from '@/components/HeightField';
import { PageTitle } from '@/components/common';
import { Chip, Field, HudButton, HudInput, HudPanel } from '@/components/hud';
import { db } from '@/db/db';
import { loadDemoData } from '@/dev/demoData';
import { playRestDoneAlert, primeAlertAudio } from '@/lib/alert';
import { downloadBackup, restoreBackup } from '@/lib/backup';
import { backupCounts, describeBackup, parseBackupJSON } from '@/schema/backup';
import type { Sex } from '@/data/strengthStandards';
import { THEMES } from '@/lib/theme';
import { formatWeight, fromKg, toKg, type Unit } from '@/lib/units';
import { eraseRemoteData, isSyncActive } from '@/sync/syncEngine';
import { clearLocalUiState, useAppStore } from '@/store/useAppStore';

export function ProfilePage() {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setTheme = useAppStore((s) => s.setTheme);
  const unit = profile.units;
  const activeTheme = profile.theme ?? 'hud';

  const [bw, setBw] = useState(() => formatWeight(profile.bodyweightKg, unit));

  const setUnit = async (u: Unit) => {
    // Keep bodyweight input in sync with the displayed unit.
    setBw(formatWeight(profile.bodyweightKg, u));
    await updateProfile({ units: u });
  };

  const commitBw = async () => {
    const v = parseFloat(bw);
    if (!Number.isNaN(v) && v > 0) await updateProfile({ bodyweightKg: toKg(v, unit) });
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  const restoreFrom = async (file: File) => {
    const parsed = parseBackupJSON(await file.text());
    if ('error' in parsed) {
      alert(parsed.error);
      return;
    }
    const summary = describeBackup(backupCounts(parsed.backup));
    if (
      !confirm(
        `Restore this backup?\n\n${summary}\n\nRecords with the same id are overwritten; anything only on this device is kept.`,
      )
    ) {
      return;
    }
    setRestoring(true);
    try {
      await restoreBackup(parsed.backup);
      location.reload();
    } catch (err) {
      setRestoring(false);
      alert(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const wipeData = async () => {
    const cloud = isSyncActive();
    const msg = cloud
      ? 'Erase ALL data — workouts, programs, custom exercises, and your food journal — from this device AND your cloud backup? Your account stays; this cannot be undone.'
      : 'Erase ALL local data (workouts, programs, custom exercises, food journal)? This cannot be undone.';
    if (!confirm(msg)) return;
    if (cloud) {
      // Remote first: if the cloud wipe fails, keep local data intact so the
      // next reconcile can't resurrect a half-erased state.
      try {
        await eraseRemoteData();
      } catch (err) {
        alert(
          `Could not erase the cloud backup (are you offline?). Nothing was deleted.\n\n${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
    }
    await db.delete();
    // The rest timer and collapsed-exercise state live in localStorage, not
    // Dexie — leaving them behind resurrects a countdown for a session that no
    // longer exists.
    clearLocalUiState();
    location.reload();
  };

  return (
    <div>
      <PageTitle title="Profile & Settings" sub="Used for units, timers, and strength standards." />

      <AccountPanel />

      <HudPanel className="mb-4 p-5" label="THEME" bracketColor="var(--violet)">
        <p className="mb-3 text-[12px] text-[var(--ink-dim)]">Skin the whole app.</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {THEMES.map((t) => {
            const on = activeTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => void setTheme(t.id)}
                className="chamfer relative flex flex-col gap-2 p-3 text-left transition-all"
                style={{
                  border: `1px solid ${on ? 'var(--cyan)' : 'var(--line)'}`,
                  background: on ? 'rgba(56,225,255,0.06)' : 'transparent',
                  boxShadow: on ? '0 0 14px rgba(56,225,255,0.18)' : 'none',
                }}
              >
                <span className="flex gap-1">
                  {t.swatch.map((c, i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded-full"
                      style={{ background: c, border: '1px solid rgba(255,255,255,0.15)' }}
                    />
                  ))}
                </span>
                <span className="font-head text-[10px] tracking-[0.12em] text-[var(--ink)]">
                  {t.label}
                </span>
                <span className="text-[10px] leading-tight text-[var(--ink-faint)]">{t.blurb}</span>
                {on && (
                  <span className="font-head absolute right-2 top-2 text-[8px] tracking-widest text-[var(--cyan)]">
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </HudPanel>

      <HudPanel className="mb-4 p-5" label="ATHLETE">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display Name">
            <HudInput
              value={profile.name ?? ''}
              onChange={(e) => void updateProfile({ name: e.target.value })}
              placeholder="Pilot"
            />
          </Field>
          <Field label="Age (optional)">
            <HudInput
              type="number"
              value={profile.age ?? ''}
              onChange={(e) => void updateProfile({ age: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="—"
            />
          </Field>
        </div>

        <div className="mt-4">
          <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">UNITS</div>
          <div className="flex gap-2">
            <Chip active={unit === 'kg'} onClick={() => void setUnit('kg')}>
              Kilograms
            </Chip>
            <Chip active={unit === 'lb'} onClick={() => void setUnit('lb')}>
              Pounds
            </Chip>
          </div>
        </div>

        <div className="mt-4">
          <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">SEX (for standards)</div>
          <div className="flex flex-wrap gap-2">
            {(['male', 'female', 'unspecified'] as const).map((s) => (
              <Chip
                key={s}
                active={profile.sex === s}
                onClick={() => void updateProfile({ sex: s as Sex | 'unspecified' })}
                color="var(--violet)"
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`Bodyweight (${unit})`} hint="Used for strength comparison and macro targets.">
            <HudInput
              type="number"
              inputMode="decimal"
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              onBlur={commitBw}
            />
          </Field>
          <HeightField
            heightCm={profile.heightCm}
            unit={unit}
            onChange={(cm) => void updateProfile({ heightCm: cm })}
            hint="Used by the Fuel target calculator."
          />
        </div>
      </HudPanel>

      <HudPanel className="mb-4 p-5" label="TIMERS" bracketColor="var(--amber)">
        <Field label="Default Rest (seconds)" hint="Auto-starts when you complete a set.">
          <div className="flex items-center gap-2">
            <HudInput
              type="number"
              className="max-w-[120px]"
              value={profile.restDefaultSec}
              onChange={(e) => void updateProfile({ restDefaultSec: Math.max(0, parseInt(e.target.value) || 0) })}
            />
            <div className="flex gap-2">
              {[60, 90, 120, 180].map((s) => (
                <Chip key={s} active={profile.restDefaultSec === s} onClick={() => void updateProfile({ restDefaultSec: s })} color="var(--amber)">
                  {s}s
                </Chip>
              ))}
            </div>
          </div>
        </Field>

        <div className="mt-4">
          <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
            END-OF-REST ALERT
          </div>
          <div className="flex gap-2">
            <Chip
              active={profile.restAlert !== false}
              onClick={() => void updateProfile({ restAlert: true })}
              color="var(--amber)"
            >
              On
            </Chip>
            <Chip
              active={profile.restAlert === false}
              onClick={() => void updateProfile({ restAlert: false })}
              color="var(--amber)"
            >
              Off
            </Chip>
            <HudButton
              variant="ghost"
              sheen={false}
              className="!min-h-[34px] !px-3 !text-[10px]"
              onClick={() => {
                primeAlertAudio();
                playRestDoneAlert();
              }}
            >
              Test
            </HudButton>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-faint)]">
            Beeps and vibrates when the rest timer reaches zero. Needs the app on screen — browsers
            won&apos;t let a background tab make noise.
          </p>
        </div>
      </HudPanel>

      <HudPanel className="mb-4 p-5" label="STANDARDS TRANSPARENCY" bracketColor="var(--violet)">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          Strength comparison uses the <strong className="text-[var(--ink)]">Wilks score</strong>{' '}
          (lift normalised for bodyweight &amp; sex). Level bands are{' '}
          <strong className="text-[var(--amber)]">approximate</strong> references, not official
          standards; percentiles are approximate. Details in{' '}
          <span className="mono text-[var(--cyan)]">DECISIONS.md</span>.
        </p>
      </HudPanel>

      <HudPanel className="p-5" label="DATA" bracketColor="var(--down)">
        <p className="mb-3 text-[12px] text-[var(--ink-dim)]">
          Everything is stored locally in your browser (IndexedDB) and works fully offline. If you
          enable Cloud Sync and sign in, your data is also synced to your Supabase account. Export
          writes a JSON backup of everything except the seeded exercise library; Restore reads one
          back, overwriting records it shares an id with and keeping the rest.
        </p>
        <div className="flex flex-wrap gap-2">
          <HudButton onClick={() => void loadDemoData().then(() => location.assign('#/'))}>
            Load Sample Data
          </HudButton>
          <HudButton variant="ghost" sheen={false} onClick={() => void downloadBackup()}>
            Export All Data
          </HudButton>
          <HudButton variant="ghost" sheen={false} onClick={() => fileRef.current?.click()}>
            Restore Backup
          </HudButton>
          <HudButton variant="danger" sheen={false} onClick={wipeData}>
            Erase Everything
          </HudButton>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Restore backup file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // let the same file be picked twice
            if (file) void restoreFrom(file);
          }}
        />
        {restoring && (
          <p className="mono mt-3 text-[11px] text-[var(--cyan)]">Restoring…</p>
        )}
      </HudPanel>

      <div className="mt-4 text-center text-[10px] text-[var(--ink-faint)]">
        Current bodyweight: {formatWeight(profile.bodyweightKg, unit)} {unit} ·{' '}
        {fromKg(profile.bodyweightKg, 'lb').toFixed(0)} lb equiv
      </div>
    </div>
  );
}
