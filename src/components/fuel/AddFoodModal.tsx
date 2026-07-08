import { useEffect, useState } from 'react';
import { IconScan, IconSearch } from '@/components/icons';
import { Chip, Field, HudButton, HudInput, Modal, Tag } from '@/components/hud';
import type { SavedFood } from '@/db/types';
import { FoodApiError, lookupBarcode, searchFoods, type ApiFood } from '@/lib/foodApi';
import { logFood } from '@/lib/fuelLog';
import { MEALS, type MacroSet, type MealId } from '@/lib/nutrition';
import { useSavedFoods } from '@/hooks/useLive';
import { BarcodeScanner } from './BarcodeScanner';
import { QuantityEditor, fmtG } from './QuantityEditor';

/** A food chosen but not yet logged — the quantity step operates on this. */
interface PendingFood {
  name: string;
  brand?: string;
  per100: MacroSet;
  servingG?: number;
  barcode?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  initialMeal: MealId;
}

/** The add-food flow. Mount it fresh per use (the Fuel page conditionally
 * renders it), so all state initialises from props — no reset effects. */
export function AddFoodModal({ open, onClose, date, initialMeal }: Props) {
  const [view, setView] = useState<'pick' | 'quantity' | 'manual'>('pick');
  const [meal, setMeal] = useState<MealId>(initialMeal);
  const [selected, setSelected] = useState<PendingFood | null>(null);
  const [amountG, setAmountG] = useState(100);
  const [scanning, setScanning] = useState(false);
  const [lookup, setLookup] = useState<'idle' | 'busy' | 'missing' | 'error'>('idle');

  const pick = (f: PendingFood) => {
    setSelected(f);
    setAmountG(f.servingG ?? 100);
    setView('quantity');
  };

  const onBarcode = (code: string) => {
    setScanning(false);
    setLookup('busy');
    lookupBarcode(code)
      .then((food) => {
        if (food) {
          setLookup('idle');
          pick(food);
        } else {
          setLookup('missing');
        }
      })
      .catch(() => setLookup('error'));
  };

  const save = async () => {
    if (!selected || amountG <= 0) return;
    await logFood({ date, meal, ...selected, amountG });
    onClose();
  };

  return (
    <>
      <Modal
        open={open && !scanning}
        onClose={onClose}
        title={view === 'quantity' ? 'LOG AMOUNT' : view === 'manual' ? 'CUSTOM FOOD' : 'LOG FOOD'}
      >
        {view === 'pick' && (
          <PickView
            onPick={pick}
            onScan={() => {
              setLookup('idle');
              setScanning(true);
            }}
            onManual={() => setView('manual')}
            lookup={lookup}
          />
        )}

        {view === 'manual' && <ManualView onBack={() => setView('pick')} onPick={pick} />}

        {view === 'quantity' && selected && (
          <div>
            <button
              className="font-head mb-1 text-[10px] tracking-[0.2em] text-[var(--ink-faint)] hover:text-[var(--cyan)]"
              onClick={() => setView('pick')}
            >
              ‹ BACK TO SEARCH
            </button>
            <div className="mb-3">
              <div className="text-[15px] font-semibold text-[var(--ink)]">{selected.name}</div>
              <div className="mt-1 flex items-center gap-2">
                {selected.brand && <Tag>{selected.brand}</Tag>}
                <span className="mono text-[10px] text-[var(--ink-faint)]">
                  {Math.round(selected.per100.kcal)} kcal / 100g
                </span>
              </div>
            </div>
            <QuantityEditor
              per100={selected.per100}
              servingG={selected.servingG}
              amountG={amountG}
              onChange={setAmountG}
            />
            <div className="mt-4">
              <div className="font-head mb-2 text-[10px] tracking-[0.2em] text-[var(--ink-faint)]">
                MEAL
              </div>
              <div className="flex flex-wrap gap-2">
                {MEALS.map((m) => (
                  <Chip key={m.id} active={meal === m.id} onClick={() => setMeal(m.id)} color="var(--amber)">
                    {m.label}
                  </Chip>
                ))}
              </div>
            </div>
            <HudButton className="mt-5 w-full" onClick={() => void save()} disabled={amountG <= 0}>
              Log to {MEALS.find((m) => m.id === meal)?.label}
            </HudButton>
          </div>
        )}
      </Modal>

      {scanning && (
        <BarcodeScanner onClose={() => setScanning(false)} onDetected={onBarcode} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function PickView({
  onPick,
  onScan,
  onManual,
  lookup,
}: {
  onPick: (f: PendingFood) => void;
  onScan: () => void;
  onManual: () => void;
  lookup: 'idle' | 'busy' | 'missing' | 'error';
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiFood[]>([]);
  const [state, setState] = useState<'idle' | 'busy' | 'error' | 'rate' | 'done'>('idle');
  const saved = useSavedFoods();

  const q = query.trim();

  // Debounced live search against the Open Food Facts catalogue. All state
  // updates happen inside the (async) timer so typing never cascades renders.
  // The debounce is deliberately long and the client caches + retries: the
  // public search endpoint rate-limits aggressively (~10 req/min).
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(
      () => {
        if (q.length < 3) {
          setResults([]);
          setState('idle');
          return;
        }
        setState('busy');
        searchFoods(q, ctl.signal)
          .then((r) => {
            setResults(r);
            setState('done');
          })
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            // Keep whatever results are already on screen — a transient
            // failure shouldn't blank the list mid-search.
            setState(err instanceof FoodApiError && err.rateLimited ? 'rate' : 'error');
          });
      },
      q.length < 3 ? 0 : 600,
    );
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const savedMatches = q
    ? saved.filter((f) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    : saved;

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]">
            <IconSearch size={15} />
          </span>
          <HudInput
            autoFocus
            className="pl-9"
            placeholder="Search foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search foods"
          />
        </div>
        <HudButton variant="accent" sheen={false} className="px-3" onClick={onScan} aria-label="Scan barcode">
          <IconScan size={19} />
        </HudButton>
      </div>

      {lookup === 'busy' && (
        <p className="mt-3 animate-pulse text-[12px] text-[var(--cyan)]">Looking up barcode…</p>
      )}
      {lookup === 'missing' && (
        <p className="mt-3 text-[12px] text-[var(--amber)]">
          That barcode isn't in the catalogue yet — search by name or add it as a custom food.
        </p>
      )}
      {lookup === 'error' && (
        <p className="mt-3 text-[12px] text-[var(--down)]">Barcode lookup failed — check your connection.</p>
      )}

      <div className="mt-3 max-h-[46vh] space-y-1 overflow-y-auto">
        {q.length >= 3 ? (
          <>
            {savedMatches.slice(0, 3).map((f) => (
              <FoodRow key={f.id} food={f} tag={f.custom ? 'custom' : 'recent'} onPick={onPick} />
            ))}
            {state === 'busy' && (
              <p className="animate-pulse px-1 py-3 text-[12px] text-[var(--cyan)]">
                Searching catalogue…
              </p>
            )}
            {state === 'rate' && (
              <p className="px-1 py-3 text-[12px] text-[var(--amber)]">
                The catalogue is busy — pause a few seconds, then edit your search to retry. Your
                saved foods and barcode scanning still work.
              </p>
            )}
            {state === 'error' && (
              <p className="px-1 py-3 text-[12px] text-[var(--down)]">
                Catalogue unreachable — you're offline or the service is down. Your saved foods
                still work.
              </p>
            )}
            {state === 'done' && results.length === 0 && (
              <p className="px-1 py-3 text-[12px] text-[var(--ink-dim)]">
                No catalogue matches. Try a simpler term, or add it as a custom food.
              </p>
            )}
            {results.map((f) => (
              <FoodRow key={f.barcode} food={f} onPick={onPick} />
            ))}
          </>
        ) : saved.length > 0 ? (
          <>
            <div className="font-head px-1 pb-1 pt-2 text-[9px] tracking-[0.22em] text-[var(--ink-faint)]">
              RECENT &amp; MY FOODS
            </div>
            {saved.slice(0, 12).map((f) => (
              <FoodRow key={f.id} food={f} tag={f.custom ? 'custom' : undefined} onPick={onPick} />
            ))}
          </>
        ) : (
          <p className="px-1 py-4 text-[12px] leading-relaxed text-[var(--ink-dim)]">
            Search the Open Food Facts catalogue (millions of products), scan a barcode, or create
            a custom food. Foods you log are kept here for quick re-logging.
          </p>
        )}
      </div>

      <button
        className="font-head mt-3 w-full rounded-[3px] border border-dashed border-[var(--line-strong)] px-3 py-2.5 text-[10px] tracking-[0.18em] text-[var(--ink-dim)] transition-colors hover:border-[var(--violet)] hover:text-[var(--violet)]"
        onClick={onManual}
      >
        + CREATE CUSTOM FOOD
      </button>
    </div>
  );
}

function FoodRow({
  food,
  tag,
  onPick,
}: {
  food: (ApiFood | SavedFood) & { brand?: string };
  tag?: string;
  onPick: (f: PendingFood) => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-3 rounded-[3px] border border-transparent px-2 py-2 text-left transition-colors hover:border-[var(--line)] hover:bg-[rgba(120,200,255,0.05)]"
      onClick={() =>
        onPick({
          name: food.name,
          brand: food.brand,
          per100: food.per100,
          servingG: food.servingG,
          barcode: food.barcode,
        })
      }
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-[var(--ink)]">{food.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          {food.brand && <Tag>{food.brand}</Tag>}
          {tag && <Tag color="var(--violet)">{tag}</Tag>}
        </span>
      </span>
      <span className="mono shrink-0 text-[11px] text-[var(--ink-dim)]">
        {Math.round(food.per100.kcal)} <span className="text-[var(--ink-faint)]">kcal/100g</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function ManualView({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (f: PendingFood) => void;
}) {
  const [name, setName] = useState('');
  const [servingG, setServingG] = useState('100');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const sg = parseFloat(servingG);
  const valid = name.trim().length > 0 && sg > 0 && parseFloat(kcal) >= 0;

  const submit = () => {
    if (!valid) return;
    // Values are entered per serving; normalise to per-100g for storage.
    const f = 100 / sg;
    const num = (s: string) => Math.max(0, parseFloat(s) || 0);
    onPick({
      name: name.trim(),
      per100: {
        kcal: num(kcal) * f,
        proteinG: num(protein) * f,
        carbsG: num(carbs) * f,
        fatG: num(fat) * f,
      },
      servingG: sg,
    });
  };

  return (
    <div>
      <button
        className="font-head mb-3 text-[10px] tracking-[0.2em] text-[var(--ink-faint)] hover:text-[var(--cyan)]"
        onClick={onBack}
      >
        ‹ BACK TO SEARCH
      </button>
      <div className="grid gap-3">
        <Field label="Name">
          <HudInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Overnight oats" />
        </Field>
        <Field label="Serving size (g)" hint="Nutrition below is for one serving.">
          <HudInput type="number" inputMode="decimal" value={servingG} onChange={(e) => setServingG(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)">
            <HudInput type="number" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Protein (g)">
            <HudInput type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Carbs (g)">
            <HudInput type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Fat (g)">
            <HudInput type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <HudButton onClick={submit} disabled={!valid}>
          Continue
        </HudButton>
        <p className="text-[11px] text-[var(--ink-faint)]">
          Saved to “My Foods” when you log it — serving = {fmtG(sg > 0 ? sg : 100)}g.
        </p>
      </div>
    </div>
  );
}
