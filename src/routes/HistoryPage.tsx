import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle, EmptyState } from '@/components/common';
import { HudButton, HudPanel, Tag } from '@/components/hud';
import {
  IconCalendar,
  IconChevronL,
  IconChevronR,
  IconClock,
  IconFuel,
  IconTrash,
} from '@/components/icons';
import { useAllFoodLogs, useExerciseMap, useFinishedWorkouts } from '@/hooks/useLive';
import type { FoodLogEntry, Workout } from '@/db/types';
import { estimate1rm } from '@/lib/e1rm';
import {
  EMPTY_MACROS,
  MEALS,
  addMacros,
  dateKey,
  macrosForAmount,
  type MacroSet,
} from '@/lib/nutrition';
import { formatDuration } from '@/lib/time';
import { formatWeight, fromKg, type Unit } from '@/lib/units';
import { removeWorkout } from '@/sync/local';
import { useAppStore } from '@/store/useAppStore';

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface Summary {
  durationSec: number;
  volumeKg: number;
  sets: number;
  exercises: number;
}
function summarize(w: Workout): Summary {
  let volumeKg = 0;
  let sets = 0;
  for (const e of w.entries) {
    for (const s of e.sets) {
      if (s.reps > 0) {
        volumeKg += s.weightKg * s.reps;
        sets += 1;
      }
    }
  }
  const durationSec = w.finishedAt ? Math.max(0, Math.round((w.finishedAt - w.startedAt) / 1000)) : 0;
  return { durationSec, volumeKg, sets, exercises: w.entries.length };
}

export function HistoryPage() {
  const workouts = useFinishedWorkouts();
  const foodLogs = useAllFoodLogs();
  const profile = useAppStore((s) => s.profile);
  const unit = profile.units;
  const navigate = useNavigate();

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [workouts],
  );

  // date-key -> workouts that day
  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of sorted) {
      const k = dayKey(w.finishedAt ?? w.startedAt);
      const list = map.get(k);
      if (list) list.push(w);
      else map.set(k, [w]);
    }
    return map;
  }, [sorted]);

  // YYYY-MM-DD -> food entries that day (journal dates are already local keys).
  const byDayFood = useMemo(() => {
    const map = new Map<string, FoodLogEntry[]>();
    for (const e of foodLogs) {
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [foodLogs]);

  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const cells = useMemo(() => buildMonth(view.y, view.m), [view]);
  const monthLabel = new Date(view.y, view.m).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const changeMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setSelectedDay(null);
  };

  // The nutrition journal keys days as YYYY-MM-DD; the calendar keys them as
  // y-m-d (0-based month). Bridge per cell.
  const fuelKeyFor = (day: number) => dateKey(new Date(view.y, view.m, day));
  const selFuelKey = selectedDay ? fuelKeyFor(Number(selectedDay.split('-')[2])) : null;
  const selFood = selFuelKey ? (byDayFood.get(selFuelKey) ?? []) : [];

  const shown = selectedDay ? (byDay.get(selectedDay) ?? []) : sorted;
  const totalMonth = cells.filter(
    (c) => c !== null && (byDay.has(`${view.y}-${view.m}-${c}`) || byDayFood.has(fuelKeyFor(c))),
  ).length;

  if (workouts.length === 0 && foodLogs.length === 0) {
    return (
      <div>
        <PageTitle title="Activity Log" sub="Training sessions and meals, by calendar day." />
        <EmptyState title="Nothing Logged Yet">
          Finish a workout or log a meal in Fuel and it will appear here — with a calendar of your
          active days and a full, browsable log.
        </EmptyState>
      </div>
    );
  }

  const todayKey = dayKey(Date.now());

  return (
    <div>
      <PageTitle
        title="Activity Log"
        sub={`${workouts.length} session${workouts.length === 1 ? '' : 's'} logged · tap a day for its training + meals.`}
      />

      <HudPanel className="mb-4 p-4" label="CALENDAR">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--ink-dim)] hover:border-[var(--cyan)] hover:text-[var(--cyan)]"
            aria-label="Previous month"
          >
            <IconChevronL size={16} />
          </button>
          <div className="flex items-center gap-2">
            <IconCalendar size={16} className="text-[var(--cyan)]" />
            <span className="font-head text-[12px] tracking-[0.16em] text-[var(--ink)]">
              {monthLabel}
            </span>
            <span className="mono text-[10px] text-[var(--ink-faint)]">· {totalMonth}d</span>
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--ink-dim)] hover:border-[var(--cyan)] hover:text-[var(--cyan)]"
            aria-label="Next month"
          >
            <IconChevronR size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className="font-head pb-1 text-center text-[9px] tracking-widest text-[var(--ink-faint)]">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const k = `${view.y}-${view.m}-${day}`;
            const count = byDay.get(k)?.length ?? 0;
            const trained = count > 0;
            const fueled = byDayFood.has(fuelKeyFor(day));
            const active = trained || fueled;
            const isToday = k === todayKey;
            const isSel = k === selectedDay;
            return (
              <button
                key={k}
                onClick={() => active && setSelectedDay(isSel ? null : k)}
                disabled={!active}
                aria-label={`Select day ${day}`}
                className="chamfer relative flex aspect-square flex-col items-center justify-center text-[12px] transition-all"
                style={{
                  cursor: active ? 'pointer' : 'default',
                  color: isSel || trained ? 'var(--space-0)' : fueled ? 'var(--ink-dim)' : 'var(--ink-faint)',
                  background: isSel
                    ? 'var(--amber)'
                    : trained
                      ? 'var(--cyan)'
                      : 'rgba(120,200,255,0.04)',
                  border: isToday ? '1px solid var(--amber)' : '1px solid var(--line)',
                  boxShadow: trained ? '0 0 10px rgba(56,225,255,0.35)' : 'none',
                  fontWeight: active ? 700 : 400,
                }}
              >
                <span className="mono leading-none">{day}</span>
                {count > 1 && (
                  <span className="mono absolute bottom-0.5 text-[7px] leading-none">×{count}</span>
                )}
                {fueled && !isSel && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 left-1 h-[4px] w-[4px] rounded-full"
                    style={{ background: 'var(--violet)', boxShadow: '0 0 5px var(--violet)' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--ink-faint)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: 'var(--cyan)' }} />
            trained
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--violet)' }} />
            meals
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-[var(--amber)]" />
            today
          </span>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="ml-auto text-[var(--cyan)] underline">
              show all sessions
            </button>
          )}
        </div>
      </HudPanel>

      {selectedDay && selFuelKey && selFood.length > 0 && (
        <FuelDayPanel
          entries={selFood}
          targetKcal={profile.nutrition?.targets.kcal}
          onOpen={() => navigate(`/fuel?date=${selFuelKey}`)}
        />
      )}

      <h2 className="font-head mb-3 text-[11px] tracking-[0.2em] text-[var(--ink-faint)]">
        {selectedDay
          ? new Date(view.y, view.m, Number(selectedDay.split('-')[2])).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })
          : 'ALL SESSIONS'}
      </h2>

      <div className="flex flex-col gap-3">
        {shown.map((w) => (
          <SessionCard key={w.id} workout={w} unit={unit} />
        ))}
        {selectedDay && shown.length === 0 && (
          <p className="text-[12px] text-[var(--ink-faint)]">No training session this day.</p>
        )}
      </div>
    </div>
  );
}

/** Compact meal breakdown for one calendar day, with a jump into Fuel. */
function FuelDayPanel({
  entries,
  targetKcal,
  onOpen,
}: {
  entries: FoodLogEntry[];
  targetKcal?: number;
  onOpen: () => void;
}) {
  const totals = entries.reduce<MacroSet>(
    (acc, e) => addMacros(acc, macrosForAmount(e.per100, e.amountG)),
    EMPTY_MACROS,
  );
  return (
    <HudPanel className="mb-4 p-4" label="FUEL" bracketColor="var(--violet)">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="mono text-[12px] text-[var(--ink)]">
          <span className="font-semibold text-[var(--amber)]">{Math.round(totals.kcal)}</span>
          {targetKcal ? <span className="text-[var(--ink-faint)]"> / {targetKcal}</span> : null}{' '}
          kcal
          <span className="ml-2 text-[10px] text-[var(--ink-dim)]">
            P {Math.round(totals.proteinG)} · C {Math.round(totals.carbsG)} · F {Math.round(totals.fatG)}
          </span>
        </span>
        <HudButton
          variant="ghost"
          sheen={false}
          className="!min-h-[34px] !px-3 !text-[10px]"
          onClick={onOpen}
        >
          <IconFuel size={13} /> Open in Fuel
        </HudButton>
      </div>
      <div className="flex flex-col gap-1.5">
        {MEALS.map((meal) => {
          const list = entries.filter((e) => e.meal === meal.id);
          if (list.length === 0) return null;
          const kcal = list.reduce((s, e) => s + macrosForAmount(e.per100, e.amountG).kcal, 0);
          return (
            <div key={meal.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="font-head mr-2 text-[9px] tracking-[0.18em] text-[var(--violet)]">
                  {meal.label.toUpperCase()}
                </span>
                <span className="text-[12px] text-[var(--ink-dim)]">
                  {list.map((e) => e.name).join(' · ')}
                </span>
              </span>
              <span className="mono shrink-0 text-[11px] text-[var(--ink-dim)]">
                {Math.round(kcal)}
              </span>
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}

function buildMonth(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  return cells;
}

function SessionCard({ workout, unit }: { workout: Workout; unit: Unit }) {
  const exMap = useExerciseMap();
  const [open, setOpen] = useState(false);
  const s = useMemo(() => summarize(workout), [workout]);
  const date = new Date(workout.finishedAt ?? workout.startedAt);

  const del = async () => {
    if (confirm('Delete this session from your log? This cannot be undone.')) {
      await removeWorkout(workout.id);
    }
  };

  return (
    <HudPanel className="p-4" brackets={false}>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[var(--ink)]">{workout.title}</div>
          <div className="mono mt-0.5 text-[11px] text-[var(--ink-faint)]">
            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <span className="mono shrink-0 text-[var(--ink-faint)]">{open ? '▲' : '▼'}</span>
      </button>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MiniStat label="Time" value={formatDuration(s.durationSec)} icon={<IconClock size={12} />} />
        <MiniStat label="Volume" value={`${Math.round(fromKg(s.volumeKg, unit)).toLocaleString()}`} suffix={unit} />
        <MiniStat label="Sets" value={String(s.sets)} />
        <MiniStat label="Lifts" value={String(s.exercises)} />
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-3">
          {workout.entries.map((e) => {
            const ex = exMap.get(e.exerciseId);
            const done = e.sets.filter((st) => st.reps > 0);
            let best = 0;
            for (const st of done) best = Math.max(best, estimate1rm(st.weightKg, st.reps));
            return (
              <div key={e.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--ink)]">
                    {ex?.name ?? e.exerciseId}
                  </span>
                  {best > 0 && (
                    <Tag color="var(--amber)">e1RM {formatWeight(best, unit)} {unit}</Tag>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {done.map((st, i) => (
                    <span
                      key={st.id}
                      className="mono rounded-[2px] border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--ink-dim)]"
                    >
                      <span className="text-[var(--ink-faint)]">{i + 1}·</span>{' '}
                      {st.weightKg > 0 ? (
                        <>
                          {formatWeight(st.weightKg, unit)}
                          <span className="text-[var(--ink-faint)]">{unit}</span>
                        </>
                      ) : (
                        <span className="text-[var(--ink-faint)]">BW</span>
                      )}{' '}
                      × {st.reps}
                      {st.rpe ? <span className="text-[var(--violet)]"> @{st.rpe}</span> : ''}
                    </span>
                  ))}
                  {done.length === 0 && (
                    <span className="text-[11px] text-[var(--ink-faint)]">No completed sets.</span>
                  )}
                </div>
                {e.notes && <div className="mono mt-1 text-[10px] text-[var(--ink-faint)]">{e.notes}</div>}
              </div>
            );
          })}
          <div className="flex justify-end">
            <HudButton variant="danger" sheen={false} className="!min-h-[34px] !px-3 !text-[10px]" onClick={del}>
              <IconTrash size={13} /> Delete session
            </HudButton>
          </div>
        </div>
      )}
    </HudPanel>
  );
}

function MiniStat({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="chamfer border border-[var(--line)] bg-[rgba(120,200,255,0.03)] px-2 py-1.5">
      <div className="font-head flex items-center gap-1 text-[8px] tracking-widest text-[var(--ink-faint)]">
        {icon}
        {label}
      </div>
      <div className="mono mt-0.5 text-[13px] font-semibold text-[var(--ink)]">
        {value}
        {suffix && <span className="ml-0.5 text-[9px] text-[var(--ink-faint)]">{suffix}</span>}
      </div>
    </div>
  );
}
