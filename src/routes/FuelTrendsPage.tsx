import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState, PageTitle, StatTile } from '@/components/common';
import { Chip, HudPanel } from '@/components/hud';
import { useAllFoodLogs, useAllWaterLogs } from '@/hooks/useLive';
import { averageMacros, dailyTotals, fillGaps, filterPeriod } from '@/lib/fuelStats';
import { dateKey, shiftDateKey, waterTargetMl } from '@/lib/nutrition';
import { useAppStore } from '@/store/useAppStore';

const tooltipStyle: React.CSSProperties = {
  background: 'var(--space-1)',
  border: '1px solid var(--line-strong)',
  borderRadius: 4,
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  color: 'var(--ink)',
};

const PERIODS = [
  [7, '1W'],
  [14, '2W'],
  [30, '1M'],
  [90, '3M'],
  [0, 'All'],
] as const;

export function FuelTrendsPage() {
  const entries = useAllFoodLogs();
  const waterLogs = useAllWaterLogs();
  const profile = useAppStore((s) => s.profile);
  const targets = profile.nutrition?.targets ?? null;
  const [period, setPeriod] = useState<number>(30);

  const allDays = useMemo(() => dailyTotals(entries), [entries]);
  const days = useMemo(() => filterPeriod(allDays, period), [allDays, period]);
  const avg = useMemo(() => averageMacros(days), [days]);

  // Avg water/day across days with water logged in the same window.
  const avgWaterMl = useMemo(() => {
    const since = period > 0 ? shiftDateKey(dateKey(), -(period - 1)) : '';
    const byDay = new Map<string, number>();
    for (const w of waterLogs) {
      if (w.date >= since) byDay.set(w.date, (byDay.get(w.date) ?? 0) + w.ml);
    }
    if (byDay.size === 0) return null;
    let sum = 0;
    for (const v of byDay.values()) sum += v;
    return sum / byDay.size;
  }, [waterLogs, period]);
  const waterTarget =
    profile.hydration && !profile.hydration.auto
      ? profile.hydration.targetMl
      : waterTargetMl(profile.bodyweightKg, profile.nutrition?.activity ?? 'moderate');

  // Unlogged days render as chart gaps (null), not misleading zero intake.
  const chartData = useMemo(
    () =>
      fillGaps(days, period).map((d) => ({
        date: new Date(`${d.date}T12:00`).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        kcal: d.logged ? Math.round(d.macros.kcal) : null,
        protein: d.logged ? Math.round(d.macros.proteinG) : null,
      })),
    [days, period],
  );

  if (allDays.length === 0) {
    return (
      <div>
        <PageTitle title="Nutrition Trends" sub="Averages and daily intake over time." />
        <EmptyState title="No Meals Logged Yet">
          Log a few days of food in Fuel and your average intake, daily calories, and protein
          trends will appear here.
        </EmptyState>
      </div>
    );
  }

  const loggedDays = days.filter((d) => d.logged).length;

  return (
    <div>
      <PageTitle
        title="Nutrition Trends"
        sub={`Averages across ${loggedDays} logged day${loggedDays === 1 ? '' : 's'} — unlogged days don't drag the numbers down.`}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PERIODS.map(([d, label]) => (
          <Chip key={label} active={period === d} onClick={() => setPeriod(d)} color="var(--amber)">
            {label}
          </Chip>
        ))}
      </div>

      {avg ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile
            label="Avg kcal / day"
            value={Math.round(avg.kcal)}
            unit={targets ? `/ ${targets.kcal}` : undefined}
            color="var(--amber)"
          />
          <StatTile
            label="Avg protein / day"
            value={Math.round(avg.proteinG)}
            unit={targets ? `/ ${targets.proteinG} g` : 'g'}
            color="var(--cyan)"
          />
          <StatTile
            label="Avg carbs / day"
            value={Math.round(avg.carbsG)}
            unit={targets ? `/ ${targets.carbsG} g` : 'g'}
            color="var(--violet)"
          />
          <StatTile
            label="Avg fat / day"
            value={Math.round(avg.fatG)}
            unit={targets ? `/ ${targets.fatG} g` : 'g'}
            color="var(--ink)"
          />
          <StatTile
            label="Avg water / day"
            value={avgWaterMl !== null ? (avgWaterMl / 1000).toFixed(1) : '—'}
            unit={`/ ${(waterTarget / 1000).toFixed(1)} L`}
            color="var(--up)"
          />
        </div>
      ) : (
        <div className="mb-4">
          <EmptyState title="Nothing In This Period">
            No meals logged in the selected window — pick a longer period.
          </EmptyState>
        </div>
      )}

      <HudPanel className="mb-4 p-4" label="DAILY CALORIES" bracketColor="var(--amber)">
        <div className="h-56 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--ink-faint)', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--amber)' }}
                formatter={(v) => [`${Number(v)} kcal`, 'Intake']}
                cursor={{ fill: 'rgba(120,200,255,0.06)' }}
              />
              {targets && (
                <ReferenceLine
                  y={targets.kcal}
                  stroke="var(--amber)"
                  strokeDasharray="5 4"
                  label={{ value: 'target', fill: 'var(--amber)', fontSize: 9, position: 'insideTopRight' }}
                />
              )}
              <Bar dataKey="kcal" fill="var(--amber)" fillOpacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      <HudPanel className="p-4" label="DAILY PROTEIN">
        <div className="h-56 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="proteinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--ink-faint)', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tick={{ fill: 'var(--ink-faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--cyan)' }}
                formatter={(v) => [`${Number(v)} g`, 'Protein']}
              />
              {targets && (
                <ReferenceLine
                  y={targets.proteinG}
                  stroke="var(--cyan)"
                  strokeDasharray="5 4"
                  label={{ value: 'target', fill: 'var(--cyan)', fontSize: 9, position: 'insideTopRight' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="protein"
                stroke="var(--cyan)"
                strokeWidth={2}
                fill="url(#proteinGrad)"
                dot={{ r: 2, fill: 'var(--cyan)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </HudPanel>

      <p className="mt-4 text-center text-[10px] text-[var(--ink-faint)]">
        Averages count only days with at least one logged food. Dashed lines mark your current
        targets.
      </p>
    </div>
  );
}
