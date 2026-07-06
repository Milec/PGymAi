import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const chrome = await launch({
  chromePath: '/opt/pw-browsers/chromium',
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const runner = await lighthouse('http://127.0.0.1:4190/', {
  port: chrome.port,
  output: 'json',
  logLevel: 'error',
  onlyCategories: ['performance', 'accessibility', 'best-practices'],
}).catch((e) => { console.error('LH error', e); return null; });

if (runner) {
  const c = runner.lhr.categories;
  for (const k of Object.keys(c)) {
    console.log(k.padEnd(16), Math.round((c[k].score ?? 0) * 100));
  }
  // installable / SW audits
  const a = runner.lhr.audits;
  const show = ['installable-manifest', 'service-worker', 'splash-screen', 'themed-omnibox', 'maskable-icon', 'viewport', 'content-width'];
  console.log('--- key PWA audits ---');
  for (const id of show) if (a[id]) console.log(id.padEnd(24), a[id].score, a[id].title);
}
await chrome.kill();
