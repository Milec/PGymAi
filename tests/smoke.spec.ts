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
