import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageTitle } from '@/components/common';
import { HudButton, HudPanel, Modal, Tag } from '@/components/hud';
import { IconCheck, IconProgram } from '@/components/icons';
import { db } from '@/db/db';
import type { StoredProgram, Workout } from '@/db/types';
import { useExercises, useFinishedWorkouts } from '@/hooks/useLive';
import { uid } from '@/lib/id';
import { buildProgramDay } from '@/lib/programRun';
import { persistProgram, removeProgram } from '@/sync/local';
import { EXAMPLE_PROGRAMS } from '@/fixtures/programs';
import { parseProgramJSON, type Program } from '@/schema/program';
import { useAppStore } from '@/store/useAppStore';

export function ProgramsPage() {
  const programs = useLiveQuery(() => db.programs.orderBy('importedAt').reverse().toArray(), [], []) ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const [viewing, setViewing] = useState<StoredProgram | null>(null);

  const importProgram = async (program: Program) => {
    const stored: StoredProgram = {
      id: uid('prog'),
      name: program.name,
      author: program.author,
      description: program.description,
      units: program.units,
      data: program,
      importedAt: Date.now(),
    };
    await persistProgram(stored);
  };

  return (
    <div>
      <PageTitle
        title="Programs"
        sub="Follow structured programs with adaptive load suggestions."
        right={<HudButton onClick={() => setImportOpen(true)}>Import</HudButton>}
      />

      <HudPanel className="mb-4 p-4" label="EXAMPLE PROGRAMS" bracketColor="var(--violet)">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {EXAMPLE_PROGRAMS.map(({ key, program }) => (
            <div key={key} className="chamfer border border-[var(--line)] bg-[rgba(120,200,255,0.03)] p-3">
              <div className="text-[13px] font-semibold text-[var(--ink)]">{program.name}</div>
              <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-[var(--ink-dim)]">
                {program.description}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Tag color="var(--cyan)">{program.weeks.length}w</Tag>
                <Tag>{program.units}</Tag>
              </div>
              <HudButton
                variant="ghost"
                sheen={false}
                className="mt-3 w-full !min-h-[36px]"
                onClick={() => void importProgram(program)}
              >
                Add to Library
              </HudButton>
            </div>
          ))}
        </div>
      </HudPanel>

      <h2 className="font-head mb-3 mt-6 text-[11px] tracking-[0.2em] text-[var(--ink-faint)]">
        MY PROGRAMS
      </h2>
      {programs.length === 0 ? (
        <HudPanel className="p-6 text-center">
          <IconProgram size={28} className="mx-auto text-[var(--ink-faint)]" />
          <div className="mt-2 text-[13px] text-[var(--ink-dim)]">
            No programs yet. Add an example above or import your own JSON.
          </div>
        </HudPanel>
      ) : (
        <div className="grid gap-3">
          {programs.map((p) => (
            <ProgramRow key={p.id} program={p} onView={() => setViewing(p)} />
          ))}
        </div>
      )}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={importProgram} />
      <FollowModal program={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function ProgramRow({ program, onView }: { program: StoredProgram; onView: () => void }) {
  const active = program.active;
  const setActive = async () => {
    const all = await db.programs.toArray();
    // Deactivate any other active program, then toggle this one.
    for (const p of all) {
      if (p.active && p.id !== program.id) await persistProgram({ ...p, active: false });
    }
    await persistProgram({ ...program, active: !active });
  };
  const remove = async () => {
    if (confirm(`Delete program "${program.name}"?`)) await removeProgram(program.id);
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(program.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = program.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const data = program.data as Program;

  return (
    <HudPanel className="p-4" glow={active} bracketColor={active ? 'var(--amber)' : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[var(--ink)]">{program.name}</span>
            {active && (
              <span className="font-head rounded-[2px] border border-[var(--amber)] px-1.5 py-0.5 text-[8px] tracking-widest text-[var(--amber)]">
                ACTIVE
              </span>
            )}
          </div>
          {program.author && <div className="mono text-[10px] text-[var(--ink-faint)]">by {program.author}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <Tag color="var(--cyan)">{data.weeks.length} weeks</Tag>
            <Tag color="var(--violet)">{data.weeks.reduce((n, w) => n + w.days.length, 0)} days</Tag>
            <Tag>{program.units}</Tag>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <HudButton className="!min-h-[38px]" onClick={onView}>
          <IconCheck size={14} /> Follow
        </HudButton>
        <HudButton variant="ghost" sheen={false} className="!min-h-[38px]" onClick={setActive}>
          {active ? 'Unpin' : 'Set Active'}
        </HudButton>
        <HudButton variant="ghost" sheen={false} className="!min-h-[38px]" onClick={exportJSON}>
          Export
        </HudButton>
        <HudButton variant="danger" sheen={false} className="!min-h-[38px]" onClick={remove}>
          Delete
        </HudButton>
      </div>
    </HudPanel>
  );
}

function FollowModal({ program, onClose }: { program: StoredProgram | null; onClose: () => void }) {
  const exercises = useExercises();
  const workouts = useFinishedWorkouts();
  const profile = useAppStore((s) => s.profile);
  const startSession = useAppStore((s) => s.startSession);
  const active = useAppStore((s) => s.active);
  const navigate = useNavigate();
  const [openWeek, setOpenWeek] = useState(0);

  if (!program) return null;
  const data = program.data as Program;

  const startDay = (weekIndex: number, dayIndex: number) => {
    if (active) {
      alert('Finish or discard your current session first.');
      return;
    }
    const built = buildProgramDay(data, weekIndex, dayIndex, exercises, workouts, profile);
    const day = data.weeks[weekIndex].days[dayIndex];
    const w: Workout = {
      id: uid('wk'),
      startedAt: Date.now(),
      title: `${program.name} — ${data.weeks[weekIndex].name} · ${day.name}`,
      entries: built.entries,
      programId: program.id,
      weekIndex,
      dayIndex,
      bodyweightKgAtTime: profile.bodyweightKg,
    };
    if (built.unmatched.length) {
      alert(`Note: these exercises weren't found in the library and were skipped:\n${built.unmatched.join(', ')}`);
    }
    if (startSession(w)) {
      onClose();
      navigate('/workout');
    }
  };

  return (
    <Modal open={!!program} onClose={onClose} title={program.name} wide>
      {program.description && (
        <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">{program.description}</p>
      )}
      <div className="flex flex-col gap-2">
        {data.weeks.map((week, wi) => (
          <div key={wi} className="chamfer border border-[var(--line)]">
            <button
              onClick={() => setOpenWeek(openWeek === wi ? -1 : wi)}
              className="font-head flex w-full items-center justify-between px-3 py-2.5 text-[11px] tracking-[0.16em] text-[var(--cyan)]"
            >
              {week.name}
              <span className="text-[var(--ink-faint)]">{openWeek === wi ? '−' : '+'}</span>
            </button>
            {openWeek === wi && (
              <div className="flex flex-col gap-2 px-3 pb-3">
                {week.days.map((day, di) => (
                  <div key={di} className="border-t border-[var(--line)] pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[var(--ink)]">{day.name}</span>
                      <HudButton
                        variant="accent"
                        sheen={false}
                        className="!min-h-[34px] !px-3 !text-[10px]"
                        onClick={() => startDay(wi, di)}
                      >
                        Start Day
                      </HudButton>
                    </div>
                    <ul className="mono mt-1.5 flex flex-col gap-0.5">
                      {day.exercises.map((ex, ei) => (
                        <li key={ei} className="flex items-center justify-between text-[11.5px] text-[var(--ink-dim)]">
                          <span>{ex.exerciseName}</span>
                          <span className="text-[var(--ink-faint)]">
                            {ex.sets}×{Array.isArray(ex.reps) ? ex.reps.join('–') : ex.reps}
                            {ex.intensity
                              ? ex.intensity.type === 'rpe'
                                ? ` @RPE${ex.intensity.value}`
                                : ex.intensity.type === 'percent1rm'
                                  ? ` @${ex.intensity.value}%`
                                  : ` @${ex.intensity.value}${program.units}`
                              : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (p: Program) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState<Program | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const validate = (raw: string) => {
    setText(raw);
    setOk(null);
    setErrors([]);
    if (!raw.trim()) return;
    const res = parseProgramJSON(raw);
    if (res.ok && res.program) setOk(res.program);
    else setErrors(res.errors ?? ['Unknown error']);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const raw = await f.text();
    validate(raw);
  };

  const doImport = async () => {
    if (!ok) return;
    await onImport(ok);
    setText('');
    setOk(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Program (JSON)" wide>
      <div className="flex flex-col gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <HudButton variant="ghost" sheen={false} onClick={() => fileRef.current?.click()}>
            Upload .json
          </HudButton>
        </div>
        <textarea
          value={text}
          onChange={(e) => validate(e.target.value)}
          placeholder='Paste program JSON here… (see DECISIONS.md §4 for the schema)'
          className="mono h-56 w-full resize-none rounded-[3px] border border-[var(--line-strong)] bg-[rgba(5,9,20,0.6)] p-3 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--cyan)]"
        />
        {errors.length > 0 && (
          <div className="chamfer border border-[var(--down)] bg-[rgba(255,90,114,0.08)] p-3">
            <div className="font-head mb-1 text-[10px] tracking-widest text-[var(--down)]">
              VALIDATION FAILED
            </div>
            <ul className="mono list-inside list-disc text-[11px] text-[var(--down)]">
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {ok && (
          <div className="chamfer border border-[var(--up)] bg-[rgba(56,247,176,0.08)] p-3 text-[12px] text-[var(--up)]">
            ✓ Valid: <strong>{ok.name}</strong> — {ok.weeks.length} weeks,{' '}
            {ok.weeks.reduce((n, w) => n + w.days.length, 0)} days.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <HudButton variant="ghost" onClick={onClose}>
            Cancel
          </HudButton>
          <HudButton onClick={doImport} disabled={!ok}>
            Import
          </HudButton>
        </div>
      </div>
    </Modal>
  );
}
