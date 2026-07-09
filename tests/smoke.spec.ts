import { expect, test, type Page } from '@playwright/test';

// Reset IndexedDB between tests for isolation.
async function freshApp(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    if (dbs) for (const d of dbs) if (d.name) indexedDB.deleteDatabase(d.name);
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByText('STRIDE').first()).toBeVisible();
}

test('boots to the dashboard flight deck', async ({ page }) => {
  await freshApp(page);
  await expect(page.getByRole('heading', { name: /flight deck/i })).toBeVisible();
});

test('every primary route renders', async ({ page }) => {
  await freshApp(page);
  const routes: [string, RegExp][] = [
    ['/#/library', /exercise library/i],
    ['/#/progress', /progress/i],
    ['/#/strength', /strength standards/i],
    ['/#/programs', /programs/i],
    ['/#/history', /activity log/i],
    ['/#/fuel', /fuel/i],
    ['/#/profile', /profile & settings/i],
  ];
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }
});

test('exercise library is seeded and searchable', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/library');
  await expect(page.getByText(/exercises loaded/i)).toBeVisible();
  await page.getByPlaceholder(/search exercises/i).fill('deadlift');
  await expect(page.getByText('Deadlift', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Bench Press', { exact: true })).toHaveCount(0);
});

test('can log a freestyle workout end to end', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();

  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Back Squat');
  await page.getByRole('button', { name: /^Back Squat/ }).first().click();

  // Fill the first set: weight + reps, then complete it.
  const weight = page.locator('input[inputmode="decimal"]').first();
  const reps = page.locator('input[inputmode="numeric"]').first();
  await weight.fill('100');
  await reps.fill('5');
  await page.getByLabel('Toggle complete').first().click();

  // e1RM readout should now appear (~116kg for 100x5 Epley).
  await expect(page.getByText(/EST 1RM/i)).toBeVisible();

  // Duration timer should be running.
  await expect(page.getByText(/Sets Done/i)).toBeVisible();

  await page.getByRole('button', { name: /finish session/i }).click();
  await expect(page).toHaveURL(/#\/progress/);
  // Progress page should now show computed stats from the logged session.
  await expect(page.getByRole('heading', { name: /progress/i })).toBeVisible();
  await expect(page.getByText(/Best e1RM/i)).toBeVisible();
});

test('program import validates and rejects bad JSON', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/programs');
  await page.getByRole('button', { name: /^Import$/ }).click();
  await page.getByPlaceholder(/Paste program JSON/i).fill('{ not valid');
  await expect(page.getByText(/VALIDATION FAILED/i)).toBeVisible();
});

test('theme setting re-skins the app', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/profile');
  await expect(page.getByText('THEME').first()).toBeVisible();
  await page.getByRole('button', { name: /bubblegum/i }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('bubblegum');
  // Persists across reload — wait for the async profile write to flush first.
  await page.waitForTimeout(600);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
    .toBe('bubblegum');
});

test('library PR can be set and drives auto-fill in a workout', async ({ page }) => {
  await freshApp(page);
  // 1) Set a 1RM PR for Back Squat in the Library.
  await page.goto('/#/library');
  await page.getByPlaceholder(/search exercises/i).fill('Back Squat');
  const card = page.locator('button', { hasText: '1RM PR' }).first();
  await card.click();
  await expect(page.getByRole('heading', { name: /back squat — 1rm pr/i })).toBeVisible();
  await page.getByPlaceholder('e.g. 140').fill('150');
  await page.getByRole('button', { name: /save pr/i }).click();
  await expect(page.getByText('150', { exact: false }).first()).toBeVisible();

  // 2) Start a workout, add Back Squat, auto-fill at 100% → should fill 150.
  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Back Squat');
  await page.getByRole('button', { name: /^Back Squat/ }).first().click();

  await page.getByRole('button', { name: /auto-fill weight/i }).click();
  const pct = page.locator('input[inputmode="numeric"]').first();
  await pct.fill('100');
  await page.getByRole('button', { name: /fill all sets/i }).click();

  const firstWeight = page.locator('input[inputmode="decimal"]').first();
  await expect(firstWeight).toHaveValue('150');
});

test('bodyweight set logs as complete with no weight', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Push-Up');
  await page.getByRole('button', { name: /^Push-Up/ }).first().click();

  // Reps only — no weight entered.
  await page.locator('input[inputmode="numeric"]').first().fill('15');
  await page.getByLabel('Toggle complete').first().click();

  // Sets Done registers the completed bodyweight set, so Finish is enabled.
  await page.getByRole('button', { name: /finish session/i }).click();
  await expect(page).toHaveURL(/#\/progress/);

  // It shows up in the training log as a bodyweight (BW) set.
  await page.goto('/#/history');
  await page.getByText(/Freestyle Session/).first().click();
  await expect(page.getByText(/BW/).first()).toBeVisible();
});

test('per-set percent auto-fills weight rounded to 2.5', async ({ page }) => {
  await freshApp(page);
  // Set a 150 kg PR for Back Squat.
  await page.goto('/#/library');
  await page.getByPlaceholder(/search exercises/i).fill('Back Squat');
  await page.locator('button', { hasText: '1RM PR' }).first().click();
  await page.getByPlaceholder('e.g. 140').fill('150');
  await page.getByRole('button', { name: /save pr/i }).click();

  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Back Squat');
  await page.getByRole('button', { name: /^Back Squat/ }).first().click();

  // Type 50% into the per-set % cell → weight fills to 75 (50% of 150).
  await page.getByLabel('Percent of 1RM').first().fill('50');
  await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('75');
});

test('muscle balance follows the volume chart period', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(async () => {
    const m = await import('/src/dev/demoData.ts');
    await m.loadDemoData();
  });
  await page.goto('/#/');
  await expect(page.getByText(/last 8w/i)).toBeVisible();
  await page.getByRole('button', { name: '4w', exact: true }).click();
  await expect(page.getByText(/last 4w/i)).toBeVisible();
});

test('activity log shows sessions, meals, and calendar', async ({ page }) => {
  await freshApp(page);
  // Seed training + nutrition history via the app's own demo loader.
  await page.evaluate(async () => {
    const m = await import('/src/dev/demoData.ts');
    await m.loadDemoData();
  });
  await page.goto('/#/history');
  await expect(page.getByRole('heading', { name: /activity log/i })).toBeVisible();
  await expect(page.getByText('CALENDAR')).toBeVisible();

  // A session card is listed; expanding it reveals per-exercise set detail.
  const card = page.getByText(/Squat Focus|Pull Focus/).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByText(/Back Squat|Deadlift|Bench Press/).first()).toBeVisible();

  // The demo seeds today's meals too: selecting today on the calendar shows
  // the FUEL panel with the day's meals, and deep-links into the Fuel page.
  await page.getByRole('button', { name: `Select day ${new Date().getDate()}` }).click();
  await expect(page.getByRole('button', { name: /open in fuel/i })).toBeVisible();
  await expect(page.getByText(/Rolled Oats/).first()).toBeVisible();
  await page.getByRole('button', { name: /open in fuel/i }).click();
  await expect(page.getByRole('heading', { name: /^fuel$/i })).toBeVisible();
  await expect(page.getByText('Rolled Oats (cooked)')).toBeVisible();
});

test('cloud sync account panel and auth modal render', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/profile');
  await expect(page.getByText('CLOUD SYNC').first()).toBeVisible();
  const signIn = page.getByRole('button', { name: /sign in \/ create account/i });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
    await expect(page.getByRole('heading', { name: /cloud sync/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible();
  }
});

test('fuel: calibrated targets + custom food logging end to end', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/fuel');

  // Calibrate macro targets from body stats (Mifflin-St Jeor).
  await page.getByRole('button', { name: /calibrate targets/i }).click();
  await page.getByLabel(/height/i).fill('180');
  await page.getByLabel(/age/i).fill('30');
  await page.getByRole('button', { name: /^male$/i }).click();
  // Preview shows computed maintenance before applying.
  await expect(page.getByText('MAINTENANCE')).toBeVisible();
  await page.getByRole('button', { name: /apply targets/i }).click();
  await expect(page.getByText('CONSUMED')).toBeVisible();
  await expect(page.getByText('PROTEIN').first()).toBeVisible();

  // Log a custom food into Breakfast (no network needed).
  await page.getByRole('button', { name: /add food to breakfast/i }).click();
  await page.getByRole('button', { name: /create custom food/i }).click();
  await page.getByLabel(/^name$/i).fill('Overnight Oats');
  await page.getByRole('spinbutton', { name: /calories/i }).fill('350');
  await page.getByRole('spinbutton', { name: /protein/i }).fill('20');
  await page.getByRole('spinbutton', { name: /carbs/i }).fill('50');
  await page.getByRole('spinbutton', { name: /fat \(g\)/i }).fill('8');
  await page.getByRole('button', { name: /continue/i }).click();

  // MFP-style quantity: 2 servings × the 100 g serving = 200 g, macros double.
  await page.getByLabel('Number of servings').fill('2');
  await expect(page.getByText('= 200 g')).toBeVisible();
  // Switching the serving-size unit keeps the count and re-derives the total.
  await page.getByLabel('Serving size').selectOption('1g');
  await expect(page.getByText('= 2 g')).toBeVisible();
  await page.getByLabel('Serving size').selectOption('serving');
  await expect(page.getByText('= 200 g')).toBeVisible();
  await page.getByRole('button', { name: /log to breakfast/i }).click();

  // The journal entry appears with its (doubled) calories counted.
  await expect(page.getByText('Overnight Oats')).toBeVisible();
  await expect(page.getByText(/700 kcal · P 40/)).toBeVisible();

  // It's kept as a reusable "My Food" for the next log.
  await page.getByRole('button', { name: /add food to lunch/i }).click();
  await expect(page.getByText(/RECENT & MY FOODS/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Overnight Oats custom/ })).toBeVisible();
});

test('expandable side menu groups collapse and expand', async ({ page }) => {
  await freshApp(page);
  // Desktop rail: NUTRITION group is expanded by default and holds Fuel.
  const fuelLink = page.getByRole('link', { name: 'Fuel', exact: true });
  await expect(fuelLink).toBeVisible();
  await page.getByRole('button', { name: 'NUTRITION' }).click();
  await expect(fuelLink).toBeHidden();
  await page.getByRole('button', { name: 'NUTRITION' }).click();
  await expect(fuelLink).toBeVisible();
  await fuelLink.click();
  await expect(page.getByRole('heading', { name: /^fuel$/i })).toBeVisible();
});

test('hydration: quick-add, undo, and manual target', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/fuel');

  // Auto target shows out of the box (default 80 kg, moderate → 3.15 L).
  await expect(page.getByText('/ 3.15 L')).toBeVisible();

  // Two quick-adds accumulate; undo removes the last one.
  await page.getByRole('button', { name: '+500ml' }).click();
  await page.getByRole('button', { name: '+250ml' }).click();
  await expect(page.getByText('0.75', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Undo last water' }).click();
  await expect(page.getByText('0.5', { exact: false }).first()).toBeVisible();

  // Manual target override persists via the profile.
  await page.getByRole('button', { name: /adjust target/i }).click();
  await page.getByRole('button', { name: /set manually/i }).click();
  await page.getByLabel(/daily target/i).fill('2000');
  await page.getByRole('button', { name: /apply target/i }).click();
  await expect(page.getByText('/ 2.0 L')).toBeVisible();
  await expect(page.getByText('manual target')).toBeVisible();

  // Intake survives a reload (persisted in Dexie).
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByText('0.5', { exact: false }).first()).toBeVisible();
});

test('barcode scanner locks onto a detected code and completes the flow', async ({ page }) => {
  // Stub the native detector: reports one EAN with a bounding box, as Chrome
  // on Android would. The fake camera flag provides the video stream.
  await page.addInitScript(() => {
    class FakeDetector {
      static getSupportedFormats() {
        return Promise.resolve(['ean_13', 'upc_a']);
      }
      detect() {
        return Promise.resolve([
          { rawValue: '737628064502', boundingBox: new DOMRect(420, 260, 380, 150) },
        ]);
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeDetector;
  });
  await freshApp(page);
  // Mock the catalogue so the post-lock lookup resolves offline.
  await page.route(/world\.openfoodfacts\.org\/api\/v2\/product/, (r) =>
    r.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        product: {
          code: '737628064502',
          product_name: 'Rice Noodles',
          nutriments: { 'energy-kcal_100g': 385, proteins_100g: 7 },
          serving_quantity: 52,
          serving_quantity_unit: 'g',
        },
      }),
    }),
  );

  await page.goto('/#/fuel');
  await page.getByRole('button', { name: /add food to snacks/i }).click();
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  // Reactive feedback: the lock-on state shows before the lookup fires…
  await expect(page.getByText(/LOCKED|READING/)).toBeVisible();
  // …then the detected product lands in the quantity step with its serving.
  await expect(page.getByText('Rice Noodles')).toBeVisible();
  await expect(page.getByLabel('Serving size')).toHaveValue('serving');
  await expect(page.getByText('= 52 g')).toBeVisible();
});

test('planner: build, save, and launch a planned workout', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/workout');

  // Build a plan: Back Squat 3×5 @ 100.
  await page.getByRole('button', { name: /new plan/i }).click();
  await page.getByPlaceholder(/push day a/i).fill('Leg Day');
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Back Squat');
  await page.getByRole('button', { name: /^Back Squat/ }).first().click();
  await page.getByLabel(/target reps/i).fill('5');
  await page.getByLabel(/weight/i).fill('100');
  await page.getByRole('button', { name: /save plan/i }).click();

  // The saved plan is listed and survives a reload (persisted in Dexie).
  await expect(page.getByText('Leg Day')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Leg Day')).toBeVisible();
  await expect(page.getByText(/1 exercise · 3 sets/)).toBeVisible();

  // Launch it: session opens with the exercise, 3 pre-filled sets at 100.
  await page.getByRole('button', { name: /^Start$/ }).click();
  await expect(page.getByRole('heading', { name: 'Leg Day' })).toBeVisible();
  await expect(page.getByText('Back Squat', { exact: true })).toBeVisible();
  const weights = page.locator('input[inputmode="decimal"]');
  await expect(weights.first()).toHaveValue('100');
  // Target reps appear as the rep placeholder.
  await expect(page.locator('input[inputmode="numeric"]').first()).toHaveAttribute('placeholder', '5');
});

test('nutrition trends shows period-filtered averages and charts', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(async () => {
    const m = await import('/src/dev/demoData.ts');
    await m.loadDemoData();
  });
  await page.goto('/#/fuel-trends');
  await expect(page.getByRole('heading', { name: /nutrition trends/i })).toBeVisible();
  await expect(page.getByText('AVG KCAL / DAY')).toBeVisible();
  await expect(page.getByText('AVG PROTEIN / DAY')).toBeVisible();
  await expect(page.getByText('DAILY CALORIES')).toBeVisible();
  await expect(page.getByText('DAILY PROTEIN')).toBeVisible();

  // Hydration trend: avg tile + daily water chart render from demo data.
  await expect(page.getByText('AVG WATER / DAY')).toBeVisible();
  await expect(page.getByText('DAILY WATER')).toBeVisible();

  // Period chips re-filter; a 1W window still has demo data.
  await page.getByRole('button', { name: '1W', exact: true }).click();
  await expect(page.getByText(/logged day/)).toBeVisible();
});

test('dashboard shows an app-wide fuel summary with quick water add', async ({ page }) => {
  await freshApp(page);
  await page.evaluate(async () => {
    const m = await import('/src/dev/demoData.ts');
    await m.loadDemoData();
  });
  await page.reload(); // pick up the demo profile targets in the store
  await expect(page.getByText('FUEL TODAY')).toBeVisible();
  // Calories vs target and the water readout render from today's demo meals.
  await expect(page.getByText(/\/ \d{4} kcal/).first()).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'WATER' })).toBeVisible();
  // Quick +250ml works straight from the dashboard.
  const before = await page.getByRole('progressbar', { name: 'WATER' }).getAttribute('aria-valuenow');
  await page.getByRole('button', { name: '+250ml' }).click();
  await expect
    .poll(async () => page.getByRole('progressbar', { name: 'WATER' }).getAttribute('aria-valuenow'))
    .toBe(String(Number(before) + 250));
});

test('adding an example program then following it works', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/programs');
  await page
    .getByText('Novice Linear Progression')
    .locator('..')
    .getByRole('button', { name: /add to library/i })
    .click();
  await expect(page.getByText(/MY PROGRAMS/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Follow/ }).first()).toBeVisible();
});
