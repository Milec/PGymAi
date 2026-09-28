import { expect, test, type Page } from '@playwright/test';

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

/** Log one completed set of an exercise in a freestyle session and finish it. */
async function logQuickSession(page: Page, exercise: string, reps = '5') {
  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill(exercise);
  await page.getByRole('button', { name: new RegExp(`^${exercise}`) }).first().click();
  await page.locator('input[inputmode="numeric"]').first().fill(reps);
  await page.getByLabel(/^Set 1 mark complete$/).click();
  await page.getByRole('button', { name: /finish session/i }).click();
  await expect(page).toHaveURL(/#\/progress/);
}

test('a backup round-trips through export, erase, and restore', async ({ page }) => {
  await freshApp(page);
  await logQuickSession(page, 'Push-Up', '12');

  // The session is in the log.
  await page.goto('/#/history');
  await expect(page.getByText(/Freestyle Session/).first()).toBeVisible();

  // Export it.
  await page.goto('/#/profile');
  const download = await Promise.race([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /export all data/i }).click().then(() => page.waitForEvent('download')),
  ]);
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  // Wipe everything.
  page.once('dialog', (d) => void d.accept());
  // Erasing reloads the app; wait for that before navigating, or the reload
  // lands after the next goto and bounces us back.
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: /erase everything/i }).click(),
  ]);
  await page.goto('/#/history');
  await expect(page.getByText(/Freestyle Session/)).toHaveCount(0);

  // Restore from the file.
  await page.goto('/#/profile');
  page.once('dialog', (d) => void d.accept());
  await Promise.all([
    page.waitForEvent('load'), // a successful restore reloads too
    page.locator('input[type="file"]').setInputFiles(backupPath!),
  ]);

  await page.goto('/#/history');
  await expect(page.getByText(/Freestyle Session/).first()).toBeVisible();
});

test('restoring a file that is not a backup is refused', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/profile');

  const messages: string[] = [];
  page.on('dialog', (d) => {
    messages.push(d.message());
    void d.dismiss();
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect.poll(() => messages.join(' ')).toMatch(/empty|doesn't look like/i);
});

test('program follow view tracks completed days', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/programs');

  // Add the first example program to the library.
  await page.getByRole('button', { name: /add to library/i }).first().click();
  await page.getByRole('button', { name: /^Follow$/ }).first().click();

  // Day 1 is up next and nothing is done yet.
  await expect(page.getByText(/0\/\d+ days/).first()).toBeVisible();
  await expect(page.getByText('NEXT').first()).toBeVisible();

  // Run that day.
  page.once('dialog', (d) => void d.accept()); // unmatched-exercise notice, if any
  await page.getByRole('button', { name: /start day/i }).first().click();
  await expect(page).toHaveURL(/#\/workout/);
  await page.getByLabel(/^Set 1 reps$/).first().fill('5');
  await page.getByLabel(/^Set 1 mark complete$/).first().click();
  await page.getByRole('button', { name: /finish session/i }).click();
  await expect(page).toHaveURL(/#\/progress/);

  // The card now offers to continue, and the day is ticked off.
  await page.goto('/#/programs');
  await expect(page.getByText(/1\/\d+ done/).first()).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).first().click();
  await expect(page.getByText(/1\/\d+ days/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Repeat$/ }).first()).toBeVisible();
});

test('auto-fill only touches sets that are still to be done', async ({ page }) => {
  await freshApp(page);

  // Set a 1RM so auto-fill is available.
  await page.goto('/#/library');
  await page.getByPlaceholder(/search exercises/i).fill('Back Squat');
  await page.locator('button', { hasText: '1RM PR' }).first().click();
  await page.getByPlaceholder('e.g. 140').fill('100');
  await page.getByRole('button', { name: /save pr/i }).click();

  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Back Squat');
  await page.getByRole('button', { name: /^Back Squat/ }).first().click();
  await page.getByRole('button', { name: /add set/i }).click();

  // Log set 1 at 60 kg and mark it done.
  await page.getByLabel(/^Set 1 weight in kg$/).fill('60');
  await page.getByLabel(/^Set 1 reps$/).fill('5');
  await page.getByLabel(/^Set 1 mark complete$/).click();

  // Auto-fill at 80% — set 1 is already logged and must keep its 60 kg.
  await page.getByRole('button', { name: /auto-fill weight/i }).click();
  await page.getByRole('button', { name: /fill 1 remaining set/i }).click();

  await expect(page.getByLabel(/^Set 1 weight in kg$/)).toHaveValue('60');
  await expect(page.getByLabel(/^Set 2 weight in kg$/)).toHaveValue('80');
});

test('a session can be finished from logged sets that were never ticked', async ({ page }) => {
  await freshApp(page);
  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Back Squat');
  await page.getByRole('button', { name: /^Back Squat/ }).first().click();

  // An empty grid has nothing worth filing, and says so.
  await expect(page.getByRole('button', { name: /finish session/i })).toBeDisabled();
  await expect(page.getByText(/enter a weight or rep count/i)).toBeVisible();

  // Log the set but never tap the completion circle.
  await page.getByLabel(/^Set 1 weight in kg$/).fill('100');
  await page.getByLabel(/^Set 1 reps$/).fill('5');

  await expect(page.getByText(/enter a weight or rep count/i)).toHaveCount(0);
  await page.getByRole('button', { name: /finish session/i }).click();
  await expect(page).toHaveURL(/#\/progress/);

  // And the set really was saved.
  await page.goto('/#/history');
  await page.getByText(/Freestyle Session/).first().click();
  await expect(page.getByText(/Back Squat/).first()).toBeVisible();
});

test('auto macro targets follow a bodyweight change', async ({ page }) => {
  await freshApp(page);

  // Calibrate targets from body stats at 90 kg.
  await page.goto('/#/profile');
  await page.getByLabel(/^Age/i).fill('30');
  await page.getByLabel(/^Bodyweight/i).fill('90');
  await page.getByLabel(/^Height/i).fill('180');
  await page.getByRole('button', { name: /^male$/i }).click();

  await page.goto('/#/fuel');
  await page.getByRole('button', { name: /calibrate|targets|goals/i }).first().click();
  await page.getByRole('button', { name: /apply|save/i }).first().click();

  const kcalAt90 = await page.getByText(/\/\s*\d+\s*kcal/).first().innerText();

  // Drop 10 kg — the plan working is exactly when targets must move.
  await page.goto('/#/profile');
  await page.getByLabel(/^Bodyweight/i).fill('80');
  await page.getByLabel(/^Bodyweight/i).blur();

  await page.goto('/#/fuel');
  const kcalAt80 = await page.getByText(/\/\s*\d+\s*kcal/).first().innerText();
  expect(kcalAt80).not.toBe(kcalAt90);
});
