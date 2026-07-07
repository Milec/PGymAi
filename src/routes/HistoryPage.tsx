import { useMemo, useState } from 'react';
import { PageTitle, EmptyState } from '@/components/common';
import { HudButton, HudPanel, Tag } from '@/components/hud';
import { IconCalendar, IconChevronL, IconChevronR, IconClock, IconTrash } from '@/components/icons';
import { useExerciseMap, useFinishedWorkouts } from '@/hooks/useLive';
import type { Workout } from '@/db/types';
import { estimate1rm } from '@/lib/e1rm';
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
  const profile = useAppStore((s) => s.profile);
  const unit = profile.units;

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

  const shown = selectedDay ? (byDay.get(selectedDay) ?? []) : sorted;
  const totalMonth = cells.filter(
    (c) => c !== null && byDay.has(`${view.y}-${view.m}-${c}`),
  ).length;

  if (workouts.length === 0) {
    return (
      <div>
        <PageTitle title="Training Log" sub="Your finished sessions and calendar." />
        <EmptyState title="No Sessions Yet">
          Finish a workout and it will appear here — with a calendar of your training days and a
          full, browsable log of every session.
        </EmptyState>
      </div>
    );
  }

  const todayKey = dayKey(Date.now());

  return (
    <div>
      <PageTitle
        title="Training Log"
        sub={`${workouts.length} session${workouts.length === 1 ? '' : 's'} logged.`}
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
            const isToday = k === todayKey;
            const isSel = k === selectedDay;
            return (
              <button
                key={k}
                onClick={() => trained && setSelectedDay(isSel ? null : k)}
                disabled={!trained}
                className="chamfer relative flex aspect-square flex-col items-center justify-center text-[12px] transition-all"
                style={{
                  cursor: trained ? 'pointer' : 'default',
                  color: trained ? 'var(--space-0)' : 'var(--ink-faint)',
                  background: isSel
                    ? 'var(--amber)'
                    : trained
                      ? 'var(--cyan)'
                      : 'rgba(120,200,255,0.04)',
                  border: isToday ? '1px solid var(--amber)' : '1px solid var(--line)',
                  boxShadow: trained ? '0 0 10px rgba(56,225,255,0.35)' : 'none',
                  fontWeight: trained ? 700 : 400,
                }}
              >
                <span className="mono leading-none">{day}</span>
                {count > 1 && (
                  <span className="mono absolute bottom-0.5 text-[7px] leading-none">×{count}</span>
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
      </div>
    </div>
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
