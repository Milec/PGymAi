import { useState } from 'react';
import { Chip, Field, HudButton, HudInput, HudSelect, Modal } from '@/components/hud';
import type { Sex } from '@/data/strengthStandards';
import {
  ACTIVITY_LEVELS,
  DEFAULT_NUTRITION_INPUTS,
  DIET_GOALS,
  FAT_PERCENT_OPTIONS,
  PROTEIN_PER_KG_OPTIONS,
  RATE_OPTIONS_KG,
  bmrMifflinStJeor,
  goalCalories,
  macroTargets,
  tdee,
  type ActivityLevel,
  type DietGoal,
} from '@/lib/nutrition';
import { formatWeight, fromKg, toKg } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Target calibration: computes daily calories from bodyweight, height, age,
 * sex (Mifflin-St Jeor), activity, and goal — then splits macros. A manual
 * mode lets users type their own targets instead.
 */
export function GoalCalculatorModal({ open, onClose }: Props) {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const unit = profile.units;
  const n = profile.nutrition;

  const [mode, setMode] = useState<'auto' | 'manual'>(n && !n.auto ? 'manual' : 'auto');
  // Body inputs (persisted back to the profile on apply).
  const [weight, setWeight] = useState(() => formatWeight(profile.bodyweightKg, unit));
  const [height, setHeight] = useState(() => (profile.heightCm ? String(profile.heightCm) : ''));
  const [age, setAge] = useState(() => (profile.age ? String(profile.age) : ''));
  const [sex, setSex] = useState<Sex | 'unspecified'>(profile.sex);
  // Calculator inputs.
  const [activity, setActivity] = useState<ActivityLevel>(n?.activity ?? DEFAULT_NUTRITION_INPUTS.activity);
  const [goal, setGoal] = useState<DietGoal>(n?.goal ?? DEFAULT_NUTRITION_INPUTS.goal);
  const [rate, setRate] = useState(n?.rateKgPerWeek ?? DEFAULT_NUTRITION_INPUTS.rateKgPerWeek);
  const [proteinPerKg, setProteinPerKg] = useState(n?.proteinPerKg ?? DEFAULT_NUTRITION_INPUTS.proteinPerKg);
  const [fatPercent, setFatPercent] = useState(n?.fatPercent ?? DEFAULT_NUTRITION_INPUTS.fatPercent);
  // Manual targets.
  const [mKcal, setMKcal] = useState(() => String(n?.targets.kcal ?? 2500));
  const [mProtein, setMProtein] = useState(() => String(n?.targets.proteinG ?? 150));
  const [mCarbs, setMCarbs] = useState(() => String(n?.targets.carbsG ?? 280));
  const [mFat, setMFat] = useState(() => String(n?.targets.fatG ?? 80));

  const weightKg = toKg(parseFloat(weight) || 0, unit);
  const heightCm = parseFloat(height) || 0;
  const ageY = parseInt(age) || 0;
  const canCompute = weightKg > 0 && heightCm > 0 && ageY > 0;

  const bmr = canCompute ? bmrMifflinStJeor(sex, weightKg, heightCm, ageY) : 0;
  const maintenance = canCompute ? tdee(bmr, activity) : 0;
  const targetKcal = canCompute ? goalCalories(maintenance, goal, goal === 'maintain' ? 0 : rate) : 0;
  const autoTargets = canCompute ? macroTargets(targetKcal, weightKg, proteinPerKg, fatPercent) : null;

  const manualTargets = {
    kcal: Math.max(0, Math.round(parseFloat(mKcal) || 0)),
    proteinG: Math.max(0, Math.round(parseFloat(mProtein) || 0)),
    carbsG: Math.max(0, Math.round(parseFloat(mCarbs) || 0)),
    fatG: Math.max(0, Math.round(parseFloat(mFat) || 0)),
  };

  const targets = mode === 'auto' ? autoTargets : manualTargets.kcal > 0 ? manualTargets : null;

  const apply = async () => {
    if (!targets) return;
    await updateProfile({
      // Body stats belong to the profile so the whole app (and sync) sees them.
      ...(weightKg > 0 ? { bodyweightKg: weightKg } : {}),
      ...(heightCm > 0 ? { heightCm } : {}),
      ...(ageY > 0 ? { age: ageY } : {}),
      sex,
      nutrition: {
        targets,
        auto: mode === 'auto',
        activity,
        goal,
        rateKgPerWeek: goal === 'maintain' ? 0 : rate,
        proteinPerKg,
        fatPercent,
      },
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="CALIBRATE TARGETS">
      <div className="mb-4 flex gap-2">
        <Chip active={mode === 'auto'} onClick={() => setMode('auto')}>
          Calculate for me
        </Chip>
        <Chip active={mode === 'manual'} onClick={() => setMode('manual')}>
          Set manually
        </Chip>
      </div>

      {mode === 'auto' ? (
        <div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={`Weight (${unit})`}>
              <HudInput type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label="Height (cm)">
              <HudInput type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" />
            </Field>
            <Field label="Age">
              <HudInput type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
            </Field>
          </div>

          <div className="mt-3.5">
            <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">SEX</div>
            <div className="flex flex-wrap gap-2">
              {(['male', 'female', 'unspecified'] as const).map((s) => (
                <Chip key={s} active={sex === s} onClick={() => setSex(s)} color="var(--violet)">
                  {s === 'unspecified' ? 'prefer not to say' : s}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-3.5">
            <Field label="Activity (training frequency)">
              <HudSelect value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.blurb}
                  </option>
                ))}
              </HudSelect>
            </Field>
          </div>

          <div className="mt-3.5">
            <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">GOAL</div>
            <div className="flex flex-wrap gap-2">
              {DIET_GOALS.map((g) => (
                <Chip key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)} color="var(--amber)">
                  {g.label}
                </Chip>
              ))}
            </div>
            {goal !== 'maintain' && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {RATE_OPTIONS_KG.map((r) => (
                  <Chip key={r} active={rate === r} onClick={() => setRate(r)}>
                    {goal === 'cut' ? '−' : '+'}
                    {unit === 'kg' ? `${r} kg` : `${fromKg(r, 'lb').toFixed(1)} lb`}/wk
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            <div>
              <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">PROTEIN</div>
              <div className="flex flex-wrap gap-1.5">
                {PROTEIN_PER_KG_OPTIONS.map((p) => (
                  <Chip key={p} active={proteinPerKg === p} onClick={() => setProteinPerKg(p)}>
                    {p} g/kg
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">FAT</div>
              <div className="flex flex-wrap gap-1.5">
                {FAT_PERCENT_OPTIONS.map((f) => (
                  <Chip key={f} active={fatPercent === f} onClick={() => setFatPercent(f)}>
                    {f}%
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {canCompute && autoTargets ? (
            <div
              className="mono mt-4 grid grid-cols-3 gap-2 rounded-[3px] border border-[var(--line)] p-3 text-center text-[11px]"
              style={{ background: 'rgba(120,200,255,0.04)' }}
            >
              <div>
                <div className="text-[var(--ink-faint)]">BMR</div>
                <div className="text-sm text-[var(--ink)]">{Math.round(bmr)}</div>
              </div>
              <div>
                <div className="text-[var(--ink-faint)]">MAINTENANCE</div>
                <div className="text-sm text-[var(--ink)]">{Math.round(maintenance)}</div>
              </div>
              <div>
                <div className="text-[var(--ink-faint)]">TARGET</div>
                <div className="text-sm font-semibold text-[var(--cyan)]">{autoTargets.kcal}</div>
              </div>
              <div className="col-span-3 border-t border-[var(--line)] pt-2 text-[var(--ink-dim)]">
                P <span className="text-[var(--cyan)]">{autoTargets.proteinG}g</span> · C{' '}
                <span className="text-[var(--violet)]">{autoTargets.carbsG}g</span> · F{' '}
                <span className="text-[var(--amber)]">{autoTargets.fatG}g</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[12px] text-[var(--ink-dim)]">
              Enter weight, height, and age to calculate your targets (Mifflin-St Jeor).
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)">
            <HudInput type="number" inputMode="numeric" value={mKcal} onChange={(e) => setMKcal(e.target.value)} />
          </Field>
          <Field label="Protein (g)">
            <HudInput type="number" inputMode="numeric" value={mProtein} onChange={(e) => setMProtein(e.target.value)} />
          </Field>
          <Field label="Carbs (g)">
            <HudInput type="number" inputMode="numeric" value={mCarbs} onChange={(e) => setMCarbs(e.target.value)} />
          </Field>
          <Field label="Fat (g)">
            <HudInput type="number" inputMode="numeric" value={mFat} onChange={(e) => setMFat(e.target.value)} />
          </Field>
        </div>
      )}

      <HudButton className="mt-5 w-full" onClick={() => void apply()} disabled={!targets}>
        Apply Targets
      </HudButton>
      <p className="mt-3 text-[10.5px] leading-relaxed text-[var(--ink-faint)]">
        Estimates use the published Mifflin-St Jeor equation and standard activity multipliers —
        planning references, not medical advice.
      </p>
    </Modal>
  );
}
