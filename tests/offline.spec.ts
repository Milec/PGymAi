import { expect, test } from '@playwright/test';

test('the built PWA works with the network cut', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /flight deck/i })).toBeVisible();
  // Wait for the service worker to take control and finish precaching.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20_000 });
  await page.waitForTimeout(2500);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /flight deck/i })).toBeVisible();

  // Every route must still render, and logging must still work offline.
  for (const r of ['/#/workout', '/#/library', '/#/fuel', '/#/history', '/#/profile']) {
    await page.goto(r);
    await page.waitForTimeout(400);
  }
  await page.goto('/#/workout');
  await page.getByRole('button', { name: /start freestyle/i }).click();
  await page.getByRole('button', { name: /add exercise/i }).click();
  await page.getByPlaceholder('Search…').fill('Push-Up');
  await page.getByRole('button', { name: /^Push-Up/ }).first().click();
  await page.getByLabel(/^Set 1 reps$/).fill('20');
  await page.getByRole('button', { name: /finish session/i }).click();
  await expect(page).toHaveURL(/#\/progress/);

  await page.goto('/#/history');
  await expect(page.getByText(/Freestyle Session/).first()).toBeVisible();
});
