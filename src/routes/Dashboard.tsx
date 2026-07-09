import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { PageTitle, StatTile, EmptyState } from '@/components/common';
import { FuelTodayPanel } from '@/components/fuel/FuelTodayPanel';
import { Chip, HudButton, HudPanel } from '@/components/hud';
import { IconFire, IconLift, IconChart } from '@/components/icons';
import { MUSCLE_LABEL } from '@/data/muscles';
import { useExerciseMap, useFinishedWorkouts } from '@/hooks/useLive';
import {
  computeStreak,
  muscleBalance,
  recentPRs,
  weeklyVolume,
} from '@/lib/analytics';
import { relativeDay } from '@/lib/time';
import { formatWeight, fromKg } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

export function Dashboard() {
  const workouts = useFinishedWorkouts();
  const exMap = useExerciseMap();
  const profile = useAppStore((s) => s.profile);
  const active = useAppStore((s) => s.active);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const unit = profile.units;

  const [volWeeks, setVolWeeks] = useState(8);
  const weeks = useMemo(() => weeklyVolume(workouts, volWeeks), [workouts, volWeeks]);
  const streak = useMemo(() => computeStreak(workouts), [workouts]);
  const prs = useMemo(() => recentPRs(workouts, exMap, 6), [workouts, exMap]);
  // Muscle balance shares the volume chart's period (weeks → days).
  const balance = useMemo(
    () => muscleBalance(workouts, exMap, volWeeks * 7),
    [workouts, exMap, volWeeks],
  );

  const thisWeekVol = weeks[weeks.length - 1]?.volumeKg ?? 0;
  const sessionsThisWeek = useMemo(() => {
    const start = weeks[weeks.length - 1]?.weekStart ?? 0;
    return workouts.filter((w) => (w.finishedAt ?? 0) >= start).length;
  }, [workouts, weeks]);

  const volChartData = weeks.map((w) => ({
    label: w.label,
    vol: Math.round(fromKg(w.volumeKg, unit)),
  }));
  const radarData = balance.slice(0, 8).map((b) => ({
    muscle: MUSCLE_LABEL[b.muscle as keyof typeof MUSCLE_LABEL] ?? b.muscle,
    sets: b.sets,
  }));

  return (
    <div>
      <PageTitle
        title="Flight Deck"
        sub={`Welcome back${profile.name ? `, ${profile.name}` : ''} — systems nominal.`}
        right={
          active ? (
            <Link to="/workout">
              <HudButton variant="accent">Resume Session</HudButton>
            </Link>
          ) : (
            <Link to="/workout" onClick={() => void startWorkout()}>
              <HudButton>
                <IconLift size={16} /> Start Workout
              </HudButton>
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="This Week Volume"
          value={Math.round(fromKg(thisWeekVol, unit)).toLocaleString()}
          unit={unit}
          icon={<IconChart size={16} />}
        />
        <StatTile label="Session Streak" value={streak} unit="days" color="var(--amber)" icon={<IconFire size={16} />} />
        <StatTile label="Sessions / Week" value={sessionsThisWeek} color="var(--violet)" />
        <StatTile label="Total Sessions" value={workouts.length} color="var(--up)" />
      </div>

      <div className="mt-4">
        <FuelTodayPanel />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <HudPanel className="p-4" label="WEEKLY VOLUME">
          <div className="mb-1 flex flex-wrap justify-end gap-1.5 pt-1">
            {([4, 8, 12, 26, 52] as const).map((w) => (
              <Chip key={w} active={volWeeks === w} onClick={() => setVolWeeks(w)}>
                {w < 52 ? `${w}w` : '1y'}
              </Chip>
            ))}
          </div>
          <div className="h-48 w-full pt-1">
            {workouts.length === 0 ? (
              <Centered>Log a session to chart your volume.</Centered>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volChartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} axisLine={{ stroke: 'var(--chart-axis)' }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(56,225,255,0.06)' }}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--cyan)' }}
                    formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, 'Volume']}
                  />
                  <Bar dataKey="vol" fill="url(#volGrad)" radius={[2, 2, 0, 0]} />
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--violet)" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </HudPanel>

        <HudPanel className="p-4" label="MUSCLE BALANCE" bracketColor="var(--violet)">
          <div className="flex justify-end pt-1">
            <span className="mono text-[10px] text-[var(--ink-faint)]">
              last {volWeeks < 52 ? `${volWeeks}w` : '1y'}
            </span>
          </div>
          <div className="h-48 w-full">
            {radarData.length === 0 ? (
              <Centered>
                Train to reveal your muscle-group balance (last {volWeeks < 52 ? `${volWeeks} weeks` : 'year'}).
              </Centered>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="var(--chart-axis)" />
                  <PolarAngleAxis dataKey="muscle" tick={{ fill: 'var(--ink-dim)', fontSize: 9 }} />
                  <Radar dataKey="sets" stroke="var(--violet)" fill="var(--violet)" fillOpacity={0.35} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v)} sets`, '']} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </HudPanel>
      </div>

      <div className="mt-4">
        <HudPanel className="p-4" label="RECENT PRs" bracketColor="var(--amber)">
          {prs.length === 0 ? (
            <div className="py-6">
              <EmptyState title="No PRs yet">
                Complete sets and STRIDE will detect estimated-1RM personal records automatically.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--line)]">
              {prs.map((pr) => (
                <li key={pr.exerciseId + pr.ts} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-[13px] text-[var(--ink)]">{pr.exerciseName}</div>
                    <div className="mono text-[10px] text-[var(--ink-faint)]">{relativeDay(pr.ts)}</div>
                  </div>
                  <div className="mono text-right text-sm font-semibold text-[var(--amber)]">
                    {formatWeight(pr.e1rmKg, unit)} {unit}
                    <span className="ml-1 text-[9px] text-[var(--ink-faint)]">e1RM</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HudPanel>
      </div>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--space-1)',
  border: '1px solid var(--line-strong)',
  borderRadius: 4,
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  color: 'var(--ink)',
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-[var(--ink-faint)]">
      {children}
    </div>
  );
}
