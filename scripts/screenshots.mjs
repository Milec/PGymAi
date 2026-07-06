import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.STRIDE_URL || 'http://127.0.0.1:5178';
const OUT = 'artifacts/screenshots';
mkdirSync(OUT, { recursive: true });

const routes = [
  ['dashboard', '/'],
  ['workout', '/workout'],
  ['library', '/library'],
  ['progress', '/progress'],
  ['strength', '/strength'],
  ['programs', '/programs'],
  ['profile', '/profile'],
];

const viewports = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
});

// Seed demo data once via the app's own loader, in a shared origin context.
async function seed(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const mod = await import('/src/dev/demoData.ts');
    await mod.loadDemoData();
    await mod.createDemoActiveSession();
  });
  await page.close();
}

for (const [label, vp] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  if (label === 'mobile') await seed(ctx);
  else {
    // desktop shares no storage with mobile ctx; seed again
    await seed(ctx);
  }
  for (const [name, route] of routes) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' });
    // let aurora/charts settle
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: label === 'desktop' });
    await page.close();
    console.log(`shot ${name}-${label}`);
  }
  await ctx.close();
}

await browser.close();
console.log('done');
