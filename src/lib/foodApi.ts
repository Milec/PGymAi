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

/** Free-text catalogue search. Throws on network failure (caller shows state). */
export async function searchFoods(query: string, signal?: AbortSignal): Promise<ApiFood[]> {
  const url =
    `${OFF_BASE}/cgi/search.pl?action=process&json=1&search_simple=1&page_size=25` +
    `&search_terms=${encodeURIComponent(query)}&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Food search failed (${res.status})`);
  const data = (await res.json()) as { products?: OffProduct[] };
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

/** Barcode lookup. Resolves null when the product isn't in the catalogue. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<ApiFood | null> {
  const clean = code.replace(/\D/g, '');
  if (!clean) return null;
  const res = await fetch(`${OFF_BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (!data.product) return null;
  return mapOffProduct({ code: clean, ...data.product });
}
