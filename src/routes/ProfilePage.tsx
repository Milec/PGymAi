import { useState } from 'react';
import { PageTitle } from '@/components/common';
import { Chip, Field, HudButton, HudInput, HudPanel } from '@/components/hud';
import { db } from '@/db/db';
import { loadDemoData } from '@/dev/demoData';
import type { Sex } from '@/data/strengthStandards';
import { formatWeight, fromKg, toKg, type Unit } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

export function ProfilePage() {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const unit = profile.units;

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

        <div className="mt-4">
          <Field label={`Bodyweight (${unit})`} hint="Used for the bodyweight-relative strength comparison.">
            <HudInput
              type="number"
              inputMode="decimal"
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              onBlur={commitBw}
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
          STRIDE's strength comparison uses <strong className="text-[var(--ink)]">bodyweight-ratio
          bands</strong> (lift ÷ bodyweight) consolidated from openly published tables (ExRx.net /
          Symmetric Strength). The <em>average reference</em> is the Novice band ceiling — a
          reference point, not a population census. Percentiles are approximate. It is a ratio
          model, so it slightly overrates very light lifters and underrates very heavy ones. These
          are approximate reference bands, never authoritative standards. Full source &amp;
          limitations live in <span className="mono text-[var(--cyan)]">DECISIONS.md</span>.
        </p>
      </HudPanel>

      <HudPanel className="p-5" label="DATA" bracketColor="var(--down)">
        <p className="mb-3 text-[12px] text-[var(--ink-dim)]">
          Everything is stored locally in your browser (IndexedDB). Nothing leaves your device.
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
  const [workouts, programs, exercises, profile] = await Promise.all([
    db.workouts.toArray(),
    db.programs.toArray(),
    db.exercises.filter((e) => !!e.custom).toArray(),
    db.profile.get('me'),
  ]);
  const payload = { exportedAt: new Date().toISOString(), profile, workouts, programs, customExercises: exercises };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stride-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}
