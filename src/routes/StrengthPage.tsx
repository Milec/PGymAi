import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle, EmptyState } from '@/components/common';
import { BandScale, Delta, HudButton, HudPanel, Readout } from '@/components/hud';
import { useExercises, useFinishedWorkouts } from '@/hooks/useLive';
import { bestE1rm } from '@/lib/analytics';
import { classifyStrength, STRENGTH_STANDARDS, type Sex } from '@/data/strengthStandards';
import { formatWeight, fromKg } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

export function StrengthPage() {
  const exercises = useExercises();
  const workouts = useFinishedWorkouts();
  const profile = useAppStore((s) => s.profile);
  const unit = profile.units;

  const bigLifts = useMemo(
    () => exercises.filter((e) => e.standardKey && e.standardKey in STRENGTH_STANDARDS),
    [exercises],
  );

  if (profile.sex === 'unspecified' || !profile.bodyweightKg) {
    return (
      <div>
        <PageTitle title="Strength Standards" sub="Compare your lifts against your bodyweight." />
        <EmptyState title="Profile Needed">
          <div className="mb-4">
            Strength comparison needs your <strong>sex</strong> and <strong>bodyweight</strong> to
            place you on the standards scale. Set them in your profile.
          </div>
          <Link to="/profile">
            <HudButton>Open Profile</HudButton>
          </Link>
        </EmptyState>
      </div>
    );
  }

  const sex = profile.sex as Sex;

  return (
    <div>
      <PageTitle
        title="Strength Standards"
        sub={`Vs. ${sex}, ${formatWeight(profile.bodyweightKg, unit)} ${unit} bodyweight — ratio bands.`}
      />

      <HudPanel className="mb-4 p-4" label="HOW TO READ THIS" bracketColor="var(--violet)">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          Bands show <strong className="text-[var(--ink)]">lift ÷ bodyweight</strong> ratios for
          each training level. The white line marks the{' '}
          <strong className="text-[var(--ink)]">average reference</strong> — defined here as the
          <em> Novice ceiling</em>, roughly what a healthy, minimally-trained {sex} of your
          bodyweight lifts. Your glowing marker is your best estimated 1RM. These are{' '}
          <strong className="text-[var(--amber)]">approximate reference bands</strong> (ratio model),
          not authoritative standards — see DECISIONS.md for the source &amp; limitations.
        </p>
      </HudPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        {bigLifts.map((ex) => {
          const e1rm = bestE1rm(workouts, ex.id);
          if (!e1rm) {
            return (
              <HudPanel key={ex.id} className="p-4" label="NO DATA">
                <div className="text-[14px] font-semibold text-[var(--ink)]">{ex.name}</div>
                <div className="mt-2 text-[12px] text-[var(--ink-faint)]">
                  Log a set of {ex.name} to unlock its comparison.
                </div>
              </HudPanel>
            );
          }
          const result = classifyStrength(ex.standardKey!, sex, e1rm, profile.bodyweightKg)!;
          return (
            <HudPanel key={ex.id} className="p-4" label={result.level.toUpperCase()}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--ink)]">{ex.name}</div>
                  <div className="mono mt-0.5 text-[11px] text-[var(--ink-faint)]">
                    {formatWeight(e1rm, unit)} {unit} e1RM · ratio {result.ratio.toFixed(2)}×BW
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-head text-[8px] tracking-widest text-[var(--ink-faint)]">
                    APPROX PERCENTILE
                  </div>
                  <div className="mono text-lg font-semibold text-[var(--cyan)]">
                    {result.approxPercentile}
                    <span className="text-[10px]">%</span>
                  </div>
                </div>
              </div>

              <BandScale
                bands={result.bands}
                ratio={result.ratio}
                averageRatio={result.averageRatio}
                level={result.level}
              />

              <div className="mt-4 flex items-end justify-between">
                <Readout
                  label="Vs. Average"
                  value={`${result.deltaVsAverageKg >= 0 ? '+' : ''}${formatWeight(Math.abs(result.deltaVsAverageKg), unit)}`}
                  unit={unit}
                  size="md"
                  flash={false}
                  color={result.deltaVsAverageKg >= 0 ? 'var(--up)' : 'var(--down)'}
                />
                <div className="text-right">
                  <div className="font-head text-[8px] tracking-widest text-[var(--ink-faint)]">
                    NEXT: {result.nextLevel ?? 'ELITE+'}
                  </div>
                  {result.nextRatio ? (
                    <div className="mono text-[12px] text-[var(--ink-dim)]">
                      need {formatWeight(result.nextRatio * profile.bodyweightKg, unit)} {unit}
                    </div>
                  ) : (
                    <div className="mono text-[12px] text-[var(--amber)]">Elite reached</div>
                  )}
                </div>
              </div>

              <div className="mt-2">
                <Delta value={fromKg(result.deltaVsAverageKg, unit)} unit={` ${unit} vs avg`} />
              </div>
            </HudPanel>
          );
        })}
      </div>
    </div>
  );
}
