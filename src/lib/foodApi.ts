import type { MacroSet } from './nutrition';

/**
 * Live food catalogue behind Fuel's search and barcode logging — two
 * complementary sources, both CORS-enabled and normalised to per-100g macros:
 *
 * 1. Open Food Facts (world.openfoodfacts.org, ODbL) — global, crowdsourced.
 * 2. USDA FoodData Central Branded Foods (api.nal.usda.gov) — US-market
 *    products (label data submitted by manufacturers), which covers newer US
 *    items OFF often misses. A free API key (VITE_USDA_FDC_KEY) unlocks
 *    1000 req/hr and full participation in every search; without one, both
 *    barcode lookups and searches that OFF couldn't answer still fall back
 *    to USDA's shared low-quota DEMO_KEY.
 *
 * Foods without usable energy data are dropped rather than logged as 0 kcal.
 */

export interface ApiFood {
  /** OFF product barcode (EAN/UPC). */
  barcode: string;
  name: string;
  brand?: string;
  per100: MacroSet;
  /** Grams in one labelled serving, when the product declares it. */
  servingG?: number;
  /** OFF unique scan count — a proxy for how commonly logged the product is. */
  popularity?: number;
}

const OFF_BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_quantity_unit,unique_scans_n';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  energy_100g?: number; // kJ fallback
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  unique_scans_n?: number;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// USDA FoodData Central (Branded Foods)
// ---------------------------------------------------------------------------

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const FDC_KEY: string = (import.meta.env?.VITE_USDA_FDC_KEY as string | undefined) || '';
/** Real key → USDA joins every search in parallel with OFF. DEMO_KEY is
 * rate-limited to a handful of requests/hour per IP, so it's reserved for
 * barcode fallbacks and searches OFF couldn't answer. */
const fdcSearchEnabled = FDC_KEY.length > 0;

interface FdcNutrient {
  nutrientNumber?: string;
  value?: number;
}
interface FdcFood {
  fdcId?: number;
  dataType?: string;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: FdcNutrient[];
}

/** FDC descriptions are SHOUTED — settle them down for the UI. */
function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s(/-])\w/g, (c) => c.toUpperCase());
}

/** Map an FDC food (per-100g nutrients) to a normalised food. Branded foods
 * key by UPC; generic SR Legacy foods get a stable pseudo-id instead. */
export function mapFdcFood(f: FdcFood): ApiFood | null {
  const name = f.description?.trim();
  const key = f.gtinUpc || (f.fdcId ? `fdc-${f.fdcId}` : undefined);
  if (!name || !key) return null;
  const byNum = new Map<string, number>();
  for (const n of f.foodNutrients ?? []) {
    if (n.nutrientNumber && typeof n.value === 'number') byNum.set(n.nutrientNumber, n.value);
  }
  const kcal = byNum.get('208'); // Energy (kcal), per 100 g
  if (kcal === undefined) return null;
  const unit = (f.servingSizeUnit ?? '').toLowerCase();
  const rawBrand = f.brandName?.trim() || f.brandOwner?.trim();
  return {
    barcode: key,
    name: titleCase(name),
    // Generic (non-branded) foods surface as USDA reference entries.
    brand: rawBrand ? titleCase(rawBrand) : f.gtinUpc ? undefined : 'USDA',
    per100: {
      kcal,
      proteinG: byNum.get('203') ?? 0,
      carbsG: byNum.get('205') ?? 0,
      fatG: byNum.get('204') ?? 0,
    },
    servingG:
      f.servingSize && ['g', 'grm', 'gram', 'ml', 'mlt'].includes(unit) ? f.servingSize : undefined,
  };
}

interface FdcSearchResponse {
  foods?: FdcFood[];
}

async function fdcQuery(
  query: string,
  pageSize: number,
  key: string,
  dataType: string,
  signal?: AbortSignal,
): Promise<ApiFood[]> {
  const url =
    `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(key)}&dataType=${dataType}` +
    `&pageSize=${pageSize}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new FoodApiError('USDA rate limit', true);
  if (!res.ok) throw new FoodApiError(`USDA search failed (${res.status})`);
  const data = (await res.json()) as FdcSearchResponse;
  const out: ApiFood[] = [];
  for (const f of data.foods ?? []) {
    const food = mapFdcFood(f);
    if (food) out.push(food);
  }
  return out;
}

// SR Legacy adds USDA's generic whole foods ("Beef, ground, 93% lean...").
const FDC_SEARCH_TYPES = 'Branded,SR%20Legacy';

/** Free-text FDC search: every term required first, so relevance stays
 * tight. When that matches nothing (typos — "bulgolgi mandu"), retry letting
 * FDC OR the terms; rankFoods keeps only near-misses, so noise stays out. */
async function fdcSearch(query: string, key: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const terms = query.split(/\s+/).filter(Boolean);
  const strict = await fdcQuery(
    terms.map((t) => `+${t}`).join(' '),
    25,
    key,
    FDC_SEARCH_TYPES,
    signal,
  );
  if (strict.length > 0 || terms.length < 2) return strict;
  return fdcQuery(terms.join(' '), 25, key, FDC_SEARCH_TYPES, signal);
}

/** Barcode lookup on FDC via the gtinUpc field (exact match). */
async function fdcBarcode(code: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const key = FDC_KEY || 'DEMO_KEY';
  const hits = await fdcQuery(`gtinUpc:${code}`, 1, key, 'Branded', signal);
  return hits[0] ?? null;
}

/**
 * US retail UPC-A codes are the same number as their EAN-13 form minus a
 * leading zero, and both catalogues store them inconsistently — try both.
 */
export function barcodeVariants(clean: string): string[] {
  const variants = [clean];
  if (clean.length === 13 && clean.startsWith('0')) variants.push(clean.slice(1));
  else if (clean.length === 12) variants.push(`0${clean}`);
  return variants;
}

/** Barcodes normalised for de-duplication across sources. */
function dedupeKey(code: string): string {
  return code.replace(/^0+/, '');
}

// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------

/** Map an OFF product to a normalised food; null when unusable. */
export function mapOffProduct(p: OffProduct): ApiFood | null {
  const name = p.product_name?.trim();
  if (!name || !p.code || !p.nutriments) return null;
  const n = p.nutriments;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = num(n.energy_100g);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  if (kcal === undefined) return null;
  const servingQ = num(p.serving_quantity);
  const servingUnit = (p.serving_quantity_unit ?? 'g').toLowerCase();
  return {
    barcode: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    per100: {
      kcal,
      proteinG: num(n.proteins_100g) ?? 0,
      carbsG: num(n.carbohydrates_100g) ?? 0,
      fatG: num(n.fat_100g) ?? 0,
    },
    // ml ≈ g is close enough for logging liquids; other units are ignored.
    servingG: servingQ && (servingUnit === 'g' || servingUnit === 'ml') ? servingQ : undefined,
    popularity: num(p.unique_scans_n),
  };
}

/** Search failure with enough shape for a useful error message. */
export class FoodApiError extends Error {
  /** true when the catalogue rate-limited us (try again shortly). */
  rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = 'FoodApiError';
    this.rateLimited = rateLimited;
  }
}

// ---------------------------------------------------------------------------
// Relevance ranking
// ---------------------------------------------------------------------------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Query tokens: lowercase words, keeping things like "93%" and "2" intact. */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((t) => t.length > 1 || /\d/.test(t));
}

/** Does the text contain the token at a word start ("bee" matches "beef")? */
function wordHit(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(token)}`).test(text);
}

/**
 * Re-rank merged catalogue results against what the user actually typed.
 * Both upstream searches match loosely (OFF ORs terms across all fields), so:
 * results matching EVERY query token (in name or brand) rank first; if that
 * tier is thin, all-but-one matches follow; zero-match noise is dropped.
 * Within a tier: name hits beat brand hits, and OFF scan-count popularity
 * breaks ties so common staples beat obscure variants.
 */
export function rankFoods(query: string, foods: ApiFood[]): ApiFood[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return foods;

  const scored = foods.map((food, index) => {
    const name = food.name.toLowerCase();
    const brand = (food.brand ?? '').toLowerCase();
    let nameHits = 0;
    let brandHits = 0;
    for (const t of tokens) {
      if (wordHit(name, t)) nameHits += 1;
      else if (wordHit(brand, t)) brandHits += 1;
    }
    const hits = nameHits + brandHits;
    const score =
      nameHits * 12 +
      brandHits * 4 +
      (nameHits === tokens.length ? 40 : 0) +
      (name.startsWith(tokens[0]) ? 6 : 0) +
      Math.min(Math.log10((food.popularity ?? 0) + 1) * 6, 18) -
      Math.min(name.length / 25, 3);
    return { food, index, hits, score };
  });

  const byScore = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    b.score - a.score || a.index - b.index;
  const full = scored.filter((s) => s.hits >= tokens.length).sort(byScore);
  if (full.length >= 8) return full.map((s) => s.food);
  const near = scored
    .filter((s) => s.hits < tokens.length && s.hits >= tokens.length - 1 && s.hits > 0)
    .sort(byScore);
  return [...full, ...near].map((s) => s.food);
}

// The public search endpoint is rate-limited (~10 req/min per IP), so cache
// results per query for the session — retyping or backspacing costs nothing.
const searchCache = new Map<string, ApiFood[]>();
const SEARCH_CACHE_MAX = 80;

async function fetchSearch(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const url =
    `${OFF_BASE}/cgi/search.pl?action=process&json=1&search_simple=1&page_size=25&sort_by=unique_scans_n` +
    `&search_terms=${encodeURIComponent(query)}&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (res.status === 429) throw new FoodApiError('Catalogue rate limit', true);
  if (!res.ok) throw new FoodApiError(`Food search failed (${res.status})`);
  // The endpoint returns an HTML error page under load — treat it as a failure
  // rather than surfacing a JSON parse crash.
  let data: { products?: OffProduct[] };
  try {
    data = (await res.json()) as { products?: OffProduct[] };
  } catch {
    throw new FoodApiError('Catalogue overloaded', true);
  }
  const seen = new Set<string>();
  const out: ApiFood[] = [];
  for (const p of data.products ?? []) {
    const food = mapOffProduct(p);
    if (food && !seen.has(food.barcode)) {
      seen.add(food.barcode);
      out.push(food);
    }
  }
  return out;
}

/**
 * Free-text catalogue search across both sources, merged (deduped by
 * barcode) and ranked. OFF and FDC run concurrently — OFF's public endpoint
 * fails often enough (429s, 503s, HTML error pages) that USDA can't queue
 * behind its retry. Without a real FDC key, USDA joins only as a DEMO_KEY
 * fallback when OFF failed or matched nothing, to conserve its tiny quota.
 * Throws FoodApiError only when no source could answer at all — a source
 * that answered "no matches" is a real empty result, not an outage.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const offPromise = (async () => {
    try {
      return await fetchSearch(query, signal);
    } catch (err) {
      // Aborts propagate (a newer query took over); anything else gets one retry.
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      await new Promise((r) => setTimeout(r, 1200));
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return fetchSearch(query, signal);
    }
  })();
  const fdcPromise = fdcSearchEnabled ? fdcSearch(query, FDC_KEY, signal) : null;
  fdcPromise?.catch(() => {}); // handled below; don't surface as unhandled if OFF aborts first

  let off: ApiFood[] = [];
  let offError: unknown = null;
  try {
    off = await offPromise;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    offError = err;
  }

  let fdc: ApiFood[] = [];
  let fdcError: unknown = null;
  const fdcAttempt =
    fdcPromise ??
    (offError !== null || off.length === 0 ? fdcSearch(query, 'DEMO_KEY', signal) : null);
  if (fdcAttempt) {
    try {
      fdc = await fdcAttempt;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      fdcError = err;
    }
  }

  if (offError !== null && (fdcAttempt === null || fdcError !== null)) throw offError;

  const seen = new Set(off.map((f) => dedupeKey(f.barcode)));
  const merged = rankFoods(query, [
    ...off,
    ...fdc.filter((f) => !seen.has(dedupeKey(f.barcode))),
  ]);

  // An empty result while a source was down isn't trustworthy enough to pin
  // for the whole session — leave it uncached so a later retype can recover.
  if (merged.length === 0 && (offError !== null || fdcError !== null)) return merged;

  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value;
    if (first !== undefined) searchCache.delete(first);
  }
  searchCache.set(key, merged);
  return merged;
}

async function fetchProduct(clean: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const res = await fetch(`${OFF_BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new FoodApiError(`Barcode lookup failed (${res.status})`, res.status === 429);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (!data.product) return null;
  return mapOffProduct({ code: clean, ...data.product });
}

/**
 * Barcode lookup across both catalogues: Open Food Facts first, then USDA
 * FoodData Central — each tried with UPC-A/EAN-13 leading-zero variants.
 * Resolves null only when every source definitively had no match; throws
 * when nothing could be reached at all.
 */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const clean = code.replace(/\D/g, '');
  if (!clean) return null;
  const variants = barcodeVariants(clean);
  let sawError: unknown = null;

  for (const v of variants) {
    try {
      const hit = await fetchProduct(v, signal);
      if (hit) return hit;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      sawError = err;
    }
  }
  for (const v of variants) {
    try {
      const hit = await fdcBarcode(v, signal);
      if (hit) return hit;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      sawError = err;
    }
  }
  // A miss is only trustworthy if at least one source answered.
  if (sawError) throw sawError instanceof Error ? sawError : new FoodApiError('Barcode lookup failed');
  return null;
}
