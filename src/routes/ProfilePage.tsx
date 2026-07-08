import { useState } from 'react';
import { AccountPanel } from '@/components/AccountPanel';
import { PageTitle } from '@/components/common';
import { Chip, Field, HudButton, HudInput, HudPanel } from '@/components/hud';
import { db } from '@/db/db';
import { loadDemoData } from '@/dev/demoData';
import type { Sex } from '@/data/strengthStandards';
import { THEMES } from '@/lib/theme';
import { formatWeight, fromKg, toKg, type Unit } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

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

  const wipeData = async () => {
    if (!confirm('Erase ALL local data (workouts, programs, custom exercises)? This cannot be undone.'))
      return;
    await db.delete();
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
          <Field label="Height (cm)" hint="Used by the Fuel target calculator.">
            <HudInput
              type="number"
              inputMode="decimal"
              value={profile.heightCm ?? ''}
              onChange={(e) =>
                void updateProfile({ heightCm: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              placeholder="—"
            />
          </Field>
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
          enable Cloud Sync and sign in, your data is also synced to your Supabase account.
        </p>
        <div className="flex flex-wrap gap-2">
          <HudButton onClick={() => void loadDemoData().then(() => location.assign('#/'))}>
            Load Sample Data
          </HudButton>
          <HudButton variant="ghost" sheen={false} onClick={() => void exportAll()}>
            Export All Data
          </HudButton>
          <HudButton variant="danger" sheen={false} onClick={wipeData}>
            Erase Everything
          </HudButton>
        </div>
      </HudPanel>

      <div className="mt-4 text-center text-[10px] text-[var(--ink-faint)]">
        Current bodyweight: {formatWeight(profile.bodyweightKg, unit)} {unit} ·{' '}
        {fromKg(profile.bodyweightKg, 'lb').toFixed(0)} lb equiv
      </div>
    </div>
  );
}

async function exportAll() {
  const [workouts, programs, exercises, profile, foodLogs, foods] = await Promise.all([
    db.workouts.toArray(),
    db.programs.toArray(),
    db.exercises.filter((e) => !!e.custom).toArray(),
    db.profile.get('me'),
    db.foodLogs.toArray(),
    db.foods.toArray(),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    workouts,
    programs,
    customExercises: exercises,
    foodLogs,
    foods,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stride-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}
