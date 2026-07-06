import { STRENGTH_LEVELS, type RatioBands, type StrengthLevel } from '@/data/strengthStandards';

interface Props {
  bands: RatioBands;
  /** User's current ratio (lift/bw). */
  ratio: number;
  /** Reference "average" ratio marker (Novice ceiling). */
  averageRatio: number;
  level: StrengthLevel;
}

const LEVEL_COLOR: Record<StrengthLevel, string> = {
  Untrained: '#5c6f8f',
  Novice: '#38e1ff',
  Intermediate: '#57d9a3',
  Advanced: '#a26bff',
  Elite: '#ffb020',
};

/** Horizontal labeled band scale with the user's glowing marker. */
export function BandScale({ bands, ratio, averageRatio, level }: Props) {
  // Scale runs from 0 to a bit beyond Elite so Elite has visible room.
  const max = bands.Elite * 1.2;
  const pct = (r: number) => `${Math.min(100, Math.max(0, (r / max) * 100))}%`;

  return (
    <div className="w-full select-none">
      {/* the bar */}
      <div className="relative h-9 w-full overflow-hidden rounded-[3px] border border-[var(--line)]">
        {STRENGTH_LEVELS.map((lvl, i) => {
          const start = bands[lvl];
          const end = i < STRENGTH_LEVELS.length - 1 ? bands[STRENGTH_LEVELS[i + 1]] : max;
          const left = (start / max) * 100;
          const width = ((end - start) / max) * 100;
          return (
            <div
              key={lvl}
              className="absolute top-0 h-full"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: `linear-gradient(180deg, ${LEVEL_COLOR[lvl]}22, ${LEVEL_COLOR[lvl]}44)`,
                borderLeft: i === 0 ? 'none' : `1px solid ${LEVEL_COLOR[lvl]}66`,
              }}
            />
          );
        })}

        {/* average reference marker */}
        <div
          className="absolute top-0 h-full w-[2px]"
          style={{ left: pct(averageRatio), background: 'rgba(232,243,255,0.55)' }}
          title="Average reference"
        />

        {/* user marker */}
        <div
          className="absolute top-[-3px] z-10 h-[calc(100%+6px)] w-[3px]"
          style={{
            left: pct(ratio),
            background: LEVEL_COLOR[level],
            boxShadow: `0 0 10px ${LEVEL_COLOR[level]}, 0 0 4px ${LEVEL_COLOR[level]}`,
          }}
        />
      </div>

      {/* labels */}
      <div className="mt-1 flex justify-between">
        {STRENGTH_LEVELS.map((lvl) => (
          <span
            key={lvl}
            className="font-head text-[8px] tracking-[0.12em]"
            style={{ color: lvl === level ? LEVEL_COLOR[lvl] : 'var(--ink-faint)' }}
          >
            {lvl.slice(0, 4)}
          </span>
        ))}
      </div>
    </div>
  );
}
