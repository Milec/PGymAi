/**
 * Search orchestration across the two catalogues (Open Food Facts + USDA
 * FDC): concurrency, fallbacks, and — critically — failure semantics. The
 * mapping and ranking helpers are covered in nutrition.test.ts; these tests
 * mock fetch and exercise searchFoods end to end.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const OFF_HOST = 'openfoodfacts.org';
const FDC_HOST = 'api.nal.usda.gov';

const offProduct = {
  code: '123',
  product_name: 'Chicken Mandu',
  nutriments: { 'energy-kcal_100g': 150 },
};
const fdcFood = {
  fdcId: 1,
  description: 'BEEF BULGOGI MANDU',
  gtinUpc: '456',
  foodNutrients: [{ nutrientNumber: '208', value: 200 }],
};

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const down = (status: number) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as Response);

/** Fresh module per test (module-level key + cache), with fetch scripted per host. */
async function load(opts: {
  key?: string;
  off: (call: number) => Promise<Response>;
  fdc?: (call: number, url: string) => Promise<Response>;
}) {
  vi.resetModules();
  vi.stubEnv('VITE_USDA_FDC_KEY', opts.key ?? '');
  let offCalls = 0;
  let fdcCalls = 0;
  const fdcUrls: string[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(OFF_HOST)) return opts.off(offCalls++);
    if (url.includes(FDC_HOST)) {
      fdcUrls.push(url);
      return (opts.fdc ?? (() => ok({ foods: [fdcFood] })))(fdcCalls++, url);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const api = await import('./foodApi');
  return { ...api, fetchMock, fdcUrls, offCallCount: () => offCalls, fdcCallCount: () => fdcCalls };
}

/** Run a search while auto-draining the OFF retry timer (1.2 s, faked). */
async function search(fn: (q: string) => Promise<unknown>, q: string) {
  vi.useFakeTimers();
  try {
    const p = fn(q);
    p.catch(() => {}); // rejection may land mid-drain, before the await below
    await vi.advanceTimersByTimeAsync(1500);
    return await p;
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('searchFoods failure semantics', () => {
  it('falls back to USDA DEMO_KEY when OFF is down and no key is set', async () => {
    const m = await load({ off: () => down(503) });
    const results = (await search(m.searchFoods, 'bulgogi mandu')) as { name: string }[];
    expect(results.map((f) => f.name)).toContain('Beef Bulgogi Mandu');
    expect(m.offCallCount()).toBe(2); // one retry
    expect(m.fdcUrls[0]).toContain('api_key=DEMO_KEY');
  });

  it('reports "no matches", not an outage, when OFF is down but USDA answered empty', async () => {
    const m = await load({ off: () => down(503), fdc: () => ok({ foods: [] }) });
    await expect(search(m.searchFoods, 'zzz qqq')).resolves.toEqual([]);
  });

  it('throws only when every source failed', async () => {
    const m = await load({ off: () => down(503), fdc: () => down(500) });
    await expect(search(m.searchFoods, 'chicken soup')).rejects.toMatchObject({
      name: 'FoodApiError',
    });
  });

  it('does not spend DEMO_KEY quota while OFF is answering with results', async () => {
    const m = await load({ off: () => ok({ products: [offProduct] }) });
    await m.searchFoods('mandu');
    expect(m.fdcCallCount()).toBe(0);
  });

  it('does not cache an empty result seen during an outage', async () => {
    const m = await load({ off: () => down(503), fdc: () => ok({ foods: [] }) });
    await search(m.searchFoods, 'mandu');
    await search(m.searchFoods, 'mandu');
    expect(m.offCallCount()).toBe(4); // refetched (2 tries each), not served from cache
  });

  it('caches successful results per query', async () => {
    const m = await load({ off: () => ok({ products: [offProduct] }) });
    await m.searchFoods('mandu');
    await m.searchFoods('Mandu ');
    expect(m.offCallCount()).toBe(1);
  });
});

describe('searchFoods with a configured USDA key', () => {
  it('merges both catalogues and queries FDC with the real key', async () => {
    const m = await load({ key: 'real-key', off: () => ok({ products: [offProduct] }) });
    const results = (await m.searchFoods('mandu')) as { name: string }[];
    expect(results.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Chicken Mandu', 'Beef Bulgogi Mandu']),
    );
    expect(m.fdcUrls[0]).toContain('api_key=real-key');
  });

  it('retries FDC without +prefixes when the all-terms query matches nothing', async () => {
    const m = await load({
      key: 'real-key',
      off: () => ok({ products: [] }),
      fdc: (call) => (call === 0 ? ok({ foods: [] }) : ok({ foods: [fdcFood] })),
    });
    const results = (await m.searchFoods('bulgolgi mandu')) as { name: string }[];
    expect(m.fdcUrls[0]).toContain(encodeURIComponent('+bulgolgi +mandu'));
    expect(m.fdcUrls[1]).toContain(encodeURIComponent('bulgolgi mandu'));
    expect(m.fdcUrls[1]).not.toContain(encodeURIComponent('+'));
    // The misspelled query still surfaces the near-miss result.
    expect(results.map((f) => f.name)).toContain('Beef Bulgogi Mandu');
  });
});
