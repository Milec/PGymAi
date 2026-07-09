import type { MacroSet } from './nutrition';

/**
 * Live food catalogue behind Fuel's search and barcode logging — two
 * complementary sources, both CORS-enabled and normalised to per-100g macros:
 *
 * 1. Open Food Facts (world.openfoodfacts.org, ODbL) — global, crowdsourced.
 * 2. USDA FoodData Central Branded Foods (api.nal.usda.gov) — US-market
 *    products (label data submitted by manufacturers), which covers newer US
 *    items OFF often misses. Used as the fallback for barcodes and empty/
 *    failed searches. A free API key (VITE_USDA_FDC_KEY) unlocks 1000 req/hr;
 *    without one, barcode lookups still try USDA's shared DEMO_KEY.
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
}

const OFF_BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,serving_quantity_unit';

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
/** Real key → USDA joins search too. DEMO_KEY is rate-limited to a handful of
 * requests/hour per IP, so it's reserved for occasional barcode fallbacks. */
const fdcSearchEnabled = FDC_KEY.length > 0;

interface FdcNutrient {
  nutrientNumber?: string;
  value?: number;
}
interface FdcFood {
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

/** Map an FDC branded food (per-100g nutrients) to a normalised food. */
export function mapFdcFood(f: FdcFood): ApiFood | null {
  const name = f.description?.trim();
  if (!name || !f.gtinUpc) return null;
  const byNum = new Map<string, number>();
  for (const n of f.foodNutrients ?? []) {
    if (n.nutrientNumber && typeof n.value === 'number') byNum.set(n.nutrientNumber, n.value);
  }
  const kcal = byNum.get('208'); // Energy (kcal), per 100 g
  if (kcal === undefined) return null;
  const unit = (f.servingSizeUnit ?? '').toLowerCase();
  const brand = f.brandName?.trim() || f.brandOwner?.trim();
  return {
    barcode: f.gtinUpc,
    name: titleCase(name),
    brand: brand ? titleCase(brand) : undefined,
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

async function fdcQuery(query: string, pageSize: number, key: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const url =
    `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(key)}&dataType=Branded` +
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

/** Free-text FDC search: every term required, so relevance stays tight. */
async function fdcSearch(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `+${t}`)
    .join(' ');
  return fdcQuery(terms, 25, FDC_KEY, signal);
}

/** Barcode lookup on FDC via the gtinUpc field (exact match). */
async function fdcBarcode(code: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const key = FDC_KEY || 'DEMO_KEY';
  const hits = await fdcQuery(`gtinUpc:${code}`, 1, key, signal);
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

// The public search endpoint is rate-limited (~10 req/min per IP), so cache
// results per query for the session — retyping or backspacing costs nothing.
const searchCache = new Map<string, ApiFood[]>();
const SEARCH_CACHE_MAX = 80;

async function fetchSearch(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const url =
    `${OFF_BASE}/cgi/search.pl?action=process&json=1&search_simple=1&page_size=25` +
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
 * Free-text catalogue search across both sources: OFF first (cached per
 * query, one automatic retry), then — with a USDA key configured — FDC
 * results merged in (deduped by barcode). USDA also acts as the fallback
 * when OFF fails outright. Throws FoodApiError when every source fails.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  let off: ApiFood[] = [];
  let offError: unknown = null;
  try {
    off = await fetchSearch(query, signal);
  } catch (err) {
    // Aborts propagate (a newer query took over); anything else gets one retry.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    await new Promise((r) => setTimeout(r, 1200));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    try {
      off = await fetchSearch(query, signal);
    } catch (err2) {
      if (err2 instanceof DOMException && err2.name === 'AbortError') throw err2;
      offError = err2;
    }
  }

  let merged = off;
  if (fdcSearchEnabled) {
    try {
      const fdc = await fdcSearch(query, signal);
      const seen = new Set(off.map((f) => dedupeKey(f.barcode)));
      merged = [...off, ...fdc.filter((f) => !seen.has(dedupeKey(f.barcode)))];
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // FDC is best-effort during search; only fail if OFF failed too.
      if (offError) throw offError;
    }
  }
  if (offError && merged.length === 0) throw offError;

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
