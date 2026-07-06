import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageTitle, EmptyState, StatTile } from '@/components/common';
import { Chip, HudPanel, HudSelect } from '@/components/hud';
import { useExerciseMap, useFinishedWorkouts } from '@/hooks/useLive';
import { buildExerciseSeries } from '@/lib/analytics';
import type { E1rmFormula } from '@/lib/e1rm';
import { formatWeight, fromKg } from '@/lib/units';
import { useAppStore } from '@/store/useAppStore';

const tooltipStyle: React.CSSProperties = {
  background: 'var(--space-1)',
  border: '1px solid var(--line-strong)',
  borderRadius: 4,
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  color: 'var(--ink)',
};

export function ProgressPage() {
  const workouts = useFinishedWorkouts();
  const exMap = useExerciseMap();
  const profile = useAppStore((s) => s.profile);
  const unit = profile.units;
  const [formula, setFormula] = useState<E1rmFormula>('epley');
  const [months, setMonths] = useState<number>(0); // 0 = all time

  // Exercises that actually have logged history.
  const loggedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of workouts) for (const e of w.entries) ids.add(e.exerciseId);
    return [...ids]
      .map((id) => exMap.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts, exMap]);

  const [selected, setSelected] = useState<string>('');
  const exerciseId = selected || loggedIds[0]?.id || '';

  const series = useMemo(
    () => (exerciseId ? buildExerciseSeries(workouts, exerciseId, formula) : null),
    [workouts, exerciseId, formula],
  );

  const chartData = useMemo(() => {
    const since = months > 0 ? Date.now() - months * 30 * 86400000 : 0;
    return (
      series?.points
        .filter((p) => p.ts >= since)
        .map((p) => ({
          date: new Date(p.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          e1rm: Math.round(fromKg(p.e1rmKg, unit) * 10) / 10,
          top: Math.round(fromKg(p.weightKg, unit) * 10) / 10,
          volume: Math.round(fromKg(p.volumeKg, unit)),
        })) ?? []
    );
  }, [series, unit, months]);

  if (loggedIds.length === 0) {
    return (
      <div>
        <PageTitle title="Progress" sub="Charts populate as you log sessions." />
        <EmptyState title="No Data Yet">
          Log a workout with weight &amp; reps and your estimated-1RM, top-set, and volume trends
          will appear here.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Progress"
        sub="Per-exercise strength & volume trends over time."
        right={
          <div className="flex items-center gap-2">
            <HudSelect
              value={formula}
              onChange={(e) => setFormula(e.target.value as E1rmFormula)}
              className="!min-h-[38px] !w-auto text-[12px]"
            >
              <option value="epley">Epley</option>
              <option value="brzycki">Brzycki</option>
            </HudSelect>
          </div>
        }
      />

      <HudPanel className="mb-4 p-3">
        <HudSelect value={exerciseId} onChange={(e) => setSelected(e.target.value)}>
          {loggedIds.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </HudSelect>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {([
            [3, '3M'],
            [6, '6M'],
            [12, '1Y'],
            [0, 'All'],
          ] as const).map(([m, label]) => (
            <Chip key={label} active={months === m} onClick={() => setMonths(m)} color="var(--amber)">
              {label}
            </Chip>
          ))}
        </div>
      </HudPanel>

      {series && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatTile label="Best e1RM" value={formatWeight(series.best1rmKg, unit)} unit={unit} color="var(--amber)" />
            <StatTile label="Best Top Set" value={formatWeight(series.bestTopSetKg, unit)} unit={unit} color="var(--cyan)" />
            <StatTile label="PRs" value={series.prTimeline.length} color="var(--violet)" />
          </div>

          <HudPanel className="mb-4 p-4" label={`ESTIMATED 1RM — ${formula.toUpperCase()}`}>
            <div className="h-56 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="e1rmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} />
                  <YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--amber)' }} formatter={(v) => [`${Number(v)} ${unit}`, 'e1RM']} />
                  <Area type="monotone" dataKey="e1rm" stroke="var(--amber)" strokeWidth={2} fill="url(#e1rmGrad)" dot={{ r: 2, fill: 'var(--amber)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </HudPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <HudPanel className="p-4" label="TOP SET">
              <div className="h-48 w-full pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} />
                    <YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v)} ${unit}`, 'Top set']} />
                    <Line type="monotone" dataKey="top" stroke="var(--cyan)" strokeWidth={2} dot={{ r: 2, fill: 'var(--cyan)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </HudPanel>

            <HudPanel className="p-4" label="SESSION VOLUME" bracketColor="var(--violet)">
              <div className="h-48 w-full pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="volGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--violet)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--violet)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} />
                    <YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v)} ${unit}`, 'Volume']} />
                    <Area type="monotone" dataKey="volume" stroke="var(--violet)" strokeWidth={2} fill="url(#volGrad2)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </HudPanel>
          </div>

          <HudPanel className="mt-4 p-4" label="PR TIMELINE" bracketColor="var(--amber)">
            {series.prTimeline.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-[var(--ink-faint)]">
                No e1RM PRs recorded for this lift yet.
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {[...series.prTimeline].reverse().map((pr, i) => (
                  <li
                    key={pr.ts}
                    className="mono flex items-center justify-between border-l-2 py-1.5 pl-3 text-[13px]"
                    style={{ borderColor: i === 0 ? 'var(--amber)' : 'var(--line)' }}
                  >
                    <span className="text-[var(--ink-dim)]">
                      {new Date(pr.ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-semibold text-[var(--amber)]">
                      {formatWeight(pr.e1rmKg, unit)} {unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </HudPanel>
        </>
      )}
    </div>
  );
}
