import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle, EmptyState } from '@/components/common';
import { BandScale, Delta, HudButton, HudPanel, Readout } from '@/components/hud';
import { useExercises, useFinishedWorkouts } from '@/hooks/useLive';
import { bestE1rm } from '@/lib/analytics';
import { classifyWilks, WILKS_BANDS, type Sex } from '@/data/strengthStandards';
import { formatWeight, fromKg } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

export function StrengthPage() {
  const exercises = useExercises();
  const workouts = useFinishedWorkouts();
  const profile = useAppStore((s) => s.profile);
  const unit = profile.units;

  const bigLifts = useMemo(
    () => exercises.filter((e) => e.standardKey && e.standardKey in WILKS_BANDS),
    [exercises],
  );

  if (profile.sex === 'unspecified' || !profile.bodyweightKg) {
    return (
      <div>
        <PageTitle title="Strength Standards" sub="Compare your lifts using the Wilks score." />
        <EmptyState title="Profile Needed">
          <div className="mb-4">
            Strength comparison needs your <strong>sex</strong> and <strong>bodyweight</strong> to
            compute your Wilks score. Set them in your profile.
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
        sub={`Wilks score vs. ${sex}, ${formatWeight(profile.bodyweightKg, unit)} ${unit} bodyweight.`}
      />

      <HudPanel className="mb-4 p-4" label="ABOUT" bracketColor="var(--violet)">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          The <strong className="text-[var(--ink)]">Wilks score</strong> normalises your lift for
          bodyweight and sex. Bands are <strong className="text-[var(--amber)]">approximate</strong>{' '}
          references, not official standards.
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
          const r = classifyWilks(ex.standardKey!, sex, e1rm, profile.bodyweightKg)!;
          return (
            <HudPanel key={ex.id} className="p-4" label={r.level.toUpperCase()}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--ink)]">{ex.name}</div>
                  <div className="mono mt-0.5 text-[11px] text-[var(--ink-faint)]">
                    {formatWeight(e1rm, unit)} {unit} e1RM · coeff {r.coefficient.toFixed(3)}
                  </div>
                </div>
                <Readout
                  label="Wilks"
                  value={Math.round(r.score)}
                  size="md"
                  flash={false}
                  color="var(--cyan)"
                  className="items-end"
                />
              </div>

              <BandScale
                bands={r.bands}
                ratio={r.score}
                averageRatio={r.averageScore}
                level={r.level}
              />

              <div className="mt-4 flex items-end justify-between">
                <Readout
                  label="Vs. Average"
                  value={`${r.deltaVsAverageKg >= 0 ? '+' : ''}${formatWeight(Math.abs(r.deltaVsAverageKg), unit)}`}
                  unit={unit}
                  size="md"
                  flash={false}
                  color={r.deltaVsAverageKg >= 0 ? 'var(--up)' : 'var(--down)'}
                />
                <div className="text-right">
                  <div className="font-head text-[8px] tracking-widest text-[var(--ink-faint)]">
                    NEXT: {r.nextLevel ?? 'ELITE+'}
                  </div>
                  {r.nextScore && r.coefficient > 0 ? (
                    <div className="mono text-[12px] text-[var(--ink-dim)]">
                      need {formatWeight(r.nextScore / r.coefficient, unit)} {unit}
                    </div>
                  ) : (
                    <div className="mono text-[12px] text-[var(--amber)]">Elite reached</div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Delta value={fromKg(r.deltaVsAverageKg, unit)} unit={` ${unit} vs avg`} />
                <span className="mono text-[10px] text-[var(--ink-faint)]">
                  ~{r.approxPercentile}%ile
                </span>
              </div>
            </HudPanel>
          );
        })}
      </div>
    </div>
  );
}
