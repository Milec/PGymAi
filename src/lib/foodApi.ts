import type { MacroSet } from './nutrition';

/**
 * Open Food Facts client — the live food catalogue behind Fuel's search and
 * barcode logging (https://world.openfoodfacts.org, ODbL, CORS-enabled).
 * Everything is normalised to per-100g macros; foods without usable
 * energy data are dropped rather than logged as zero-calorie.
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
 * Free-text catalogue search: cached per query, one automatic retry on
 * transient failure. Throws FoodApiError when both attempts fail.
 */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  let result: ApiFood[];
  try {
    result = await fetchSearch(query, signal);
  } catch (err) {
    // Aborts propagate (a newer query took over); anything else gets one retry.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    await new Promise((r) => setTimeout(r, 1200));
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    result = await fetchSearch(query, signal);
  }
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const first = searchCache.keys().next().value;
    if (first !== undefined) searchCache.delete(first);
  }
  searchCache.set(key, result);
  return result;
}

async function fetchProduct(clean: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const res = await fetch(`${OFF_BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new FoodApiError(`Barcode lookup failed (${res.status})`, res.status === 429);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (!data.product) return null;
  return mapOffProduct({ code: clean, ...data.product });
}

/** Barcode lookup with one retry. Resolves null when the product isn't in the catalogue. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const clean = code.replace(/\D/g, '');
  if (!clean) return null;
  try {
    return await fetchProduct(clean, signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    await new Promise((r) => setTimeout(r, 1000));
    return fetchProduct(clean, signal);
  }
}
